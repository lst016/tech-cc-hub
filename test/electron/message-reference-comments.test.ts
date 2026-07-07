import assert from "node:assert/strict";
import test from "node:test";

import { extractMessageReferencesPrompt } from "../../src/ui/utils/code-reference-prompt.js";

test("parses commented chat selections from message references", () => {
  const prompt = [
    "逐条回复这些 CR 意见",
    "<message_references>",
    JSON.stringify({
      type: "message_references",
      version: 1,
      count: 1,
      items: [{
        type: "message_comment",
        index: 1,
        comment: "先回这个点，解释为什么保留现在的实现。",
        source: {
          role: "assistant",
          label: "助手消息",
          capturedAt: 1779368400000,
        },
        selection: {
          text: "这里是被选中的聊天内容",
        },
      }],
    }, null, 2),
    "</message_references>",
  ].join("\n");

  const result = extractMessageReferencesPrompt(prompt);

  assert.equal(result.visiblePrompt, "逐条回复这些 CR 意见");
  assert.deepEqual(result.messageReferences, [{
    index: 1,
    kind: "comment",
    sourceRole: "assistant",
    sourceLabel: "助手消息",
    capturedAt: 1779368400000,
    comment: "先回这个点，解释为什么保留现在的实现。",
    textPreview: "这里是被选中的聊天内容",
  }]);
});