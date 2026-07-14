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

test("turn-level file-change cards preserve preview-open actions", () => {
  const processGroupSource = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");
  const turnCardStart = processGroupSource.indexOf("const TurnFileChangesCard");
  const processGroupStart = processGroupSource.indexOf("const ProcessGroupCard");
  const turnCardSource = processGroupSource.slice(turnCardStart, processGroupStart);

  assert.notEqual(turnCardStart, -1);
  assert.match(turnCardSource, /buildProcessChangedFiles\(messages, workspace\)/);
  assert.match(processGroupSource, /ChangePreviewPopover/);
  assert.match(processGroupSource, /operationLabel\(file\.operation\)/);
  assert.match(processGroupSource, /new CustomEvent<PreviewOpenFileDetail>\(PREVIEW_OPEN_FILE_EVENT/);
  assert.match(processGroupSource, /detail: \{ filePath: file\.path, revealFirstChange: true \}/);
  assert.match(processGroupSource, /setPreviewOpen\(true\)/);
});

test("process groups no longer render file-change cards inline", () => {
  const processGroupSource = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");
  const processGroupStart = processGroupSource.indexOf("const ProcessGroupCard");
  const processGroupEnd = processGroupSource.indexOf("export default ProcessGroupCard");
  const processGroupComponent = processGroupSource.slice(processGroupStart, processGroupEnd);

  assert.notEqual(processGroupStart, -1);
  assert.doesNotMatch(processGroupComponent, /changedFiles|TurnFileChangesCard/);
});

test("main and shared transcripts append the same turn-level file-change entries", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const transcriptSource = readFileSync("src/ui/components/chat/ChatTranscript.tsx", "utf8");

  assert.match(appSource, /return appendTurnFileChangeEntries\(entries, activeSessionId \?\? "chat"\)/);
  assert.match(appSource, /entry\.type === "turn_file_changes"[\s\S]{0,260}<TurnFileChangesCard/);
  assert.match(transcriptSource, /return appendTurnFileChangeEntries\(entries, keyPrefix\)/);
  assert.match(transcriptSource, /entry\.type === "turn_file_changes"[\s\S]{0,220}<TurnFileChangesCard/);
});

test("the active turn file-change card stays after streaming response content", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const partialResponseIndex = appSource.indexOf("data-streaming-response");
  const trailingFileChangesIndex = appSource.lastIndexOf("<TurnFileChangesCard");

  assert.match(appSource, /const trailingTurnFileChanges/);
  assert.notEqual(partialResponseIndex, -1);
  assert.ok(trailingFileChangesIndex > partialResponseIndex);
});
