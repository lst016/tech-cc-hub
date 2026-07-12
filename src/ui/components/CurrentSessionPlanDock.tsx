import type { SessionPlanSnapshot } from "../../shared/plan-progress.js";
import { buildSessionPlanPreviewSummary } from "../utils/session-plan-preview.js";

export interface CurrentSessionPlanDockProps {
  sessionTitle: string;
  plan: SessionPlanSnapshot;
}

function PlanStepIcon({ status }: { status: SessionPlanSnapshot["plan"][number]["status"] }) {
  if (status === "completed") {
    return (
      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[#b8bcc2] text-[#73777f]">
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="m4 8 2.5 2.5L12 5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (status === "in_progress") {
    return <span className="mt-0.5 h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-ink-900/20 border-t-ink-900" />;
  }

  return <span className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-ink-900" />;
}

export function CurrentSessionPlanDock({ sessionTitle, plan }: CurrentSessionPlanDockProps) {
  const summary = buildSessionPlanPreviewSummary(plan);
  if (!summary || summary.completed === summary.total) return null;

  return (
    <section
      role="region"
      aria-label={`当前会话未完成计划：${sessionTitle}`}
      data-current-session-plan-dock
      className="overflow-hidden rounded-[18px] border border-black/12 bg-white/95 shadow-[0_12px_34px_rgba(15,23,42,0.14)] backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 border-b border-black/8 px-4 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-800">{sessionTitle}</span>
        <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-muted">
          {summary.completed}/{summary.total}
        </span>
      </div>
      <div className="max-h-56 overflow-y-auto overscroll-contain px-3 py-2">
        {plan.plan.map((item, index) => (
          <div
            key={`${index}:${item.step}`}
            data-plan-step-status={item.status}
            className="flex items-start gap-3 rounded-xl px-1 py-1.5 text-[14px] leading-6"
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
