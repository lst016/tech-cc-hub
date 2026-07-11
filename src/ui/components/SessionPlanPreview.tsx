import { createPortal } from "react-dom";
import type { SessionPlanSnapshot } from "../../shared/plan-progress.js";
import { buildSessionPlanPreviewSummary } from "../utils/session-plan-preview.js";

export type SessionPlanPreviewAnchor = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export interface SessionPlanPreviewProps {
  id: string;
  plan: SessionPlanSnapshot;
  anchor: SessionPlanPreviewAnchor;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
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
    return (
      <span className="mt-0.5 h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 border-ink-900/20 border-t-ink-900" />
    );
  }

  return <span className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-ink-900" />;
}

export function SessionPlanPreview({
  id,
  plan,
  anchor,
  onMouseEnter,
  onMouseLeave,
}: SessionPlanPreviewProps) {
  if (typeof document === "undefined") return null;

  const summary = buildSessionPlanPreviewSummary(plan);
  if (!summary) return null;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const cardWidth = Math.min(360, Math.max(260, viewportWidth - 24));
  const estimatedHeight = Math.min(320, 24 + plan.plan.length * 44);
  const left = Math.max(12, Math.min(anchor.right + 10, viewportWidth - cardWidth - 12));
  const top = Math.max(12, Math.min(anchor.top - 10, viewportHeight - estimatedHeight - 12));

  return createPortal(
    <section
      id={id}
      role="region"
      aria-label={summary.label}
      data-session-plan-preview
      className="fixed z-[90] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-[18px] border border-black/15 bg-white p-2.5 text-[15px] shadow-[0_16px_48px_rgba(15,23,42,0.18)]"
      style={{ left, top }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="max-h-72 overflow-y-auto overscroll-contain">
        {plan.plan.map((item, index) => (
          <div
            key={`${index}:${item.step}`}
            data-plan-step-status={item.status}
            className="flex items-start gap-3 rounded-xl px-1.5 py-2 leading-6"
          >
            <PlanStepIcon status={item.status} />
            <span className={item.status === "completed" ? "text-[#858990]" : item.status === "in_progress" ? "font-medium text-ink-900" : "text-ink-800"}>
              {item.step}
            </span>
          </div>
        ))}
      </div>
    </section>,
    document.body,
  );
}
