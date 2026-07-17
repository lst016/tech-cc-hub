import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ipcHandlersSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");

function getContinueBranch(): string {
  return ipcHandlersSource.slice(
    ipcHandlersSource.indexOf('if (event.type === "session.continue")'),
    ipcHandlersSource.indexOf('if (event.type === "session.set_model")'),
  );
}

test("session continue resumes an existing provider session with a thin prompt", () => {
  const continueBranch = getContinueBranch();

  assert.match(continueBranch, /const supportsResume = config \? supportsRemoteSessionResume\(config\) : true;/);
  assert.match(
    continueBranch,
    /const canUseRemoteResume = Boolean\(session\.claudeSessionId\)[\s\S]*?&& \(supportsResume \|\| canUseFigmaOAuthCallbackResume\)[\s\S]*?&& !switchedModel[\s\S]*?&& !replacingHistoryId;/,
  );
  assert.match(continueBranch, /const thinResumePrompt = isFigmaOAuthCallback \? storagePrompt : agentPrompt;/);
  assert.match(
    continueBranch,
    /const prompt = canUseRemoteResume\s*\? thinResumePrompt\s*: continuationPayload\?\.prompt \?\? thinResumePrompt;/,
  );
  assert.match(
    continueBranch,
    /const resumeSessionId = canUseRemoteResume\s*\? session\.claudeSessionId\s*: undefined;/,
  );
  assert.match(
    continueBranch,
    /continuationSummary: canUseRemoteResume\s*\? session\.continuationSummary\s*:/,
  );
  assert.match(
    continueBranch,
    /continuationSummaryMessageCount: canUseRemoteResume\s*\? session\.continuationSummaryMessageCount\s*:/,
  );
});

test("session continue avoids provider resume when history or model identity changed", () => {
  const continueBranch = getContinueBranch();

  assert.match(
    continueBranch,
    /const switchedModel = Boolean\([\s\S]*?selectedModel\.trim\(\) !== previousModel\.trim\(\)[\s\S]*?\);/,
  );
  assert.match(continueBranch, /&& !switchedModel/);
  assert.match(continueBranch, /&& !replacingHistoryId/);
});

test("session continue falls back to stateless history when no provider session exists", () => {
  const continueBranch = getContinueBranch();

  assert.ok(
    continueBranch.indexOf("const continuationPayload = buildStatelessContinuationPayload(") < continueBranch.indexOf("runClaude({"),
    "session.continue should rebuild the stateless prompt before dispatching the next run",
  );
  assert.match(
    continueBranch,
    /const continuationPayload = canUseRemoteResume\s*\? null\s*: buildStatelessContinuationPayload\(/,
  );
});
