import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("prompt input clears visible text before awaiting message dispatch", () => {
  const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const submitStart = source.indexOf("const submitCurrentInput = useCallback");
  const sendStart = source.indexOf("const sent = await sendPromptDraft", submitStart);
  const clearStart = source.indexOf("clearPromptDraftText();", submitStart);

  assert.ok(submitStart >= 0);
  assert.ok(sendStart > submitStart);
  assert.ok(clearStart > submitStart);
  assert.ok(clearStart < sendStart, "composer text must clear before slow title generation or dispatch awaits");
});

test("prompt draft updates synchronously replace the contenteditable DOM", () => {
  const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const setDraftStart = source.indexOf("const setPromptDraft = useCallback");
  const clearComposerStart = source.indexOf("const clearComposer = useCallback", setDraftStart);
  const setDraftSection = source.slice(setDraftStart, clearComposerStart);

  assert.ok(setDraftStart >= 0);
  assert.ok(clearComposerStart > setDraftStart);
  assert.match(setDraftSection, /renderPromptEditorContent\(editor,\s*buildSlashCommandDisplayParts\(nextPrompt,\s*slashCommands\)\)/);
  assert.match(setDraftSection, /editor\.dataset\.renderedPrompt\s*=\s*nextPrompt/);
});
