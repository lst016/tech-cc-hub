// test/electron/session-semantics.test.mjs
// Phase 4 of the Claude Code 2.1.161 compatibility workflow.

import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

// Load the .ts file's compiled output (npm run transpile:electron first).
// Windows paths need to be converted to file:// URLs for dynamic import.
const mod = await import(pathToFileURL("dist-electron/shared/session-semantics.js").href);

test("buildSessionSemanticState: running status with no permissions is running", () => {
  const out = mod.buildSessionSemanticState({ sessionId: "s1", status: "running" });
  assert.equal(out.status, "running");
  assert.equal(out.executionMode, "foreground");
});

test("buildSessionSemanticState: pending permissions => waiting_input", () => {
  const out = mod.buildSessionSemanticState({ sessionId: "s1", status: "running", pendingPermissionCount: 2 });
  assert.equal(out.status, "waiting_input");
  assert.match(out.blockerSummary, /2 permission/);
});

test("buildSessionSemanticState: blocker summary => blocked", () => {
  const out = mod.buildSessionSemanticState({ sessionId: "s1", status: "running", blockerSummary: "tool X failed" });
  assert.equal(out.status, "blocked");
  assert.equal(out.blockerSummary, "tool X failed");
});

test("buildSessionSemanticState: error takes precedence over permissions", () => {
  const out = mod.buildSessionSemanticState({ sessionId: "s1", status: "error", pendingPermissionCount: 5 });
  assert.equal(out.status, "error");
});

test("buildSessionSemanticState: idle stays idle", () => {
  const out = mod.buildSessionSemanticState({ sessionId: "s1", status: "idle" });
  assert.equal(out.status, "idle");
});

test("buildBackgroundAgentViewModel: passes through known status", () => {
  const out = mod.buildBackgroundAgentViewModel({
    id: "a1", sessionId: "s1", label: "alpha", status: "running", lastEventAt: new Date().toISOString(),
  });
  assert.equal(out.status, "running");
  assert.equal(out.label, "alpha");
});

test("buildBackgroundAgentViewModel: stale detection when lastEventAt is too old", () => {
  const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const out = mod.buildBackgroundAgentViewModel({
    id: "a1", sessionId: "s1", label: "old", status: "running", lastEventAt: old, staleAfterMs: 60_000,
  });
  assert.equal(out.status, "stale");
});

test("buildBackgroundAgentViewModel: completed is never re-marked stale", () => {
  const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const out = mod.buildBackgroundAgentViewModel({
    id: "a1", sessionId: "s1", label: "done", status: "completed", lastEventAt: old, staleAfterMs: 60_000,
  });
  assert.equal(out.status, "completed");
});

test("buildBackgroundAgentViewModel: detached survives stale check", () => {
  const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const out = mod.buildBackgroundAgentViewModel({
    id: "a1", sessionId: "s1", label: "off", status: "detached", lastEventAt: old, staleAfterMs: 60_000,
  });
  assert.equal(out.status, "detached");
});

test("buildBackgroundAgentViewModel: invalid date string is left as-is", () => {
  const out = mod.buildBackgroundAgentViewModel({
    id: "a1", sessionId: "s1", label: "x", status: "running", lastEventAt: "not-a-date",
  });
  assert.equal(out.status, "running");
});

test("summarizeBackgroundAgents: counts each status once", () => {
  const mk = (s) => mod.buildBackgroundAgentViewModel({
    id: Math.random().toString(), sessionId: "s1", label: s, status: s, lastEventAt: new Date().toISOString(),
  });
  const out = mod.summarizeBackgroundAgents([
    mk("running"), mk("running"), mk("blocked"), mk("waiting_input"), mk("stale"),
    mk("completed"), mk("failed"), mk("detached"),
  ]);
  assert.equal(out.total, 8);
  assert.equal(out.running, 2);
  assert.equal(out.blocked, 1);
  assert.equal(out.waitingInput, 1);
  assert.equal(out.stale, 1);
  assert.equal(out.done, 1);
  assert.equal(out.failed, 1);
  assert.equal(out.detached, 1);
});

test("buildBackgroundAgentViewModel: preserves runtime options for resume", () => {
  const out = mod.buildBackgroundAgentViewModel({
    id: "a1", sessionId: "s1", label: "x", status: "running",
    lastEventAt: new Date().toISOString(),
    model: "claude-opus-4-8", effort: "xhigh", permissionMode: "default",
    worktreePath: "/tmp/worktree-a1",
  });
  assert.equal(out.model, "claude-opus-4-8");
  assert.equal(out.effort, "xhigh");
  assert.equal(out.permissionMode, "default");
  assert.equal(out.worktreePath, "/tmp/worktree-a1");
});
