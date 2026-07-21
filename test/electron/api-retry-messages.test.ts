import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { keepLatestApiRetryPerTurn } from "../../src/ui/utils/api-retry-messages.js";
import type { StreamMessage } from "../../src/ui/types.js";

function item(message: StreamMessage, originalIndex: number) {
  return { message, originalIndex };
}

function retry(attempt: number): StreamMessage {
  return {
    type: "system",
    subtype: "api_retry",
    attempt,
    max_retries: 10,
    retry_delay_ms: 100,
    error_status: 429,
    error: "rate_limit",
    uuid: `retry-${attempt}`,
    session_id: "sdk-session",
  } as StreamMessage;
}

test("keepLatestApiRetryPerTurn keeps only the final retry attempt in a turn", () => {
  const messages = [
    item({ type: "user_prompt", prompt: "start" }, 0),
    ...[1, 2, 3, 4, 5].map((attempt, index) => item(retry(attempt), index + 1)),
  ];

  const result = keepLatestApiRetryPerTurn(messages);

  assert.deepEqual(result.map(({ originalIndex }) => originalIndex), [0, 5]);
  assert.equal((result[1]?.message as { attempt?: number }).attempt, 5);
});

test("keepLatestApiRetryPerTurn collapses retries separated by status messages", () => {
  const messages = [
    item({ type: "user_prompt", prompt: "start" }, 0),
    item(retry(1), 1),
    item({ type: "system", subtype: "commands_changed" } as StreamMessage, 2),
    item(retry(2), 3),
  ];

  const result = keepLatestApiRetryPerTurn(messages);

  assert.deepEqual(result.map(({ originalIndex }) => originalIndex), [0, 2, 3]);
});

test("keepLatestApiRetryPerTurn retains the final retry from each user turn", () => {
  const messages = [
    item({ type: "user_prompt", prompt: "first" }, 0),
    item(retry(1), 1),
    item(retry(2), 2),
    item({ type: "assistant" } as StreamMessage, 3),
    item({ type: "user_prompt", prompt: "second" }, 4),
    item(retry(1), 5),
    item(retry(2), 6),
  ];

  const result = keepLatestApiRetryPerTurn(messages);

  assert.deepEqual(result.map(({ originalIndex }) => originalIndex), [0, 2, 3, 4, 6]);
});

test("main and shared chat transcripts apply retry coalescing before rendering", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const sharedTranscriptSource = readFileSync("src/ui/components/chat/ChatTranscript.tsx", "utf8");

  assert.match(appSource, /for \(const item of keepLatestApiRetryPerTurn\(visibleMessages\)\)/);
  assert.match(sharedTranscriptSource, /const transcriptMessages = keepLatestApiRetryPerTurn\(/);
});
