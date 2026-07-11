import test from "node:test";
import assert from "node:assert/strict";

test("pending stream appends reuse the private queue and preserve message order", async () => {
  const modulePath = "../../src/ui/utils/pending-stream-messages.js";
  const pendingModule = await import(modulePath).catch(() => ({}));
  const appendPendingStreamMessages = (
    pendingModule as { appendPendingStreamMessages?: <T>(queue: T[] | undefined, next: readonly T[]) => T[] }
  ).appendPendingStreamMessages;
  if (!appendPendingStreamMessages) assert.fail("pending stream helper should be exported");

  const firstBatch = [{ id: "a" }, { id: "b" }];
  const secondBatch = [{ id: "c" }, { id: "d" }];

  const firstQueue = appendPendingStreamMessages(undefined, firstBatch);
  const secondQueue = appendPendingStreamMessages(firstQueue, secondBatch);

  assert.strictEqual(secondQueue, firstQueue);
  assert.deepEqual(secondQueue, [
    { id: "a" },
    { id: "b" },
    { id: "c" },
    { id: "d" },
  ]);
  assert.deepEqual(firstBatch, [{ id: "a" }, { id: "b" }]);
  assert.deepEqual(secondBatch, [{ id: "c" }, { id: "d" }]);
});
