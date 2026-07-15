import assert from "node:assert/strict";
import test from "node:test";

import { waitForBrowserRenderedContent } from "../../src/electron/libs/browser-workbench/browser-rendered-content-wait.js";
import type { BrowserRenderedContentResult } from "../../src/electron/libs/browser-workbench/browser-rendered-content.js";

function renderedResult(text: string, fingerprint: string): BrowserRenderedContentResult {
  return {
    url: "https://app.example/",
    framesScanned: 1,
    framesFailed: 0,
    surfaceCount: 1,
    semanticSurfaceCount: 1,
    surfaces: [{
      selector: "#surface",
      tagName: "canvas",
      semantic: true,
      semantics: [{ provider: "custom", kind: "scene", text }],
      frameUrl: "https://app.example/",
    }],
    fingerprint,
    warnings: [],
  };
}

test("rendered content wait returns after any provider output changes", async () => {
  const reads = [renderedResult("loading", "rendered-old-7"), renderedResult("ready", "rendered-new-5")];
  let now = 0;
  const result = await waitForBrowserRenderedContent(
    async () => ({ success: true, result: reads.shift()! }),
    { previousFingerprint: "rendered-old-7", timeoutMs: 1_000, pollIntervalMs: 100 },
    { now: () => now, sleep: async (milliseconds) => { now += milliseconds; } },
  );

  assert.equal(result.conditionMatched, true);
  assert.equal(result.matchReason, "changed");
  assert.equal(result.result?.surfaces[0].semantics[0].text, "ready");
});

test("rendered content wait searches text across all semantic providers", async () => {
  let now = 0;
  const result = await waitForBrowserRenderedContent(
    async () => ({ success: true, result: renderedResult("still loading", "rendered-same-13") }),
    { untilText: "complete", timeoutMs: 250, pollIntervalMs: 100 },
    { now: () => now, sleep: async (milliseconds) => { now += milliseconds; } },
  );

  assert.equal(result.conditionMatched, false);
  assert.equal(result.timedOut, true);
  assert.equal(result.result?.surfaces[0].semantics[0].text, "still loading");
});
