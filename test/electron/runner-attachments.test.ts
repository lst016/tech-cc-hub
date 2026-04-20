import test from "node:test";
import assert from "node:assert/strict";

import { buildAnthropicPromptContentBlocks } from "../../src/shared/attachments.js";

test("buildAnthropicPromptContentBlocks emits Anthropic image content blocks for image attachments", () => {
  const contentBlocks = buildAnthropicPromptContentBlocks("describe this image", [
    {
      kind: "image",
      name: "image.png",
      mimeType: "image/png",
      data: "data:image/png;base64,AAAA",
      preview: "data:image/png;base64,AAAA",
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
        data: "AAAA",
      },
    },
  ]);
});
