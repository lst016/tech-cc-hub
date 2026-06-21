import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sharedSource = readFileSync("src/shared/workflows/workflow-runs.ts", "utf8");
const appSource = readFileSync("src/ui/App.tsx", "utf8");
const panelSource = readFileSync("src/ui/components/workflow/WorkflowAgentTranscriptPanel.tsx", "utf8");
const ipcSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");
const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

test("workflow run actions expose stop from UI to Electron", () => {
  assert.match(sharedSource, /export type WorkflowRunAction = "resume" \| "rerun" \| "stop";/);
  assert.match(panelSource, /onAction\?\.\("stop", run\)/);
  assert.match(panelSource, />\s*Stop\s*</);
  assert.match(appSource, /if \(action === "stop"\)/);
  assert.match(appSource, /type: "workflow\.run\.stop"/);
  assert.match(appSource, /taskId: run\.taskId/);
});

test("workflow run stop uses the SDK stopTask control API", () => {
  assert.match(runnerSource, /stopTask: \(taskId: string\) => Promise<void>;/);
  assert.match(runnerSource, /await activeQuery\.stopTask\(taskId\);/);
  assert.match(ipcSource, /await handle\.stopTask\(event\.payload\.taskId\);/);
  assert.doesNotMatch(ipcSource, /Workflow task-level stop 暂未接入 SDK control API/);
});
