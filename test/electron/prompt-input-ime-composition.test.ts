import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("prompt IME composition starts from a clean empty rich text editor", () => {
  const contentSource = readFileSync("src/ui/utils/prompt-editor-content.ts", "utf8");
  const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");

  assert.match(contentSource, /export function preparePromptEditorForNativeComposition\(editor: HTMLElement\)/);
  assert.match(contentSource, /isNativeEmptyPromptEditor\(editor\)/);
  assert.match(contentSource, /editor\.replaceChildren\(\)/);
  assert.match(promptInputSource, /preparePromptEditorForNativeComposition\(editor\)/);
  assert.match(promptInputSource, /onCompositionStart=\{handleCompositionStart\}/);
  assert.match(promptInputSource, /onCompositionEnd=\{handleCompositionEnd\}/);
});
