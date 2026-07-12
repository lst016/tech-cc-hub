import {
  query,
  type EffortLevel,
  type HookCallbackMatcher,
  type PermissionResult,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
  type ThinkingConfig,
} from "@anthropic-ai/claude-agent-sdk";
import { execFileSync } from "child_process";
import { existsSync, statSync } from "fs";
import { basename, extname, isAbsolute, join } from "path";

import { buildRunnerPromptContentBlocks } from "../../../shared/runner-prompt.js";
import {
  isEmptySuccessfulRunnerResult,
  isSuccessfulRunnerResult,
  shouldSuppressRunnerErrorAfterSuccessfulResult,
} from "../../../shared/runner-status.js";
import {
  getVisibleTerminalResultText,
  hasAssistantTextActivity,
  updateAwaitingVisiblePostToolResponse,
} from "../../../shared/runner-result-visibility.js";
import { resolveStructuredOutputIntent } from "../../../shared/structured-output.js";
import { canMainModelReadImages } from "../../../shared/models/model-capabilities.js";
import {
  filterEnabledBuiltinMcpServerNames,
  type BuiltinMcpServerName,
} from "../../../shared/builtin-mcp-registry.js";
import {
  CLAUDE_AGENT_TEAMS_ENV_VAR,
  TASK_TOOL_NAMES,
  buildClaudeAgentTeamsDisallowedTools,
  resolveClaudeAgentTeamsEnv,
} from "../../../shared/claude-agent-teams.js";
import {
  createLearnCaptureHook,
  createQualityGateHook,
  createSecretScanHook,
  createGitBlastRadiusHook,
  createCommitValidateHook,
  createToolCallBudgetHook,
  createReadBeforeWriteHook,
} from "../learning/learning-hooks.js";
import {
  normalizeTaskCreateArgs,
  normalizeUpdatePlanArgs,
  type SessionPlanSource,
  type UpdatePlanArgs,
} from "../../../shared/plan-progress.js";
import type { AgentRunSurface, ApiConfig, PromptAttachment, RuntimeOverrides, ServerEvent } from "../../types.js";
import { resolveAgentRuntimeContext } from "../agent-resolver.js";
import {
  buildEnvForConfig,
  buildClaudeCodeModelSettings,
  getClaudeCodeExpertModel,
  getClaudeCodeModelOption,
  getClaudeCodePath,
  getCurrentApiConfig,
  getEnabledUsableApiConfigs,
  getGlobalRuntimeConfig,
  resolveApiConfigForModel,
} from "../claude/claude-settings.js";
import { buildClaudeProjectMemoryPromptAppend } from "../claude/claude-project-memory.js";
import { buildBetasForModel } from "../claude/claude-betas.js";
import { buildClaudeSandboxSettings } from "../claude/claude-sandbox-policy.js";
import { buildKnowledgeOverviewPromptAppend } from "../knowledge/knowledge-overview.js";
import { saveGlobalRuntimeConfig } from "../config-store.js";
import {
  getExternalMcpServers,
  isConfiguredExternalMcpTool,
} from "../external-mcp-servers.js";
import { buildEmulatorMcpServers } from "../emulator-installer/emulator-mcp-server.js";
import {
  isClaudeCodePluginMcpTool,
  listClaudeCodePluginMcpServerNames,
  resolveEnabledClaudeCodeSdkPlugins,
} from "../claude/claude-code-plugins.js";
import {
  FIGMA_REST_TOOL_NAMES,
  getFigmaOfficialPluginStatusFromConfig,
  isLikelyFigmaTokenFailureMessage,
} from "../figma-official-plugin.js";
import { summarizeBase64Image, summarizeLocalImageFile } from "../image/image-preprocessor.js";
import {
  getBuiltinMcpServers,
  listBuiltinMcpToolNames,
} from "../builtin-mcp-servers.js";
import { setImageGenerationSessionContext, toImageGenerationRouteConfig } from "../mcp-tools/image-generation.js";
import { normalizeRunnerError } from "./runner-error.js";
import {
  normalizeKnownToolInputsInMessage,
  normalizeToolInputForKnownSchemas,
} from "../tool-input-normalizer.js";
import {
  mergeRuntimeEfficiencyProfile,
  resolveRuntimeEfficiencyProfile,
  isExplicitDynamicWorkflowPrompt,
  runtimeEfficiencyProfileStateEquals,
  runtimeEfficiencyProfileToState,
} from "../runtime-efficiency.js";
import {
  applyStickyBuiltinMcpServersToProfile,
  isStatefulBuiltinMcpServerName,
} from "./sticky-mcp-servers.js";
import type { Session } from "../session-store.js";
import {
  getBashBackgroundServiceGuidance,
  normalizeWindowsBashCommand,
} from "../windows-bash-command.js";
import {
  buildAdminConfigPromptAppend,
  buildBrowserWorkbenchPromptAppend,
  buildBuiltinMcpRegistryPromptAppend,
  buildClaudeCodeCompatFeaturePromptAppend,
  buildDesignParityPromptAppend,
  buildFeishuDocumentFetchPromptAppend,
  buildGlobalRuntimeSystemPromptExtAppend,
  buildToolCallOptimizationPromptAppend,
} from "../system-prompt-presets.js";
import { buildInvokedLocalSlashDefinitionPromptAppend } from "../slash-command-catalog.js";
import {
  buildOversizedTextToolOutputReplacement,
  createTextToolOutputBlocks,
  buildToolImageReplacementText,
  extractInlineBase64ImageFromToolResponse,
} from "../tool-output-sanitizer.js";
import { getEnhancedEnv } from "../util.js";
import { buildClaudeCodeSystemPromptOption } from "../claude/claude-system-prompt.js";
import {
  normalizeLinkedWorkspaceContext,
  normalizeWorkspacePath,
  shellQuotePath,
  type LinkedWorkspaceContext,
} from "../../../shared/linked-workspaces.js";
import { isManagedCodeGraphInitialized } from "../codegraph/managed-codegraph.js";

export type RunnerOptions = {
  prompt: string;
  displayPrompt?: string;
  attachments?: PromptAttachment[];
  runtime?: RuntimeOverrides;
  session: Session;
  workspaceContext?: LinkedWorkspaceContext;
  resumeSessionId?: string;
  onEvent: (event: ServerEvent) => void;
  onSessionUpdate?: (updates: Partial<Session>) => void;
};

export type RunnerHandle = {
  abort: () => void;
  appendPrompt: (prompt: string, attachments?: PromptAttachment[], options?: { displayPrompt?: string; workspaceContext?: LinkedWorkspaceContext }) => Promise<void>;
  stopTask: (taskId: string) => Promise<void>;
  isClosed: () => boolean;
  reuseKey?: string;
};

type QueryWithMcpOAuth = Query & {
  mcpAuthenticate: (serverName: string, redirectUri?: string) => Promise<unknown>;
};

type StatefulMcpNotConnectedResult = {
  toolName: string;
  toolUseId: string;
};

const DEFAULT_CWD = process.cwd();
const BUILTIN_MCP_TOOL_NAMES = listBuiltinMcpToolNames();
const CLAUDE_CODE_AUTO_TRUNCATE_ARGS: Record<string, string | null> = {
  "allow-auto-truncate": null,
};
let claudeCodeAutoTruncateSupport: boolean | null = null;
const ALWAYS_ALLOWED_TOOLS = new Set([
  "AskUserQuestion",
  ...BUILTIN_MCP_TOOL_NAMES,
]);
const SKILL_ENV_HINTS: Record<string, string[]> = {
  feishu: ["FEISHU", "LARK"],
  "飞书": ["FEISHU", "LARK"],
  "figma官方": ["FIGMA"],
  lark: ["LARK", "FEISHU"],
  telegram: ["TELEGRAM"],
  figma: ["FIGMA"],
  notion: ["NOTION"],
  jira: ["JIRA"],
  slack: ["SLACK"],
  linear: ["LINEAR"],
  github: ["GITHUB", "GH_"],
  gitlab: ["GITLAB"],
};

const RASTER_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);
const MAX_IMAGE_READS_PER_RUN = 1;
const MAX_SINGLE_IMAGE_READ_BYTES = 400_000;
const MAX_RUNNER_STDERR_CHARS = 12_000;
const BLOCKED_SHELL_TOOL_NAMES = new Set(["mcp__windows__Powershell-Tool"]);
const BLOCKED_SHELL_TOOL_MESSAGE =
  "This Windows shell tool is disabled in tech-cc-hub because it can hang without returning a tool_result. Use Bash with cmd.exe instead, for example: cmd.exe /d /s /c \"<command>\".";
const KNOWLEDGE_INDEX_INTENT_PATTERN =
  /(?:knowledge[_\s-]*index|reindex|refresh\s+(?:knowledge|repo\s*wiki)|generate\s+(?:knowledge|repo\s*wiki)|update\s+(?:knowledge|repo\s*wiki)|(?:生成|重新生成|更新|刷新|重建|重跑|索引).{0,12}(?:知识库|知识|Repo\s*Wiki|repowiki)|(?:知识库|知识|Repo\s*Wiki|repowiki).{0,12}(?:生成|重新生成|更新|刷新|重建|重跑|索引))/i;
const FIGMA_GUIDE_AGENT_ID = "figma-official-mcp-guide";
const FIGMA_REST_TOOL_NAME_SET = new Set<string>(FIGMA_REST_TOOL_NAMES);
const FIGMA_OFFICIAL_MCP_SERVER_NAMES = new Set(["figma", "plugin_figma_figma"]);
const FIGMA_URL_PATTERN = /https?:\/\/(?:www\.)?figma\.com\/(?:design|file|proto|board|slides)\//i;
const FIGMA_IMPLEMENTATION_ANCHOR_TOOL_NAMES = new Set([
  "design_inspect_image",
]);
const FIGMA_SVG_ASSET_TOOL_NAMES = new Set([
  "figma_get_image_urls",
]);
const FILE_MUTATION_TOOL_NAMES = new Set(["Edit", "MultiEdit", "Write"]);

// SDK built-in cron tools are blocked in favor of tech-cc-hub MCP cron tools
// which provide persistent storage, execution history, and retry mechanism.
const SDK_BUILTIN_CRON_TOOLS = new Set(["CronCreate", "CronDelete", "CronList"]);
const CODEGRAPH_RETRIEVAL_TOOL_NAMES = new Set(["codegraph_search", "codegraph_context", "codegraph_impact"]);
const CODEGRAPH_WORKSPACE_TOOL_NAMES = new Set([
  "codegraph_status",
  "codegraph_sync",
  ...CODEGRAPH_RETRIEVAL_TOOL_NAMES,
]);
const BROAD_CODE_EXPLORATION_TOOL_NAMES = new Set(["Grep", "Glob", "Task", "Search"]);
const BASH_CODE_EXPLORATION_COMMAND_PATTERN =
  /(?:^|[;&|()\s])(?:rg|grep|find|fd|tree|findstr)(?:\.exe)?(?=\s|$)|\bgit\s+(?:grep|ls-files)\b|\b(?:Get-ChildItem|Select-String)\b/i;

function isSdkBuiltinCronTool(toolName: string): boolean {
  return SDK_BUILTIN_CRON_TOOLS.has(toolName);
}

function isKnowledgeIndexTool(toolName: string): boolean {
  return (
    toolName === "knowledge_index" ||
    toolName.endsWith("__knowledge_index") ||
    toolName.endsWith(":knowledge_index") ||
    toolName.endsWith("/knowledge_index")
  );
}

function getKnowledgeIndexDenyMessage(toolName: string, prompt: string): string | undefined {
  if (!isKnowledgeIndexTool(toolName) || KNOWLEDGE_INDEX_INTENT_PATTERN.test(prompt)) {
    return undefined;
  }

  return [
    "Legacy knowledge_index is disabled because RepoWiki/vector indexing has been removed.",
    "For code retrieval or questions about this repo, try mcp__tech-cc-hub-knowledge__codegraph_search or codegraph_context first when the managed index is available; otherwise fall back to focused source reads. If CodeGraph is slow, timed out, temporarily bypassed, or unavailable, fall back to focused source reads.",
  ].join(" ");
}

function isCodeGraphRetrievalTool(toolName: string): boolean {
  return Array.from(CODEGRAPH_RETRIEVAL_TOOL_NAMES).some((codegraphToolName) => (
    toolName === codegraphToolName ||
    toolName.endsWith(`__${codegraphToolName}`) ||
    toolName.endsWith(`:${codegraphToolName}`) ||
    toolName.endsWith(`/${codegraphToolName}`)
  ));
}

function isCodeGraphWorkspaceTool(toolName: string): boolean {
  return Array.from(CODEGRAPH_WORKSPACE_TOOL_NAMES).some((codegraphToolName) => (
    toolName === codegraphToolName ||
    toolName.endsWith(`__${codegraphToolName}`) ||
    toolName.endsWith(`:${codegraphToolName}`) ||
    toolName.endsWith(`/${codegraphToolName}`)
  ));
}

function getCodeGraphFirstDenyMessage(
  toolName: string,
  projectCwd: string | undefined,
  codeGraphRetrievalSeen: boolean,
  input?: unknown,
): string | undefined {
  if (!projectCwd || codeGraphRetrievalSeen || !isBroadCodeExplorationTool(toolName, input)) {
    return undefined;
  }
  if (!isManagedCodeGraphInitialized(projectCwd)) {
    return undefined;
  }

  return "Use mcp__tech-cc-hub-knowledge__codegraph_search or mcp__tech-cc-hub-knowledge__codegraph_context before broad source exploration when the managed index is available. If CodeGraph returns no useful result, an error, a timeout, a slow-machine bypass, or feels slow, fall back to focused Read/Grep/Glob instead of retrying CodeGraph.";
}

function isBroadCodeExplorationTool(toolName: string, input: unknown): boolean {
  if (BROAD_CODE_EXPLORATION_TOOL_NAMES.has(toolName)) {
    return true;
  }

  if (toolName === "Bash") {
    return isBroadCodeExplorationCommand(input);
  }

  return false;
}

function isBroadCodeExplorationCommand(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const command = typeof input.command === "string" ? input.command.trim() : "";
  return Boolean(command && BASH_CODE_EXPLORATION_COMMAND_PATTERN.test(command));
}

function normalizeRunnerWorkspaceContext(context: LinkedWorkspaceContext | undefined): LinkedWorkspaceContext | null {
  return normalizeLinkedWorkspaceContext({
    primaryCwd: context?.primaryCwd,
    linkedCwds: context?.linkedCwds,
  });
}

function isRelativeToolPath(filePath: string): boolean {
  const trimmed = filePath.trim();
  return Boolean(trimmed && !isAbsolute(trimmed) && !/^[a-zA-Z]:[\\/]/.test(trimmed));
}

function commandAlreadyRoutesWorkspace(command: string, workspacePath: string): boolean {
  const normalizedCommand = command.trim();
  const normalizedWorkspace = normalizeWorkspacePath(workspacePath);
  if (!normalizedCommand || !normalizedWorkspace) return true;
  if (normalizedCommand.includes(normalizedWorkspace)) return true;
  return /(?:^|[;&|]\s*)(?:cd|pushd)\s+/.test(normalizedCommand);
}

function promptTargetsLinkedWorkspace(prompt: string, workspacePath: string, linkedCount: number): boolean {
  const normalizedPrompt = prompt.toLowerCase();
  const normalizedPath = normalizeWorkspacePath(workspacePath).toLowerCase();
  const workspaceName = basename(normalizedPath).toLowerCase();
  if (!normalizedPrompt || !normalizedPath) return false;
  if (normalizedPrompt.includes(normalizedPath)) return true;
  if (workspaceName.length >= 3 && normalizedPrompt.includes(workspaceName)) return true;

  const nameTokens = workspaceName
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .filter((token) => token.length >= 3);
  if (nameTokens.some((token) => normalizedPrompt.includes(token))) return true;

  const backendPrompt = /(后端|服务端|backend|server|api)/i.test(prompt);
  const frontendPrompt = /(前端|客户端|frontend|front-end|web|ui)/i.test(prompt);
  if (backendPrompt && /(backend|server|api|service)/i.test(workspaceName)) return true;
  if (frontendPrompt && /(frontend|front-end|web|ui|client)/i.test(workspaceName)) return true;

  // 只有一个关联目录时，明确提到“关联/跨目录”就可以安全地指向它。
  return linkedCount === 1 && /(关联工作区|其他工作区|另一个工作区|跨目录|跨仓库|linked workspace)/i.test(prompt);
}

function resolveLinkedWorkspaceTarget(
  context: LinkedWorkspaceContext | null,
  prompt: string,
): string | null {
  if (!context) return null;
  for (const linkedCwd of context.linkedCwds) {
    if (promptTargetsLinkedWorkspace(prompt, linkedCwd, context.linkedCwds.length)) {
      return linkedCwd;
    }
  }
  return null;
}

function routeLinkedWorkspaceToolInput(
  toolName: string,
  input: Record<string, unknown>,
  options: {
    context: LinkedWorkspaceContext | null;
    prompt: string;
  },
): { input: Record<string, unknown>; routed: boolean; reason?: string } {
  const targetCwd = resolveLinkedWorkspaceTarget(options.context, options.prompt);
  if (!targetCwd) return { input, routed: false };

  const nextInput: Record<string, unknown> = { ...input };
  if (toolName === "Bash") {
    const command = typeof nextInput.command === "string" ? nextInput.command.trim() : "";
    if (!command || commandAlreadyRoutesWorkspace(command, targetCwd)) {
      return { input, routed: false };
    }
    nextInput.command = `cd ${shellQuotePath(targetCwd)} && ${command}`;
    return { input: nextInput, routed: true, reason: "Bash command routed to linked workspace" };
  }

  if (["Read", "Edit", "Write", "MultiEdit"].includes(toolName)) {
    const filePath = typeof nextInput.file_path === "string" ? nextInput.file_path.trim() : "";
    if (!isRelativeToolPath(filePath)) return { input, routed: false };
    nextInput.file_path = join(targetCwd, filePath);
    return { input: nextInput, routed: true, reason: `${toolName} file_path routed to linked workspace` };
  }

  if (["Glob", "Grep", "Search"].includes(toolName)) {
    const pathValue = typeof nextInput.path === "string" ? nextInput.path.trim() : "";
    if (!pathValue) {
      nextInput.path = targetCwd;
      return { input: nextInput, routed: true, reason: `${toolName} path routed to linked workspace` };
    }
    if (!isRelativeToolPath(pathValue)) return { input, routed: false };
    nextInput.path = join(targetCwd, pathValue);
    return { input: nextInput, routed: true, reason: `${toolName} relative path routed to linked workspace` };
  }

  if (isCodeGraphWorkspaceTool(toolName)) {
    const workspaceRoot = typeof nextInput.workspaceRoot === "string" ? nextInput.workspaceRoot.trim() : "";
    if (workspaceRoot) return { input, routed: false };
    nextInput.workspaceRoot = targetCwd;
    return { input: nextInput, routed: true, reason: "CodeGraph workspaceRoot routed to linked workspace" };
  }

  return { input, routed: false };
}

const POWERSHELL_COMMAND_PATTERN = /(^|[^\w.-])(powershell(?:\.exe)?|pwsh(?:\.exe)?)(?=$|[^\w.-])/i;
const LARGE_IMAGE_READ_GUIDANCE =
  "Image file is too large for direct Read into the main context. Use the built-in image/design MCP tools instead.";

const PLAN_OUTPUT_FORMAT_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          step: { type: "number" },
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["step", "title"],
      },
    },
  },
  required: ["steps"],
};

const MAX_EMPTY_SUCCESS_AUTO_RETRIES = 2;
const EMPTY_SUCCESS_RETRY_PROMPT =
  "Continue the task. The previous turn returned no assistant output and made no tool calls. Do not stop or return an empty result; resume from the last concrete step and keep executing.";

function buildVisibleAssistantMessage(sessionId: string, text: string, model?: string): SDKMessage {
  return {
    type: "assistant",
    message: {
      id: `fallback-${crypto.randomUUID()}`,
      type: "message",
      role: "assistant",
      model: model ?? "unknown",
      content: [{ type: "text", text }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
    parent_tool_use_id: null,
    uuid: crypto.randomUUID(),
    session_id: sessionId,
  } as SDKMessage;
}

function buildEmptySuccessFallbackMessage(sessionId: string, model?: string): SDKMessage {
  return buildVisibleAssistantMessage(sessionId, "本轮工具执行已完成，但模型没有返回文字说明。", model);
}

function getRequestedModelName(configModel: string | undefined, runtimeModel: string | undefined): string | undefined {
  const normalizedRuntimeModel = runtimeModel?.trim();
  if (normalizedRuntimeModel) {
    return normalizedRuntimeModel;
  }

  const normalizedConfigModel = configModel?.trim();
  return normalizedConfigModel || undefined;
}

function appendBoundedText(current: string, chunk: string, maxChars: number): string {
  const next = `${current}${chunk}`;
  return next.length > maxChars ? next.slice(-maxChars) : next;
}

export async function runClaude(options: RunnerOptions): Promise<RunnerHandle> {
  const { prompt, displayPrompt = prompt, attachments = [], runtime, session, workspaceContext, resumeSessionId, onEvent, onSessionUpdate } = options;
  const abortController = new AbortController();
  const permissionMode = runtime?.permissionMode ?? "bypassPermissions";
  const promptInput = new PromptInputQueue();
  promptInput.enqueue(prompt, attachments);
  let activeQuery: Query | null = null;
  let runnerClosed = false;
  let rasterImageReads = 0;
  let requestedModelForError: string | undefined;
  let emittedSuccessfulResult = false;
  let emittedTerminalStatus = false;
  let observedAssistantTextActivity = false;
  let awaitingVisiblePostToolResponse = false;
  let emptySuccessAutoRetries = 0;
  let figmaRestAuthFailureSeen = false;
  let figmaImplementationAnchorSeen = false;
  let figmaSvgAssetSeen = false;
  let codeGraphRetrievalSeen = false;
  let latestGlobalRuntimeConfig: unknown = null;
  let currentDisplayPrompt = displayPrompt;
  let figmaContextSeen = hasFigmaContext(currentDisplayPrompt, session.lastPrompt);
  let latestWorkspaceContext = normalizeRunnerWorkspaceContext(workspaceContext);
  let requiresFigmaImplementationAnchor = shouldRequireFigmaImplementationAnchor(currentDisplayPrompt);
  let requiresFigmaSvgAsset = shouldRequireFigmaSvgAsset(currentDisplayPrompt);
  const desiredBuiltinMcpServerNames = new Set<BuiltinMcpServerName>();
  let activeBuiltinMcpServerNames = new Set<BuiltinMcpServerName>();
  let latestFigmaToolMode: "core" | "full" = "full";
  let latestProjectCwd: string | undefined;
  let selectedImageGenerationConfig: ApiConfig | null = null;
  let latestRunSurface: AgentRunSurface = runtime?.runSurface ?? session.runSurface ?? "development";
  let recentClaudeStderr = "";
  const toolUseNamesById = new Map<string, string>();
  let statefulMcpRefresh: Promise<void> | null = null;
  const appendClaudeProcessStderr = (chunk: string) => {
    recentClaudeStderr = appendBoundedText(recentClaudeStderr, chunk, MAX_RUNNER_STDERR_CHARS);
  };

  const sendMessage = (message: SDKMessage) => {
    onEvent({
      type: "stream.message",
      payload: { sessionId: session.id, message },
    });
  };

  const sendPermissionRequest = (toolUseId: string, toolName: string, input: unknown) => {
    onEvent({
      type: "permission.request",
      payload: { sessionId: session.id, toolUseId, toolName, input },
    });
  };

  const requestPermissionDecision = (toolName: string, input: unknown, signal?: AbortSignal) => {
    const toolUseId = crypto.randomUUID();

    sendPermissionRequest(toolUseId, toolName, input);

    return new Promise<PermissionResult>((resolve) => {
      session.pendingPermissions.set(toolUseId, {
        toolUseId,
        toolName,
        input,
        resolve: (result) => {
          session.pendingPermissions.delete(toolUseId);
          resolve(result as PermissionResult);
        },
      });

      signal?.addEventListener("abort", () => {
        session.pendingPermissions.delete(toolUseId);
        resolve({ behavior: "deny", message: "Session aborted" });
      }, { once: true });
    });
  };

  const collectRuntimeProfileForPrompt = (
    nextPrompt: string,
    nextAttachments: readonly PromptAttachment[],
  ) => {
    const previousDesiredBuiltinMcpServerNames = new Set(desiredBuiltinMcpServerNames);
    const profile = applyStickyBuiltinMcpServersToProfile(mergeRuntimeEfficiencyProfile(resolveRuntimeEfficiencyProfile({
      prompt: nextPrompt,
      attachments: nextAttachments,
      runtime,
      runSurface: latestRunSurface,
    }), session.runtimeProfileState), [
      activeBuiltinMcpServerNames,
      previousDesiredBuiltinMcpServerNames,
    ]);
    const nextProfileState = runtimeEfficiencyProfileToState(profile);
    if (!runtimeEfficiencyProfileStateEquals(session.runtimeProfileState, nextProfileState)) {
      session.runtimeProfileState = nextProfileState;
      onSessionUpdate?.({ runtimeProfileState: nextProfileState });
    }
    latestFigmaToolMode = "full";
    desiredBuiltinMcpServerNames.clear();
    for (const serverName of profile.builtinMcpServers) {
      desiredBuiltinMcpServerNames.add(serverName);
    }
    return profile;
  };

  const resolveUserEnabledBuiltinMcpServers = (
    serverNames: readonly BuiltinMcpServerName[],
    config: unknown = getGlobalRuntimeConfig(),
  ): BuiltinMcpServerName[] => filterEnabledBuiltinMcpServerNames(serverNames, config);

  const syncImageGenerationSessionContext = (enabledBuiltinMcpServerNames: readonly BuiltinMcpServerName[]): void => {
    if (!enabledBuiltinMcpServerNames.includes("tech-cc-hub-image")) {
      setImageGenerationSessionContext(null);
      return;
    }

    const enabledConfigs = getEnabledUsableApiConfigs()
      .map((cfg) => toImageGenerationRouteConfig(cfg))
      .filter((cfg): cfg is NonNullable<ReturnType<typeof toImageGenerationRouteConfig>> => Boolean(cfg));
    setImageGenerationSessionContext({
      sessionId: session.id,
      cwd: latestProjectCwd,
      selectedConfig: toImageGenerationRouteConfig(selectedImageGenerationConfig),
      enabledConfigs,
    });
  };

  const ensureMcpServersForPrompt = async (
    nextPrompt: string,
    nextAttachments: readonly PromptAttachment[],
  ): Promise<void> => {
    const profile = collectRuntimeProfileForPrompt(nextPrompt, nextAttachments);
    if (!activeQuery) {
      return;
    }

    const enabledBuiltinMcpServerNames = resolveUserEnabledBuiltinMcpServers(profile.builtinMcpServers);
    const nextBuiltinMcpServerNames = new Set(enabledBuiltinMcpServerNames);
    if (builtinMcpServerSetsEqual(activeBuiltinMcpServerNames, nextBuiltinMcpServerNames)) {
      return;
    }

    syncImageGenerationSessionContext(enabledBuiltinMcpServerNames);
    const result = await activeQuery.setMcpServers({
      ...getExternalMcpServers(latestGlobalRuntimeConfig ?? getGlobalRuntimeConfig(), { projectDir: latestProjectCwd }),
      ...getBuiltinMcpServers({
        sessionId: session.id,
        cwd: latestProjectCwd,
        figmaToolMode: latestFigmaToolMode,
      }, enabledBuiltinMcpServerNames),
    });
    activeBuiltinMcpServerNames = nextBuiltinMcpServerNames;
    console.info("[runner][mcp-expanded]", {
      sessionId: session.id,
      builtinMcpServersChanged: true,
      builtinMcpServers: enabledBuiltinMcpServerNames,
      result,
    });
  };

  const buildMcpServersForBuiltinNames = (enabledBuiltinMcpServerNames: readonly BuiltinMcpServerName[]) => ({
    ...getExternalMcpServers(latestGlobalRuntimeConfig ?? getGlobalRuntimeConfig(), { projectDir: latestProjectCwd }),
    ...getBuiltinMcpServers({
      sessionId: session.id,
      cwd: latestProjectCwd,
      figmaToolMode: latestFigmaToolMode,
    }, enabledBuiltinMcpServerNames),
  });

  const refreshStatefulMcpServers = async (reason: StatefulMcpNotConnectedResult): Promise<void> => {
    const queryForRefresh = activeQuery;
    if (!queryForRefresh) {
      return;
    }

    const enabledBuiltinMcpServerNames = [...activeBuiltinMcpServerNames];
    if (!enabledBuiltinMcpServerNames.some(isStatefulBuiltinMcpServerName)) {
      return;
    }

    if (statefulMcpRefresh) {
      await statefulMcpRefresh;
      return;
    }

    statefulMcpRefresh = (async () => {
      const withoutStatefulServers = enabledBuiltinMcpServerNames.filter((serverName) => !isStatefulBuiltinMcpServerName(serverName));
      console.warn("[runner][stateful-mcp-reattach-start]", {
        sessionId: session.id,
        toolName: reason.toolName,
        toolUseId: reason.toolUseId,
        enabledBuiltinMcpServers: enabledBuiltinMcpServerNames,
      });

      try {
        await queryForRefresh.setMcpServers(buildMcpServersForBuiltinNames(withoutStatefulServers));
        const result = await queryForRefresh.setMcpServers(buildMcpServersForBuiltinNames(enabledBuiltinMcpServerNames));
        console.warn("[runner][stateful-mcp-reattach-complete]", {
          sessionId: session.id,
          toolName: reason.toolName,
          toolUseId: reason.toolUseId,
          result,
        });
      } catch (error) {
        console.warn("[runner][stateful-mcp-reattach-failed]", {
          sessionId: session.id,
          toolName: reason.toolName,
          toolUseId: reason.toolUseId,
          error,
        });
      } finally {
        statefulMcpRefresh = null;
      }
    })();

    await statefulMcpRefresh;
  };

  const sendPlanUpdate = (
    args: UpdatePlanArgs,
    source: SessionPlanSource,
    toolName?: string,
    toolUseId?: string,
    turnId?: string,
  ) => {
    onEvent({
      type: "session.plan.updated",
      payload: {
        sessionId: session.id,
        turnId,
        updatedAt: Date.now(),
        source,
        toolName,
        toolUseId,
        ...args,
      },
    });
  };

  const extractPlanUpdateFromMessage = (message: SDKMessage) => {
    if (message.type !== "assistant") return;
    const content = (message as { message?: { content?: unknown[] }; uuid?: string }).message?.content;
    if (!Array.isArray(content)) return;

    for (const item of content) {
      if (!isRecord(item) || item.type !== "tool_use") continue;
      const toolName = typeof item.name === "string" ? item.name : "";
      const toolUseId = typeof item.id === "string" ? item.id : undefined;
      const turnId = typeof (message as { uuid?: unknown }).uuid === "string"
        ? (message as { uuid: string }).uuid
        : undefined;

      if (toolName === "update_plan" || toolName.endsWith("__update_plan") || toolName.endsWith(":update_plan") || toolName.endsWith("/update_plan")) {
        const args = normalizeUpdatePlanArgs(item.input);
        if (args) sendPlanUpdate(args, "update_plan", toolName, toolUseId, turnId);
        continue;
      }

      if ((TASK_TOOL_NAMES as readonly string[]).includes(toolName)) {
        const input = toolName === "TaskUpdate"
          ? { item: item.input }
          : item.input;
        const args = normalizeTaskCreateArgs(input);
        if (args) sendPlanUpdate(args, "task_create", toolName, toolUseId, turnId);
      }
    }
  };

  void (async () => {
    try {
      const defaultConfig = getCurrentApiConfig();

      if (!defaultConfig) {
        onEvent({
          type: "session.status",
          payload: {
            sessionId: session.id,
            status: "error",
            title: session.title,
            cwd: session.cwd,
            error: "API configuration not found. Please configure API settings.",
          },
        });
        return;
      }

      const requestedModel = getRequestedModelName(defaultConfig.model, runtime?.model);
      const resolvedConfig = resolveApiConfigForModel(requestedModel);
      if (!resolvedConfig) {
        const errorMessage = `Requested model "${requestedModel ?? ""}" is not available in the enabled API profiles. Enable a profile that supports this model first.`;
        onEvent({
          type: "runner.error",
          payload: {
            sessionId: session.id,
            message: errorMessage,
          },
        });
        onEvent({
          type: "session.status",
          payload: {
            sessionId: session.id,
            status: "error",
            title: session.title,
            cwd: session.cwd,
            error: errorMessage,
          },
        });
        return;
      }

      const { config } = resolvedConfig;
      selectedImageGenerationConfig = config;
      const effectiveModel = resolvedConfig.model;
      requestedModelForError = effectiveModel;

      const env = buildEnvForConfig(config, effectiveModel);
      const globalRuntimeConfig = getGlobalRuntimeConfig();
      const thinking = buildThinkingConfig(runtime?.reasoningMode);
      const projectCwd = session.cwd && existsSync(session.cwd) ? session.cwd : undefined;
      latestProjectCwd = projectCwd;
      const resolvedCwd = projectCwd ?? DEFAULT_CWD;
      const runSurface = runtime?.runSurface ?? session.runSurface ?? "development";
      latestRunSurface = runSurface;
      const agentId = runtime?.agentId ?? session.agentId;
      const runtimeProfile = collectRuntimeProfileForPrompt(prompt, attachments);
      const mergedEnv = resolveClaudeAgentTeamsEnv({
        ...getEnhancedEnv(),
        ...env,
      }, runtimeProfile.enableAgentTeams);
      const effort = buildEffortLevel(runtime?.reasoningMode, mergedEnv);
      let syncedGlobalRuntimeConfig = persistDiscoveredRuntimeConfig(globalRuntimeConfig, mergedEnv);
      latestGlobalRuntimeConfig = syncedGlobalRuntimeConfig;
      const agentContext = resolveAgentRuntimeContext({
        cwd: projectCwd,
        surface: runSurface,
        agentId,
      });
      const effectiveAllowedTools = buildEffectiveAllowedToolSet(
        session.allowedTools,
        agentContext.allowedTools,
        agentContext.enforceAllowedTools,
      );
      const enabledSkills = agentContext.skills.length > 0
        ? agentContext.skills
        : undefined;
      const hooks = buildQualityHooks(resolvedCwd, {
        config,
        mainModelName: effectiveModel,
        getPrompt: () => currentDisplayPrompt,
        projectCwd,
        sessionId: session.id,
        isCodeGraphRetrievalSeen: () => codeGraphRetrievalSeen,
        onCodeGraphRetrieval: () => {
          codeGraphRetrievalSeen = true;
        },
        onFigmaRestAuthFailure: () => {
          figmaRestAuthFailureSeen = true;
        },
        onFigmaImplementationAnchor: () => {
          figmaImplementationAnchorSeen = true;
          figmaContextSeen = true;
        },
        onFigmaContext: () => {
          figmaContextSeen = true;
        },
        onFigmaSvgAsset: () => {
          figmaSvgAssetSeen = true;
        },
      });
      const enabledBuiltinMcpServerNames = resolveUserEnabledBuiltinMcpServers(
        [...desiredBuiltinMcpServerNames],
        syncedGlobalRuntimeConfig,
      );
      const enabledBuiltinMcpServerSet = new Set(enabledBuiltinMcpServerNames);
      activeBuiltinMcpServerNames = new Set(enabledBuiltinMcpServerNames);
      const builtinMcpServers = getBuiltinMcpServers({
        sessionId: session.id,
        cwd: projectCwd,
        figmaToolMode: latestFigmaToolMode,
      }, enabledBuiltinMcpServerNames);
      // 生图工具会话上下文注入：让 image_generate 能解析路由、落盘到 sessionId 目录。
      syncImageGenerationSessionContext(enabledBuiltinMcpServerNames);
      // Phase 8: device-emulator-plugin MCP injection. Empty object when
      // @mobilenext/mobile-mcp is not yet installed, so the SDK map is
      // untouched and the session is unaffected.
      const emulatorMcpServers = await buildEmulatorMcpServers();
      const sdkPlugins = resolveEnabledClaudeCodeSdkPlugins();
      const sdkPluginMcpServerNames = listClaudeCodePluginMcpServerNames(sdkPlugins);
      const systemPromptAppend = combineSystemPromptAppend(
        buildGlobalRuntimePromptAppend(syncedGlobalRuntimeConfig, mergedEnv),
        buildFeishuDocumentFetchPromptAppend(currentDisplayPrompt, mergedEnv),
        enabledBuiltinMcpServerSet.has("tech-cc-hub-admin") ? buildAdminConfigPromptAppend() : undefined,
        buildInvokedLocalSlashDefinitionPromptAppend(currentDisplayPrompt, projectCwd),
        agentContext.systemPromptAppend,
        runtimeProfile.includeProjectMemoryPrompt ? buildClaudeProjectMemoryPromptAppend(projectCwd) : undefined,
        enabledBuiltinMcpServerSet.has("tech-cc-hub-knowledge") ? buildKnowledgeOverviewPromptAppend(projectCwd) : undefined,
        buildToolCallOptimizationPromptAppend(),
        runtimeProfile.includeBrowserPrompt && enabledBuiltinMcpServerSet.has("tech-cc-hub-browser") ? buildBrowserWorkbenchPromptAppend() : undefined,
        runtimeProfile.includeDesignPrompt && enabledBuiltinMcpServerSet.has("tech-cc-hub-design") ? buildDesignParityPromptAppend() : undefined,
        buildBuiltinMcpRegistryPromptAppend(enabledBuiltinMcpServerNames),
        runtimeProfile.includeClaudeCompatPrompt ? buildClaudeCodeCompatFeaturePromptAppend({
          includeAgentTeamsHint: runtimeProfile.enableAgentTeams,
        }) : undefined,
      );
      const structuredOutputIntent = resolveStructuredOutputIntent(runtime?.outputFormat, currentDisplayPrompt);
      const outputFormat = structuredOutputIntent === "none"
        ? undefined
        : { type: "json_schema" as const, schema: PLAN_OUTPUT_FORMAT_SCHEMA };
      const sdkModelOption = getClaudeCodeModelOption(config, effectiveModel);
      const dynamicWorkflowSettings = buildClaudeDynamicWorkflowSettings(currentDisplayPrompt, runtime?.reasoningMode, runtime?.workflowMode);
      const sdkModelSettings = {
        ...buildClaudeCodeModelSettings(config, effectiveModel),
        ...dynamicWorkflowSettings,
      };
      const agentTeamsDisallowedTools = buildClaudeAgentTeamsDisallowedTools(runtimeProfile.enableAgentTeams);
      const sdkExpertModel = getClaudeCodeExpertModel(config, effectiveModel);
      console.info("[runner][route]", {
        sessionId: session.id,
        configProfileId: config.id,
        configProfileName: config.name,
        configProvider: config.provider,
        configuredBaseURL: config.baseURL,
        anthropicBaseURL: mergedEnv.ANTHROPIC_BASE_URL,
        settingsEnvBaseURL: sdkModelSettings.env?.ANTHROPIC_BASE_URL,
        requestedModel,
        model: effectiveModel,
        modelFallback: resolvedConfig.fellBack,
        sdkModelOption,
        sdkExpertModel,
        settingSources: agentContext.settingSources,
        claudePath: getClaudeCodePath(),
        sdkPlugins: sdkPlugins.map((plugin) => plugin.path),
        agentTeamsEnabled: mergedEnv[CLAUDE_AGENT_TEAMS_ENV_VAR] === "1",
        dynamicWorkflowsEnabled: dynamicWorkflowSettings.enableWorkflows === true && dynamicWorkflowSettings.disableWorkflows !== true,
        ultracodeEnabled: dynamicWorkflowSettings.ultracode === true,
        runtimeProfile: runtimeProfile.id,
        builtinMcpServers: enabledBuiltinMcpServerNames,
        structuredOutputIntent,
      });

      const q = query({
        prompt: promptInput,
        options: {
          model: sdkModelOption,
          betas: buildBetasForModel(effectiveModel),
          cwd: resolvedCwd,
          additionalDirectories: latestWorkspaceContext?.linkedCwds?.length
            ? latestWorkspaceContext.linkedCwds
            : undefined,
          resume: resumeSessionId,
          abortController,
          env: mergedEnv,
          extraArgs: getClaudeCodeExtraArgs(),
          thinking,
          effort,
          stderr: appendClaudeProcessStderr,
          pathToClaudeCodeExecutable: getClaudeCodePath(),
          permissionMode,
          settingSources: agentContext.settingSources,
          settings: sdkModelSettings,
          sandbox: buildClaudeSandboxSettings({
            enabled: permissionMode !== "bypassPermissions",
            workspaceRoot: resolvedCwd,
          }),
          ...(enabledSkills ? { skills: enabledSkills } : {}),
          systemPrompt: buildClaudeCodeSystemPromptOption(systemPromptAppend),
          includePartialMessages: runtimeProfile.includePartialMessages,
          includeHookEvents: runtimeProfile.includeHookEvents,
          agentProgressSummaries: runtimeProfile.agentProgressSummaries,
          forwardSubagentText: runtimeProfile.forwardSubagentText,
          outputFormat,
          plugins: sdkPlugins.length > 0 ? sdkPlugins : undefined,
          mcpServers: {
            ...emulatorMcpServers,
            ...getExternalMcpServers(syncedGlobalRuntimeConfig, { projectDir: projectCwd }),
            ...builtinMcpServers,
          },
          hooks,
          disallowedTools: agentTeamsDisallowedTools,
          allowDangerouslySkipPermissions: permissionMode === "bypassPermissions",
          canUseTool: async (toolName, input, { signal }) => {
            const schemaNormalization = isRecord(input)
              ? normalizeToolInputForKnownSchemas(toolName, input)
              : { input: input as Record<string, unknown>, fixes: [], mutated: false };
            let effectiveInput: Record<string, unknown> = schemaNormalization.mutated ? schemaNormalization.input : input;
            if (schemaNormalization.mutated) {
              console.info("[runner][tool-input-normalized]", {
                sessionId: session.id,
                toolName,
                fixes: schemaNormalization.fixes,
              });
            }
            const linkedWorkspaceRoute = routeLinkedWorkspaceToolInput(toolName, effectiveInput, {
              context: latestWorkspaceContext,
              prompt: currentDisplayPrompt,
            });
            if (linkedWorkspaceRoute.routed) {
              effectiveInput = linkedWorkspaceRoute.input;
              console.info("[runner][linked-workspace-routed]", {
                sessionId: session.id,
                toolName,
                reason: linkedWorkspaceRoute.reason,
              });
            }
            if (isCodeGraphRetrievalTool(toolName)) {
              codeGraphRetrievalSeen = true;
            }

            const denyGuards: Array<() => { behavior: "deny"; message: string } | null> = [
              () => isBlockedShellTool(toolName)
                ? { behavior: "deny", message: BLOCKED_SHELL_TOOL_MESSAGE }
                : null,
              () => shouldDenyPowerShellCommand(toolName, effectiveInput)
                ? { behavior: "deny", message: "PowerShell is disabled by tech-cc-hub's Windows shell policy because it is unstable in this environment. Use cmd.exe instead, for example: cmd.exe /d /s /c \"<command>\"." }
                : null,
              () => isSdkBuiltinCronTool(toolName)
                ? { behavior: "deny", message: "SDK CronCreate/CronDelete/CronList are disabled. Use the tech-cc-hub cron MCP tools so schedules are persisted with history and retry metadata." }
                : null,
              () => {
                const message = getKnowledgeIndexDenyMessage(toolName, currentDisplayPrompt);
                return message ? { behavior: "deny", message } : null;
              },
              () => {
                if (!activeBuiltinMcpServerNames.has("tech-cc-hub-knowledge")) {
                  return null;
                }
                const message = getCodeGraphFirstDenyMessage(
                  toolName,
                  projectCwd,
                  codeGraphRetrievalSeen,
                  effectiveInput,
                );
                return message ? { behavior: "deny", message } : null;
              },
              () => {
                const message = getFigmaImplementationAnchorDenyMessage(
                  toolName, requiresFigmaImplementationAnchor, figmaImplementationAnchorSeen,
                );
                return message ? { behavior: "deny", message } : null;
              },
              () => {
                const message = getFigmaSvgAssetDenyMessage(
                  toolName, effectiveInput, requiresFigmaSvgAsset, figmaContextSeen, figmaSvgAssetSeen,
                );
                return message ? { behavior: "deny", message } : null;
              },
              () => {
                const message = getFigmaOfficialRouteDenyMessage(
                  toolName, syncedGlobalRuntimeConfig, figmaRestAuthFailureSeen,
                );
                return message ? { behavior: "deny", message } : null;
              },
              () => permissionMode === "plan"
                ? { behavior: "deny", message: "Current run is in plan mode; tools will not be executed." }
                : null,
              () => toolName === "Skill" && shouldDenyExternalBrowseSkill(effectiveInput, currentDisplayPrompt)
                ? { behavior: "deny", message: "This task is testing the built-in tech-cc-hub browser workbench. Use tech-cc-hub browser MCP tools instead of the external browse skill." }
                : null,
              () => {
                const message = getAuthenticatedUrlWebFetchDenyMessage(
                  toolName,
                  effectiveInput,
                  activeBuiltinMcpServerNames.has("tech-cc-hub-browser"),
                  currentDisplayPrompt,
                );
                return message ? { behavior: "deny", message } : null;
              },
            ];

            for (const guard of denyGuards) {
              const result = guard();
              if (result) return result;
            }

            if (toolName === "AskUserQuestion") {
              return requestPermissionDecision(toolName, effectiveInput, signal);
            }

            if (toolName === "Skill" && isRecord(effectiveInput)) {
              const requestedSkill = typeof effectiveInput.skill === "string" ? effectiveInput.skill.trim() : "";
              if (requestedSkill) {
                syncedGlobalRuntimeConfig = persistDiscoveredRuntimeConfig(
                  syncedGlobalRuntimeConfig,
                  mergedEnv,
                  requestedSkill,
                );
                latestGlobalRuntimeConfig = syncedGlobalRuntimeConfig;
              }
            }

            if (toolName === "Read" && isRecord(effectiveInput)) {
              const filePath = typeof effectiveInput.file_path === "string" ? effectiveInput.file_path.trim() : "";
              if (!canMainModelReadImages(effectiveModel) && !shouldPreprocessImageRead(config, filePath, effectiveModel)) {
                const imageReadCheck = checkRasterImageRead(filePath, rasterImageReads);
                if (imageReadCheck.denyMessage) {
                  return {
                    behavior: "deny",
                    message: imageReadCheck.denyMessage,
                  };
                }
                if (imageReadCheck.countRead) {
                  rasterImageReads += 1;
                }
              }
            }

            if (
              effectiveAllowedTools &&
              !effectiveAllowedTools.has(toolName) &&
              !isAlwaysAllowedTool(toolName, syncedGlobalRuntimeConfig) &&
              !isClaudeCodePluginMcpTool(toolName, sdkPluginMcpServerNames)
            ) {
              return {
                behavior: "deny",
                message: `Current run surface does not allow tool: ${toolName}`,
              };
            }

            return { behavior: "allow", updatedInput: effectiveInput };
          },
        },
      });
      activeQuery = q;

      await maybeRunFigmaGuideOAuth(q, {
        agentId,
        abortSignal: abortController.signal,
        requestPermissionDecision,
      });

      for await (const rawMessage of q) {
        const message = normalizeKnownToolInputsInMessage(rawMessage);
        if (hasAssistantTextActivity(message)) {
          observedAssistantTextActivity = true;
        }
        awaitingVisiblePostToolResponse = updateAwaitingVisiblePostToolResponse(
          awaitingVisiblePostToolResponse,
          message,
        );
        recordToolUseNamesFromMessage(message, toolUseNamesById);
        if (message.type === "system" && "subtype" in message && message.subtype === "init") {
          const sdkSessionId = message.session_id;
          if (sdkSessionId) {
            session.claudeSessionId = sdkSessionId;
            onSessionUpdate?.({ claudeSessionId: sdkSessionId });
          }
        }

        if (message.type === "system" && "subtype" in message && message.subtype === "memory_recall") {
          const memoryMsg = message as Record<string, unknown>;
          const mode = typeof memoryMsg.mode === "string" ? memoryMsg.mode : "unknown";
          const memories = Array.isArray(memoryMsg.memories) ? memoryMsg.memories : [];
          console.info("[runner][memory-recall]", {
            sessionId: session.id,
            mode,
            count: memories.length,
          });
        }

        if (message.type === "result") {
          const resultMeta = message as Record<string, unknown>;
          const origin = typeof resultMeta.origin === "string" ? resultMeta.origin : undefined;
          const stopReason = typeof resultMeta.stop_reason === "string" ? resultMeta.stop_reason : undefined;
          if (origin || stopReason === "refusal") {
            console.info("[runner][result]", {
              sessionId: session.id,
              origin,
              stopReason,
            });
          }
          if (stopReason === "refusal") {
            const refusalMessage = normalizeRunnerError(
              "stop_reason: refusal",
              requestedModelForError ?? getRequestedModelName(getCurrentApiConfig()?.model, runtime?.model),
              latestGlobalRuntimeConfig,
              { processStderr: recentClaudeStderr },
            );
            onEvent({
              type: "runner.error",
              payload: {
                sessionId: session.id,
                message: refusalMessage,
              },
            });
          }
          const emptySuccess = isEmptySuccessfulRunnerResult(message, observedAssistantTextActivity);
          if (emptySuccess && emptySuccessAutoRetries < MAX_EMPTY_SUCCESS_AUTO_RETRIES) {
            emptySuccessAutoRetries += 1;
            observedAssistantTextActivity = false;
            console.warn("[runner][empty-success-auto-retry]", {
              sessionId: session.id,
              retry: emptySuccessAutoRetries,
              maxRetries: MAX_EMPTY_SUCCESS_AUTO_RETRIES,
            });
            promptInput.enqueue(EMPTY_SUCCESS_RETRY_PROMPT, []);
            continue;
          }

          const status = message.subtype === "success" && !emptySuccess ? "completed" : "error";
          if (!emptySuccess && typeof activeQuery?.getContextUsage === "function") {
            try {
              const usage = await activeQuery.getContextUsage();
              onEvent({
                type: "stream.message",
                payload: {
                  sessionId: session.id,
                  message: {
                    type: "context_usage",
                    usage,
                    capturedAt: Date.now(),
                  },
                },
              });
            } catch (error) {
              console.warn("[runner][context-usage] failed", error instanceof Error ? error.message : String(error));
            }
          }
          if (emptySuccess) {
            sendMessage(buildEmptySuccessFallbackMessage(session.id, requestedModelForError));
          }
          const visibleResultText = getVisibleTerminalResultText(message, awaitingVisiblePostToolResponse);
          if (visibleResultText) {
            sendMessage(buildVisibleAssistantMessage(session.id, visibleResultText, requestedModelForError));
            awaitingVisiblePostToolResponse = false;
          }
          sendMessage(message);
          onEvent({
            type: "session.status",
            payload: {
              sessionId: session.id,
              status,
              title: session.title,
              error: emptySuccess
                ? "Runner returned an empty success without assistant text output."
                : undefined,
            },
          });
          emittedTerminalStatus = true;
          if (isSuccessfulRunnerResult(message) && !emptySuccess) {
            emittedSuccessfulResult = true;
          } else {
            promptInput.close();
            q.close();
          }
          continue;
        }

        sendMessage(message);
        extractPlanUpdateFromMessage(message);
        const statefulNotConnectedResult = findStatefulMcpNotConnectedResult(message, toolUseNamesById);
        if (statefulNotConnectedResult) {
          await refreshStatefulMcpServers(statefulNotConnectedResult);
        }
      }

      if (!emittedTerminalStatus && !runnerClosed) {
        const errorMessage = "Runner ended without a result message.";
        onEvent({
          type: "runner.error",
          payload: {
            sessionId: session.id,
            message: errorMessage,
          },
        });
        onEvent({
          type: "session.status",
          payload: { sessionId: session.id, status: "error", title: session.title, error: errorMessage },
        });
      }
      activeQuery = null;
      runnerClosed = true;
      promptInput.close();
    } catch (error) {
      activeQuery = null;
      runnerClosed = true;
      promptInput.close();
      if ((error as Error).name === "AbortError") {
        return;
      }

      const errorMessage = normalizeRunnerError(
        error,
        requestedModelForError ?? getRequestedModelName(getCurrentApiConfig()?.model, runtime?.model),
        latestGlobalRuntimeConfig,
        { processStderr: recentClaudeStderr },
      );

      if (shouldSuppressRunnerErrorAfterSuccessfulResult(emittedSuccessfulResult)) {
        console.warn("[runner] Ignoring late runner error after successful result:", errorMessage);
        onEvent({
          type: "session.status",
          payload: { sessionId: session.id, status: "completed", title: session.title },
        });
        return;
      }

      onEvent({
        type: "runner.error",
        payload: {
          sessionId: session.id,
          message: errorMessage,
        },
      });

      onEvent({
        type: "session.status",
        payload: { sessionId: session.id, status: "error", title: session.title, error: errorMessage },
      });
    }
  })();

  return {
    abort: () => {
      runnerClosed = true;
      promptInput.close();
      activeQuery?.close();
      abortController.abort();
    },
    appendPrompt: async (
      nextPrompt: string,
      nextAttachments: PromptAttachment[] = [],
      appendOptions: { displayPrompt?: string; workspaceContext?: LinkedWorkspaceContext } = {},
    ) => {
      if (runnerClosed || promptInput.isClosed()) {
        throw new Error("Runner is closed.");
      }
      currentDisplayPrompt = appendOptions.displayPrompt ?? nextPrompt;
      if ("workspaceContext" in appendOptions) {
        latestWorkspaceContext = normalizeRunnerWorkspaceContext(appendOptions.workspaceContext);
      }
      requiresFigmaImplementationAnchor = shouldRequireFigmaImplementationAnchor(currentDisplayPrompt);
      requiresFigmaSvgAsset = shouldRequireFigmaSvgAsset(currentDisplayPrompt);
      figmaContextSeen = figmaContextSeen || hasFigmaContext(currentDisplayPrompt, session.lastPrompt);
      figmaSvgAssetSeen = false;
      codeGraphRetrievalSeen = false;
      observedAssistantTextActivity = false;
      awaitingVisiblePostToolResponse = false;
      emptySuccessAutoRetries = 0;
      await ensureMcpServersForPrompt(nextPrompt, nextAttachments);
      promptInput.enqueue(nextPrompt, nextAttachments);
    },
    stopTask: async (taskId: string) => {
      if (runnerClosed || promptInput.isClosed() || !activeQuery) {
        throw new Error("Runner is not ready for task control.");
      }
      await activeQuery.stopTask(taskId);
    },
    isClosed: () => runnerClosed || promptInput.isClosed(),
  };
}

async function maybeRunFigmaGuideOAuth(
  q: Query,
  options: {
    agentId?: string;
    abortSignal: AbortSignal;
    requestPermissionDecision: (toolName: string, input: unknown, signal?: AbortSignal) => Promise<PermissionResult>;
  },
): Promise<void> {
  if (options.agentId !== FIGMA_GUIDE_AGENT_ID) {
    return;
  }

  try {
    await q.initializationResult();
    const figmaServer = (await q.mcpServerStatus()).find(isFigmaMcpServerStatus);
    if (!figmaServer || figmaServer.status !== "needs-auth") {
      return;
    }

    const auth = await (q as QueryWithMcpOAuth).mcpAuthenticate(figmaServer.name);
    const authUrl = isRecord(auth) && typeof auth.authUrl === "string" ? auth.authUrl : "";
    if (!authUrl) {
      return;
    }

    const decision = await options.requestPermissionDecision(
      "AskUserQuestion",
      buildFigmaOAuthQuestionInput(authUrl),
      options.abortSignal,
    );
    if (decision.behavior !== "allow") {
      return;
    }

    const answerText = extractPermissionAnswerText(decision);
    if (/desktop|妗岄潰|鎵撲笉寮€/i.test(answerText)) {
      return;
    }

    await delay(600);
    await q.reconnectMcpServer(figmaServer.name).catch((error) => {
      console.warn("[runner] Figma MCP reconnect after OAuth did not complete:", error);
    });
  } catch (error) {
    console.warn("[runner] Failed to start Figma MCP OAuth guide:", error);
  }
}

function isFigmaMcpServerStatus(status: unknown): status is { name: string; status: string } {
  if (!isRecord(status) || typeof status.name !== "string" || typeof status.status !== "string") {
    return false;
  }

  const config = isRecord(status.config) ? status.config : {};
  return (
    status.name === "figma" ||
    status.name.endsWith(":figma") ||
    (typeof config.url === "string" && config.url === "https://mcp.figma.com/mcp")
  );
}

function buildFigmaOAuthQuestionInput(authUrl: string): Record<string, unknown> {
  return {
    figmaAuthUrl: authUrl,
    questions: [{
      question: "Choose the result after finishing Figma OAuth authorization.",
      header: "Figma OAuth",
      options: [
        {
          label: "Authorization completed",
          description: "Figma access was allowed and the localhost completion page loaded.",
        },
        {
          label: "localhost 椤甸潰鎵撲笉寮€锛屾敼鐢?Figma Desktop MCP",
          description: "The OAuth callback did not complete; stop remote OAuth retry.",
        },
      ],
    }],
  };
}

function extractPermissionAnswerText(result: PermissionResult): string {
  if (result.behavior !== "allow") {
    return "";
  }

  const candidate = (result as { updatedInput?: unknown }).updatedInput;
  const updatedInput = isRecord(candidate) ? candidate : {};
  const answers = isRecord(updatedInput.answers) ? updatedInput.answers : {};
  return Object.values(answers)
    .filter((value): value is string => typeof value === "string")
    .join("\n");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildEffectiveAllowedToolSet(
  sessionAllowedTools: string | undefined,
  agentAllowedTools: string[] | undefined,
  enforceAgentPolicy: boolean,
): Set<string> | null {
  const parsedSessionTools = parseAllowedTools(sessionAllowedTools);
  const parsedAgentTools = parseAllowedToolList(agentAllowedTools);

  if (enforceAgentPolicy) {
    if (parsedSessionTools && parsedSessionTools.size > 0 && parsedAgentTools && parsedAgentTools.size > 0) {
      return new Set(Array.from(parsedSessionTools).filter((tool) => parsedAgentTools.has(tool)));
    }
    if (parsedAgentTools && parsedAgentTools.size > 0) {
      return parsedAgentTools;
    }
    return parsedSessionTools;
  }

  if (parsedAgentTools && parsedAgentTools.size > 0) {
    return parsedAgentTools;
  }

  return null;
}

function parseAllowedTools(value: string | undefined): Set<string> | null {
  if (!value?.trim()) {
    return null;
  }

  return parseAllowedToolList(value.split(","));
}

function parseAllowedToolList(value: string[] | undefined): Set<string> | null {
  const parsed = (value ?? [])
    .map((tool) => tool.trim())
    .filter(Boolean);

  if (parsed.includes("*")) {
    return null;
  }

  return parsed.length > 0 ? new Set(parsed) : null;
}

function isAlwaysAllowedTool(toolName: string, globalRuntimeConfig: unknown): boolean {
  if (ALWAYS_ALLOWED_TOOLS.has(toolName)) {
    return true;
  }

  if (isConfiguredExternalMcpTool(toolName, globalRuntimeConfig)) {
    return true;
  }

  return BUILTIN_MCP_TOOL_NAMES.some((allowedToolName) => (
    toolName.endsWith(`__${allowedToolName}`) ||
    toolName.endsWith(`:${allowedToolName}`) ||
    toolName.endsWith(`/${allowedToolName}`)
  ));
}

function combineSystemPromptAppend(...sections: Array<string | undefined>): string | undefined {
  const joined = sections
    .map((section) => section?.trim())
    .filter((section): section is string => Boolean(section))
    .join("\n\n");
  return joined || undefined;
}

function builtinMcpServerSetsEqual(
  left: ReadonlySet<BuiltinMcpServerName>,
  right: ReadonlySet<BuiltinMcpServerName>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const serverName of left) {
    if (!right.has(serverName)) {
      return false;
    }
  }

  return true;
}

function recordToolUseNamesFromMessage(
  message: SDKMessage,
  toolUseNamesById: Map<string, string>,
): void {
  if (message.type !== "assistant") {
    return;
  }

  const content = getSdkMessageContentBlocks(message);
  for (const item of content) {
    if (!isRecord(item) || item.type !== "tool_use") {
      continue;
    }

    const toolUseId = typeof item.id === "string" ? item.id : "";
    const toolName = typeof item.name === "string" ? item.name : "";
    if (toolUseId && toolName) {
      toolUseNamesById.set(toolUseId, toolName);
    }
  }
}

function findStatefulMcpNotConnectedResult(
  message: SDKMessage,
  toolUseNamesById: ReadonlyMap<string, string>,
): StatefulMcpNotConnectedResult | null {
  if (message.type !== "user") {
    return null;
  }

  const content = getSdkMessageContentBlocks(message);
  for (const item of content) {
    if (!isRecord(item) || item.type !== "tool_result") {
      continue;
    }

    const toolUseId = typeof item.tool_use_id === "string" ? item.tool_use_id : "";
    const toolName = toolUseNamesById.get(toolUseId);
    if (!toolUseId || !toolName || !isStatefulBuiltinMcpServerName(getMcpServerName(toolName))) {
      continue;
    }

    const resultText = extractToolResultText(item.content).trim();
    if (resultText === "Not connected") {
      return { toolName, toolUseId };
    }
  }

  return null;
}

function getSdkMessageContentBlocks(message: SDKMessage): unknown[] {
  const maybeMessage = (message as { message?: unknown }).message;
  if (!isRecord(maybeMessage) || !Array.isArray(maybeMessage.content)) {
    return [];
  }
  return maybeMessage.content;
}

function extractToolResultText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractToolResultText).filter(Boolean).join("\n");
  }

  if (!isRecord(value)) {
    return "";
  }

  if (typeof value.text === "string") {
    return value.text;
  }

  if ("content" in value) {
    return extractToolResultText(value.content);
  }

  return "";
}

function supportsClaudeCodeAutoTruncate(): boolean {
  if (claudeCodeAutoTruncateSupport !== null) {
    return claudeCodeAutoTruncateSupport;
  }

  try {
    const claudePath = getClaudeCodePath();
    if (!claudePath) {
      claudeCodeAutoTruncateSupport = false;
      return claudeCodeAutoTruncateSupport;
    }
    const help = execFileSync(claudePath, ["--help"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    });
    claudeCodeAutoTruncateSupport = help.includes("--allow-auto-truncate");
  } catch {
    claudeCodeAutoTruncateSupport = false;
  }
  return claudeCodeAutoTruncateSupport;
}

function getClaudeCodeExtraArgs(): Record<string, string | null> | undefined {
  return supportsClaudeCodeAutoTruncate() ? CLAUDE_CODE_AUTO_TRUNCATE_ARGS : undefined;
}

function persistDiscoveredRuntimeConfig(
  globalRuntimeConfig: unknown,
  runtimeEnv: Record<string, string | undefined>,
  requestedSkill?: string,
): unknown {
  const nextConfig: Record<string, unknown> = isRecord(globalRuntimeConfig) ? { ...globalRuntimeConfig } : {};
  let changed = false;

  const discoveredEnvKeys = getDiscoveredCredentialEnvKeys(runtimeEnv);
  if (discoveredEnvKeys.length > 0) {
    const envSection = isRecord(nextConfig.env) ? { ...nextConfig.env } : {};
    for (const key of discoveredEnvKeys) {
      const existingValue = typeof envSection[key] === "string" ? envSection[key].trim() : "";
      const nextValue = runtimeEnv[key]?.trim();
      if (nextValue && !existingValue) {
        envSection[key] = nextValue;
        changed = true;
      }
    }

    if (Object.keys(envSection).length > 0) {
      nextConfig.env = envSection;
    }
  }

  if (requestedSkill) {
    const skillCredentialName = getBestMatchedSkillName(requestedSkill);
    const candidateKeys = getSkillEnvCandidates(skillCredentialName, discoveredEnvKeys);
    if (candidateKeys.length > 0) {
      const skillCredentials = isRecord(nextConfig.skillCredentials) ? { ...nextConfig.skillCredentials } : {};
      const existingConfig = skillCredentials[skillCredentialName];
      const existing = extractEnvVarNames(existingConfig);
      const merged = Array.from(new Set([...existing, ...candidateKeys])).sort();
      if (!areStringArraysEqual(existing, merged)) {
        skillCredentials[skillCredentialName] = merged;
        nextConfig.skillCredentials = skillCredentials;
        changed = true;
      }
    }
  }

  if (!changed) {
    return globalRuntimeConfig;
  }

  try {
    saveGlobalRuntimeConfig(nextConfig);
  } catch (error) {
    console.error("[runner] Failed to persist auto-discovered skill credentials:", error);
    return globalRuntimeConfig;
  }

  return nextConfig;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
}

function getBestMatchedSkillName(requestedSkill: string): string {
  return normalizeSkillCredentialKey(requestedSkill);
}

function getSkillEnvCandidates(skillName: string, discoveredEnvKeys: string[]): string[] {
  const normalized = getNormalizedSkillName(skillName);
  if (!normalized) {
    return [];
  }

  const aliasKey = skillName.trim().toLowerCase();
  const normalizedHints = SKILL_ENV_HINTS[aliasKey] ?? [];
  const aliasHints = SKILL_ENV_HINTS[normalized] ?? [];
  const fallbackHints = normalized.length >= 3 ? [normalized.toUpperCase()] : [];
  const mapFallback = Object.entries(SKILL_ENV_HINTS)
    .filter(([skillAlias]) => {
      const normalizedAlias = getNormalizedSkillName(skillAlias);
      if (!normalizedAlias) {
        return false;
      }
      return normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized);
    })
    .flatMap(([, value]) => value);

  const candidates = Array.from(new Set([...normalizedHints, ...aliasHints, ...fallbackHints, ...mapFallback]));

  return discoveredEnvKeys
    .filter((key) => {
      const upper = key.toUpperCase();
      return candidates.some((hint) => upper.includes(hint));
    })
    .sort();
}

function getNormalizedSkillName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

function normalizeSkillCredentialKey(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "unknown";
}

function buildGlobalRuntimePromptAppend(
  globalRuntimeConfig: unknown,
  runtimeEnv: Record<string, string | undefined>,
): string | undefined {
  const configuredEnvKeys = getConfiguredRuntimeEnvKeys(globalRuntimeConfig);
  const discoveredEnvKeys = getDiscoveredCredentialEnvKeys(runtimeEnv);
  const envKeys = Array.from(new Set([...configuredEnvKeys, ...discoveredEnvKeys])).sort();
  const skillCredentialHints = getSkillCredentialHints(globalRuntimeConfig);
  const systemPromptExtAppend = buildGlobalRuntimeSystemPromptExtAppend(globalRuntimeConfig);
  const hasConfiguredRuntime = configuredEnvKeys.length > 0 || skillCredentialHints.length > 0;
  const autoDiscoverLabel = hasConfiguredRuntime ? "" : "锛堟湭鍙戠幇鑷畾涔夊嚟璇佹槧灏勶紝宸茶嚜鍔ㄥ彂鐜板綋鍓嶇幆澧冨€欓€夛級";

  if (envKeys.length === 0 && skillCredentialHints.length === 0 && !systemPromptExtAppend) {
    return undefined;
  }

  const sections: string[] = [];

  if (envKeys.length > 0 || skillCredentialHints.length > 0) {
    const hints: string[] = [
      "鍏ㄥ眬杩愯鍙傛暟宸插惎鐢紙鐢ㄤ簬鎶€鑳戒笌宸ュ叿鎵ц锛夛細",
      "Use injected environment variables for skill/tool auth when needed; never expose or echo secret values.",
    ];

    if (configuredEnvKeys.length > 0 || discoveredEnvKeys.length > 0) {
      hints.push(
        `Injected environment variables${autoDiscoverLabel}: ${envKeys.join(", ")}`,
      );
    }

    if (skillCredentialHints.length > 0) {
      hints.push("Skill credential mapping:");
      hints.push(...skillCredentialHints.map((hint) => `- ${hint}`));
    }

    sections.push(hints.join("\n"));
  }

  if (systemPromptExtAppend) {
    sections.push(systemPromptExtAppend);
  }

  return sections.join("\n\n");
}

function getConfiguredRuntimeEnvKeys(globalRuntimeConfig: unknown): string[] {
  if (!isRecord(globalRuntimeConfig)) {
    return [];
  }

  const envSection = isRecord(globalRuntimeConfig.env) ? globalRuntimeConfig.env : null;
  if (!envSection) {
    return [];
  }

  return Object.keys(envSection)
    .map((key) => key.trim())
    .filter(Boolean)
    .filter((key) => !key.toUpperCase().startsWith("ANTHROPIC_"))
    .sort();
}

function getDiscoveredCredentialEnvKeys(runtimeEnv: Record<string, string | undefined>): string[] {
  return Object.entries(runtimeEnv)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key]) => key)
    .filter(isLikelyCredentialEnvName)
    .filter((key) => !key.toUpperCase().startsWith("ANTHROPIC_"))
    .sort();
}

function isLikelyCredentialEnvName(name: string): boolean {
  if (!/^[A-Z_][A-Z0-9_]*$/i.test(name)) {
    return false;
  }

  const upper = name.toUpperCase();

  if (upper === "ANTHROPIC_AUTH_TOKEN" || upper === "ANTHROPIC_BASE_URL" || upper === "ANTHROPIC_MODEL") {
    return false;
  }

  const noisyEnvVars = new Set([
    "PATH",
    "HOME",
    "SHELL",
    "TERM",
    "TERM_PROGRAM",
    "TERM_PROGRAM_VERSION",
    "TMPDIR",
    "TMP",
    "TEMP",
    "HOSTNAME",
    "PWD",
    "OLDPWD",
    "USER",
    "LOGNAME",
    "LANG",
    "LC_ALL",
    "SHLVL",
    "COLORTERM",
    "SSH_ASKPASS",
    "SSH_AGENT_PID",
    "SSH_CONNECTION",
    "TZ",
    "XDG_SESSION_ID",
    "XDG_RUNTIME_DIR",
    "LC_CTYPE",
    "LC_COLLATE",
    "LC_MESSAGES",
    "COMSPEC",
    "SYSTEMROOT",
    "WINDIR",
    "APPDATA",
    "LOCALAPPDATA",
  ]);

  if (noisyEnvVars.has(upper) || upper.startsWith("LC_") || upper.startsWith("XDG_")) {
    return false;
  }

  const credentialMarker = /(TOKEN|KEY|SECRET|PASSWORD|PASS|AUTH|CREDENTIAL|CLIENT|ACCESS|BEARER|PAT|SIGN|OAUTH|API|CERT|PRIVATE)/i;
  return credentialMarker.test(upper);
}

function getSkillCredentialHints(globalRuntimeConfig: unknown): string[] {
  if (!isRecord(globalRuntimeConfig)) {
    return [];
  }

  const sections = [
    "skillCredentials",
    "skills",
    "toolCredentials",
    "credentials",
  ];

  const hints = new Set<string>();
  for (const sectionName of sections) {
    const section = globalRuntimeConfig[sectionName];
    if (!isRecord(section)) {
      continue;
    }

    for (const [skillName, configValue] of Object.entries(section)) {
      const envs = extractEnvVarNames(configValue);
      if (envs.length === 0) {
        continue;
      }
      hints.add(`${skillName}: ${envs.join(", ")}`);
    }
  }

  return Array.from(hints).sort();
}

function extractEnvVarNames(value: unknown): string[] {
  if (typeof value === "string") {
    return [value.trim()].filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (!isRecord(value)) {
    return [];
  }

  const fromEnv = isRecord(value.env) ? value.env : null;
  if (fromEnv) {
    return Object.keys(fromEnv)
      .filter(Boolean)
      .filter((key) => !key.toUpperCase().startsWith("ANTHROPIC_"));
  }

  const direct = value.envVar;
  if (typeof direct === "string" && direct.trim()) {
    return [direct.trim()];
  }

  return [];
}

function isBlockedShellTool(toolName: string): boolean {
  return (
    BLOCKED_SHELL_TOOL_NAMES.has(toolName) ||
    /^mcp__windows__.*powershell/i.test(toolName)
  );
}

function shouldDenyPowerShellCommand(toolName: string, input: unknown): boolean {
  if (toolName !== "Bash" || !isRecord(input)) {
    return false;
  }

  const command = typeof input.command === "string" ? input.command.trim() : "";
  return Boolean(command && POWERSHELL_COMMAND_PATTERN.test(command));
}

function shouldDenyExternalBrowseSkill(input: unknown, prompt: string): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const requestedSkill = typeof input.skill === "string" ? input.skill.trim().toLowerCase() : "";
  if (requestedSkill !== "browse") {
    return false;
  }

  return /鍐呯疆娴忚鍣▅娴忚鍣ㄥ伐浣滃彴|褰撳墠椤甸潰|杩欎釜椤甸潰|杩欎釜缃戦〉|鐖彇|browserview|browser workbench|tech-cc-hub-browser/i.test(prompt);
}

function getAuthenticatedUrlWebFetchDenyMessage(
  toolName: string,
  input: unknown,
  browserPromptEnabled: boolean,
  prompt: string,
): string | undefined {
  if (!browserPromptEnabled || toolName !== "WebFetch" || !isRecord(input)) {
    return undefined;
  }

  const rawUrl = typeof input.url === "string" ? input.url.trim() : "";
  if (!rawUrl || !shouldUseBrowserViewBeforeWebFetch(rawUrl, prompt)) {
    return undefined;
  }

  return [
    "The user provided this URL directly; it may require saved browser login state, cookies, or SSO.",
    "Use mcp__tech-cc-hub-browser__browser_open_page for the URL, then inspect it with browser_extract_page or browser_snapshot_interactive.",
    "Do not ask the user to paste task details before trying the built-in BrowserView.",
  ].join(" ");
}

function shouldUseBrowserViewBeforeWebFetch(rawUrl: string, prompt: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (isLocalBrowserBypassHost(url.hostname)) return false;
    return promptMentionsUrl(prompt, rawUrl, url);
  } catch {
    return false;
  }
}

function isLocalBrowserBypassHost(hostname: string): boolean {
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";
}

function promptMentionsUrl(prompt: string, rawUrl: string, url: URL): boolean {
  const haystack = prompt.toLowerCase();
  const href = url.href.toLowerCase();
  const raw = rawUrl.toLowerCase();
  const withoutTrailingSlash = href.endsWith("/") ? href.slice(0, -1) : href;
  return haystack.includes(raw) ||
    haystack.includes(href) ||
    haystack.includes(withoutTrailingSlash) ||
    haystack.includes(`${url.hostname.toLowerCase()}${url.pathname.toLowerCase()}`);
}

function checkRasterImageRead(
  filePath: string,
  currentImageReads: number,
): { denyMessage?: string; countRead: boolean } {
  if (!filePath) {
    return { countRead: false };
  }

  const extension = extname(filePath).toLowerCase();
  if (!RASTER_IMAGE_EXTENSIONS.has(extension)) {
    return { countRead: false };
  }

  const normalizedFilePath = filePath.replace(/\\/g, "/");
  if (normalizedFilePath.includes("/prompt-attachments/")) {
    return {
      denyMessage:
        `杩欐槸鐢ㄦ埛涓婁紶鎴浘钀界洏鍚庣殑鍥剧墖璧勪骇锛屼笉鍏佽鐢?Read 鐩存帴璇诲叆涓?Agent銆傝鍏堢敤 mcp__tech-cc-hub-design__design_inspect_image 璇诲彇璇ュ浘鐗囷紱濡傛灉瑕佸仛鎴浘瀵归綈锛屽啀鐢?mcp__tech-cc-hub-design__design_compare_current_view 鎴?mcp__tech-cc-hub-design__design_compare_images 澶勭悊璇ヨ矾寰勶細${filePath}`,
      countRead: false,
    };
  }

  if (currentImageReads >= MAX_IMAGE_READS_PER_RUN) {
    return {
      denyMessage:
        "This run already read one raster image. Avoid reading more images into the main context; use the design MCP tools or ask for the single key image.",
      countRead: false,
    };
  }

  if (!existsSync(filePath)) {
    return { countRead: true };
  }

  try {
    const { size } = statSync(filePath);
    if (size > MAX_SINGLE_IMAGE_READ_BYTES) {
      return {
        denyMessage:
          `${LARGE_IMAGE_READ_GUIDANCE} Current file size: ${Math.round(size / 1024)} KB.`,
        countRead: false,
      };
    }
  } catch {
    return { countRead: true };
  }

  return { countRead: true };
}

function shouldPreprocessImageRead(
  config: NonNullable<ReturnType<typeof getCurrentApiConfig>> | null,
  filePath: string,
  mainModelName?: string,
): boolean {
  void mainModelName;

  // 涓存椂鍏抽棴 Read 鍥剧墖鏃剁殑鍥剧墖妯″瀷鎽樿鎷︽埅锛岄伩鍏嶆埅鍥炬瘮鐓?闄勪欢閾捐矾琚浛鎹㈡垚涓嶅彲闈犳枃鏈€?
  return Boolean(config?.imageModel?.trim() && RASTER_IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase()));
}

function createImageSummaryToolOutput(summary: string): Array<{ type: "text"; text: string }> {
  return createTextToolOutputBlocks(summary);
}

function buildQualityHooks(
  _cwd: string,
  options: {
    config: NonNullable<ReturnType<typeof getCurrentApiConfig>>;
    mainModelName?: string;
    prompt?: string;
    getPrompt?: () => string;
    projectCwd?: string;
    sessionId: string;
    isCodeGraphRetrievalSeen?: () => boolean;
    onCodeGraphRetrieval?: () => void;
    onFigmaRestAuthFailure?: () => void;
    onFigmaImplementationAnchor?: () => void;
    onFigmaContext?: () => void;
    onFigmaSvgAsset?: () => void;
  },
): Partial<Record<string, HookCallbackMatcher[]>> {
  void _cwd;
  const {
    config,
    mainModelName,
    sessionId,
    projectCwd,
    isCodeGraphRetrievalSeen,
    onCodeGraphRetrieval,
    onFigmaRestAuthFailure,
    onFigmaImplementationAnchor,
    onFigmaContext,
    onFigmaSvgAsset,
  } = options;
  const getCurrentPrompt = options.getPrompt ?? (() => options.prompt ?? "");
  const readFiles = new Set<string>();
  let lastToolSignature: string | null = null;
  let toolFailureCount = 0;
  let repeatWarningCount = 0;
  let rasterImageReads = 0;

  // Learning hooks 鈥?create wrappers that adapt learning-hooks return types to HookCallback
  const learnCaptureHook = createLearnCaptureHook();
  const secretScanHook = createSecretScanHook();
  const gitBlastRadiusHook = createGitBlastRadiusHook();
  const commitValidateHook = createCommitValidateHook();
  const toolCallBudgetHook = createToolCallBudgetHook(sessionId);
  const qualityGateHook = createQualityGateHook(sessionId);
  const readBeforeWriteHook = createReadBeforeWriteHook();

  return {
    UserPromptSubmit: [{
      hooks: [async (input) => {
        if (!("prompt" in input) || typeof input.prompt !== "string") {
          return { continue: true };
        }

        const prompt = input.prompt.trim();
        const hints: string[] = [];
        if (prompt.length > 0 && prompt.length < 12) {
          hints.push("User prompt is short; narrow the key assumptions before executing.");
        }
        if (/\b(this|that|it|there|above|below)\b/i.test(prompt) && prompt.length < 48) {
          hints.push("Prompt contains ambiguous references; state the target object you are relying on.");
        }

        if (hints.length === 0) {
          return { continue: true };
        }

        return {
          continue: true,
          hookSpecificOutput: {
            hookEventName: "UserPromptSubmit",
            additionalContext: `Quality reminder: ${hints.join("; ")}`,
          },
        };
      }],
    }],
    ConfigChange: [{
      hooks: [async (input) => {
        const source = "source" in input && typeof input.source === "string" ? input.source : "unknown";
        const filePath = "file_path" in input && typeof input.file_path === "string" ? input.file_path : undefined;
        console.info("[runner][hook][config-change]", { sessionId, source, filePath });
        return { continue: true };
      }],
    }],
    TeammateIdle: [{
      hooks: [async (input) => {
        const teammateName = "teammate_name" in input && typeof input.teammate_name === "string" ? input.teammate_name : "teammate";
        const teamName = "team_name" in input && typeof input.team_name === "string" ? input.team_name : "team";
        console.info("[runner][hook][teammate-idle]", { sessionId, teammateName, teamName });
        return { continue: true };
      }],
    }],
    TaskCompleted: [{
      hooks: [async (input) => {
        const taskSubject = "task_subject" in input && typeof input.task_subject === "string" ? input.task_subject : "task";
        const teammateName = "teammate_name" in input && typeof input.teammate_name === "string" ? input.teammate_name : undefined;
        console.info("[runner][hook][task-completed]", { sessionId, taskSubject, teammateName });
        return { continue: true };
      }],
    }],
    MessageDisplay: [{
      hooks: [async (input) => {
        if (!("hook_event_name" in input) || input.hook_event_name !== "MessageDisplay") {
          return { continue: true };
        }
        // Display-only hook: passthrough, no transformation applied.
        // The delta is rendered as-is; the hook exists so future
        // per-message display transforms have a registration point.
        return { continue: true };
      }],
    }],
    PreCompact: [{
      hooks: [async (input) => {
        if (!("hook_event_name" in input) || input.hook_event_name !== "PreCompact") {
          return { continue: true };
        }
        const trigger = "trigger" in input && typeof input.trigger === "string" ? input.trigger : "unknown";
        console.info("[runner][hook][pre-compact]", { sessionId, trigger });
        return { continue: true };
      }],
    }],
    PreToolUse: [{
      hooks: [async (input) => {
        if (!("tool_name" in input) || typeof input.tool_name !== "string") {
          return { continue: true };
        }

        const toolName = input.tool_name;
        const toolInput = isRecord(input.tool_input) ? input.tool_input : {};
        let normalizedInput: Record<string, unknown> = { ...toolInput };
        const hints: string[] = [];
        const fixes: string[] = [];
        let didMutate = false;

        if (isCodeGraphRetrievalTool(toolName)) {
          onCodeGraphRetrieval?.();
        }

        const trimmed = (value: string): string => value.replace(/\s+/g, " ").trim();
        const setTrimmed = (key: string, label: string, raw: unknown): void => {
          if (typeof raw !== "string") {
            return;
          }

          const fixed = trimmed(raw);
          if (fixed !== raw) {
            normalizedInput[key] = fixed;
            didMutate = true;
            fixes.push(`${label} 鍘婚櫎绌虹櫧`);
          }
        };

        const normalizeCommand = (raw: unknown): void => {
          if (typeof raw !== "string") {
            return;
          }

          const whitespaceFixed = trimmed(raw.replace(/\n/g, " "));
          const windowsFixed = normalizeWindowsBashCommand(whitespaceFixed);
          const fixed = windowsFixed.command;
          if (fixed !== raw) {
            normalizedInput.command = fixed;
            didMutate = true;
            if (whitespaceFixed !== raw) {
              fixes.push("Normalized Bash command whitespace");
            }
            if (windowsFixed.note) {
              fixes.push(windowsFixed.note);
            }
          }
        };

        if (["Read", "Edit", "Write", "MultiEdit"].includes(toolName)) {
          const filePath = typeof toolInput.file_path === "string" ? toolInput.file_path : "";
          if (!filePath) {
            hints.push(`${toolName} 缂哄皯 file_path锛屽缓璁厛琛ラ綈鐩爣璺緞`);
          } else {
            const fixed = trimmed(filePath);
            if (fixed !== filePath) {
              normalizedInput.file_path = fixed;
              didMutate = true;
              fixes.push("file_path 鍘婚櫎绌虹櫧");
            }
            if (toolName === "Read") {
              if (!canMainModelReadImages(mainModelName ?? config.model) && !shouldPreprocessImageRead(config, fixed, mainModelName)) {
                const imageReadCheck = checkRasterImageRead(fixed, rasterImageReads);
                if (imageReadCheck.denyMessage) {
                  return {
                    continue: true,
                    hookSpecificOutput: {
                      hookEventName: "PreToolUse",
                      permissionDecision: "deny",
                      permissionDecisionReason: imageReadCheck.denyMessage,
                      additionalContext: imageReadCheck.denyMessage,
                      ...(didMutate ? { updatedInput: normalizedInput } : {}),
                    },
                  };
                }
                if (imageReadCheck.countRead) {
                  rasterImageReads += 1;
                }
              }
              readFiles.add(fixed);
            } else if (!readFiles.has(fixed)) {
              hints.push(`淇敼/鍐欏叆鍓嶆湭璇昏繃 ${fixed}锛屽缓璁ˉ涓€娆?Read`);
            }
          }
        }

        if (toolName === "Bash") {
          normalizeCommand(toolInput.command);
          const effectiveCommand = typeof normalizedInput.command === "string"
            ? normalizedInput.command
            : toolInput.command;
          if (typeof effectiveCommand !== "string" || !effectiveCommand.trim()) {
            hints.push("Bash 缂哄皯 command 鍙傛暟");
          } else {
            setTrimmed("command", "command", effectiveCommand);
            const command = effectiveCommand.toLowerCase();
            if (/(rm\s+-rf|git\s+reset\s+--hard|mkfs|dd\s+if=|format\s+)/i.test(command)) {
              hints.push("Bash command looks high-risk; verify path and argument boundaries first.");
            }
          }
        }

        if (toolName === "Glob") {
          setTrimmed("path", "path", toolInput.path);
          setTrimmed("pattern", "pattern", toolInput.pattern);
          if (typeof toolInput.pattern !== "string" || !toolInput.pattern.trim()) {
            hints.push("Glob 缂哄皯 pattern锛屽缓璁粰鍑烘槑纭尮閰嶈〃杈惧紡");
          }
        }

        if (toolName === "Search") {
          setTrimmed("path", "path", toolInput.path);
          setTrimmed("query", "query", toolInput.query);
          if (typeof toolInput.query !== "string" || !toolInput.query.trim()) {
            hints.push("Search 缂哄皯 query锛屽缓璁粰鍑烘绱㈠叧閿瓧");
          }
        }

        const schemaNormalization = normalizeToolInputForKnownSchemas(toolName, normalizedInput);
        if (schemaNormalization.mutated) {
          normalizedInput = schemaNormalization.input;
          didMutate = true;
          fixes.push(...schemaNormalization.fixes);
        }

        const codeGraphDenyMessage = getCodeGraphFirstDenyMessage(
          toolName,
          projectCwd,
          isCodeGraphRetrievalSeen?.() ?? false,
          normalizedInput,
        );
        if (codeGraphDenyMessage) {
          return {
            continue: true,
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: "deny",
              permissionDecisionReason: codeGraphDenyMessage,
              additionalContext: codeGraphDenyMessage,
              ...(didMutate ? { updatedInput: normalizedInput } : {}),
            },
          };
        }

        const toolSignature = `${toolName}:${stableToolSignature(normalizedInput)}`;
        if (lastToolSignature === toolSignature) {
          repeatWarningCount += 1;
          hints.push("Tool input repeats the previous call; inspect the last result before retrying.");
        } else {
          repeatWarningCount = 0;
        }
        lastToolSignature = toolSignature;

        if (repeatWarningCount >= 2) {
          hints.push("閲嶅閲嶈瘯娆℃暟鍋忛珮锛岃璋冩暣鍙傛暟鍚庡啀璋冪敤宸ュ叿");
        }

        if (fixes.length === 0 && hints.length === 0) {
          return { continue: true };
        }

        const additionalContext = `Tool input optimization: ${[...fixes, ...hints].join("; ")}`;
        return {
          continue: true,
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            additionalContext,
            ...(didMutate ? { updatedInput: normalizedInput } : {}),
          },
        };
      }],
    },
    // Learning hooks: secret scan, git blast radius, commit validation, tool budget, quality gate, read-before-write
    { hooks: [secretScanHook as never] },
    { hooks: [gitBlastRadiusHook as never] },
    { hooks: [commitValidateHook as never] },
    { hooks: [toolCallBudgetHook as never] },
    { hooks: [qualityGateHook as never] },
    { hooks: [readBeforeWriteHook.preToolUse as never] },
    ],
    PostToolUse: [{
      hooks: [async (input) => {
        if (!("tool_name" in input) || typeof input.tool_name !== "string") {
          return { continue: true };
        }

        if (
          "tool_response" in input &&
          isFigmaRestToolName(input.tool_name) &&
          isLikelyFigmaRestAuthFailure(input.tool_response)
        ) {
          onFigmaRestAuthFailure?.();
        } else if (
          "tool_response" in input &&
          isFigmaRestToolName(input.tool_name) &&
          !isLikelyFailedToolResponse(input.tool_response)
        ) {
          onFigmaContext?.();
        }

        if (
          "tool_response" in input &&
          isFigmaImplementationAnchorToolName(input.tool_name) &&
          isImplementationGradeFigmaAnchorResponse(input.tool_response)
        ) {
          onFigmaImplementationAnchor?.();
        } else if (
          "tool_response" in input &&
          isFigmaImplementationAnchorToolName(input.tool_name)
        ) {
          return {
            continue: true,
            hookSpecificOutput: {
              hookEventName: "PostToolUse",
              additionalContext: "Figma implementation anchor was not established: design_inspect_image must return success with qualityGate.confidence >= 0.75 and needsStrongerVisionModel=false before file edits.",
            },
          };
        }

        if (
          "tool_response" in input &&
          isFigmaSvgAssetToolName(input.tool_name) &&
          isFigmaSvgImageUrlRequest("tool_input" in input ? input.tool_input : undefined) &&
          isLikelyFigmaSvgAssetResponse(input.tool_response)
        ) {
          onFigmaSvgAsset?.();
        }

        if ("tool_response" in input) {
          const serviceGuidance = getBashBackgroundServiceGuidance(
            input.tool_name,
            "tool_input" in input ? input.tool_input : undefined,
            input.tool_response,
          );
          if (serviceGuidance) {
            return {
              continue: true,
              hookSpecificOutput: {
                hookEventName: "PostToolUse",
                additionalContext: serviceGuidance,
              },
            };
          }
        }

        if (input.tool_name === "Read") {

        const toolInput = isRecord(input.tool_input) ? input.tool_input : {};
        const filePath = typeof toolInput.file_path === "string" ? toolInput.file_path.trim() : "";
        if (!shouldPreprocessImageRead(config, filePath, mainModelName)) {
          return { continue: true };
        }

        try {
          const summary = await summarizeLocalImageFile({ config, prompt: getCurrentPrompt(), filePath });
          if (!summary) {
            return { continue: true };
          }

          return {
            continue: true,
            hookSpecificOutput: {
              hookEventName: "PostToolUse",
              additionalContext: `Replaced image Read output with a ${config.imageModel?.trim() || "vision model"} summary to avoid context overflow.`,
              updatedToolOutput: createImageSummaryToolOutput(summary),
            },
          };
        } catch (error) {
          if (canMainModelReadImages(mainModelName ?? config.model)) {
            return {
              continue: true,
              hookSpecificOutput: {
                hookEventName: "PostToolUse",
                additionalContext: "Image preprocessing failed; the selected main model supports image understanding, so the raw image Read output was left available as a fallback.",
              },
            };
          }

          const message = error instanceof Error ? error.message : String(error);
          const fallback = [
            `Image file: ${filePath}`,
            "Image preprocessing failed; raw image output was blocked from the main context.",
            `Failure reason: ${message}`,
            "Use adjacent docs or a single user-specified key image instead.",
          ].join("\n");

          return {
            continue: true,
            hookSpecificOutput: {
              hookEventName: "PostToolUse",
              additionalContext: fallback,
              updatedToolOutput: createImageSummaryToolOutput(fallback),
            },
          };
        }
        }

        if (!("tool_response" in input)) {
          return { continue: true };
        }

        const inlineImage = extractInlineBase64ImageFromToolResponse(input.tool_response);
        if (!inlineImage) {
          const oversizedText = buildOversizedTextToolOutputReplacement(input.tool_name, input.tool_response);
          if (!oversizedText) {
            return { continue: true };
          }

          return {
            continue: true,
            hookSpecificOutput: {
              hookEventName: "PostToolUse",
              additionalContext:
                `Truncated ${input.tool_name} output from ${oversizedText.originalChars} chars to prevent context overflow.`,
              updatedToolOutput: createImageSummaryToolOutput(oversizedText.replacementText),
            },
          };
        }

        const summarizedPrompt = [
          getCurrentPrompt().trim(),
          inlineImage.textContext.trim() ? `Tool response context: ${inlineImage.textContext.trim()}` : "",
        ].filter(Boolean).join("\n\n");

        try {
          const summary = await summarizeBase64Image({
            config,
            prompt: summarizedPrompt,
            attachmentName: `${input.tool_name}-result`,
            mimeType: inlineImage.mimeType,
            base64Data: inlineImage.base64Data,
          });
          const replacementText = buildToolImageReplacementText({
            toolName: input.tool_name,
            textContext: inlineImage.textContext,
            summary: summary ?? undefined,
          });

          return {
            continue: true,
            hookSpecificOutput: {
              hookEventName: "PostToolUse",
              additionalContext: `Replaced ${input.tool_name} image output with text to avoid context overflow.`,
              updatedToolOutput: createImageSummaryToolOutput(replacementText),
            },
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const fallback = buildToolImageReplacementText({
            toolName: input.tool_name,
            textContext: inlineImage.textContext,
            error: message,
          });

          return {
            continue: true,
            hookSpecificOutput: {
              hookEventName: "PostToolUse",
              additionalContext: fallback,
              updatedToolOutput: createImageSummaryToolOutput(fallback),
            },
          };
        }
      }],
    }],
    PostToolUseFailure: [{
      hooks: [async (input) => {
        const failedToolInput: Record<string, unknown> | null = isRecord(input) ? input : null;
        const failedToolName = typeof failedToolInput?.tool_name === "string"
          ? failedToolInput.tool_name
          : "";
        if (
          failedToolName &&
          isFigmaRestToolName(failedToolName) &&
          isLikelyFigmaRestAuthFailure(input)
        ) {
          onFigmaRestAuthFailure?.();
        }

        toolFailureCount += 1;
        return {
          continue: true,
          hookSpecificOutput: {
            hookEventName: "PostToolUseFailure",
            additionalContext: toolFailureCount >= 2
              ? "宸ュ叿宸茶繛缁け璐ワ紝涓嬩竴姝ュ厛鎬荤粨閿欒鍘熷洜骞舵崲璺緞锛屽繀瑕佹椂鍗囩骇涓撳妯″瀷"
              : "宸ュ叿澶辫触鍚庡厛鍒╃敤閿欒淇℃伅缂╁皬鑼冨洿锛屼笉瑕佺洿鎺ラ噸澶嶅悓涓€璋冪敤",
          },
        };
      }],
    }],
    // Stop: learn capture 鈥?extracts [LEARN] blocks from assistant response
    Stop: [{
      hooks: [learnCaptureHook as never],
    }],
  };
}

function getFigmaOfficialRouteDenyMessage(
  toolName: string,
  globalRuntimeConfig: unknown,
  restAuthFailureSeen: boolean,
): string | null {
  if (!isOfficialFigmaMcpToolName(toolName)) {
    return null;
  }

  const status = getFigmaOfficialPluginStatusFromConfig(globalRuntimeConfig);
  if (status.mode !== "rest" || status.status !== "ready" || restAuthFailureSeen) {
    return null;
  }

  return null;
}

function getFigmaImplementationAnchorDenyMessage(
  toolName: string,
  requiresFigmaImplementationAnchor: boolean,
  figmaImplementationAnchorSeen: boolean,
): string | null {
  if (!requiresFigmaImplementationAnchor || figmaImplementationAnchorSeen || !FILE_MUTATION_TOOL_NAMES.has(toolName)) {
    return null;
  }

  return [
    "This task includes a Figma design URL. Before editing code, establish an implementation-grade Figma anchor.",
    "Do not implement from raw figma_read_design JSON alone; it is often too large and truncated.",
    "For UI implementation, first use mcp__tech-cc-hub-figma__figma_list_node_index, then mcp__tech-cc-hub-figma__figma_export_node_images, then inspect the returned imagePath with mcp__tech-cc-hub-design__design_inspect_image.",
    "The implementation anchor is established only after mcp__tech-cc-hub-design__design_inspect_image succeeds; generated Tailwind, summaries, audits, and raw node JSON are supporting material, not the source of truth.",
    "After the image anchor exists, record the generic reference tuple: Figma nodeId, local reference imagePath, DOM selector/region, acceptance gate, and visual constraints. Do not turn this task's domain shape into a global component concept.",
    "Use mcp__tech-cc-hub-figma__figma_summarize_design or mcp__tech-cc-hub-figma__figma_read_design with small depth only to confirm component props/tokens after the visual anchor exists.",
    "If the URL node-id is broad or the file contains repeated Frame names, call mcp__tech-cc-hub-figma__figma_list_node_index with the original URL and a text query from the requested UI before asking the user for a frame number.",
    "If a rendered UI node is involved, collect browser_query_nodes or annotation DOM fields (text, selector, box, attributes, componentStack, context.nearbyText) and call mcp__tech-cc-hub-figma__figma_match_ui_nodes to establish the UI-node to Figma-node mapping.",
    "Before trusting risky layout or color changes, compare the locked visual constraints with current DOM evidence from browser_query_nodes/browser_inspect_styles and screenshot diff; avoid standalone CSS-rule guessing.",
    "Prefer a specific node-id from the Figma URL or a narrowed target node. After that, map the design sections to the existing project components and then edit code.",
  ].join("\n");
}

function getFigmaSvgAssetDenyMessage(
  toolName: string,
  toolInput: unknown,
  requiresFigmaSvgAsset: boolean,
  figmaContextSeen: boolean,
  figmaSvgAssetSeen: boolean,
): string | null {
  if (figmaSvgAssetSeen || !FILE_MUTATION_TOOL_NAMES.has(toolName)) {
    return null;
  }

  const mutationNeedsFigmaSvgAsset = requiresFigmaSvgAsset || (figmaContextSeen && isSvgOrIconMutation(toolName, toolInput));
  if (!mutationNeedsFigmaSvgAsset) {
    return null;
  }

  return [
    "This Figma implementation is editing SVG/icon/vector content. Do not redraw, approximate, or substitute Figma SVGs with hand-written paths, lucide/Element Plus icons, CSS shapes, or guessed inline SVG.",
    "Before editing code, identify the exact Figma icon/vector node with mcp__tech-cc-hub-figma__figma_list_node_index or mcp__tech-cc-hub-figma__figma_get_node.",
    "Then call mcp__tech-cc-hub-figma__figma_get_image_urls with format=\"svg\" for those exact nodeIds and fetch/use the returned SVG asset content.",
    "Only after the SVG export exists may you adapt it to the project, preserving the Figma path geometry. You may normalize size, currentColor, aria-hidden, and component wrapping, but not invent the icon shape.",
    "If Figma SVG export fails, report the export failure and stop or ask for a fallback; do not silently fabricate a replacement SVG.",
  ].join("\n");
}

function shouldRequireFigmaImplementationAnchor(prompt: string): boolean {
  return FIGMA_URL_PATTERN.test(prompt);
}

function shouldRequireFigmaSvgAsset(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return /figma/i.test(normalized) && /(svg|icon|icons|vector|asset|assets|图标|矢量|素材|资产)/i.test(normalized);
}

function hasFigmaContext(...texts: Array<string | undefined>): boolean {
  return texts.some((text) => {
    if (!text) {
      return false;
    }

    return FIGMA_URL_PATTERN.test(text) || /figma/i.test(text);
  });
}

function isSvgOrIconMutation(toolName: string, value: unknown): boolean {
  if (!FILE_MUTATION_TOOL_NAMES.has(toolName)) {
    return false;
  }

  const text = stringifyForSearch(value);
  return /(<\/?svg\b|<\/?path\b|\bviewBox\b|\bd=["'][^"']+["']|\bstroke=["']|\bfill=["']|\bcurrentColor\b|@element-plus\/icons-vue|lucide(?:-react|-vue)?|\bIcon[A-Z]\w*|\bicons?\b|svg|图标|矢量)/i.test(text);
}

function isOfficialFigmaMcpToolName(toolName: string): boolean {
  const serverName = getMcpServerName(toolName);
  return Boolean(serverName && FIGMA_OFFICIAL_MCP_SERVER_NAMES.has(serverName));
}

function getMcpServerName(toolName: string): string | null {
  const mcpMatch = toolName.match(/^mcp__(.+?)__/);
  if (mcpMatch?.[1]) {
    return mcpMatch[1];
  }

  const doubleUnderscoreIndex = toolName.indexOf("__");
  if (doubleUnderscoreIndex > 0) {
    return toolName.slice(0, doubleUnderscoreIndex);
  }

  const separatorMatch = toolName.match(/^([^:/]+)[:/]/);
  return separatorMatch?.[1] ?? null;
}

function isFigmaRestToolName(toolName: string): boolean {
  for (const restToolName of FIGMA_REST_TOOL_NAME_SET) {
    if (
      toolName === restToolName ||
      toolName.endsWith(`__${restToolName}`) ||
      toolName.endsWith(`:${restToolName}`) ||
      toolName.endsWith(`/${restToolName}`)
    ) {
      return true;
    }
  }

  return false;
}

function isFigmaImplementationAnchorToolName(toolName: string): boolean {
  for (const restToolName of FIGMA_IMPLEMENTATION_ANCHOR_TOOL_NAMES) {
    if (
      toolName === restToolName ||
      toolName.endsWith(`__${restToolName}`) ||
      toolName.endsWith(`:${restToolName}`) ||
      toolName.endsWith(`/${restToolName}`)
    ) {
      return true;
    }
  }

  return false;
}

function isFigmaSvgAssetToolName(toolName: string): boolean {
  for (const restToolName of FIGMA_SVG_ASSET_TOOL_NAMES) {
    if (
      toolName === restToolName ||
      toolName.endsWith(`__${restToolName}`) ||
      toolName.endsWith(`:${restToolName}`) ||
      toolName.endsWith(`/${restToolName}`)
    ) {
      return true;
    }
  }

  return false;
}

function isFigmaSvgImageUrlRequest(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const format = typeof value.format === "string" ? value.format.trim().toLowerCase() : "";
  return format === "svg";
}

function isLikelyFigmaSvgAssetResponse(value: unknown): boolean {
  if (isLikelyFailedToolResponse(value)) {
    return false;
  }

  const text = stringifyForSearch(value).toLowerCase();
  return /\.svg(?:\?|["'\s]|$)|format["']?\s*:\s*["']?svg|image\/svg\+xml|svg_export/i.test(text);
}

function isLikelyFailedToolResponse(value: unknown): boolean {
  let text: string;
  if (typeof value === "string") {
    text = value;
  } else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }

  return /"success"\s*:\s*false|tool\s+failed|exception|unauthorized|forbidden|401|403/i.test(text);
}

function isImplementationGradeFigmaAnchorResponse(value: unknown): boolean {
  if (isLikelyFailedToolResponse(value)) {
    return false;
  }

  const gates = extractQualityGates(value);
  return gates.some((gate) => {
    const confidence = typeof gate.confidence === "number" ? gate.confidence : 0;
    return confidence >= 0.75 && gate.needsStrongerVisionModel !== true;
  });
}

function extractQualityGates(value: unknown): Array<Record<string, unknown>> {
  const directGates = collectQualityGates(value);
  if (directGates.length > 0) {
    return directGates;
  }

  return collectToolResponseTexts(value)
    .flatMap((text) => parseJsonCandidates(text))
    .flatMap(collectQualityGates);
}

function collectQualityGates(value: unknown, depth = 0): Array<Record<string, unknown>> {
  if (depth > 6 || !isRecord(value)) {
    return [];
  }

  const gates: Array<Record<string, unknown>> = [];
  if (isRecord(value.qualityGate)) {
    gates.push(value.qualityGate);
  }
  if (isRecord(value.dsl) && isRecord(value.dsl.qualityGate)) {
    gates.push(value.dsl.qualityGate);
  }

  for (const nested of Object.values(value)) {
    if (isRecord(nested)) {
      gates.push(...collectQualityGates(nested, depth + 1));
    } else if (Array.isArray(nested)) {
      for (const item of nested) {
        gates.push(...collectQualityGates(item, depth + 1));
      }
    }
  }

  return gates;
}

function collectToolResponseTexts(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectToolResponseTexts);
  }
  if (!isRecord(value)) {
    return [];
  }

  const texts: string[] = [];
  if (typeof value.text === "string") {
    texts.push(value.text);
  }
  if (typeof value.content === "string") {
    texts.push(value.content);
  } else if (Array.isArray(value.content)) {
    texts.push(...value.content.flatMap(collectToolResponseTexts));
  }
  return texts;
}

function parseJsonCandidates(text: string): unknown[] {
  const candidates = [text.trim()];
  const firstObject = text.indexOf("{");
  const lastObject = text.lastIndexOf("}");
  if (firstObject >= 0 && lastObject > firstObject) {
    candidates.push(text.slice(firstObject, lastObject + 1));
  }

  const parsed: unknown[] = [];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    try {
      parsed.push(JSON.parse(candidate) as unknown);
    } catch {
      // Ignore non-JSON tool wrapping text.
    }
  }
  return parsed;
}

function isLikelyFigmaRestAuthFailure(value: unknown): boolean {
  const text = stringifyForSearch(value);
  return /figma/i.test(text) && isLikelyFigmaTokenFailureMessage(text);
}

function stringifyForSearch(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableToolSignature(input: Record<string, unknown>): string {
  const normalized = Object.keys(input)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = input[key];
      return result;
    }, {});

  try {
    return JSON.stringify(normalized);
  } catch {
    return String(normalized);
  }
}

function buildThinkingConfig(reasoningMode?: RuntimeOverrides["reasoningMode"]): ThinkingConfig | undefined {
  if (!reasoningMode) {
    return undefined;
  }

  if (reasoningMode === "disabled") {
    return { type: "disabled" };
  }

  return { type: "adaptive" };
}

function buildEffortLevel(
  reasoningMode?: RuntimeOverrides["reasoningMode"],
  env?: Record<string, string | undefined>,
): EffortLevel | undefined {
  if (!reasoningMode || reasoningMode === "disabled") {
    return undefined;
  }

  if (reasoningMode === "xhigh" && isBedrockRuntimeEnv(env)) {
    return "max";
  }

  return reasoningMode;
}

function isBedrockRuntimeEnv(env?: Record<string, string | undefined>): boolean {
  if (!env) {
    return false;
  }

  if (isTruthyEnvValue(env.CLAUDE_CODE_USE_BEDROCK)) {
    return true;
  }

  const model = env.ANTHROPIC_MODEL ?? env.ANTHROPIC_DEFAULT_MODEL ?? "";
  return /^(?:[a-z0-9-]+\.)?anthropic\.claude-/i.test(model);
}

function isTruthyEnvValue(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^(?:1|true|yes|on)$/i.test(value.trim());
}

function buildClaudeDynamicWorkflowSettings(
  prompt: string,
  reasoningMode?: RuntimeOverrides["reasoningMode"],
  workflowMode: RuntimeOverrides["workflowMode"] = "auto",
): { enableWorkflows?: true; disableWorkflows?: true; ultracode?: true } {
  if (workflowMode === "off") {
    return { disableWorkflows: true };
  }

  const wantsDynamicWorkflow = workflowMode === "force"
    || isExplicitDynamicWorkflowPrompt(prompt);
  return {
    enableWorkflows: true,
    ...(wantsDynamicWorkflow && reasoningMode === "xhigh" ? { ultracode: true } : {}),
  };
}

export function createPromptSource(prompt: string, attachments: PromptAttachment[]): AsyncIterable<SDKUserMessage> {
  return (async function* promptSource(): AsyncIterable<SDKUserMessage> {
    yield createPromptMessage(prompt, attachments);
  })();
}

function createPromptMessage(prompt: string, attachments: PromptAttachment[]): SDKUserMessage {
  const content = buildRunnerPromptContentBlocks(prompt, attachments) as unknown as SDKUserMessage["message"]["content"];

  return {
    type: "user",
    message: {
      role: "user",
      content,
    },
    parent_tool_use_id: null,
  };
}

class PromptInputQueue implements AsyncIterable<SDKUserMessage>, AsyncIterator<SDKUserMessage> {
  private readonly queue: SDKUserMessage[] = [];
  private waiter: ((result: IteratorResult<SDKUserMessage>) => void) | null = null;
  private closed = false;

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return this;
  }

  enqueue(prompt: string, attachments: PromptAttachment[]): void {
    if (this.closed) {
      throw new Error("Prompt input queue is closed.");
    }

    const message = createPromptMessage(prompt, attachments);
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      waiter({ done: false, value: message });
      return;
    }

    this.queue.push(message);
  }

  next(): Promise<IteratorResult<SDKUserMessage>> {
    if (this.queue.length > 0) {
      return Promise.resolve({ done: false, value: this.queue.shift() as SDKUserMessage });
    }

    if (this.closed) {
      return Promise.resolve({ done: true, value: undefined });
    }

    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      waiter({ done: true, value: undefined });
    }
  }

  isClosed(): boolean {
    return this.closed;
  }
}
