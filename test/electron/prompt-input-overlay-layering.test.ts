import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("modal overlays render above the fixed prompt composer", () => {
  const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const globalStyles = readFileSync("src/ui/index.css", "utf8");
  const startSessionModalSource = readFileSync("src/ui/components/StartSessionModal.tsx", "utf8");
  const generatedImageCardSource = readFileSync("src/ui/components/chat/GeneratedImageResultCard.tsx", "utf8");
  const gitConfirmDialogSource = readFileSync("src/ui/components/git/GitConfirmDialog.tsx", "utf8");
  const settingsSheetSource = readFileSync("src/ui/components/settings/SettingsSheet.tsx", "utf8");

  assert.match(promptInputSource, /fixed bottom-0 left-0 right-0 z-40/);
  assert.doesNotMatch(promptInputSource, /fixed bottom-0 left-0 right-0 z-\[120\]/);
  assert.match(promptInputSource, /data-prompt-composer/);
  assert.match(globalStyles, /body:has\(\[aria-modal="true"\]\) \[data-prompt-composer\]/);
  assert.match(globalStyles, /visibility: hidden/);
  assert.match(globalStyles, /pointer-events: none/);
  assert.match(startSessionModalSource, /fixed inset-0 z-50/);
  assert.match(startSessionModalSource, /aria-modal="true"/);
  assert.match(generatedImageCardSource, /fixed inset-0 z-50/);
  assert.match(generatedImageCardSource, /aria-modal="true"/);
  assert.match(gitConfirmDialogSource, /fixed inset-0 z-\[90\]/);
  assert.match(gitConfirmDialogSource, /aria-modal="true"/);
  assert.match(settingsSheetSource, /aria-modal="true"/);
});
