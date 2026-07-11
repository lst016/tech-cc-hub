import type { SessionPlanSnapshot } from "../../shared/plan-progress.js";

export type SessionPlanPreviewSummary = {
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
  label: string;
};

export function buildSessionPlanPreviewSummary(
  plan: SessionPlanSnapshot | undefined,
): SessionPlanPreviewSummary | null {
  if (!plan?.plan.length) return null;

  const completed = plan.plan.filter((item) => item.status === "completed").length;
  const inProgress = plan.plan.filter((item) => item.status === "in_progress").length;
  const pending = plan.plan.length - completed - inProgress;
  const activeSuffix = inProgress > 0 ? `，${inProgress} 项进行中` : "";

  return {
    completed,
    inProgress,
    pending,
    total: plan.plan.length,
    label: `查看执行计划，已完成 ${completed}/${plan.plan.length}${activeSuffix}`,
  };
}
