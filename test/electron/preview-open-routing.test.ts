import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("preview open requests are routed through app state before the preview pane consumes them", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");
  const paneSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.tsx", "utf8");

  assert.match(appSource, /PREVIEW_OPEN_FILE_EVENT/);
  assert.match(appSource, /pendingPreviewOpenRequestBySessionId/);
  assert.match(appSource, /setActiveSessionActivityRailTab\("preview"\)/);
  assert.match(appSource, /pendingPreviewOpenRequest=\{pendingPreviewOpenRequest\}/);
  assert.match(railSource, /pendingPreviewOpenRequest\?: \{/);
  assert.match(railSource, /pendingOpenRequest=\{pendingPreviewOpenRequest\}/);
  assert.match(paneSource, /pendingOpenRequest\?: \{/);
  assert.match(paneSource, /if \(!pendingOpenRequest\?\.filePath\) return;/);
  assert.match(paneSource, /void openFile\(pendingOpenRequest\.filePath, \{ revealLine: pendingOpenRequest\.startLine \}\);/);
});

test("process groups surface changed files with preview-open actions", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");

  assert.match(appSource, /collectCompletedPreviewFileChanges\(messages\.map\(\(entry\) => entry\.message\)\)/);
  assert.match(appSource, /已修改 \{changedFiles\.length\} 个文件/);
  assert.match(appSource, /点击文件在右侧预览打开/);
  assert.match(appSource, /new CustomEvent<PreviewOpenFileDetail>\(PREVIEW_OPEN_FILE_EVENT/);
  assert.match(appSource, /再显示 \$\{remainingChangedFileCount\} 个文件/);
});
