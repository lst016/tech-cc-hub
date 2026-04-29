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
});
