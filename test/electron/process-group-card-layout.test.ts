import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("expanded process details are not clipped by an inner fixed-height scroller", () => {
  const source = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");

  assert.doesNotMatch(source, /max-h-64 overflow-auto/);
  assert.match(source, /overflow-visible rounded-lg/);
});
