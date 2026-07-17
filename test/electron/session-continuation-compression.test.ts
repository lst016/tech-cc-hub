import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ipcHandlersSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");
const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
const sessionContinueStart = ipcHandlersSource.indexOf('if (event.type === "session.continue")');
const sessionContinueEnd = ipcHandlersSource.indexOf(
  "/* Legacy session.continue append path removed:",
  sessionContinueStart,
);
const activeSessionContinueSource = ipcHandlersSource.slice(sessionContinueStart, sessionContinueEnd);

test("session continue builds one stateless payload before starting a fresh runner", () => {
  assert.match(activeSessionContinueSource, /const continuationPayload = buildStatelessContinuationPayload\(/);
  assert.match(activeSessionContinueSource, /const prompt = continuationPayload\.prompt;/);
  assert.match(activeSessionContinueSource, /const resumeSessionId = undefined;/);
  assert.doesNotMatch(activeSessionContinueSource, /initialPromptContextBudget/);
  assert.ok(
    activeSessionContinueSource.indexOf("if (runnerHandles.has(session.id))") < activeSessionContinueSource.indexOf("const continuationPayload = buildStatelessContinuationPayload("),
    "session.continue should close any warm runner before rebuilding stateless history",
  );
});

test("prompt ledger reflects the stateless payload selected before runner startup", () => {
  assert.match(
    activeSessionContinueSource,
    /historyMessages: continuationPayload\.usedCompression \? \[\] : historyMessagesForRun/,
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
