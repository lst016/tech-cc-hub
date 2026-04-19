import { query, type EffortLevel, type SDKMessage, type PermissionResult, type SDKUserMessage, type ThinkingConfig } from "@anthropic-ai/claude-agent-sdk";
import type { PromptAttachment, RuntimeOverrides, ServerEvent } from "../types.js";
import type { Session } from "./session-store.js";
import { existsSync } from "fs";

import { getCurrentApiConfig, buildEnvForConfig, getClaudeCodePath} from "./claude-settings.js";
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

  const sendMessage = (message: SDKMessage) => {
    onEvent({
      type: "stream.message",
      payload: { sessionId: session.id, message }
    });
  };

  const sendPermissionRequest = (toolUseId: string, toolName: string, input: unknown) => {
    onEvent({
      type: "permission.request",
      payload: { sessionId: session.id, toolUseId, toolName, input }
    });
  };

  // Start the query in the background
  (async () => {
    try {
      // 获取当前配置
      const config = getCurrentApiConfig();
      
      if (!config) {
        onEvent({
          type: "session.status",
          payload: { sessionId: session.id, status: "error", title: session.title, cwd: session.cwd, error: "API configuration not found. Please configure API settings." }
        });
        return;
      }
      
      // 使用 Anthropic SDK
      const env = buildEnvForConfig(config, runtime?.model);
      const mergedEnv = {
        ...getEnhancedEnv(),
        ...env
      };
      const thinking = buildThinkingConfig(runtime?.reasoningMode);
      const effort = buildEffortLevel(runtime?.reasoningMode);
      
      const resolvedCwd = session.cwd && existsSync(session.cwd) ? session.cwd : DEFAULT_CWD;

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
          permissionMode: "bypassPermissions",
          includePartialMessages: true,
          allowDangerouslySkipPermissions: true,
          canUseTool: async (toolName, input, { signal }) => {
            // For AskUserQuestion, we need to wait for user response
            if (toolName === "AskUserQuestion") {
              const toolUseId = crypto.randomUUID();

              // Send permission request to frontend
              sendPermissionRequest(toolUseId, toolName, input);

              // Create a promise that will be resolved when user responds
              return new Promise<PermissionResult>((resolve) => {
                session.pendingPermissions.set(toolUseId, {
                  toolUseId,
                  toolName,
                  input,
                  resolve: (result) => {
                    session.pendingPermissions.delete(toolUseId);
                    resolve(result as PermissionResult);
                  }
                });

                // Handle abort
                signal.addEventListener("abort", () => {
                  session.pendingPermissions.delete(toolUseId);
                  resolve({ behavior: "deny", message: "Session aborted" });
                });
              });
            }

            // Auto-approve other tools
            return { behavior: "allow", updatedInput: input };
          }
        }
      });

      // Capture session_id from init message
      for await (const message of q) {
        // Extract session_id from system init message
        if (message.type === "system" && "subtype" in message && message.subtype === "init") {
          const sdkSessionId = message.session_id;
          if (sdkSessionId) {
            session.claudeSessionId = sdkSessionId;
            onSessionUpdate?.({ claudeSessionId: sdkSessionId });
          }
        }

        // Send message to frontend
        sendMessage(message);

        // Check for result to update session status
        if (message.type === "result") {
          const status = message.subtype === "success" ? "completed" : "error";
          onEvent({
            type: "session.status",
            payload: { sessionId: session.id, status, title: session.title }
          });
        }
      }

      // Query completed normally
      if (session.status === "running") {
        onEvent({
          type: "session.status",
          payload: { sessionId: session.id, status: "completed", title: session.title }
        });
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        // Session was aborted, don't treat as error
        return;
      }
      onEvent({
        type: "session.status",
        payload: { sessionId: session.id, status: "error", title: session.title, error: String(error) }
      });
    }
  })();

  return {
    abort: () => abortController.abort()
  };
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

function createPromptSource(prompt: string, attachments: PromptAttachment[]): string | AsyncIterable<SDKUserMessage> {
  if (attachments.length === 0) {
    return prompt;
  }

  return (async function* promptSource(): AsyncIterable<SDKUserMessage> {
    const contentBlocks: Array<Record<string, unknown>> = [];

    if (prompt.trim()) {
      contentBlocks.push({
        type: "text",
        text: prompt.trim(),
      });
    }

    for (const attachment of attachments) {
      if (attachment.kind === "image") {
        const base64Data = stripDataUrlPrefix(attachment.data);
        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: attachment.mimeType,
            data: base64Data,
          },
        });
        continue;
      }

      const normalizedText = attachment.data.trim();
      if (!normalizedText) {
        continue;
      }

      contentBlocks.push({
        type: "text",
        text: `附件文件：${attachment.name}\n\`\`\`\n${truncateTextAttachment(normalizedText)}\n\`\`\``,
      });
    }

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

function stripDataUrlPrefix(data: string): string {
  const [, base64Data = data] = data.split(",", 2);
  return base64Data;
}

function truncateTextAttachment(text: string, maxChars = 20_000): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n\n[已截断，原始长度 ${text.length} 字符]`;
}
