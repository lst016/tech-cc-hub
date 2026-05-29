import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("preview directory listing skips unreadable children instead of failing the whole tree", () => {
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const viteSource = readFileSync("vite.config.ts", "utf8");

  for (const source of [mainSource, viteSource]) {
    assert.match(source, /\.flatMap\(\(entry\) => \{/);
    assert.match(source, /const entryStat = statSync\(entryPath\)/);
    assert.match(source, /catch \{\s*return \[\];\s*\}/);
  }
});

test("preview directory listing sorts before applying the visible-entry cap", () => {
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const viteSource = readFileSync("vite.config.ts", "utf8");

  assert.ok(
    mainSource.indexOf(".sort((left, right)") < mainSource.indexOf(".slice(0, MAX_PREVIEW_DIRECTORY_ENTRIES)"),
    "Electron preview listing should sort before truncation",
  );
  assert.ok(
    viteSource.indexOf(".sort((left, right)") < viteSource.indexOf(".slice(0, 500)"),
    "Vite preview listing should sort before truncation",
  );
});
