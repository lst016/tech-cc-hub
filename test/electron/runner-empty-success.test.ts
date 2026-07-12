import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

test("runner treats only visible assistant text as empty-success activity", () => {
  assert.match(runnerSource, /let observedAssistantTextActivity = false;/);
  assert.match(runnerSource, /if \(hasAssistantTextActivity\(message\)\) \{\s*observedAssistantTextActivity = true;/);
  assert.match(runnerSource, /isEmptySuccessfulRunnerResult\(message, observedAssistantTextActivity\)/);
  assert.match(runnerSource, /hasAssistantTextActivity,\s*updateAwaitingVisiblePostToolResponse,/);
});

test("runner resets empty-success tracking for each warm appended prompt", () => {
  assert.match(runnerSource, /emittedSuccessfulResult = false;\s*emittedTerminalStatus = false;\s*observedAssistantTextActivity = false;\s*awaitingVisiblePostToolResponse = false;\s*emptySuccessAutoRetries = 0;\s*unfinishedPlanAutoRetries = 0;\s*runnerWatchdog\.touch\(\);\s*await ensureMcpServersForPrompt/);
});

test("runner reports a missing terminal result instead of silently completing", () => {
  assert.match(runnerSource, /const errorMessage = "Runner ended without a result message\.";/);
  assert.match(runnerSource, /type: "runner\.error"/);
  assert.match(runnerSource, /status: "error", title: session\.title, error: errorMessage/);
});

test("runner aborts and reports a session when no SDK event arrives in time", () => {
  assert.match(runnerSource, /const RUNNER_FIRST_EVENT_TIMEOUT_MS = 120_000;/);
  assert.match(runnerSource, /function createRunnerActivityWatchdog\(/);
  assert.match(runnerSource, /const runnerWatchdog = createRunnerActivityWatchdog\(/);
  assert.match(runnerSource, /runnerWatchdog\.touch\(\);/);
  assert.match(runnerSource, /runnerWatchdog\.dispose\(\);/);
  assert.match(runnerSource, /Runner did not receive any events for 2 minutes\./);
});

test("runner emits a visible assistant fallback for an empty successful result", () => {
  assert.match(runnerSource, /function buildEmptySuccessFallbackMessage\(sessionId: string, model\?: string\): SDKMessage/);
  assert.match(runnerSource, /本轮工具执行已完成，但模型没有返回文字说明。/);
  assert.match(runnerSource, /if \(emptySuccess\) \{\s*sendMessage\(buildEmptySuccessFallbackMessage/);
});

test("runner emits non-empty terminal result text after an unanswered tool call", () => {
  assert.match(runnerSource, /const visibleResultText = getVisibleTerminalResultText\(message, awaitingVisiblePostToolResponse\);/);
  assert.match(runnerSource, /if \(visibleResultText\) \{\s*sendMessage\(buildVisibleAssistantMessage/);
});

test("runner continues instead of completing while its latest plan has unfinished steps", () => {
  assert.match(runnerSource, /hasIncompletePlan\(session\.planSnapshot\?\.plan\)/);
  assert.match(runnerSource, /promptInput\.enqueue\(UNFINISHED_PLAN_CONTINUATION_PROMPT, \[\]\);/);
});
