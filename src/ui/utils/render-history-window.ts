import type { StreamMessage } from "../types.js";

export function getVisibleLimitForMessageIndex(
  totalMessages: number,
  originalIndex: number,
  currentLimit: number,
): number {
  if (originalIndex < 0 || originalIndex >= totalMessages) return currentLimit;
  return Math.min(totalMessages, Math.max(currentLimit, totalMessages - originalIndex));
}

export function getUserPromptAnchoredWindowStart(
  messages: StreamMessage[],
  targetStart: number,
): number {
  for (let index = targetStart; index >= 0; index -= 1) {
    if (messages[index]?.type === "user_prompt") {
      return index;
    }
  }
  return 0;
}
