import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { preprocessImageAttachmentsCore } from "../../src/electron/libs/image/image-preprocessor-core.js";
import type { PromptAttachment } from "../../src/electron/types.js";

function createImageAttachment(): PromptAttachment {
  return {
    id: "image-1",
    kind: "image",
    name: "image.png",
    mimeType: "image/png",
    data: "data:image/png;base64,AAAA",
    runtimeData: "data:image/png;base64,AAAA",
    preview: "data:image/png;base64,AAAA",
    size: 4,
  };
}

test("preprocessImageAttachments fails instead of silently dispatching images without an image model", () => {
  const source = readFileSync("src/electron/libs/image/image-preprocessor.ts", "utf8");
  const missingConfigStart = source.indexOf("if (!config || !imageModel)");
  const coreCallStart = source.indexOf("return preprocessImageAttachmentsCore", missingConfigStart);
  const missingConfigBranch = source.slice(missingConfigStart, coreCallStart);

  assert.ok(missingConfigStart >= 0);
  assert.ok(coreCallStart > missingConfigStart);
  assert.match(missingConfigBranch, /success:\s*false/);
  assert.match(missingConfigBranch, /图片预处理模型/);
  assert.doesNotMatch(missingConfigBranch, /success:\s*true/);
});

test("preprocessImageAttachmentsCore keeps dispatchable image attachment when image summary is empty", async () => {
  const attachment = createImageAttachment();

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
