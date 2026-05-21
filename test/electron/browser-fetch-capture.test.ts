import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const browserManagerSource = readFileSync(join(process.cwd(), "src/electron/browser-manager.ts"), "utf8");
const browserToolSource = readFileSync(join(process.cwd(), "src/electron/libs/mcp-tools/browser.ts"), "utf8");
const preloadSource = readFileSync(join(process.cwd(), "src/electron/preload.cts"), "utf8");

test("BrowserWorkbench captures Fetch/XHR bodies through the DevTools Network domain", () => {
  assert.match(browserManagerSource, /Network\.enable/);
  assert.match(browserManagerSource, /Network\.requestWillBeSent/);
  assert.match(browserManagerSource, /Network\.responseReceived/);
  assert.match(browserManagerSource, /Network\.loadingFinished/);
  assert.match(browserManagerSource, /Network\.getResponseBody/);
  assert.match(browserManagerSource, /resourceType !== "fetch" && resourceType !== "xhr"/);
  assert.match(browserManagerSource, /SENSITIVE_HEADER_NAMES/);
});

test("browser_fetch_logs is available to agents and the renderer bridge", () => {
  assert.match(browserToolSource, /"browser_fetch_logs"/);
  assert.match(browserToolSource, /resourceTypes: input\.resourceTypes \?\? \["Fetch", "XHR"\]/);
  assert.match(browserToolSource, /includeHeaders: z\.boolean\(\)\.optional\(\)/);
  assert.match(preloadSource, /getBrowserWorkbenchFetchLogs/);
  assert.match(preloadSource, /browser-fetch-logs/);
});
