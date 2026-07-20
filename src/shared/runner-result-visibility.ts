import { isSuccessfulRunnerResult } from "./runner-status.js";

type RunnerMessageLike = {
  type?: unknown;
  subtype?: unknown;
  result?: unknown;
  message?: unknown;
  terminal_reason?: unknown;
};

function getAssistantContent(message: RunnerMessageLike): unknown[] {
  if (message.type !== "assistant" || !message.message || typeof message.message !== "object") {
    return [];
  }

  const content = "content" in message.message
    ? (message.message as { content?: unknown }).content
    : undefined;
  return Array.isArray(content) ? content : [content];
}

export function hasAssistantTextActivity(message: RunnerMessageLike): boolean {
  return getAssistantContent(message).some((item) => {
    if (typeof item === "string") return item.trim().length > 0;
    if (!item || typeof item !== "object" || !("type" in item) || item.type !== "text") return false;
    const text = "text" in item ? item.text : undefined;
    return typeof text === "string" && text.trim().length > 0;
  });
}

function hasAssistantToolUseActivity(message: RunnerMessageLike): boolean {
  return getAssistantContent(message).some((item) => (
    item !== null && typeof item === "object" && "type" in item && item.type === "tool_use"
  ));
}

export function updateAwaitingVisiblePostToolResponse(
  current: boolean,
  message: RunnerMessageLike,
): boolean {
  if (hasAssistantToolUseActivity(message)) return true;
  if (hasAssistantTextActivity(message)) return false;
  return current;
}

export function getVisibleTerminalResultText(
  message: RunnerMessageLike,
  awaitingVisiblePostToolResponse: boolean,
): string | undefined {
  if (!awaitingVisiblePostToolResponse || !isSuccessfulRunnerResult(message)) {
    return undefined;
  }

  if (typeof message.result !== "string") return undefined;
  const text = message.result.trim();
  return text || undefined;
}
