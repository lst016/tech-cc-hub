import assert from "node:assert/strict";
import test from "node:test";
import type { PlanStepStatus, SessionPlanSnapshot } from "../../src/shared/plan-progress.js";
import {
  buildSessionPlanPreviewSummary,
  shouldShowCurrentSessionPlan,
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

test("current conversation plan stays visible while any step is unfinished", () => {
  assert.equal(shouldShowCurrentSessionPlan(plan("active", ["completed", "in_progress", "pending"], 10)), true);
});

test("current conversation plan disappears when every step is complete", () => {
  assert.equal(shouldShowCurrentSessionPlan(plan("active", ["completed", "completed"], 20)), false);
  assert.equal(shouldShowCurrentSessionPlan(undefined), false);
});
