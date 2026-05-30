import test from "node:test";
import assert from "node:assert/strict";

import { filterDisplayMessages } from "../../src/ui/utils/chat-display-messages.js";

test("filterDisplayMessages keeps only the first init message without rescanning per row", () => {
  const messages = [
    { type: "system", subtype: "init", label: "init-0" },
    { type: "assistant", label: "assistant-1" },
    { type: "system", subtype: "init", label: "init-2" },
    { type: "user_prompt", label: "user-3" },
  ];

  const display = filterDisplayMessages(
    messages.map((message, originalIndex) => ({ message, originalIndex })),
    messages,
  );

  assert.deepEqual(display.map((item) => item.message.label), ["init-0", "assistant-1", "user-3"]);
});

test("filterDisplayMessages drops visible init when an older hidden init already exists", () => {
  const messages = [
    { type: "system", subtype: "init", label: "hidden-init" },
    { type: "assistant", label: "hidden-assistant" },
    { type: "system", subtype: "init", label: "visible-init" },
    { type: "user_prompt", label: "visible-user" },
  ];

  const display = filterDisplayMessages(
    messages.slice(2).map((message, offset) => ({ message, originalIndex: offset + 2 })),
    messages,
  );

  assert.deepEqual(display.map((item) => item.message.label), ["visible-user"]);
});
