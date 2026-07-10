import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { shouldShowChatThinkingPlaceholder } from "../../src/ui/utils/chat-thinking-state.js";

test("shows thinking placeholder while the assistant has not streamed any visible output yet", () => {
  assert.equal(shouldShowChatThinkingPlaceholder({
    isRunning: true,
    partialMessage: "",
    showPartialMessage: false,
    lastRenderableEntryType: "user_prompt",
  }), true);
});

test("hides thinking placeholder once partial output starts or another entry appears", () => {
  assert.equal(shouldShowChatThinkingPlaceholder({
    isRunning: true,
    partialMessage: "",
    showPartialMessage: true,
    lastRenderableEntryType: "user_prompt",
  }), false);

  assert.equal(shouldShowChatThinkingPlaceholder({
    isRunning: true,
    partialMessage: "Hello",
    showPartialMessage: false,
    lastRenderableEntryType: "user_prompt",
  }), false);

  assert.equal(shouldShowChatThinkingPlaceholder({
    isRunning: true,
    partialMessage: "",
    showPartialMessage: false,
    lastRenderableEntryType: "process_group",
  }), false);
});

test("App renders the ChatGPT-style thinking text placeholder", () => {
  const source = readFileSync("src/ui/App.tsx", "utf8");
  assert.match(source, /<ThinkingTextPlaceholder \/>/);
  assert.match(source, /正在思考/);
});
