import test from "node:test";
import assert from "node:assert/strict";

import { buildSessionSemanticState } from "../../src/shared/session-semantics.js";

test("session semantic state marks background permission waits explicitly", () => {
  const state = buildSessionSemanticState({
    sessionId: "session-bg",
    executionMode: "background",
    status: "running",
    model: "gpt-5.5",
    effort: "xhigh",
    permissionMode: "plan",
    pendingPermissionCount: 1,
  });

  assert.equal(state.executionMode, "background");
  assert.equal(state.status, "waiting_input");
  assert.equal(state.model, "gpt-5.5");
  assert.equal(state.effort, "xhigh");
  assert.equal(state.permissionMode, "plan");
  assert.equal(state.blockerSummary, "Waiting for 1 permission response.");
});

test("session semantic state preserves completed background run parameters", () => {
  const state = buildSessionSemanticState({
    sessionId: "session-bg-done",
    executionMode: "background",
    status: "completed",
    model: "claude-opus-4-7",
    effort: "high",
    permissionMode: "bypassPermissions",
  });

  assert.equal(state.executionMode, "background");
  assert.equal(state.status, "completed");
  assert.equal(state.model, "claude-opus-4-7");
  assert.equal(state.effort, "high");
  assert.equal(state.permissionMode, "bypassPermissions");
  assert.equal(state.blockerSummary, undefined);
});
