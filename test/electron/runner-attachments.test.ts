import test from "node:test";
import assert from "node:assert/strict";

import { buildAnthropicPromptContentBlocks } from "../../src/shared/attachments.js";

test("buildAnthropicPromptContentBlocks only emits image blocks from explicit runtimeData", () => {
  const contentBlocks = buildAnthropicPromptContentBlocks("describe this image", [
    {
      kind: "image",
      name: "image.png",
      mimeType: "image/png",
      data: "data:image/png;base64,AAAA",
      preview: "data:image/png;base64,AAAA",
      runtimeData: "data:image/png;base64,BBBB",
    },
  ]);

  assert.deepEqual(contentBlocks, [
    {
      type: "text",
      text: "describe this image",
    },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: "BBBB",
      },
    },
  ]);
});

test("buildAnthropicPromptContentBlocks does not leak preview base64 into the main agent", () => {
  const contentBlocks = buildAnthropicPromptContentBlocks("use this screenshot", [
    {
      kind: "image",
      name: "image.png",
      mimeType: "image/png",
      data: "data:image/png;base64,AAAA",
      preview: "data:image/png;base64,AAAA",
      summaryText: "图片资产：/tmp/image.png",
    },
  ]);

  assert.deepEqual(contentBlocks, [
    {
      type: "text",
      text: "use this screenshot",
    },
    {
      type: "text",
      text: "图片资产：/tmp/image.png",
    },
  ]);
});
