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

test("model usage increments only after a prompt is sent or queued", () => {
  const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const submitStart = source.indexOf("const submitCurrentInput = useCallback");
  const submitEnd = source.indexOf("useEffect(() => {", submitStart);
  const submitSection = source.slice(submitStart, submitEnd);

  assert.ok(submitStart >= 0);
  assert.ok(submitEnd > submitStart);
  assert.match(submitSection, /const queued = queueCurrentDraft\(promptSnapshot\);\s*if \(queued\) incrementModelUsage\(selectedRuntimeModel\);/);
  assert.match(submitSection, /if \(sent\) \{\s*incrementModelUsage\(selectedRuntimeModel\);/);
  assert.equal(submitSection.match(/incrementModelUsage\(selectedRuntimeModel\)/g)?.length, 2);
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

test("selected prompt mode buttons clear after successful send or queue", () => {
  const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const queueStart = source.indexOf("const queueCurrentDraft = useCallback");
  const submitStart = source.indexOf("const submitCurrentInput = useCallback");
  const submitEnd = source.indexOf("useEffect(() => {", submitStart);
  const queueSection = source.slice(queueStart, submitStart);
  const submitSection = source.slice(submitStart, submitEnd);

  assert.ok(queueStart >= 0);
  assert.ok(submitStart > queueStart);
  assert.ok(submitEnd > submitStart);

  assert.match(queueSection, /setGoalModeEnabled\(false\);/);
  assert.match(queueSection, /setWorkflowForceEnabled\(false\);/);
  assert.match(submitSection, /if \(sent\) \{[\s\S]*setGoalModeEnabled\(false\);[\s\S]*setWorkflowForceEnabled\(false\);/);
});
