import type { SessionPlanSnapshot } from "../../shared/plan-progress.js";
import { buildSessionPlanPreviewSummary } from "../utils/session-plan-preview.js";

export interface SidebarPlanDockProps {
  sessionId: string;
  sessionTitle: string;
  plan: SessionPlanSnapshot;
  onOpenSession: (sessionId: string) => void;
}

function PlanStepIcon({ status }: { status: SessionPlanSnapshot["plan"][number]["status"] }) {
  if (status === "completed") {
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#b8bcc2] text-[#73777f]">
        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="m4 8 2.5 2.5L12 5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (status === "in_progress") {
    return <span className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ink-900/20 border-t-ink-900" />;
  }

  return <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-[1.5px] border-ink-900" />;
}

export function SidebarPlanDock({
  sessionId,
  sessionTitle,
  plan,
  onOpenSession,
}: SidebarPlanDockProps) {
  const summary = buildSessionPlanPreviewSummary(plan);
  if (!summary || summary.completed === summary.total) return null;

  return (
    <section
      role="region"
      aria-label={`未完成计划：${sessionTitle}`}
      data-sidebar-plan-dock
      className="mx-0.5 shrink-0 overflow-hidden rounded-2xl border border-black/12 bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.12)]"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 border-b border-black/8 px-3 py-2 text-left transition-colors hover:bg-black/[0.025] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/45"
        onClick={() => onOpenSession(sessionId)}
        aria-label={`打开会话：${sessionTitle}`}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-800">{sessionTitle}</span>
        <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-muted">
          {summary.completed}/{summary.total}
        </span>
      </button>
      <div className="max-h-56 overflow-y-auto overscroll-contain px-2 py-1.5">
        {plan.plan.map((item, index) => (
          <div
            key={`${index}:${item.step}`}
            data-plan-step-status={item.status}
            className="flex items-start gap-2.5 rounded-lg px-1 py-1.5 text-[13px] leading-5"
          >
            <PlanStepIcon status={item.status} />
            <span className={item.status === "completed" ? "text-[#858990]" : item.status === "in_progress" ? "font-medium text-ink-900" : "text-ink-800"}>
              {item.step}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
