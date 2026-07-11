import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getUserPromptAnchoredWindowStart } from "../../src/ui/utils/render-history-window.js";
import type { StreamMessage } from "../../src/ui/types.js";

function assistantMessage(label: string): StreamMessage {
  return {
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "text", text: label }],
    },
  } as StreamMessage;
}

test("visible message windows start at the current user prompt when a turn exceeds the UI limit", () => {
  const messages: StreamMessage[] = [
    {
      type: "user_prompt",
      prompt: "older prompt",
      capturedAt: 1,
      historyId: "older-prompt",
    },
    ...Array.from({ length: 2223 }, (_, index) => assistantMessage(`older process ${index}`)),
    {
      type: "user_prompt",
      prompt: "current prompt",
      capturedAt: 2,
      historyId: "current-prompt",
    },
    ...Array.from({ length: 1832 }, (_, index) => assistantMessage(`current process ${index}`)),
  ];
  const targetWindowStart = messages.length - 160;

  const windowStart = getUserPromptAnchoredWindowStart(messages, targetWindowStart);

  assert.equal(windowStart, 2224);
  assert.equal(messages[windowStart]?.type, "user_prompt");
  assert.equal(messages[windowStart]?.type === "user_prompt" ? messages[windowStart].prompt : "", "current prompt");
});

test("visible message windows keep the current turn boundary even when the turn is oversized", () => {
  const messages: StreamMessage[] = [
    {
      type: "user_prompt",
      prompt: "current prompt",
      capturedAt: 1,
      historyId: "current-prompt",
    },
    ...Array.from({ length: 500 }, (_, index) => assistantMessage(`current process ${index}`)),
  ];
  const targetWindowStart = messages.length - 160;

  const windowStart = getUserPromptAnchoredWindowStart(messages, targetWindowStart, 260);

  assert.equal(windowStart, 0);
  assert.equal(messages[windowStart]?.type, "user_prompt");
});

test("visible message windows keep the full loaded page when the user prompt boundary is not loaded yet", () => {
  const messages: StreamMessage[] = Array.from({ length: 400 }, (_, index) => assistantMessage(`current process ${index}`));
  const targetWindowStart = messages.length - 160;

  const windowStart = getUserPromptAnchoredWindowStart(messages, targetWindowStart);

  assert.equal(windowStart, 0);
});

test("renderer store keeps loaded messages instead of trimming chat history", () => {
  const storeSource = readFileSync("src/ui/store/useAppStore.ts", "utf8");
  const renderWindowSource = readFileSync("src/ui/utils/render-history-window.ts", "utf8");

  assert.doesNotMatch(storeSource, /trimMessagesToRecent/);
  assert.doesNotMatch(renderWindowSource, /MAX_RENDERER_HISTORY_MESSAGES/);
  assert.doesNotMatch(renderWindowSource, /trimMessagesToRecent/);
  assert.match(storeSource, /const messages = session\.messages\.concat\(nextMessages\)/);
  assert.match(storeSource, /const shouldUpdateGoal = nextMessages\.some\(messageMayAffectGoalSnapshot\)/);
  assert.match(storeSource, /latestGoal: shouldUpdateGoal \? deriveLatestGoalSnapshot\(session\.id, messages, session\.latestGoal\) : session\.latestGoal/);
});
