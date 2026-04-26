import test from "node:test";
import assert from "node:assert/strict";

import { preprocessImageAttachmentsCore } from "./image-preprocessor-core.js";
import type { PromptAttachment } from "../types.js";

test("preprocessImageAttachmentsCore keeps dispatchable image attachment when image summary is empty", async () => {
  const attachment: PromptAttachment = {
    id: "image-1",
    kind: "image",
    name: "image.png",
    mimeType: "image/png",
    data: "data:image/png;base64,AAAA",
    runtimeData: "data:image/png;base64,AAAA",
    preview: "data:image/png;base64,AAAA",
    size: 4,
  };

  const result = await preprocessImageAttachmentsCore({
    imageModel: "image-model",
    selectedModel: "text-model",
    attachments: [attachment],
    persistImageAttachmentReference: async () => ({
      storagePath: "D:\\tmp\\image.png",
      storageUri: "file:///D:/tmp/image.png",
      size: 4,
    }),
    summarizeImageAttachment: async () => {
      throw new Error("image model did not return a usable summary");
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.attachments.length, 1);
  assert.equal(result.attachments[0].data, "file:///D:/tmp/image.png");
  assert.equal(result.attachments[0].preview, "data:image/png;base64,AAAA");
  assert.equal(result.attachments[0].runtimeData, undefined);
  assert.match(result.attachments[0].summaryText ?? "", /image\.png/);
  assert.match(result.attachments[0].summaryText ?? "", /not return a usable summary/i);
});
