import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("system init directory stays in the compact metadata grid", () => {
  const source = readFileSync("src/ui/components/EventCard.tsx", "utf8");

  assert.match(source, /<InfoItem name="目录" value=\{systemMsg\.cwd \|\| "-"\} \/>/);
  assert.doesNotMatch(source, /<InfoItem name="目录" value=\{systemMsg\.cwd \|\| "-"\} wide \/>/);
  assert.match(source, /min-w-0 overflow-hidden rounded-xl/);
  assert.match(source, /min-w-0 overflow-hidden truncate whitespace-nowrap/);
});
