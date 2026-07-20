import type { StreamMessage } from "../types.js";

export function isPureToolProgressHeartbeat(message: StreamMessage): boolean {
  if (message.type !== "tool_progress") return false;
  const progress = message as StreamMessage & {
    heartbeat?: unknown;
    subagent_retry?: unknown;
  };
  return progress.heartbeat === true && progress.subagent_retry == null;
}

function getHeartbeatToolUseId(message: StreamMessage): string | undefined {
  if (!isPureToolProgressHeartbeat(message)) return undefined;
  const toolUseId = (message as { tool_use_id?: unknown }).tool_use_id;
  return typeof toolUseId === "string" && toolUseId ? toolUseId : undefined;
}

/**
 * Keeps at most the latest pure heartbeat for each tool call. Retry-bearing
 * progress messages are deliberately never folded because each retry attempt
 * is meaningful history.
 */
export function appendStoreMessages(
  current: readonly StreamMessage[],
  incoming: readonly StreamMessage[],
): StreamMessage[] {
  if (!incoming.some(isPureToolProgressHeartbeat)) {
    return current.concat(incoming);
  }

  const latestCurrentHeartbeatIndex = new Map<string, number>();
  for (let index = 0; index < current.length; index += 1) {
    const toolUseId = getHeartbeatToolUseId(current[index]);
    if (toolUseId) latestCurrentHeartbeatIndex.set(toolUseId, index);
  }
  const messages = current.filter((message, index) => {
    const toolUseId = getHeartbeatToolUseId(message);
    return !toolUseId || latestCurrentHeartbeatIndex.get(toolUseId) === index;
  });
  const heartbeatIndexByToolUseId = new Map<string, number>();
  for (let index = 0; index < messages.length; index += 1) {
    const toolUseId = getHeartbeatToolUseId(messages[index]);
    if (toolUseId) heartbeatIndexByToolUseId.set(toolUseId, index);
  }

  for (const message of incoming) {
    const toolUseId = getHeartbeatToolUseId(message);
    const existingIndex = toolUseId ? heartbeatIndexByToolUseId.get(toolUseId) : undefined;
    if (toolUseId && existingIndex !== undefined) {
      messages[existingIndex] = message;
      continue;
    }
    if (toolUseId) heartbeatIndexByToolUseId.set(toolUseId, messages.length);
    messages.push(message);
  }
  return messages;
}
