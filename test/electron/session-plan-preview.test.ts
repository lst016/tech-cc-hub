import assert from "node:assert/strict";
import test from "node:test";
import type { PlanStepStatus, SessionPlanSnapshot } from "../../src/shared/plan-progress.js";
import {
  buildSessionPlanPreviewSummary,
  pickSidebarPlanDockSession,
} from "../../src/ui/utils/session-plan-preview.js";

function plan(sessionId: string, statuses: PlanStepStatus[], updatedAt: number): SessionPlanSnapshot {
  return {
    sessionId,
    source: "update_plan",
    updatedAt,
    plan: statuses.map((status, index) => ({ step: `Step ${index + 1}`, status })),
  };
}

test("summarizes completed, active, and pending plan steps", () => {
  const summary = buildSessionPlanPreviewSummary({
    sessionId: "session-1",
    source: "update_plan",
    updatedAt: 1,
    plan: [
      { step: "Inspect", status: "completed" },
      { step: "Implement", status: "in_progress" },
      { step: "Verify", status: "pending" },
    ],
  });

  assert.deepEqual(summary, {
    completed: 1,
    inProgress: 1,
    pending: 1,
    total: 3,
    label: "查看执行计划，已完成 1/3，1 项进行中",
  });
});

test("returns no summary for a missing or empty plan", () => {
  assert.equal(buildSessionPlanPreviewSummary(undefined), null);
  assert.equal(buildSessionPlanPreviewSummary({
    sessionId: "session-1",
    source: "update_plan",
    updatedAt: 1,
    plan: [],
  }), null);
});

test("dock prefers the active conversation when its plan is unfinished", () => {
  const selected = pickSidebarPlanDockSession([
    { id: "active", title: "Active", updatedAt: 10, latestPlan: plan("active", ["in_progress", "pending"], 10) },
    { id: "newer", title: "Newer", updatedAt: 20, latestPlan: plan("newer", ["pending"], 20) },
  ], "active");

  assert.equal(selected?.id, "active");
});

test("dock falls back to the latest unfinished plan when the active conversation has none", () => {
  const selected = pickSidebarPlanDockSession([
    { id: "active", title: "Active", updatedAt: 30 },
    { id: "older", title: "Older", updatedAt: 10, latestPlan: plan("older", ["pending"], 10) },
    { id: "newer", title: "Newer", updatedAt: 20, latestPlan: plan("newer", ["completed", "in_progress"], 20) },
  ], "active");

  assert.equal(selected?.id, "newer");
});

test("dock disappears when every available plan is complete", () => {
  const selected = pickSidebarPlanDockSession([
    { id: "active", title: "Active", updatedAt: 20, latestPlan: plan("active", ["completed", "completed"], 20) },
    { id: "other", title: "Other", updatedAt: 10, latestPlan: plan("other", ["completed"], 10) },
  ], "active");

  assert.equal(selected, null);
});
