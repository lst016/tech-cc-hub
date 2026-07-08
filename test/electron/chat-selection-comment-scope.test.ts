import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("chat selection drag scope disables selection outside the active chat message", () => {
  const eventCardSource = readFileSync("src/ui/components/EventCard.tsx", "utf8");
  const cssSource = readFileSync("src/ui/index.css", "utf8");

  assert.match(eventCardSource, /const CHAT_SELECTION_ACTIVE_BODY_ATTR = "data-chat-selection-active";/);
  assert.match(eventCardSource, /const CHAT_SELECTION_ALLOWED_ATTR = "data-chat-selection-allow";/);
  assert.match(eventCardSource, /const enableChatSelectionScope = \(container: HTMLElement \| null\) => \{/);
  assert.match(eventCardSource, /container\.setAttribute\(CHAT_SELECTION_ALLOWED_ATTR, "true"\);/);
  assert.match(eventCardSource, /document\.body\.setAttribute\(CHAT_SELECTION_ACTIVE_BODY_ATTR, "true"\);/);
  assert.match(eventCardSource, /const disableChatSelectionScope = \(\) => \{/);
  assert.match(eventCardSource, /document\.body\.removeAttribute\(CHAT_SELECTION_ACTIVE_BODY_ATTR\);/);
  assert.match(eventCardSource, /disableChatSelectionScope\(\);\s+setSelectionDraft\(null\);/);
  assert.match(eventCardSource, /captureSelectionDraft\(\);\s+disableChatSelectionScope\(\);/);
  assert.match(eventCardSource, /enableChatSelectionScope\(container\);\s+selectionStartBlockRef\.current = getSelectionBlockElement/);
  assert.match(eventCardSource, /\{\.\.\.\{ \[CHAT_SELECTION_POPOVER_ATTR\]: "true" \}\}/);

  assert.match(cssSource, /body\[data-chat-selection-active="true"\] \*/);
  assert.match(cssSource, /\[data-chat-selection-allow="true"\],/);
  assert.match(cssSource, /\[data-chat-selection-popover="true"\],/);
});
