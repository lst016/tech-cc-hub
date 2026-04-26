import {
  query,
  type EffortLevel,
  type HookCallbackMatcher,
  type PermissionResult,
  type SDKMessage,
  type SDKUserMessage,
  type ThinkingConfig,
} from "@anthropic-ai/claude-agent-sdk";
import { existsSync, statSync } from "fs";
import { extname } from "path";

import { buildAnthropicPromptContentBlocks } from "../../shared/attachments.js";
import type { PromptAttachment, RuntimeOverrides, ServerEvent } from "../types.js";
import { resolveAgentRuntimeContext } from "./agent-resolver.js";
import { buildEnvForConfig, getClaudeCodePath, getCurrentApiConfig } from "./claude-settings.js";
import { summarizeBase64Image, summarizeLocalImageFile } from "./image-preprocessor.js";
import { BROWSER_TOOL_NAMES, getBrowserMcpServer } from "./browser-mcp-tools.js";
import { normalizeRunnerError } from "./runner-error.js";
import type { Session } from "./session-store.js";
import { buildToolImageReplacementText, extractInlineBase64ImageFromToolResponse } from "./tool-output-sanitizer.js";
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
};

const DEFAULT_CWD = process.cwd();
const ALWAYS_ALLOWED_TOOLS = new Set([
  "AskUserQuestion",
  ...BROWSER_TOOL_NAMES,
]);
const RASTER_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);
const MAX_IMAGE_READS_PER_RUN = 1;
const MAX_SINGLE_IMAGE_READ_BYTES = 400_000;

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
      const mergedEnv = {
        ...getEnhancedEnv(),
        ...env,
      };
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
      const systemPromptAppend = combineSystemPromptAppend(
        agentContext.systemPromptAppend,
        buildBrowserWorkbenchPromptAppend(),
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
    } catch (error) {
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

  return BROWSER_TOOL_NAMES.some((browserToolName) => (
    toolName.endsWith(`__${browserToolName}`) ||
    toolName.endsWith(`:${browserToolName}`) ||
    toolName.endsWith(`/${browserToolName}`)
  ));
}

function combineSystemPromptAppend(...sections: Array<string | undefined>): string | undefined {
  const joined = sections
    .map((section) => section?.trim())
    .filter((section): section is string => Boolean(section))
    .join("\n\n");
  return joined || undefined;
}

function buildBrowserWorkbenchPromptAppend(): string {
  return [
    "内置规则默认要求：涉及网页查看、抓取、调试、标注、截图的场景，默认优先使用 Electron 内置浏览器工作台（BrowserView）。",
    "当前客户端提供 Electron 内置浏览器工作台工具。",
    "当用户提到“内置浏览器”“当前页面”“这个网页”“爬取页面数据”“读取网页内容”时，优先使用浏览器 MCP 工具读取当前 BrowserView，不要回答自己无法访问浏览器。",
    "不要为这些请求调用 Skill browse、ToolSearch 查找浏览器工具或 ~/.claude/skills/gstack/browse；那些连接的是外部浏览器会话，不是 tech-cc-hub 的右侧 BrowserView。",
    "常用工具：browser_get_state 获取当前 URL/标题；browser_extract_page 提取当前页面正文、标题、链接和图片；browser_console_logs 读取控制台日志；browser_capture_visible 截取可见区域。",
    "开发诊断工具：browser_get_dom_stats 统计 DOM 节点规模；browser_query_nodes 按 CSS selector 或 XPath 定向查节点；browser_inspect_styles 读取目标节点的计算样式、CSS 变量和内联样式。",
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
          `图片文件过大（${Math.round(size / 1024)} KB），直接读取容易造成上下文溢出。请改读相邻文档说明，或只处理裁剪后的关键截图。`,
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
  return Boolean(config?.imageModel?.trim()) && isRasterImagePath(filePath);
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
          return { continue: true };
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

export function createPromptSource(prompt: string, attachments: PromptAttachment[]): string | AsyncIterable<SDKUserMessage> {
  if (attachments.length === 0) {
    return prompt;
  }

  return (async function* promptSource(): AsyncIterable<SDKUserMessage> {
    const contentBlocks = buildAnthropicPromptContentBlocks(prompt, attachments);

    yield {
      type: "user",
      message: {
        role: "user",
        content: contentBlocks as unknown as SDKUserMessage["message"]["content"],
      },
      parent_tool_use_id: null,
    };
  })();
}
