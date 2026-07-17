import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ipcHandlersSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");
const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
const continueStart = ipcHandlersSource.indexOf('if (event.type === "session.continue")');
const continueBranch = ipcHandlersSource.slice(
  continueStart,
  ipcHandlersSource.indexOf("    return;\n    /* Legacy session.continue append path removed:", continueStart),
);

test("session continue keeps app-managed compression as the no-resume fallback", () => {
  assert.match(
    continueBranch,
    /const continuationPayload = canUseRemoteResume\s*\? null\s*: buildStatelessContinuationPayload\(/,
  );
  assert.match(continueBranch, /const resumeSessionId = canUseRemoteResume[\s\S]*?: undefined;/);
  assert.ok(
    continueBranch.indexOf("if (runnerHandles.has(session.id))") < continueBranch.indexOf("const continuationPayload = canUseRemoteResume"),
    "session.continue should close any warm runner before choosing resume or stateless fallback",
  );
  assert.match(continueBranch, /forceCompression: history\?\.hasMore,/);
  assert.match(continueBranch, /historyMessageCount: history\?\.totalMessages,/);
});

test("prompt ledger reflects the stateless payload selected before runner startup", () => {
  assert.match(
    continueBranch,
    /historyMessages: canUseRemoteResume \|\| continuationPayload\?\.usedCompression\s*\? \[\]\s*: historyMessagesForRun/,
  );
});

test("runner seeds the prompt queue before constructing the SDK query", () => {
  const queueIndex = runnerSource.indexOf("const promptInput = new PromptInputQueue()");
  const enqueueIndex = runnerSource.indexOf("promptInput.enqueue(prompt, attachments)", queueIndex);
  const queryIndex = runnerSource.indexOf("const q = query(", enqueueIndex);

  assert.notEqual(queueIndex, -1);
  assert.notEqual(enqueueIndex, -1, "the first prompt must be queued synchronously");
  assert.notEqual(queryIndex, -1);
  assert.ok(
    queueIndex < enqueueIndex && enqueueIndex < queryIndex,
    "the SDK input queue must not be empty while startup control requests are waiting for initialization",
  );
  assert.doesNotMatch(runnerSource, /initialPromptContextBudget|initial-context-usage/);
});

test("session resume is not gated to the official Anthropic host", () => {
  const claudeSettingsSource = readFileSync("src/electron/libs/claude/claude-settings.ts", "utf8");

  assert.doesNotMatch(claudeSettingsSource, /hostname\s*===\s*["']api\.anthropic\.com["']/);
  assert.match(claudeSettingsSource, /supportsRemoteSessionResume[\s\S]*Boolean\(config\.baseURL\?\.trim\(\)\)/);
});
