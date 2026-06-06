// test/electron/claude-background-agent-state.test.mjs
// Phase 4 of the Claude Code 2.1.161 compatibility workflow.
// Companion to session-semantics.test.mjs; focused on resume-safety of the
// runtime options that must survive a "resume background agent" call.

import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const mod = await import(pathToFileURL("dist-electron/shared/session-semantics.js").href);

test("background agent view model exposes 8 statuses", () => {
  const all = ["queued", "running", "waiting_input", "blocked", "completed", "failed", "stale", "detached"];
  for (const status of all) {
    const out = mod.buildBackgroundAgentViewModel({
      id: status, sessionId: "s1", label: status, status, lastEventAt: new Date().toISOString(),
    });
    assert.equal(out.status, status);
  }
});

test("background agent view model keeps id, sessionId, label, lastEventAt", () => {
  const now = new Date().toISOString();
  const out = mod.buildBackgroundAgentViewModel({
    id: "agent-42", sessionId: "session-7", label: "Researcher", status: "running", lastEventAt: now,
  });
  assert.equal(out.id, "agent-42");
  assert.equal(out.sessionId, "session-7");
  assert.equal(out.label, "Researcher");
  assert.equal(out.lastEventAt, now);
});

test("background agent view model passes through progress counters", () => {
  const out = mod.buildBackgroundAgentViewModel({
    id: "a", sessionId: "s", label: "x", status: "running", lastEventAt: new Date().toISOString(),
    doneCount: 3, totalCount: 10, longestRunningMs: 12_345,
  });
  assert.equal(out.doneCount, 3);
  assert.equal(out.totalCount, 10);
  assert.equal(out.longestRunningMs, 12_345);
});

test("summarizeBackgroundAgents: zero agents yields zero summary", () => {
  const out = mod.summarizeBackgroundAgents([]);
  assert.equal(out.total, 0);
  assert.equal(out.running, 0);
  assert.equal(out.blocked, 0);
  assert.equal(out.waitingInput, 0);
  assert.equal(out.stale, 0);
  assert.equal(out.done, 0);
  assert.equal(out.failed, 0);
  assert.equal(out.detached, 0);
});

test("background agent view model stale threshold is configurable", () => {
  const old = new Date(Date.now() - 1_000).toISOString();
  // staleAfterMs = 10s, age = 1s => not stale
  const notStale = mod.buildBackgroundAgentViewModel({
    id: "a", sessionId: "s", label: "x", status: "running", lastEventAt: old, staleAfterMs: 10_000,
  });
  assert.equal(notStale.status, "running");
  // staleAfterMs = 100ms => stale
  const stale = mod.buildBackgroundAgentViewModel({
    id: "a", sessionId: "s", label: "x", status: "running", lastEventAt: old, staleAfterMs: 100,
  });
  assert.equal(stale.status, "stale");
});
