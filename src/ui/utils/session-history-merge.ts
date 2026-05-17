import type { SessionStatus, StreamMessage } from "../types.js";

type SessionMessageSnapshot = {
  status: SessionStatus;
  messages: StreamMessage[];
};

function getMessageStableKey(message: StreamMessage): string {
  if (message.historyId) {
    return `history:${message.historyId}`;
  }

  if ("uuid" in message && typeof message.uuid === "string" && message.uuid.length > 0) {
    return `uuid:${message.uuid}`;
  }

  if (message.type === "user_prompt") {
    return `user:${message.capturedAt ?? "na"}:${message.prompt}`;
  }

  return `fallback:${message.type}:${message.capturedAt ?? "na"}:${JSON.stringify(message)}`;
}

export function mergeMessages(olderMessages: StreamMessage[], newerMessages: StreamMessage[]): StreamMessage[] {
  const merged: StreamMessage[] = [];
  const seen = new Set<string>();

  for (const message of [...olderMessages, ...newerMessages]) {
    const key = getMessageStableKey(message);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(message);
  }

  return merged;
}

export function mergeHistoryReplacementMessages(
  historyMessages: StreamMessage[],
  existingSession: SessionMessageSnapshot,
  nextStatus: SessionStatus,
): StreamMessage[] {
  if (existingSession.messages.length === 0) return historyMessages;

  // A running session can receive live stream events before an in-flight
  // history request finishes. Keep those live messages instead of letting a
  // stale replace response make the chat appear unsent.
  if (existingSession.status === "running" || nextStatus === "running") {
    return mergeMessages(historyMessages, existingSession.messages);
  }

  return historyMessages;
}
