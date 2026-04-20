import test from "node:test";
import assert from "node:assert/strict";

import { buildStatelessContinuationPrompt } from "../src/electron/stateless-continuation.js";

test("buildStatelessContinuationPrompt marks image attachments on the latest turn in stateless mode", () => {
  const prompt = buildStatelessContinuationPrompt(
    [
      { type: "user_prompt", prompt: "please read the image" },
      { type: "result", subtype: "success", result: "I could not see any uploaded image." } as never,
    ],
    "analyze this image",
    [
      {
        id: "image-1",
        kind: "image",
        name: "image.png",
        mimeType: "image/png",
        data: "data:image/png;base64,AAAA",
      },
    ],
  );

  assert.match(prompt, /latest message includes attachments: 1 attachment, 1 image/i);
  assert.match(prompt, /if image attachments are present in the current turn, analyze them directly/i);
  assert.match(prompt, /do not repeat earlier claims that an image was missing/i);
});
