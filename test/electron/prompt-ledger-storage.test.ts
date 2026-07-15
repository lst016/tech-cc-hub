import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildPromptLedgerMessage } from "../../src/shared/prompt-ledger.js";

describe("prompt ledger storage", () => {
  it("keeps token accounting for large tool output without storing full text", () => {
    const message = buildPromptLedgerMessage({
      phase: "continue",
      prompt: "继续",
      historyMessages: [{
        type: "user",
        message: {
          content: [{
            type: "tool_result",
            tool_use_id: "tool-1",
            content: "A".repeat(60_000),
          }],
        },
      }],
    });

    const toolSegment = message.segments.find((segment) => segment.segmentKind === "history_tool_output");
    assert.ok(toolSegment);
    assert.equal(toolSegment.chars, 60_000);
    assert.equal(toolSegment.text, undefined);
    assert.ok(toolSegment.sample.length < 200);
  });

  it("caps stored history segments while preserving aggregate accounting and recent context", () => {
    const historyMessages = Array.from({ length: 1_000 }, (_, index) => ({
      type: "user_prompt",
      prompt: `Round ${index + 1}: ${"history ".repeat(40)}`,
      historyId: `history-${index + 1}`,
    }));
    const expectedHistoryChars = historyMessages.reduce((sum, message) => sum + message.prompt.length, 0);

    const message = buildPromptLedgerMessage({
      phase: "continue",
      prompt: "continue",
      historyMessages,
    });

    const historyBucket = message.buckets.find((bucket) => bucket.id === "history-user-prompt");
    assert.equal(historyBucket?.itemCount, 1_000);
    assert.equal(historyBucket?.chars, expectedHistoryChars);
    assert.ok(message.segments.length <= 120);
    assert.ok(message.segments.some((segment) => segment.messageId === "history-1000"));
    assert.ok(JSON.stringify(message).length < 150_000);
  });
});
