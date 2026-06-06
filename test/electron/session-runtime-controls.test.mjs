// test/electron/session-runtime-controls.test.mjs
// Phase 4 of the Claude Code 2.1.161 compatibility workflow.
// Focused on the runtime controls that must survive a "resume background
// agent" or "resume workflow lane" call: model, effort, permissionMode,
// workdir, worktreePath.

import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const mod = await import(pathToFileURL("dist-electron/shared/session-semantics.js").href);

test("resume preserves model", () => {
  const out = mod.buildBackgroundAgentViewModel({
    id: "a", sessionId: "s", label: "x", status: "running", lastEventAt: new Date().toISOString(),
    model: "claude-sonnet-4-6",
  });
  assert.equal(out.model, "claude-sonnet-4-6");
});

test("resume preserves effort", () => {
  const out = mod.buildBackgroundAgentViewModel({
    id: "a", sessionId: "s", label: "x", status: "running", lastEventAt: new Date().toISOString(),
    effort: "xhigh",
  });
  assert.equal(out.effort, "xhigh");
});

test("resume preserves permission mode", () => {
  const out = mod.buildBackgroundAgentViewModel({
    id: "a", sessionId: "s", label: "x", status: "running", lastEventAt: new Date().toISOString(),
    permissionMode: "acceptEdits",
  });
  assert.equal(out.permissionMode, "acceptEdits");
});

test("resume preserves worktree path", () => {
  const out = mod.buildBackgroundAgentViewModel({
    id: "a", sessionId: "s", label: "x", status: "running", lastEventAt: new Date().toISOString(),
    worktreePath: "/tmp/wt-a",
  });
  assert.equal(out.worktreePath, "/tmp/wt-a");
});

test("resume preserves blocker summary", () => {
  const out = mod.buildBackgroundAgentViewModel({
    id: "a", sessionId: "s", label: "x", status: "blocked", lastEventAt: new Date().toISOString(),
    blockerSummary: "tool X timed out",
  });
  assert.equal(out.status, "blocked");
  assert.equal(out.blockerSummary, "tool X timed out");
});

test("session semantic state preserves model and effort on resume", () => {
  const out = mod.buildSessionSemanticState({
    sessionId: "s1", status: "running", model: "claude-opus-4-8", effort: "high", permissionMode: "default",
  });
  assert.equal(out.model, "claude-opus-4-8");
  assert.equal(out.effort, "high");
  assert.equal(out.permissionMode, "default");
  assert.equal(out.status, "running");
});

test("session state without permissions remains running", () => {
  const out = mod.buildSessionSemanticState({ sessionId: "s1", status: "running" });
  assert.equal(out.status, "running");
  assert.equal(out.blockerSummary, undefined);
});

test("multi-agent summary aggregates runtime mix", () => {
  const mk = (s, extra = {}) => mod.buildBackgroundAgentViewModel({
    id: Math.random().toString(), sessionId: "s", label: s, status: s, lastEventAt: new Date().toISOString(),
    ...extra,
  });
  const summary = mod.summarizeBackgroundAgents([
    mk("running", { model: "claude-opus-4-8" }),
    mk("running", { model: "claude-sonnet-4-6" }),
    mk("blocked", { worktreePath: "/tmp/wt" }),
  ]);
  assert.equal(summary.total, 3);
  assert.equal(summary.running, 2);
  assert.equal(summary.blocked, 1);
});
