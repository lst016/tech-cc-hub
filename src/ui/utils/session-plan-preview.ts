import type { SessionPlanSnapshot } from "../../shared/plan-progress.js";

export type SessionPlanPreviewSummary = {
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
  label: string;
};

export type SidebarPlanDockSession = {
  id: string;
  title: string;
  updatedAt?: number;
  latestPlan?: SessionPlanSnapshot;
};

export function pickSidebarPlanDockSession<T extends SidebarPlanDockSession>(
  sessions: T[],
  activeSessionId: string | null,
): T | null {
  const unfinished = sessions.filter((session) => (
    session.latestPlan?.plan.some((item) => item.status !== "completed")
  ));
  if (unfinished.length === 0) return null;

  const active = activeSessionId
    ? unfinished.find((session) => session.id === activeSessionId)
    : undefined;
  if (active) return active;

  return [...unfinished].sort((a, b) => {
    const aUpdatedAt = a.latestPlan?.updatedAt ?? a.updatedAt ?? 0;
    const bUpdatedAt = b.latestPlan?.updatedAt ?? b.updatedAt ?? 0;
    return bUpdatedAt - aUpdatedAt;
  })[0] ?? null;
}

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
