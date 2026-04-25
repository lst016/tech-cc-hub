import test from "node:test";
import assert from "node:assert/strict";

import { buildPromptLedgerMessage } from "../../src/shared/prompt-ledger.js";

test("buildPromptLedgerMessage keeps full history size metrics but caps stored tool output text", () => {
  const hugeToolOutput = "tool output payload ".repeat(20_000);
  const ledger = buildPromptLedgerMessage({
    phase: "continue",
    prompt: "继续",
    historyMessages: [
      {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "large-read",
              content: hugeToolOutput,
            },
          ],
        },
      },
    ],
  });

  const segment = ledger.segments.find((item) => item.segmentKind === "history_tool_output");

  assert.ok(segment);
  assert.equal(segment.chars, hugeToolOutput.length);
  assert.ok((segment.text?.length ?? 0) < hugeToolOutput.length);
  assert.match(segment.text ?? "", /\[truncated/);
});
