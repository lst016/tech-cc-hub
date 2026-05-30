import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("workspace preview uses dirty-state helpers to avoid overriding unsaved tabs", () => {
  const paneSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.tsx", "utf8");

  assert.match(paneSource, /confirmClosePreviewTabs/);
  assert.match(paneSource, /markPreviewTabContent/);
  assert.match(paneSource, /if \(isPreviewTabDirty\(existing\)\) \{/);
  assert.match(paneSource, /savedContent: result\.content/);
  assert.match(paneSource, /isDirty: false/);
});

test("workspace preview shows dirty-tab indicators and keyboard close shortcut", () => {
  const paneSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.tsx", "utf8");
  const cssSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.css", "utf8");

  assert.match(paneSource, /vscode-preview__tab-dot--dirty/);
  assert.match(paneSource, /file\.isDirty && \(/);
  assert.match(paneSource, /Unsaved/);
  assert.match(paneSource, /event\.key\.toLowerCase\(\) !== 'w'/);
  assert.match(cssSource, /\.vscode-preview__tab-dot--dirty/);
});
