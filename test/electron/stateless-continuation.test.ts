import test from "node:test";
import assert from "node:assert/strict";

import { buildStatelessContinuationPrompt } from "../../src/electron/stateless-continuation.js";

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

test("buildStatelessContinuationPrompt compresses by default when context metadata is missing", () => {
  const longChunk = "连续上下文".repeat(10_000);
  const messages = Array.from({ length: 6 }, (_, index) => {
    const round = index + 1;
    return [
      {
        type: "user_prompt" as const,
        prompt: `第${round}轮问题：${longChunk}`,
      },
      {
        type: "result",
        subtype: "success",
        result: `第${round}轮回答：${longChunk}`,
      } as never,
    ];
  }).flat();

  const prompt = buildStatelessContinuationPrompt(messages, "继续");

  assert.match(prompt, /Earlier conversation summary:/);
  assert.match(prompt, /Latest user message: 继续/);
});

test("buildStatelessContinuationPrompt counts latest text attachments toward the compression budget", () => {
  const messages = Array.from({ length: 4 }, (_, index) => {
    const round = index + 1;
    return [
      {
        type: "user_prompt" as const,
        prompt: `Round ${round} question: ${"follow-up ".repeat(40)}`,
      },
      {
        type: "result",
        subtype: "success",
        result: `Round ${round} answer: ${"answer ".repeat(40)}`,
      } as never,
    ];
  }).flat();

  const prompt = buildStatelessContinuationPrompt(
    messages,
    "Continue with the attached spec",
    [
      {
        id: "attachment-1",
        kind: "text",
        name: "spec.md",
        mimeType: "text/markdown",
        data: "Detailed attachment body. ".repeat(600),
      },
    ],
    {
      contextWindow: 5_000,
      compressionThresholdPercent: 40,
      recentTurnCount: 4,
    },
  );

  assert.match(prompt, /Earlier conversation summary:/);
  assert.match(prompt, /latest message includes attachments: 1 attachment, 1 text attachment/i);
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
  assert.match(prompt, /Round 6 question:/);
  assert.match(prompt, /Latest user message: Please continue from the latest context/);
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

test("buildStatelessContinuationPrompt still compresses when the latest five turns alone exceed the threshold", () => {
  const messages = Array.from({ length: 5 }, (_, index) => {
    const round = index + 1;
    const repeated = "这是一个非常长的连续上下文片段，用来模拟高 token 会话。".repeat(90);
    return [
      {
        type: "user_prompt" as const,
        prompt: `第 ${round} 轮问题：${repeated}`,
      },
      {
        type: "result",
        subtype: "success",
        result: `第 ${round} 轮回答：${repeated}`,
      } as never,
    ];
  }).flat();

  const prompt = buildStatelessContinuationPrompt(
    messages,
    "继续处理当前问题",
    [],
    {
      contextWindow: 4_000,
      compressionThresholdPercent: 40,
      recentTurnCount: 5,
    },
  );

  assert.match(prompt, /Earlier conversation summary:/);
  assert.match(prompt, /Latest user message: 继续处理当前问题/);
});
