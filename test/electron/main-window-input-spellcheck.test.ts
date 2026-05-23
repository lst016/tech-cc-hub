import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("main window disables macOS spellcheck-driven replacements", () => {
  const source = readFileSync("src/electron/main.ts", "utf8");
  assert.match(source, /webPreferences:\s*\{[\s\S]*spellcheck:\s*process\.platform !== "darwin"/);
});
