import test from "node:test";
import assert from "node:assert/strict";

import { createStoredUserPromptMessage, resolveImageAttachmentSrc } from "../shared/attachments.js";

test("createStoredUserPromptMessage preserves attachments for history replay", () => {
  const attachments = [
    {
      id: "image-1",
      kind: "image" as const,
      name: "image.png",
      mimeType: "image/png",
      data: "data:image/png;base64,AAAA",
      preview: "data:image/png;base64,AAAA",
    },
  ];

  assert.deepEqual(createStoredUserPromptMessage("look at this", attachments), {
    type: "user_prompt",
    prompt: "look at this",
    attachments,
  });
});

test("resolveImageAttachmentSrc keeps an existing data URL intact", () => {
  const src = resolveImageAttachmentSrc({
    data: "data:image/png;base64,AAAA",
    preview: "data:image/png;base64,BBBB",
    mimeType: "image/png",
  });

  assert.equal(src, "data:image/png;base64,BBBB");
});

test("resolveImageAttachmentSrc converts raw base64 into a displayable data URL", () => {
  const src = resolveImageAttachmentSrc({
    data: "iVBORw0KGgoAAAANSUhEUgAAAAUA",
    mimeType: "image/png",
    preview: undefined,
  });

  assert.equal(src, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA");
});
