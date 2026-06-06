// test/electron/claude-worktree-isolation.test.mjs
// Phase 5 of the Claude Code 2.1.161 compatibility workflow.

import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const mod = await import(pathToFileURL("dist-electron/shared/agent-workspace-policy.js").href);

test("resolveAgentWorkspacePolicy: user override wins", () => {
  const out = mod.resolveAgentWorkspacePolicy({
    parallelWriteLanes: 1, isMultiAgent: false, userOverride: "shared",
  });
  assert.equal(out.policy, "shared");
  assert.equal(out.reason, "user override");
});

test("resolveAgentWorkspacePolicy: multi-agent with >1 write lane defaults to isolated", () => {
  const out = mod.resolveAgentWorkspacePolicy({
    parallelWriteLanes: 3, isMultiAgent: true,
  });
  assert.equal(out.policy, "isolated");
  assert.match(out.reason, /3 write lanes/);
  assert.ok(out.worktreePathSuggestion?.includes("lane-3"));
});

test("resolveAgentWorkspacePolicy: multiple write lanes (even non-multi-agent) => isolated", () => {
  const out = mod.resolveAgentWorkspacePolicy({
    parallelWriteLanes: 2, isMultiAgent: false,
  });
  assert.equal(out.policy, "isolated");
});

test("resolveAgentWorkspacePolicy: single agent can use shared", () => {
  const out = mod.resolveAgentWorkspacePolicy({
    parallelWriteLanes: 1, isMultiAgent: false, singleAgentSharedAllowed: true,
  });
  assert.equal(out.policy, "shared");
});

test("resolveAgentWorkspacePolicy: default safe is isolated", () => {
  const out = mod.resolveAgentWorkspacePolicy({ parallelWriteLanes: 1, isMultiAgent: false });
  assert.equal(out.policy, "isolated");
  assert.match(out.reason, /default-safe/);
});

test("canCleanupWorktree: blocks when dirty unless force", () => {
  const lease = { taskId: "t", laneId: "l", policy: "isolated", rootPath: "/r", status: "active" };
  const out = mod.canCleanupWorktree(lease, true, false);
  assert.equal(out.ok, false);
  assert.match(out.reason, /uncommitted/);
});

test("canCleanupWorktree: allows cleanup when force=true even if dirty", () => {
  const lease = { taskId: "t", laneId: "l", policy: "isolated", rootPath: "/r", status: "active" };
  const out = mod.canCleanupWorktree(lease, true, true);
  assert.equal(out.ok, true);
});

test("canCleanupWorktree: refuses readonly policy", () => {
  const lease = { taskId: "t", laneId: "l", policy: "readonly", rootPath: "/r", status: "active" };
  const out = mod.canCleanupWorktree(lease, false, true);
  assert.equal(out.ok, false);
  assert.match(out.reason, /readonly/);
});

test("canCleanupWorktree: refuses already-cleaned", () => {
  const lease = { taskId: "t", laneId: "l", policy: "isolated", rootPath: "/r", status: "cleaned" };
  const out = mod.canCleanupWorktree(lease, false, false);
  assert.equal(out.ok, false);
  assert.match(out.reason, /already cleaned/);
});
