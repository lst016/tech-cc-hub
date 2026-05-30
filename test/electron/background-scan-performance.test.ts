import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("task artifact workspace walk skips generated cache directories", () => {
  const source = readFileSync("src/electron/libs/task/executor.ts", "utf8");

  for (const skipped of [".tech", ".turbo", ".vite", "build", "coverage", "out", "dist-test", "node_modules"]) {
    assert.match(source, new RegExp(`part === "${skipped.replace(".", "\\.")}"`));
  }
  assert.match(source, /visited < 2000/);
});

test("memory JSON mirror is bounded for large memory stores", () => {
  const source = readFileSync("src/electron/libs/mcp-tools/knowledge.ts", "utf8");

  assert.match(source, /MEMORY_JSON_MIRROR_LIMIT/);
  assert.match(source, /repo\.listAll\(workspaceScope as MemoryScope, \{ limit: MEMORY_JSON_MIRROR_LIMIT \+ 1 \}\)/);
  assert.match(source, /truncated/);
});
