import type { StreamMessage } from "../types.js";

export function getUserPromptAnchoredWindowStart(messages: StreamMessage[], targetStart: number): number {
  for (let index = targetStart; index >= 0; index -= 1) {
    if (messages[index]?.type === "user_prompt") {
      return index;
    }
  }
  return 0;
}
