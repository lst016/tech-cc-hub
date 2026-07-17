import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("browser open and bounds IPC are registered before the renderer can restore a page", () => {
  const source = readFileSync("src/electron/main.ts", "utf8");
  const rendererLoadIndex = source.indexOf("await loadRenderer(mainWindow)");
  const browserOpenIndex = source.indexOf('ipcMainHandle("browser-open"');
  const browserBoundsIndex = source.indexOf('ipcMainHandle("browser-set-bounds"');

  assert.ok(rendererLoadIndex >= 0, "expected the main renderer load");
  assert.ok(browserOpenIndex >= 0 && browserOpenIndex < rendererLoadIndex);
  assert.ok(browserBoundsIndex >= 0 && browserBoundsIndex < rendererLoadIndex);
  assert.equal(source.match(/ipcMainHandle\("browser-open"/g)?.length, 1);
  assert.equal(source.match(/ipcMainHandle\("browser-set-bounds"/g)?.length, 1);
});
