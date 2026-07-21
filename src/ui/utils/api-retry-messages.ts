import type { StreamMessage } from "../types.js";

type StreamMessageItem = {
  message: StreamMessage;
};

function isApiRetryMessage(message: StreamMessage): boolean {
  return message.type === "system" && "subtype" in message && message.subtype === "api_retry";
}

/**
 * Retry events are status updates for the current user turn, not separate chat
 * messages. Keep the newest update until the next explicit user prompt starts a
 * new turn.
 */
export function keepLatestApiRetryPerTurn<T extends StreamMessageItem>(items: readonly T[]): T[] {
  const result: T[] = [];
  let latestRetryIndex: number | undefined;

  for (const item of items) {
    if (item.message.type === "user_prompt") {
      latestRetryIndex = undefined;
    }

    if (isApiRetryMessage(item.message)) {
      if (latestRetryIndex !== undefined) {
        result.splice(latestRetryIndex, 1);
      }
      result.push(item);
      latestRetryIndex = result.length - 1;
      continue;
    }

    result.push(item);
  }

  return result;
}
