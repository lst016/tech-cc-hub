import test from "node:test";
import assert from "node:assert/strict";

import {
  extractInlineBase64ImageFromToolResponse,
  stripInlineBase64ImagesFromMessage,
} from "./libs/tool-output-sanitizer.js";

test("extractInlineBase64ImageFromToolResponse captures screenshot image blocks", () => {
  const image = extractInlineBase64ImageFromToolResponse({
    content: [
      { type: "text", text: "Took a screenshot of the current page's viewport." },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: " AAAA \n BBBB ",
        },
      },
    ],
  });

  assert.deepEqual(image, {
    mimeType: "image/png",
    base64Data: "AAAABBBB",
    textContext: "Took a screenshot of the current page's viewport.",
  });
});

test("stripInlineBase64ImagesFromMessage replaces tool-result images with text", () => {
  const sanitized = stripInlineBase64ImagesFromMessage({
    type: "user",
    message: {
      role: "user",
      content: [{
        tool_use_id: "call_123",
        type: "tool_result",
        content: [
          { type: "text", text: "Took a screenshot of the current page's viewport." },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: "iVBORw0KGgoAAA",
            },
          },
        ],
      }],
    },
  } as unknown as Parameters<typeof stripInlineBase64ImagesFromMessage>[0]);

  const toolResult = (sanitized as unknown as {
    message: { content: Array<{ type: string; content: string }> };
  }).message.content[0];
  assert.equal(toolResult.type, "tool_result");
  assert.equal(typeof toolResult.content, "string");
  assert.match(toolResult.content, /replaced with text/i);
  assert.doesNotMatch(toolResult.content, /iVBORw0KGgoAAA/);
});
