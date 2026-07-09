import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("chat selection comments avoid body-wide selection locks that can flicker other UI", () => {
  const eventCardSource = readFileSync("src/ui/components/EventCard.tsx", "utf8");
  const cssSource = readFileSync("src/ui/index.css", "utf8");

  assert.doesNotMatch(eventCardSource, /CHAT_SELECTION_ACTIVE_BODY_ATTR/);
  assert.doesNotMatch(eventCardSource, /CHAT_SELECTION_ALLOWED_ATTR/);
  assert.doesNotMatch(eventCardSource, /CHAT_SELECTION_POPOVER_ATTR/);
  assert.doesNotMatch(eventCardSource, /document\.body\.setAttribute/);
  assert.doesNotMatch(eventCardSource, /document\.body\.removeAttribute/);
  assert.doesNotMatch(eventCardSource, /enableChatSelectionScope\(/);
  assert.doesNotMatch(eventCardSource, /disableChatSelectionScope\(/);
  assert.match(eventCardSource, /selectionStartBlockRef\.current = getSelectionBlockElement\(event\.target as Node \| null, container\);/);

  assert.doesNotMatch(cssSource, /body\[data-chat-selection-active="true"\]/);
  assert.doesNotMatch(cssSource, /data-chat-selection-allow/);
  assert.doesNotMatch(cssSource, /data-chat-selection-popover/);
});
