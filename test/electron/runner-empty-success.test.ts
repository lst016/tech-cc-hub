import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

test("runner treats only visible assistant text as empty-success activity", () => {
  assert.match(runnerSource, /let observedAssistantTextActivity = false;/);
  assert.match(runnerSource, /if \(hasAssistantTextActivity\(message\)\) \{\s*observedAssistantTextActivity = true;/);
  assert.match(runnerSource, /isEmptySuccessfulRunnerResult\(message, observedAssistantTextActivity\)/);
  assert.match(runnerSource, /function hasAssistantTextActivity\(message: SDKMessage\): boolean/);
  assert.match(runnerSource, /return false;\s*\}\);\s*\}/);
  assert.doesNotMatch(runnerSource, /return type === "tool_use";/);
});

test("runner resets empty-success tracking for each warm appended prompt", () => {
  assert.match(runnerSource, /observedAssistantTextActivity = false;\s*emptySuccessAutoRetries = 0;\s*await ensureMcpServersForPrompt/);
});

test("runner reports a missing terminal result instead of silently completing", () => {
  assert.match(runnerSource, /const errorMessage = "Runner ended without a result message\.";/);
  assert.match(runnerSource, /type: "runner\.error"/);
  assert.match(runnerSource, /status: "error", title: session\.title, error: errorMessage/);
});
