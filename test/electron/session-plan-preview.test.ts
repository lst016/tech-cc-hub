import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionPlanPreviewSummary } from "../../src/ui/utils/session-plan-preview.js";

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
