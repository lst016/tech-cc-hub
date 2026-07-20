import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RunnerTurnLifecycle } from "../../src/electron/libs/runner/runner-turn-lifecycle.js";

test("keeps the runner non-terminal after result A while appended turn B is reserved", () => {
  const lifecycle = new RunnerTurnLifecycle();

  assert.deepEqual(lifecycle.reserveAppendedTurn(), { startsNewCycle: false });
  assert.deepEqual(lifecycle.completeCurrentTurn(), { hasPendingTurns: true });
  assert.deepEqual(lifecycle.completeCurrentTurn(), { hasPendingTurns: false });
});

test("rolls back the appended turn reservation when append preparation fails", () => {
  const lifecycle = new RunnerTurnLifecycle();

  lifecycle.reserveAppendedTurn();

  assert.deepEqual(lifecycle.cancelAppendedTurn(), { hasPendingTurns: true });
  assert.deepEqual(lifecycle.completeCurrentTurn(), { hasPendingTurns: false });
});

test("marks a post-completion append as a new runner cycle and rolls it back cleanly", () => {
  const lifecycle = new RunnerTurnLifecycle();

  assert.deepEqual(lifecycle.completeCurrentTurn(), { hasPendingTurns: false });
  assert.deepEqual(lifecycle.reserveAppendedTurn(), { startsNewCycle: true });
  assert.deepEqual(lifecycle.cancelAppendedTurn(), { hasPendingTurns: false });
});

test("runner reserves appended turns before preflight and gates terminal status on pending turns", () => {
  const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
  const appendStart = runnerSource.indexOf("appendPrompt: async (");
  const appendEnd = runnerSource.indexOf("stopTask: async", appendStart);
  const appendSource = runnerSource.slice(appendStart, appendEnd);
  const reserveIndex = appendSource.indexOf("turnLifecycle.reserveAppendedTurn()");
  const attachmentWaitIndex = appendSource.indexOf("await nextAttachments");
  const preflightIndex = appendSource.indexOf("await ensureMcpServersForPrompt(");
  const enqueueIndex = appendSource.indexOf("promptInput.enqueue(nextPrompt, resolvedNextAttachments, nextPromptOrigin)");
  const rollbackIndex = appendSource.indexOf("turnLifecycle.cancelAppendedTurn()");

  assert.notEqual(appendStart, -1);
  assert.notEqual(appendEnd, -1);
  assert.ok(
    reserveIndex !== -1 && reserveIndex < attachmentWaitIndex && attachmentWaitIndex < preflightIndex,
    "B must be reserved before awaiting attachment or MCP preparation so result(A) cannot race past it",
  );
  assert.ok(
    preflightIndex < enqueueIndex && enqueueIndex < rollbackIndex,
    "failed append preparation or enqueue must cancel the B reservation",
  );

  const resultStart = runnerSource.indexOf('if (message.type === "result")');
  const resultEnd = runnerSource.indexOf("sendMessage(message);", resultStart) + "sendMessage(message);".length;
  const terminalEnd = runnerSource.indexOf("emittedTerminalStatus = true;", resultEnd);
  const resultSource = runnerSource.slice(resultStart, terminalEnd);
  const completeIndex = resultSource.indexOf("turnLifecycle.completeCurrentTurn()");
  const pendingGateIndex = resultSource.indexOf("if (status === \"completed\" && hasPendingTurns)");
  const statusIndex = resultSource.indexOf('type: "session.status"', pendingGateIndex);

  assert.ok(
    completeIndex !== -1 && completeIndex < pendingGateIndex && pendingGateIndex < statusIndex,
    "result(A) must continue into pending B before a terminal session.status can be emitted",
  );
});
