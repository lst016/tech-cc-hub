import test from "node:test";
import assert from "node:assert/strict";

import {
  getVisibleTerminalResultText,
  hasAssistantTextActivity,
  updateAwaitingVisiblePostToolResponse,
} from "../../src/shared/runner-result-visibility.js";

test("tool use waits for a later visible assistant response", () => {
  const toolUse = {
    type: "assistant",
    message: {
      content: [{ type: "tool_use", name: "StructuredOutput", input: { steps: [] } }],
    },
  };
  const text = {
    type: "assistant",
    message: {
      content: [{ type: "text", text: "最终结果" }],
    },
  };

  assert.equal(updateAwaitingVisiblePostToolResponse(false, toolUse), true);
  assert.equal(updateAwaitingVisiblePostToolResponse(true, text), false);
  assert.equal(hasAssistantTextActivity(text), true);
});

test("tool use wins when text and a tool call share one assistant message", () => {
  const message = {
    type: "assistant",
    message: {
      content: [
        { type: "text", text: "我先执行工具" },
        { type: "tool_use", name: "Read", input: { file_path: "README.md" } },
      ],
    },
  };

  assert.equal(updateAwaitingVisiblePostToolResponse(false, message), true);
});

test("non-empty terminal result becomes visible only after an unanswered tool call", () => {
  const result = { type: "result", subtype: "success", result: "完整结构化报告" };

  assert.equal(getVisibleTerminalResultText(result, true), "完整结构化报告");
  assert.equal(getVisibleTerminalResultText(result, false), undefined);
  assert.equal(getVisibleTerminalResultText({ ...result, result: "  " }, true), undefined);
  assert.equal(getVisibleTerminalResultText({ ...result, subtype: "error" }, true), undefined);
  assert.equal(getVisibleTerminalResultText({ ...result, terminal_reason: "budget_exhausted" }, true), undefined);
});
