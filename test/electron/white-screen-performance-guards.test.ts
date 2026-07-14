import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mainSource = readFileSync("src/electron/main.ts", "utf8");
const storeSource = readFileSync("src/electron/libs/session-store.ts", "utf8");
const ipcSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");
const appSource = readFileSync("src/ui/App.tsx", "utf8");

test("startup avoids synchronous legacy message-table scans and leaked Claude prewarming", () => {
  assert.doesNotMatch(storeSource, /delete from messages where coalesce\(json_extract\(data/);
  assert.doesNotMatch(storeSource, /findLatestPlanSnapshot\(sessionId\)/);
  assert.doesNotMatch(mainSource, /prewarmClaudeCodeSubprocess/);
  assert.doesNotMatch(mainSource, /\bstartup\s*\(/);
});

test("completed runs and old BrowserViews have bounded lifetimes", () => {
  assert.match(ipcSource, /status === "completed"[\s\S]{0,180}closeRunnerHandle/);
  assert.doesNotMatch(ipcSource, /WARM_RUNNER_IDLE_MS/);
  assert.match(mainSource, /enforceBrowserWorkbenchRetention/);
  assert.match(mainSource, /mainWindow\.on\("unresponsive"/);
  assert.match(mainSource, /render-process-gone[\s\S]{0,300}reason/);
});

test("continuations page history and streaming text bypasses full markdown parsing", () => {
  assert.match(ipcSource, /getSessionHistoryPage\(session\.id, \{ limit: CONTINUATION_HISTORY_LIMIT \}\)/);
  assert.doesNotMatch(appSource, /<MDContent text=\{partialMessage\}/);
  assert.doesNotMatch(appSource, /headerWorkflowOptimizationPrompt/);
});
