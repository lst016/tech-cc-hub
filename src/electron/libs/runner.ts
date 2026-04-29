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
import { existsSync, statSync } from "fs";
import { extname } from "path";

import { buildAnthropicPromptContentBlocks } from "../../shared/attachments.js";
import type { PromptAttachment, RuntimeOverrides, ServerEvent } from "../types.js";
import { resolveAgentRuntimeContext } from "./agent-resolver.js";
import { buildEnvForConfig, getClaudeCodePath, getCurrentApiConfig, getGlobalRuntimeConfig } from "./claude-settings.js";
import { buildClaudeProjectMemoryPromptAppend } from "./claude-project-memory.js";
import { saveGlobalRuntimeConfig } from "./config-store.js";
import { summarizeBase64Image, summarizeLocalImageFile } from "./image-preprocessor.js";
import { ADMIN_TOOL_NAMES, getAdminMcpServer } from "./mcp-tools/admin.js";
import { BROWSER_TOOL_NAMES, getBrowserMcpServer } from "./mcp-tools/browser.js";
import { DESIGN_TOOL_NAMES, getDesignMcpServer } from "./mcp-tools/design.js";
import { normalizeRunnerError } from "./runner-error.js";
import type { Session } from "./session-store.js";
import {
  buildOversizedTextToolOutputReplacement,
  buildToolImageReplacementText,
  extractInlineBase64ImageFromToolResponse,
} from "./tool-output-sanitizer.js";
import { getEnhancedEnv } from "./util.js";

export type RunnerOptions = {
  prompt: string;
  attachments?: PromptAttachment[];
  runtime?: RuntimeOverrides;
  session: Session;
  resumeSessionId?: string;
  onEvent: (event: ServerEvent) => void;
  onSessionUpdate?: (updates: Partial<Session>) => void;
};

export type RunnerHandle = {
  abort: () => void;
  appendPrompt: (prompt: string, attachments?: PromptAttachment[]) => Promise<void>;
};

const DEFAULT_CWD = process.cwd();
const ALWAYS_ALLOWED_TOOLS = new Set([
  "AskUserQuestion",
  ...BROWSER_TOOL_NAMES,
  ...ADMIN_TOOL_NAMES,
  ...DESIGN_TOOL_NAMES,
]);
const SKILL_ENV_HINTS: Record<string, string[]> = {
  feishu: ["FEISHU", "LARK"],
  飞书: ["FEISHU", "LARK"],
  "figma官方": ["FIGMA"],
  lark: ["LARK", "FEISHU"],
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
const LARGE_IMAGE_READ_GUIDANCE =
  "图片文件过大，不能用 Read 直接读入主上下文。请改用内置图片/设计工具：如果是两张截图对比，用 mcp__tech-cc-hub-design__design_compare_images；如果是当前浏览器页面与参考图对齐，用 mcp__tech-cc-hub-design__design_compare_current_view；如果只需要图片信息，请基于用户消息里的图片资产路径/缩略图路径调用专门视觉工具或让用户裁剪关键区域。";

function getRequestedModelName(configModel: string | undefined, runtimeModel: string | undefined): string | undefined {
  const normalizedRuntimeModel = runtimeModel?.trim();
  if (normalizedRuntimeModel) {
    return normalizedRuntimeModel;
  }

  const normalizedConfigModel = configModel?.trim();
  return normalizedConfigModel || undefined;
}

function getConfiguredModelNames(config: NonNullable<ReturnType<typeof getCurrentApiConfig>>): string[] {
  return Array.from(new Set([
    config.model,
    config.expertModel,
    ...(config.models ?? []).map((item) => item.name),
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

export async function runClaude(options: RunnerOptions): Promise<RunnerHandle> {
  const { prompt, attachments = [], runtime, session, resumeSessionId, onEvent, onSessionUpdate } = options;
  const abortController = new AbortController();
  const permissionMode = runtime?.permissionMode ?? "bypassPermissions";
  const pendingAppends: Array<{ prompt: string; attachments: PromptAttachment[] }> = [];
  let activeQuery: Query | null = null;
  let rasterImageReads = 0;

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

  void (async () => {
    try {
      const config = getCurrentApiConfig();
      const requestedModel = getRequestedModelName(config?.model, runtime?.model);

      if (!config) {
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

      const configuredModelNames = getConfiguredModelNames(config);
      if (requestedModel && configuredModelNames.length > 0 && !configuredModelNames.includes(requestedModel)) {
        const errorMessage = `请求模型「${requestedModel}」失败：它不在当前启用配置的模型列表里，请先在设置里切换到可用模型。`;
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

      const env = buildEnvForConfig(config, runtime?.model);
      const globalRuntimeConfig = getGlobalRuntimeConfig();
      const mergedEnv = {
        ...getEnhancedEnv(),
        ...env,
      };
      let syncedGlobalRuntimeConfig = persistDiscoveredRuntimeConfig(globalRuntimeConfig, mergedEnv);
      const thinking = buildThinkingConfig(runtime?.reasoningMode);
      const effort = buildEffortLevel(runtime?.reasoningMode);
      const projectCwd = session.cwd && existsSync(session.cwd) ? session.cwd : undefined;
      const resolvedCwd = projectCwd ?? DEFAULT_CWD;
      const runSurface = runtime?.runSurface ?? session.runSurface ?? "development";
      const agentId = runtime?.agentId ?? session.agentId;
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
      const hooks = buildQualityHooks(resolvedCwd, { config, prompt });
      const browserToolServer = getBrowserMcpServer();
      const adminToolServer = getAdminMcpServer();
      const designToolServer = getDesignMcpServer();
      const systemPromptAppend = combineSystemPromptAppend(
        buildGlobalRuntimePromptAppend(syncedGlobalRuntimeConfig, mergedEnv),
        buildAdminConfigPromptAppend(),
        agentContext.systemPromptAppend,
        buildClaudeProjectMemoryPromptAppend(projectCwd),
        buildToolCallOptimizationPromptAppend(),
        buildBrowserWorkbenchPromptAppend(),
        buildDesignParityPromptAppend(),
      );

      const q = query({
        prompt: createPromptSource(prompt, attachments),
        options: {
          model: runtime?.model?.trim() || undefined,
          cwd: resolvedCwd,
          resume: resumeSessionId,
          abortController,
          env: mergedEnv,
          thinking,
          effort,
          pathToClaudeCodeExecutable: getClaudeCodePath(),
          permissionMode,
          settingSources: agentContext.settingSources,
          systemPrompt: systemPromptAppend
            ? { type: "preset", preset: "claude_code", append: systemPromptAppend }
            : undefined,
          includePartialMessages: true,
          includeHookEvents: true,
          mcpServers: {
            [browserToolServer.name]: browserToolServer,
            [adminToolServer.name]: adminToolServer,
            [designToolServer.name]: designToolServer,
          },
          hooks,
          allowDangerouslySkipPermissions: permissionMode === "bypassPermissions",
          canUseTool: async (toolName, input, { signal }) => {
            if (permissionMode === "plan") {
              return {
                behavior: "deny",
                message: "当前为计划模式，不会执行工具。",
              };
            }

            if (toolName === "AskUserQuestion") {
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

                signal.addEventListener("abort", () => {
                  session.pendingPermissions.delete(toolUseId);
                  resolve({ behavior: "deny", message: "Session aborted" });
                });
              });
            }

            if (toolName === "Skill" && shouldDenyExternalBrowseSkill(input, prompt)) {
              return {
                behavior: "deny",
                message: "当前任务是在测试 tech-cc-hub 的 Electron 内置浏览器工作台，请使用 mcp__tech-cc-hub-browser__browser_get_state / browser_extract_page 等 MCP 工具，不要使用外部 browse skill。",
              };
            }

            if (toolName === "Skill" && isRecord(input)) {
              const requestedSkill = typeof input.skill === "string" ? input.skill.trim() : "";
              if (requestedSkill) {
                syncedGlobalRuntimeConfig = persistDiscoveredRuntimeConfig(
                  syncedGlobalRuntimeConfig,
                  mergedEnv,
                  requestedSkill,
                );
              }
            }

            if (toolName === "Read" && isRecord(input)) {
              const filePath = typeof input.file_path === "string" ? input.file_path.trim() : "";
              if (!shouldPreprocessImageRead(config, filePath)) {
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

            if (effectiveAllowedTools && !effectiveAllowedTools.has(toolName) && !isAlwaysAllowedTool(toolName)) {
              return {
                behavior: "deny",
                message: `当前运行面不允许使用工具：${toolName}`,
              };
            }

            return { behavior: "allow", updatedInput: input };
          },
        },
      });
      activeQuery = q;

      for (const pendingAppend of pendingAppends.splice(0)) {
        await q.streamInput(createPromptSource(pendingAppend.prompt, pendingAppend.attachments));
      }

      for await (const message of q) {
        if (message.type === "system" && "subtype" in message && message.subtype === "init") {
          const sdkSessionId = message.session_id;
          if (sdkSessionId) {
            session.claudeSessionId = sdkSessionId;
            onSessionUpdate?.({ claudeSessionId: sdkSessionId });
          }
        }

        sendMessage(message);

        if (message.type === "result") {
          const status = message.subtype === "success" ? "completed" : "error";
          onEvent({
            type: "session.status",
            payload: { sessionId: session.id, status, title: session.title },
          });
        }
      }

      if (session.status === "running") {
        onEvent({
          type: "session.status",
          payload: { sessionId: session.id, status: "completed", title: session.title },
        });
      }
      activeQuery = null;
    } catch (error) {
      activeQuery = null;
      if ((error as Error).name === "AbortError") {
        return;
      }

      const errorMessage = normalizeRunnerError(
        error,
        getRequestedModelName(getCurrentApiConfig()?.model, runtime?.model),
      );

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
    abort: () => abortController.abort(),
    appendPrompt: async (nextPrompt: string, nextAttachments: PromptAttachment[] = []) => {
      if (!activeQuery) {
        pendingAppends.push({ prompt: nextPrompt, attachments: nextAttachments });
        return;
      }
      await activeQuery.streamInput(createPromptSource(nextPrompt, nextAttachments));
    },
  };
}

function buildEffectiveAllowedToolSet(
  sessionAllowedTools: string | undefined,
  agentAllowedTools: string[] | undefined,
  enforceAgentPolicy: boolean,
): Set<string> | null {
  const parsedSessionTools = parseAllowedTools(sessionAllowedTools);
  const parsedAgentTools = new Set((agentAllowedTools ?? []).map((tool) => tool.trim()).filter(Boolean));

  if (enforceAgentPolicy) {
    if (parsedSessionTools && parsedSessionTools.size > 0 && parsedAgentTools.size > 0) {
      return new Set(Array.from(parsedSessionTools).filter((tool) => parsedAgentTools.has(tool)));
    }
    if (parsedAgentTools.size > 0) {
      return parsedAgentTools;
    }
    return parsedSessionTools;
  }

  if (parsedAgentTools.size > 0) {
    return parsedAgentTools;
  }

  return null;
}

function parseAllowedTools(value: string | undefined): Set<string> | null {
  if (!value?.trim()) {
    return null;
  }

  const parsed = value
    .split(",")
    .map((tool) => tool.trim())
    .filter(Boolean);

  return parsed.length > 0 ? new Set(parsed) : null;
}

function isAlwaysAllowedTool(toolName: string): boolean {
  if (ALWAYS_ALLOWED_TOOLS.has(toolName)) {
    return true;
  }

  const alwaysAllowedMcpTools = [
    ...BROWSER_TOOL_NAMES,
    ...ADMIN_TOOL_NAMES,
    ...DESIGN_TOOL_NAMES,
  ];

  return alwaysAllowedMcpTools.some((allowedToolName) => (
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
  const hasConfiguredRuntime = configuredEnvKeys.length > 0 || skillCredentialHints.length > 0;
  const autoDiscoverLabel = hasConfiguredRuntime ? "" : "（未发现自定义凭证映射，已自动发现当前环境候选）";

  if (envKeys.length === 0 && skillCredentialHints.length === 0) {
    return undefined;
  }

  const hints: string[] = [
    "全局运行参数已启用（用于技能与工具执行）：",
    "若执行 skill/tool 需要鉴权，请优先使用对应环境变量；不要向用户暴露或回显密钥原文。",
  ];

  if (configuredEnvKeys.length > 0 || discoveredEnvKeys.length > 0) {
    hints.push(
      `已注入环境变量（名字）${autoDiscoverLabel}：${envKeys.join("、")}`,
    );
  }

  if (skillCredentialHints.length > 0) {
    hints.push("技能凭证映射（按技能归纳）：");
    hints.push(...skillCredentialHints.map((hint) => `- ${hint}`));
  }

  return hints.join("\n");
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
      hints.add(`${skillName}: ${envs.join("、")}`);
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

function buildBrowserWorkbenchPromptAppend(): string {
  return [
    "内置规则默认要求：涉及网页查看、抓取、调试、标注、截图的场景，默认优先使用 Electron 内置浏览器工作台（BrowserView）。",
    "当前客户端提供 Electron 内置浏览器工作台工具。",
    "当用户提到“内置浏览器”“当前页面”“这个网页”“爬取页面数据”“读取网页内容”时，优先使用浏览器 MCP 工具读取当前 BrowserView，不要回答自己无法访问浏览器。",
    "不要为这些请求调用 Skill browse、ToolSearch 查找浏览器工具或 ~/.claude/skills/gstack/browse；那些连接的是外部浏览器会话，不是 tech-cc-hub 的右侧 BrowserView。",
    "常用工具：browser_get_state 获取当前 URL/标题；browser_extract_page 提取当前页面正文、标题、链接和图片；browser_console_logs 读取控制台日志；browser_capture_visible 截取可见区域。",
    "开发诊断工具：browser_get_dom_stats 统计 DOM 节点规模；browser_query_nodes 按 CSS selector 或 XPath 定向查节点；browser_inspect_styles 读取目标节点的计算样式、CSS 变量和内联样式。",
    "If the current prompt contains <browser_annotations>, treat page.url, dom.selector, dom.xpath, and dom.path as the primary targeting hints before searching the codebase by visible text.",
    "For a prompt with <browser_annotations>, the latest annotation supersedes older screenshots, older browser annotations, and earlier modal/dialog tasks from resumed session history unless the user explicitly says to keep working on that same old target.",
    "If dom.context.ancestorChain or dom.context.nearbyText is present, use that section context before grepping generic button/link text.",
    "If the annotation selector is too generic, recover the real interactive element from the same page location with xpath/path or browser inspection tools first, then locate the code.",
  ].join("\n");
}

function buildAdminConfigPromptAppend(): string {
  return [
    "运行配置持久化规则：如需向 `agent-runtime.json` 写入通用配置（如 `env`、`skillCredentials`、`closeSidebarOnBrowserOpen`），应优先使用 `mcp__tech-cc-hub-admin__set_global_runtime_config` 工具。",
    "工具只做合规持久化更新，不应回显任何密钥明文；返回值按字段名统计变化即可。",
  ].join("\n");
}

function buildToolCallOptimizationPromptAppend(): string {
  return [
    "Tool reliability rules: only call tools that are present in the current system tool list. Do not invent tools such as Explore; use Agent with an available subagent_type or inspect files directly.",
    "Before using deferred or schema-sensitive tools such as WebSearch, WebFetch, TodoWrite, Agent, or Skill, make sure their schema is available in the current context; if not, call ToolSearch first with select:<ToolName>, then retry.",
    "On Windows paths, prefer PowerShell-safe commands or quote paths carefully. Do not pass unquoted D:\\path values through bash-style commands because backslashes can be swallowed.",
    "When parallel tool calls are optional, avoid grouping fragile probes together: one failed parallel call can cancel sibling calls. Split uncertain filesystem probes from required reads.",
    "工具调用优化规则：已知多个具体文件需要查看时，优先并发读取，不要串行一个个 Read。",
    "目标文件不明确时，先用一次只读 Bash 搜索/筛选收敛范围，例如 rg/find/sed/awk，再读取少量命中文件。",
    "避免碎片链路：ls -> cat -> grep -> cat。能用一次 rg 或一次批量只读命令得到结论时，不要拆成多次工具调用。",
    "只读批量操作可以合并；写入、删除、移动、安装、提交等有副作用操作不要混进批量 Bash。",
    "复盘时如果发现同目录串行多次 Read、重复 Bash、ls/cat/grep 链路，应优先建议改成并发读取或先搜索收敛。",
  ].join("\n");
}

function buildDesignParityPromptAppend(): string {
  return [
    "设计还原规则：只要用户提供截图、Figma 图、页面参考图，并要求生成或修改 UI/前端代码，必须优先使用内置设计 MCP 工具。",
    "如果当前轮包含用户上传/粘贴的单张参考图，第一步必须调用 `design_inspect_image` 读取结构化视觉摘要；不要用 Read 读取图片，也不要把同一张图传给 `design_compare_images` 的 reference 和 candidate。",
    "`design_capture_current_view` 可将当前 BrowserView 截图保存成 PNG；`design_compare_current_view` 可将当前截图与 Figma/参考图做截图比照，并返回当前截图、diff 图、三栏 comparison 图、差异比例、尺寸信息；`design_compare_images` 仅用于两张不同本地截图。",
    "修 UI 时先生成当前截图和 comparison 图，再根据差异依次调整布局尺寸、间距、信息密度、颜色、字体、阴影和图标细节。",
  ].join("\n");
}

function shouldDenyExternalBrowseSkill(input: unknown, prompt: string): boolean {
  if (!isRecord(input)) {
    return false;
  }

  const requestedSkill = typeof input.skill === "string" ? input.skill.trim().toLowerCase() : "";
  if (requestedSkill !== "browse") {
    return false;
  }

  return /内置浏览器|浏览器工作台|当前页面|这个页面|这个网页|爬取|browserview|browser workbench|tech-cc-hub-browser/i.test(prompt);
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

  if (filePath.includes("/prompt-attachments/")) {
    return {
      denyMessage:
        `这是用户上传截图落盘后的图片资产，不允许用 Read 直接读入主 Agent。请用 mcp__tech-cc-hub-design__design_compare_images 或 mcp__tech-cc-hub-design__design_compare_current_view 处理该路径：${filePath}`,
      countRead: false,
    };
  }

  if (currentImageReads >= MAX_IMAGE_READS_PER_RUN) {
    return {
      denyMessage:
        "当前这轮已经读取过一张图片。继续读取多张栅格图很容易撑爆上下文，请只保留最关键的一张，或改为让用户指定要看哪张。",
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
          `${LARGE_IMAGE_READ_GUIDANCE} 当前文件大小：${Math.round(size / 1024)} KB。`,
        countRead: false,
      };
    }
  } catch {
    return { countRead: true };
  }

  return { countRead: true };
}

function isRasterImagePath(filePath: string): boolean {
  return RASTER_IMAGE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function shouldPreprocessImageRead(
  config: NonNullable<ReturnType<typeof getCurrentApiConfig>> | null,
  filePath: string,
): boolean {
  void config;
  void filePath;
  // 临时关闭 Read 图片时的图片模型摘要拦截，避免截图比照/附件链路被替换成不可靠文本。
  return false;
}

function createImageSummaryToolOutput(summary: string): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: summary }],
  };
}

function buildQualityHooks(
  _cwd: string,
  options: {
    config: NonNullable<ReturnType<typeof getCurrentApiConfig>>;
    prompt: string;
  },
): Partial<Record<string, HookCallbackMatcher[]>> {
  void _cwd;
  const { config, prompt } = options;
  const readFiles = new Set<string>();
  let lastToolSignature: string | null = null;
  let toolFailureCount = 0;
  let repeatWarningCount = 0;
  let rasterImageReads = 0;

  return {
    UserPromptSubmit: [{
      hooks: [async (input) => {
        if (!("prompt" in input) || typeof input.prompt !== "string") {
          return { continue: true };
        }

        const prompt = input.prompt.trim();
        const hints: string[] = [];
        if (prompt.length > 0 && prompt.length < 12) {
          hints.push("用户提示较短，执行前先收束关键假设，避免大范围误改");
        }
        if (/[它他她这个那个这里那里上面下面]/.test(prompt) && prompt.length < 48) {
          hints.push("提示里有较多指代词，输出时优先显式说明你依据的对象");
        }

        if (hints.length === 0) {
          return { continue: true };
        }

        return {
          continue: true,
          hookSpecificOutput: {
            hookEventName: "UserPromptSubmit",
            additionalContext: `质量提醒：${hints.join("；")}`,
          },
        };
      }],
    }],
    PreToolUse: [{
      hooks: [async (input) => {
        if (!("tool_name" in input) || typeof input.tool_name !== "string") {
          return { continue: true };
        }

        const toolName = input.tool_name;
        const toolInput = isRecord(input.tool_input) ? input.tool_input : {};
        const normalizedInput: Record<string, unknown> = { ...toolInput };
        const hints: string[] = [];
        const fixes: string[] = [];
        let didMutate = false;

        const trimmed = (value: string): string => value.replace(/\s+/g, " ").trim();
        const setTrimmed = (key: string, label: string, raw: unknown): void => {
          if (typeof raw !== "string") {
            return;
          }

          const fixed = trimmed(raw);
          if (fixed !== raw) {
            normalizedInput[key] = fixed;
            didMutate = true;
            fixes.push(`${label} 去除空白`);
          }
        };

        const normalizeCommand = (raw: unknown): void => {
          if (typeof raw !== "string") {
            return;
          }

          const fixed = trimmed(raw.replace(/\n/g, " "));
          if (fixed !== raw) {
            normalizedInput.command = fixed;
            didMutate = true;
            fixes.push("Bash command 规范化");
          }
        };

        if (["Read", "Edit", "Write", "MultiEdit"].includes(toolName)) {
          const filePath = typeof toolInput.file_path === "string" ? toolInput.file_path : "";
          if (!filePath) {
            hints.push(`${toolName} 缺少 file_path，建议先补齐目标路径`);
          } else {
            const fixed = trimmed(filePath);
            if (fixed !== filePath) {
              normalizedInput.file_path = fixed;
              didMutate = true;
              fixes.push("file_path 去除空白");
            }
            if (toolName === "Read") {
              if (!shouldPreprocessImageRead(config, fixed)) {
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
              hints.push(`修改/写入前未读过 ${fixed}，建议补一次 Read`);
            }
          }
        }

        if (toolName === "Bash") {
          normalizeCommand(toolInput.command);
          if (typeof toolInput.command !== "string" || !toolInput.command.trim()) {
            hints.push("Bash 缺少 command 参数");
          } else {
            setTrimmed("command", "command", toolInput.command);
            const command = (toolInput.command as string).toLowerCase();
            if (/(rm\s+-rf|git\s+reset\s+--hard|mkfs|dd\s+if=|format\s+)/i.test(command)) {
              hints.push("Bash 存在高风险命令，建议先确认参数边界");
            }
          }
        }

        if (toolName === "Glob") {
          setTrimmed("path", "path", toolInput.path);
          setTrimmed("pattern", "pattern", toolInput.pattern);
          if (typeof toolInput.pattern !== "string" || !toolInput.pattern.trim()) {
            hints.push("Glob 缺少 pattern，建议给出明确匹配表达式");
          }
        }

        if (toolName === "Search") {
          setTrimmed("path", "path", toolInput.path);
          setTrimmed("query", "query", toolInput.query);
          if (typeof toolInput.query !== "string" || !toolInput.query.trim()) {
            hints.push("Search 缺少 query，建议给出检索关键字");
          }
        }

        if (toolName === "TodoWrite") {
          setTrimmed("content", "content", toolInput.content);
        }

        const toolSignature = `${toolName}:${stableToolSignature(normalizedInput)}`;
        if (lastToolSignature === toolSignature) {
          repeatWarningCount += 1;
          hints.push("与上条工具输入重复，建议先看上条返回再决定是否重试");
        } else {
          repeatWarningCount = 0;
        }
        lastToolSignature = toolSignature;

        if (repeatWarningCount >= 2) {
          hints.push("重复重试次数偏高，请调整参数后再调用工具");
        }

        if (fixes.length === 0 && hints.length === 0) {
          return { continue: true };
        }

        const additionalContext = `工具参数优化：${[...fixes, ...hints].join("；")}`;
        return {
          continue: true,
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            additionalContext,
            ...(didMutate ? { updatedInput: normalizedInput } : {}),
          },
        };
      }],
    }],
    PostToolUse: [{
      hooks: [async (input) => {
        if (!("tool_name" in input) || typeof input.tool_name !== "string") {
          return { continue: true };
        }

        if (input.tool_name === "Read") {

        const toolInput = isRecord(input.tool_input) ? input.tool_input : {};
        const filePath = typeof toolInput.file_path === "string" ? toolInput.file_path.trim() : "";
        if (!shouldPreprocessImageRead(config, filePath)) {
          return { continue: true };
        }

        try {
          const summary = await summarizeLocalImageFile({ config, prompt, filePath });
          if (!summary) {
            return { continue: true };
          }

          return {
            continue: true,
            hookSpecificOutput: {
              hookEventName: "PostToolUse",
              additionalContext: `已将图片读取结果替换为 ${config.imageModel?.trim() || "图片模型"} 的中文摘要，避免原图进入上下文。`,
              updatedMCPToolOutput: createImageSummaryToolOutput(summary),
            },
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const fallback = [
            `图片文件：${filePath}`,
            "图片预处理失败，已阻止原图直接进入上下文。",
            `失败原因：${message}`,
            "请优先读取相邻文档说明，或只处理用户明确指定的一张关键图片。",
          ].join("\n");

          return {
            continue: true,
            hookSpecificOutput: {
              hookEventName: "PostToolUse",
              additionalContext: fallback,
              updatedMCPToolOutput: createImageSummaryToolOutput(fallback),
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
              updatedMCPToolOutput: createImageSummaryToolOutput(oversizedText.replacementText),
            },
          };
        }

        const summarizedPrompt = [
          prompt.trim(),
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
              updatedMCPToolOutput: createImageSummaryToolOutput(replacementText),
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
              updatedMCPToolOutput: createImageSummaryToolOutput(fallback),
            },
          };
        }
      }],
    }],
    PostToolUseFailure: [{
      hooks: [async () => {
        toolFailureCount += 1;
        return {
          continue: true,
          hookSpecificOutput: {
            hookEventName: "PostToolUseFailure",
            additionalContext: toolFailureCount >= 2
              ? "工具已连续失败，下一步先总结错误原因并换路径，必要时升级专家模型"
              : "工具失败后先利用错误信息缩小范围，不要直接重复同一调用",
          },
        };
      }],
    }],
  };
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

function buildEffortLevel(reasoningMode?: RuntimeOverrides["reasoningMode"]): EffortLevel | undefined {
  if (!reasoningMode || reasoningMode === "disabled") {
    return undefined;
  }

  return reasoningMode;
}

export function createPromptSource(prompt: string, attachments: PromptAttachment[]): AsyncIterable<SDKUserMessage> {
  return (async function* promptSource(): AsyncIterable<SDKUserMessage> {
    const content = attachments.length > 0
      ? buildAnthropicPromptContentBlocks(prompt, attachments) as unknown as SDKUserMessage["message"]["content"]
      : prompt;

    yield {
      type: "user",
      message: {
        role: "user",
        content,
      },
      parent_tool_use_id: null,
    };
  })();
}
