import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("tool call telemetry does not inject model context", () => {
  const source = readFileSync("src/electron/libs/learning/learning-hooks.ts", "utf8");
  const hookSource = source.slice(
    source.indexOf("export function createToolCallBudgetHook"),
    source.indexOf("export function createDriftDetectorHook"),
  );

  assert.match(source, /Tool call telemetry hook/);
  assert.match(hookSource, /execution-efficiency telemetry only/);
  assert.match(hookSource, /store\.updateSessionCounts\(SID, 1, 0, 0\)/);
  assert.doesNotMatch(hookSource, /hookSpecificOutput/);
  assert.doesNotMatch(hookSource, /additionalContext/);
  assert.doesNotMatch(hookSource, /\[Tool usage checkpoint\]/);
  assert.doesNotMatch(hookSource, /\[Budget\]/);
  assert.doesNotMatch(hookSource, /quick-fix budget/);
  assert.doesNotMatch(hookSource, /continue only if another tool is necessary/);
});

test("tool call checkpoint is keyed by the active app session when available", () => {
  const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
  const hookSource = readFileSync("src/electron/libs/learning/learning-hooks.ts", "utf8");

  assert.match(runnerSource, /createToolCallBudgetHook\(sessionId\)/);
  assert.match(hookSource, /createToolCallBudgetHook\(sessionId\?: string\)/);
  assert.match(hookSource, /const SID = sessionId \|\| process\.env\.CLAUDE_SESSION_ID \|\| "default"/);
});
