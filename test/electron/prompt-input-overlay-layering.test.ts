import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("modal overlays render above the fixed prompt composer", () => {
  const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const globalStyles = readFileSync("src/ui/index.css", "utf8");
  const appModalOverlaySource = readFileSync("src/ui/components/AppModalOverlay.tsx", "utf8");
  const startSessionModalSource = readFileSync("src/ui/components/StartSessionModal.tsx", "utf8");
  const generatedImageCardSource = readFileSync("src/ui/components/chat/GeneratedImageResultCard.tsx", "utf8");
  const gitConfirmDialogSource = readFileSync("src/ui/components/git/GitConfirmDialog.tsx", "utf8");
  const settingsSheetSource = readFileSync("src/ui/components/settings/SettingsSheet.tsx", "utf8");
  const imageGenerationControlsSource = readFileSync("src/ui/components/prompt-input/ImageGenerationPluginControls.tsx", "utf8");

  assert.match(promptInputSource, /fixed bottom-0 left-0 right-0 z-40/);
  assert.doesNotMatch(promptInputSource, /fixed bottom-0 left-0 right-0 z-\[120\]/);
  assert.match(promptInputSource, /data-prompt-composer/);
  assert.match(
    globalStyles,
    /body:has\(\[aria-modal="true"\]:not\(\[data-keep-prompt-composer-visible="true"\]\)\) \[data-prompt-composer\]/,
  );
  assert.match(globalStyles, /visibility: hidden/);
  assert.match(globalStyles, /pointer-events: none/);
  assert.match(appModalOverlaySource, /fixed inset-0/);
  assert.match(appModalOverlaySource, /role = "dialog"/);
  assert.match(appModalOverlaySource, /aria-modal=\{resolvedAriaModal\}/);
  assert.match(startSessionModalSource, /<AppModalOverlay[\s\S]*?className="z-50/);
  assert.match(generatedImageCardSource, /<AppModalOverlay[\s\S]*?className="z-50/);
  assert.match(gitConfirmDialogSource, /<AppModalOverlay[\s\S]*?className="z-\[90\]/);
  assert.match(settingsSheetSource, /<AppModalOverlay[\s\S]*?className="z-\[40000\]/);
  assert.match(imageGenerationControlsSource, /createPortal\(/);
  assert.match(imageGenerationControlsSource, /document\.body/);
  assert.match(imageGenerationControlsSource, /data-keep-prompt-composer-visible="true"/);
  assert.doesNotMatch(startSessionModalSource, /data-keep-prompt-composer-visible/);
});

test("settings constrain scrolling to their content regions", () => {
  const settingsSheetSource = readFileSync("src/ui/components/settings/SettingsSheet.tsx", "utf8");
  const aiInterfaceSource = readFileSync("src/ui/components/settings/AiInterfaceSettingsPage.tsx", "utf8");
  const apiProfilesSource = readFileSync("src/ui/components/settings/ApiProfilesSettingsPage.tsx", "utf8");

  assert.match(settingsSheetSource, /<main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">/);
  assert.match(settingsSheetSource, /<section className="min-h-0 flex-1 overflow-y-auto pb-6">/);
  assert.match(settingsSheetSource, /<footer className="-mx-6 flex shrink-0/);
  assert.doesNotMatch(settingsSheetSource, /<footer className="sticky bottom-0/);
  assert.match(aiInterfaceSource, /<div className="flex h-full min-h-0 min-w-0 flex-col">/);
  assert.match(apiProfilesSource, /lg:h-full lg:min-h-0 lg:grid-cols/);
  assert.match(apiProfilesSource, /lg:min-h-0 lg:overflow-y-auto/);
});
