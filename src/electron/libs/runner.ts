import {
  query,
  type EffortLevel,
  type HookCallbackMatcher,
  type PermissionResult,
  type SDKMessage,
  type SDKUserMessage,
  type ThinkingConfig,
} from "@anthropic-ai/claude-agent-sdk";
import { existsSync } from "fs";

import { buildAnthropicPromptContentBlocks } from "../../shared/attachments.js";
import type { PromptAttachment, RuntimeOverrides, ServerEvent } from "../types.js";
import { buildEnvForConfig, getClaudeCodePath, getCurrentApiConfig } from "./claude-settings.js";
import type { Session } from "./session-store.js";
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

export async function runClaude(options: RunnerOptions): Promise<RunnerHandle> {
  const { prompt, attachments = [], runtime, session, resumeSessionId, onEvent, onSessionUpdate } = options;
  const abortController = new AbortController();
  const permissionMode = runtime?.permissionMode ?? "bypassPermissions";

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

      const env = buildEnvForConfig(config, runtime?.model);
      const mergedEnv = {
        ...getEnhancedEnv(),
        ...env,
      };
      const thinking = buildThinkingConfig(runtime?.reasoningMode);
      const effort = buildEffortLevel(runtime?.reasoningMode);
      const resolvedCwd = session.cwd && existsSync(session.cwd) ? session.cwd : DEFAULT_CWD;
      const hooks = buildQualityHooks(resolvedCwd);

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
          includePartialMessages: true,
          includeHookEvents: true,
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

      onEvent({
        type: "session.status",
        payload: { sessionId: session.id, status: "error", title: session.title, error: String(error) },
      });
    }
  })();

  return {
    abort: () => abortController.abort(),
  };
}

function buildQualityHooks(_cwd: string): Partial<Record<string, HookCallbackMatcher[]>> {
  void _cwd;
  const readFiles = new Set<string>();
  let lastToolSignature: string | null = null;
  let toolFailureCount = 0;
  let repeatWarningCount = 0;

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
