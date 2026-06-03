// Minimal node:test test to verify the runner works under Electron
import { test } from "node:test";
import assert from "node:assert/strict";

test("basic 1+1=2", () => {
  assert.equal(1 + 1, 2);
});

test("async resolves", async () => {
  const x = await Promise.resolve(42);
  assert.equal(x, 42);
});
