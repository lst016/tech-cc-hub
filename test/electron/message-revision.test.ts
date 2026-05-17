import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRevisionComposerPrompt,
  resolveRevisionReferenceSource,
} from "../../src/ui/utils/message-revision.js";

test("resolveRevisionReferenceSource prefers the selected chat text", () => {
  const source = resolveRevisionReferenceSource({
    selectedText: "  只改这一段建议  ",
    fallbackText: "整条助手消息",
    fallbackLabel: "助手",
  });

  assert.deepEqual(source, {
    kind: "selection",
    text: "只改这一段建议",
    sourceLabel: "助手选区",
  });
});

test("resolveRevisionReferenceSource falls back to the full message", () => {
  const source = resolveRevisionReferenceSource({
    selectedText: "",
    fallbackText: "\n整条助手消息\n",
    fallbackLabel: "助手",
  });

  assert.deepEqual(source, {
    kind: "message",
    text: "整条助手消息",
    sourceLabel: "助手",
  });
});

test("buildRevisionComposerPrompt appends a concrete revision scaffold without clobbering drafts", () => {
  const prompt = buildRevisionComposerPrompt("已有草稿");

  assert.equal(prompt, "已有草稿\n\n请重新修改上方引用内容。\n\n修改要求：\n- ");
});
