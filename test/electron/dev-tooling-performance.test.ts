import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("electron transpile uses incremental TypeScript cache", () => {
  const tsconfig = JSON.parse(readFileSync("src/electron/tsconfig.json", "utf8").replace(/\/\/.*$/gm, ""));

  assert.equal(tsconfig.compilerOptions.incremental, true);
  assert.match(tsconfig.compilerOptions.tsBuildInfoFile, /dist-electron/);
});

test("vite dev server ignores generated heavyweight directories", () => {
  const source = readFileSync("vite.config.ts", "utf8");

  for (const ignored of ["**/.tech/**", "**/node_modules/**", "**/dist-test/**", "**/coverage/**", "**/out/**"]) {
    assert.match(source, new RegExp(ignored.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
