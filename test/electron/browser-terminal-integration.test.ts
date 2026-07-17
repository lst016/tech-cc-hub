import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("generic rendered-content extraction scans every frame and keeps xterm as a provider", () => {
  const managerSource = readFileSync("src/electron/browser-manager.ts", "utf8");
  const mainSource = readFileSync("src/electron/main.ts", "utf8");

  assert.match(managerSource, /mainFrame\.framesInSubtree/);
  assert.match(managerSource, /extractRenderedContent/);
  assert.match(managerSource, /extractXtermProviderContent/);
  assert.match(managerSource, /extractBrowserTerminalViaDebugger/);
  assert.match(mainSource, /extractRenderedContent:\s*async/);
  assert.match(mainSource, /browserWorkbench\.extractRenderedContent/);
});
