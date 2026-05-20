import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("prompt input keeps native edits out of the layout rerender path", () => {
  const source = readFileSync("src/ui/components/PromptInput.tsx", "utf8");
  const handleInputMatch = source.match(
    /const handleInput = \(e: React\.FormEvent<HTMLDivElement>\) => \{[\s\S]*?\r?\n {2}\};/,
  );

  assert.ok(handleInputMatch, "handleInput should be present");
  assert.match(handleInputMatch[0], /target\.dataset\.renderedPrompt = nextPrompt;/);
  assert.match(handleInputMatch[0], /setPrompt\(nextPrompt\);/);
});
