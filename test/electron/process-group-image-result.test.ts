import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("process groups extract generated images from tool-result text blocks", () => {
  const source = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");

  assert.match(source, /function getToolResultText\(content: unknown\): string/);
  assert.match(source, /parseGeneratedImageResult\(getToolResultText\(content\.content\)\)/);
  assert.match(source, /!result\.isImageGeneration \|\| !result\.success/);
});

test("process group cards render generated images outside the collapsed process details", () => {
  const source = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");

  assert.match(source, /collectGeneratedImageResults\(messages\)/);
  assert.match(source, /<GeneratedImageResultCard/);
});
