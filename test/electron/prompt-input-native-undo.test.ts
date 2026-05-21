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

test("prompt input pastes clipboard html as plain text", () => {
  const source = readFileSync("src/ui/components/PromptInput.tsx", "utf8");

  assert.match(source, /function getPlainTextFromClipboardData\(clipboardData: DataTransfer\)/);
  assert.match(source, /clipboardData\.getData\("text\/plain"\)/);
  assert.match(source, /clipboardData\.getData\("text\/html"\)/);
  assert.match(source, /insertTextIntoPrompt\(currentPrompt, plainText, selection\.start, selection\.end\)/);
  assert.match(source, /contentEditable=\{disabled \? false : "plaintext-only"\}/);
  assert.doesNotMatch(source, /execCommand/);
  assert.doesNotMatch(source, /insertHTML/);
});

test("prompt input disables spellcheck for pasted api payloads", () => {
  const source = readFileSync("src/ui/components/PromptInput.tsx", "utf8");

  assert.match(source, /spellCheck=\{false\}/);
  assert.match(source, /autoCorrect="off"/);
  assert.match(source, /autoCapitalize="off"/);
});
