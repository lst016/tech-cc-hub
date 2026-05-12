import test from "node:test";
import assert from "node:assert/strict";

import {
  createStoredUserPromptMessage,
  estimateAttachmentPromptChars,
  resolveImageAttachmentSrc,
} from "../../src/shared/attachments.js";

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

test("estimateAttachmentPromptChars counts stored image summary instead of raw image bytes", () => {
  const chars = estimateAttachmentPromptChars({
    kind: "image",
    name: "large-reference.png",
    mimeType: "image/png",
    data: "tech-cc-hub://prompt-attachments/session-id/image.png",
    storageUri: "tech-cc-hub://prompt-attachments/session-id/image.png",
    storagePath: "D:\\tmp\\image.png",
    size: 4_800_000,
    summaryText: "Local image asset; use design_inspect_image with the saved path.",
  });

  assert.ok(chars < 1_000);
});
