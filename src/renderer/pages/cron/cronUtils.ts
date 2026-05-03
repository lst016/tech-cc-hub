// Source: CV from AionUi cronUtils.ts (92 lines)
// Adapted for tech-cc-hub: hardcoded Chinese, removed i18n TFunction parameter

import type { CronJob } from "../../../types/cron.js";

const WEEKDAY_LABELS: Record<string, string> = {
  MON: "周一", TUE: "周二", WED: "周三", THU: "周四",
  FRI: "周五", SAT: "周六", SUN: "周日",
};

function formatTime(hour: string, minute: string): string {
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function formatCronExpr(expr: string): string | null {
  if (!expr) return "手动触发";

  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return null;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const normalizedDayOfWeek = dayOfWeek.toUpperCase();
  const time = formatTime(hour, minute);

  if (minute === "0" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "每小时";
  }

  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*" && hour !== "*" && minute !== "*") {
    return `每天 ${time}`;
  }

  if (dayOfMonth === "*" && month === "*" && normalizedDayOfWeek === "MON-FRI") {
    return `工作日 ${time}`;
  }

  const weekdayKey = WEEKDAY_LABELS[normalizedDayOfWeek];
  if (dayOfMonth === "*" && month === "*" && weekdayKey) {
    return `每${weekdayKey} ${time}`;
  }

  return null;
}

export function formatSchedule(job: CronJob): string {
  if (job.schedule.kind === "cron") {
    return formatCronExpr(job.schedule.expr) ?? job.schedule.description;
  }

  if (job.schedule.kind === "every" && job.schedule.everyMs === 3600000) {
    return "每小时";
  }

  return job.schedule.description;
}

export function formatNextRun(nextRunAtMs?: number): string {
  if (!nextRunAtMs) return "-";
  const date = new Date(nextRunAtMs);
  return date.toLocaleString();
}

export function getJobStatusFlags(job: CronJob): { hasError: boolean; isPaused: boolean } {
  return {
    hasError: job.state.lastStatus === "error",
    isPaused: !job.enabled,
  };
}
