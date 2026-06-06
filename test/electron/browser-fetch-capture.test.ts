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
  assert.match(browserManagerSource, /responseBodyPreview/);
  assert.match(browserManagerSource, /responseJsonFields/);
});

test("browser_fetch_logs is available to agents and the renderer bridge", () => {
  assert.match(browserToolSource, /"browser_fetch_logs"/);
  assert.match(browserToolSource, /resourceTypes: input\.resourceTypes \?\? \["Fetch", "XHR"\]/);
  assert.match(browserToolSource, /includeHeaders: z\.boolean\(\)\.optional\(\)/);
  assert.match(browserToolSource, /responseJsonFields\/body previews stay available even when includeBody=false/);
  assert.match(preloadSource, /getBrowserWorkbenchFetchLogs/);
  assert.match(preloadSource, /browser-fetch-logs/);
});

test("browser_http_request reuses BrowserView credentials for direct API probes", () => {
  assert.match(browserToolSource, /"browser_http_request"/);
  assert.match(browserToolSource, /reusing browser cookies\/session credentials/);
  assert.match(browserManagerSource, /credentials: "include"/);
  assert.match(browserManagerSource, /responseJsonFields: extractJsonScalarFields/);
});
