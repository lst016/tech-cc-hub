import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const footerPath = "src/ui/components/prompt-input/PromptComposerFooter.tsx";
const source = [
  readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8"),
  existsSync(footerPath) ? readFileSync(footerPath, "utf8") : "",
].join("\n");
const appSource = readFileSync("src/ui/App.tsx", "utf8");
const styles = readFileSync("src/ui/index.css", "utf8");

test("prompt composer keeps a smaller usable minimum after compacting controls", () => {
  assert.match(source, /COMPOSER_SURFACE_WIDTH_CLASS\s*=\s*"[^"]*min-w-\[min\(430px,_100%\)\]/);
  assert.doesNotMatch(source, /COMPOSER_SURFACE_WIDTH_CLASS\s*=\s*"[^"]*min-w-\[600px\]/);
});

test("prompt composer width contract is shared by palettes and input surface", () => {
  assert.match(source, /const composerSurfaceWidthClass = embedded/);
  const references = source.match(/composerSurfaceWidthClass/g) ?? [];
  assert.ok(references.length >= 5);
});

test("prompt composer hides runtime controls before hitting minimum width", () => {
  assert.match(source, /prompt-composer-runtime-controls/);
  assert.match(styles, /@container\s*\(max-width:\s*580px\)/);
  assert.match(styles, /\.prompt-composer-runtime-controls\s*\{\s*display:\s*none;/);
});

test("prompt composer keeps pasted json inside the composer body", () => {
  assert.match(source, /prompt-composer-surface prompt-composer-card/);
  assert.match(source, /prompt-composer-body min-h-0 flex-1 overflow-y-auto overflow-x-hidden/);
  assert.match(source, /prompt-composer-editor[^"]*min-h-\[72px\][^"]*overflow-y-auto[^"]*overflow-x-hidden/);
  assert.doesNotMatch(source, /prompt-composer-editor[^"]*max-h-\[180px\]/);
  assert.match(styles, /\.prompt-composer-card\s*\{[\s\S]*max-height:\s*min\(70vh,\s*440px\);[\s\S]*overflow:\s*visible;/);
  assert.match(styles, /\.prompt-composer-editor,\s*\.prompt-composer-editor \*\s*\{[\s\S]*overflow-wrap:\s*anywhere;/);
});

test("prompt composer does not clip runtime control popovers", () => {
  assert.match(source, /<ComposerModelMenu/);
  assert.match(styles, /\.prompt-composer-card\s*\{[\s\S]*overflow:\s*visible;/);
  assert.match(source, /prompt-composer-footer[^"]*overflow-visible/);
});

test("app shell reserves the same minimum width for the chat column", () => {
  assert.match(appSource, /const MIN_CENTER_WIDTH = 430;/);
  assert.match(appSource, /clampResizablePaneWidth\(activityRailWidth, MIN_ACTIVITY_RAIL_WIDTH, maxActivityRailWidth\)/);
  assert.match(appSource, /rightOffset=\{activityRailOffset\}/);
});
