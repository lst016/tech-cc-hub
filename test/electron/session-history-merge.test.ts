import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { mergeHistoryReplacementMessages } from "../../src/ui/utils/session-history-merge.js";
import type { StreamMessage } from "../../src/ui/types.js";

describe("session history merge", () => {
  it("keeps live stream messages when a stale running history replace arrives later", () => {
    const livePrompt: StreamMessage = {
      type: "user_prompt",
      prompt: "enter-send-computer-use",
      capturedAt: 123,
    };

    const messages = mergeHistoryReplacementMessages(
      [],
      { status: "running", messages: [livePrompt] },
      "running",
    );

    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.type, "user_prompt");
    assert.equal(messages[0]?.type === "user_prompt" ? messages[0].prompt : "", "enter-send-computer-use");
  });

  it("treats completed history replace as authoritative", () => {
    const livePrompt: StreamMessage = {
      type: "user_prompt",
      prompt: "old-live-message",
      capturedAt: 123,
    };
    const persistedPrompt: StreamMessage = {
      type: "user_prompt",
      prompt: "persisted-message",
      capturedAt: 456,
    };

    const messages = mergeHistoryReplacementMessages(
      [persistedPrompt],
      { status: "completed", messages: [livePrompt] },
      "completed",
    );

    assert.deepEqual(messages, [persistedPrompt]);
  });
});
