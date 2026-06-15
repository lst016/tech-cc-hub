import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("runner sends user-provided external URLs to BrowserView before WebFetch", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.doesNotMatch(source, /AUTHENTICATED_BROWSER_URL_HOST_PATTERN/);
  assert.doesNotMatch(source, /teambition\\\.pook\\\.com/);
  assert.match(source, /shouldUseBrowserViewBeforeWebFetch/);
  assert.match(source, /promptMentionsUrl/);
  assert.match(source, /isLocalBrowserBypassHost/);
  assert.match(source, /toolName !== "WebFetch"/);
  assert.match(source, /mcp__tech-cc-hub-browser__browser_open_page/);
  assert.match(source, /Do not ask the user to paste task details/);
});
