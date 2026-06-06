import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("browser screenshot save treats empty image buffers as failures", () => {
  const source = readFileSync("src/electron/browser-manager.ts", "utf8");

  assert.match(source, /buffer\.length === 0/);
  assert.match(source, /BrowserView screenshot capture returned an empty image/);
  assert.match(source, /success:\s*false/);
  assert.match(source, /return \{ success: false, result, error: result\.error \}/);
});
