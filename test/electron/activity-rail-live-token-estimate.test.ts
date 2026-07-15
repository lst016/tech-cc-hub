import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");

test("usage panel token estimates sample bounded live text instead of rescanning the full stream", () => {
  assert.match(source, /const sample = trimmed\.slice\(-2_048\)/);
  assert.match(source, /const livePartialPreview = partialMessage\.slice\(-8_192\)/);
  assert.match(source, /const streamingTokens = estimateLiveTextTokens\(deferredPartialMessage\)/);
  assert.doesNotMatch(source, /estimatePromptLedgerTokens\(deferredPartialMessage\)/);
});
