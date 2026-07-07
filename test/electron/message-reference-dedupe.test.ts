import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("message references replace duplicate chat comments instead of piling them up", () => {
  const source = readFileSync("src/ui/store/useAppStore.ts", "utf8");

  assert.match(source, /const withoutDuplicate = existing\.filter\(\(item\) => !\(/);
  assert.match(source, /item\.sourceRole === nextReference\.sourceRole/);
  assert.match(source, /item\.sourceLabel === nextReference\.sourceLabel/);
  assert.match(source, /item\.text === nextReference\.text/);
  assert.match(source, /item\.capturedAt === nextReference\.capturedAt/);
  assert.match(source, /item\.kind === nextReference\.kind/);
  assert.match(source, /\|\| \(item\.kind !== "message" && nextReference\.kind !== "message"\)/);
});