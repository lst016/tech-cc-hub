import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("preview open requests are routed through session-scoped pending state", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");
  const paneSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.tsx", "utf8");

  assert.match(appSource, /window\.addEventListener\(PREVIEW_OPEN_FILE_EVENT, handlePreviewOpenFile\)/);
  assert.match(appSource, /const sessionId = activeSessionIdRef\.current/);
  assert.match(appSource, /setPendingPreviewOpenRequestBySessionId\(\(current\) => \(\{/);
  assert.match(appSource, /\[sessionId\]: \{/);
  assert.match(appSource, /setActivityRailTabBySessionId\(\(current\) => \(/);
  assert.match(appSource, /\[sessionId\]: "preview"/);
  assert.match(appSource, /pendingPreviewOpenRequest=\{pendingPreviewOpenRequest\}/);

  assert.match(railSource, /pendingPreviewOpenRequest\?: \{/);
  assert.match(railSource, /shouldMountPreviewPane = selectedTab === "preview"/);
  assert.match(railSource, /pendingOpenRequest=\{pendingPreviewOpenRequest\}/);

  assert.match(paneSource, /pendingOpenRequest\?: \{/);
  assert.match(paneSource, /if \(!pendingOpenRequest\?\.filePath\) return;/);
  assert.match(paneSource, /if \(!workspace\) return;/);
  assert.match(paneSource, /consumedPendingOpenNonceRef\.current === pendingOpenRequest\.nonce/);
  assert.match(paneSource, /openFile\(pendingOpenRequest\.filePath, \{/);
  assert.match(paneSource, /\.finally\(\(\) => \{/);
  assert.match(paneSource, /consumedPendingOpenNonceRef\.current = pendingOpenRequest\.nonce/);
  assert.match(paneSource, /onConsumePendingOpenRequest\?\.\(\)/);
  assert.match(paneSource, /setActiveTabPath\(resolved\.path\)/);
});

test("process groups surface changed files with preview-open actions", () => {
  const processGroupSource = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");

  assert.match(processGroupSource, /collectCompletedPreviewFileChanges\(messages\.map\(\(entry\) => entry\.message\)\)/);
  assert.match(processGroupSource, /ChangePreviewPopover/);
  assert.match(processGroupSource, /operationLabel\(file\.operation\)/);
  assert.match(processGroupSource, /new CustomEvent<PreviewOpenFileDetail>\(PREVIEW_OPEN_FILE_EVENT/);
  assert.match(processGroupSource, /detail: \{ filePath: file\.path, revealFirstChange: true \}/);
  assert.match(processGroupSource, /setPreviewOpen\(true\)/);
});

test("process groups render changed files after process details", () => {
  const processGroupSource = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");
  const detailsIndex = processGroupSource.indexOf("CompactProcessDetails");
  const changedFilesIndex = processGroupSource.indexOf("changedFiles.length > 0");

  assert.notEqual(detailsIndex, -1);
  assert.notEqual(changedFilesIndex, -1);
  assert.ok(changedFilesIndex > detailsIndex);
});
