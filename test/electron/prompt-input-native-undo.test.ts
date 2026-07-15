import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("prompt input keeps native edits out of the layout rerender path", () => {
  const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const handleInputMatch = source.match(
    /const handleInput = \(e: React\.FormEvent<HTMLDivElement>\) => \{[\s\S]*?\r?\n {2}\};/,
  );

  assert.ok(handleInputMatch, "handleInput should be present");
  assert.match(handleInputMatch[0], /target\.dataset\.renderedPrompt = nextPrompt;/);
  assert.match(handleInputMatch[0], /setPrompt\(nextPrompt\);/);
});

test("image token removal reads the live native editor draft", () => {
  const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");

  assert.match(source, /const readCurrentPromptDraft = useCallback/);
  assert.match(source, /readCurrentPromptDraft\(\)\.replaceAll\(IMAGE_GENERATION_PLUGIN_TOKEN, ""\)/);
  assert.doesNotMatch(source, /nextPrompt\.replaceAll\(IMAGE_GENERATION_PLUGIN_TOKEN, ""\)/);
});

test("prompt input distinguishes copied images from rich clipboard text", () => {
  const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const pasteStart = source.indexOf("const handlePaste");
  const fileStart = source.indexOf("const clipboardFiles", pasteStart);
  const imagePriorityStart = source.indexOf("shouldPreferClipboardImageFiles", fileStart);
  const textStart = source.indexOf("const plainText = getPlainTextFromClipboardData", imagePriorityStart);

  assert.match(source, /import \{ getPlainTextFromClipboardData \} from "\.\.\/\.\.\/utils\/clipboard-text"/);
  assert.match(source, /getClipboardFiles\(event\.clipboardData\)/);
  assert.match(source, /shouldPreferClipboardImageFiles\(event\.clipboardData, clipboardFiles\)/);
  assert.match(source, /shouldReadNativeClipboardImage\(event\.clipboardData, clipboardFiles\)/);
  assert.match(source, /window\.electron\.invoke<ClipboardImagePayload \| null>\("clipboard:read-image"\)/);
  assert.match(source, /clipboardImagePayloadToFile\(nativeClipboardImage\)/);
  assert.match(source, /insertTextIntoPrompt\(currentPrompt, plainText, selection\.start, selection\.end\)/);
  assert.match(source, /contentEditable=\{disabled \? false : "plaintext-only"\}/);
  assert.ok(
    fileStart > pasteStart && imagePriorityStart > fileStart && textStart > imagePriorityStart,
    "copied images should be classified before rich clipboard text is inserted",
  );
  assert.doesNotMatch(source, /execCommand/);
  assert.doesNotMatch(source, /insertHTML/);
});

test("prompt input inserts newlines through text draft selection restoration", () => {
  const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const newlineStart = source.indexOf("if (shouldInsertPromptNewline(keyboardEvent))");
  const submitStart = source.indexOf("if (shouldSubmitPromptOnEnter", newlineStart);
  const newlineSection = source.slice(newlineStart, submitStart);

  assert.ok(newlineStart >= 0);
  assert.ok(submitStart > newlineStart);
  assert.match(newlineSection, /getSelectionRangeInEditor\(editor\)/);
  assert.match(newlineSection, /insertTextIntoPrompt\(currentPrompt,\s*"\\n",\s*selection\.start,\s*selection\.end\)/);
  assert.match(newlineSection, /setPromptDraft\(nextDraft\.prompt,\s*nextDraft\.cursorIndex\)/);
  assert.match(newlineSection, /focusPromptEditor\(nextDraft\.cursorIndex\)/);
});

test("prompt input disables spellcheck for pasted api payloads", () => {
  const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");

  assert.match(source, /spellCheck=\{false\}/);
  assert.match(source, /autoCorrect="off"/);
  assert.match(source, /autoCapitalize="off"/);
});
