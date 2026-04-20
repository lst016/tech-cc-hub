import test from "node:test";
import assert from "node:assert/strict";

import { buildStatelessContinuationPrompt } from "./stateless-continuation.js";

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

test("buildStatelessContinuationPrompt compresses older history after the model threshold and keeps the latest 5 turns raw", () => {
  const messages = Array.from({ length: 6 }, (_, index) => {
    const round = index + 1;
    return [
      {
        type: "user_prompt" as const,
        prompt: `Round ${round} question: ${"need detailed continuity ".repeat(10)}`,
      },
      {
        type: "result",
        subtype: "success",
        result: `Round ${round} answer: ${"here is a fairly long assistant reply ".repeat(10)}`,
      } as never,
    ];
  }).flat();

  const prompt = buildStatelessContinuationPrompt(
    messages,
    "Please continue from the latest context",
    [],
    {
      contextWindow: 1_000,
      compressionThresholdPercent: 20,
      recentTurnCount: 5,
    },
  );

  assert.match(prompt, /Earlier conversation summary:/);
  assert.match(prompt, /Round 1 question:/);
  assert.doesNotMatch(prompt, /User: Round 1 question:/);
  assert.match(prompt, /User: Round 6 question:/);
  assert.match(prompt, /Assistant: Round 6 answer:/);
});

test("buildStatelessContinuationPrompt keeps raw history when the model threshold is not reached", () => {
  const prompt = buildStatelessContinuationPrompt(
    [
      { type: "user_prompt", prompt: "Short question" },
      { type: "result", subtype: "success", result: "Short answer" } as never,
    ],
    "Continue",
    [],
    {
      contextWindow: 10_000,
      compressionThresholdPercent: 80,
      recentTurnCount: 5,
    },
  );

  assert.doesNotMatch(prompt, /Earlier conversation summary:/);
  assert.match(prompt, /User: Short question/);
  assert.match(prompt, /Assistant: Short answer/);
});
