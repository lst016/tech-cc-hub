import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("runner denies WebFetch for authenticated BrowserView URLs", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.match(source, /AUTHENTICATED_BROWSER_URL_HOST_PATTERN/);
  assert.match(source, /teambition\\\.pook\\\.com/);
  assert.match(source, /toolName !== "WebFetch"/);
  assert.match(source, /mcp__tech-cc-hub-browser__browser_open_page/);
  assert.match(source, /Do not ask the user to paste task details/);
});
