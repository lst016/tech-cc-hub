import React from "react";
import type { CronJob } from "../../../types/cron.js";

type StatusTone = "active" | "running" | "paused" | "warning" | "error";

const TONE_CLASSES: Record<StatusTone, string> = {
  active: "border-success/15 bg-success-light text-success",
  running: "border-info/15 bg-info-light text-info",
  paused: "border-ink-900/8 bg-surface-secondary text-ink-500",
  warning: "border-warning/15 bg-warning-light text-warning",
  error: "border-error/15 bg-error-light text-error",
};

function resolveStatus(job: CronJob): { label: string; tone: StatusTone } {
  if (!job.enabled) return { label: "已暂停", tone: "paused" };
  if (job.state.lastStatus === "retrying") return { label: "重试中", tone: "warning" };
  if (job.state.lastStatus === "error") return { label: "异常", tone: "error" };
  if (job.state.lastStatus === "missed") return { label: "已错过", tone: "error" };
  if (job.state.lastStatus === "skipped") return { label: "已跳过", tone: "warning" };
  return { label: "已启用", tone: "active" };
}

const CronStatusTag: React.FC<{ job: CronJob }> = ({ job }) => {
  const status = resolveStatus(job);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${TONE_CLASSES[status.tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      {status.label}
    </span>
  );
};

export default CronStatusTag;
