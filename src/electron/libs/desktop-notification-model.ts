export type DesktopNotificationUrgency = "normal" | "critical" | "low";

export type DesktopNotificationTarget =
  | { type: "session"; sessionId: string }
  | { type: "task"; taskId: string; sessionId?: string }
  | { type: "cron"; jobId: string; sessionId?: string };

export type DesktopNotificationIntent = {
  id: string;
  dedupeKey: string;
  title: string;
  body: string;
  urgency: DesktopNotificationUrgency;
  target: DesktopNotificationTarget;
};

export type DesktopNotificationWindowState = {
  focused: boolean;
  minimized: boolean;
  visible: boolean;
  destroyed?: boolean;
};

export type TaskExecutionNotificationInput = {
  taskId: string;
  sessionId?: string;
  taskTitle?: string;
  workspacePath?: string;
  status: "running" | "completed" | "failed" | "cancelled";
  error?: string;
};

export type SessionNotificationInput = {
  sessionId: string;
  title?: string;
  lastPrompt?: string;
  workspacePath?: string;
  status: "idle" | "running" | "completed" | "error";
  error?: string;
};

export type CronNotificationInput = {
  jobId: string;
  jobName?: string;
  conversationTitle?: string;
  sessionId?: string;
  workspacePath?: string;
  status: "ok" | "error" | "skipped" | "missed";
  error?: string;
};

const MAX_NOTIFICATION_TITLE_CHARS = 72;
const MAX_NOTIFICATION_BODY_CHARS = 160;
const MAX_NOTIFICATION_LINE_CHARS = 90;
const TASK_SESSION_TITLE_PATTERN = /^\[(?:任务|浠诲姟)\]/;

export function shouldShowDesktopNotification(windows: DesktopNotificationWindowState[]): boolean {
  const liveWindows = windows.filter((windowState) => !windowState.destroyed);
  if (liveWindows.length === 0) return true;

  return !liveWindows.some((windowState) =>
    windowState.focused && windowState.visible && !windowState.minimized
  );
}

export function buildTaskExecutionDesktopNotification(
  input: TaskExecutionNotificationInput,
): DesktopNotificationIntent | null {
  if (input.status === "running" || input.status === "cancelled") return null;

  const isFailed = input.status === "failed";
  const taskTitle = normalizeLabel(input.taskTitle, "未命名任务");
  const body = buildNotificationBody([
    formatLine("工作区", formatWorkspaceName(input.workspacePath)),
    isFailed ? formatLine("错误", input.error) : undefined,
  ], "点击查看任务详情");

  return {
    body,
    dedupeKey: `task:${input.taskId}:${input.status}`,
    id: `task:${input.taskId}:${input.status}`,
    target: input.sessionId
      ? { type: "task", taskId: input.taskId, sessionId: input.sessionId }
      : { type: "task", taskId: input.taskId },
    title: buildNotificationTitle(isFailed ? "任务失败" : "任务完成", taskTitle),
    urgency: isFailed ? "critical" : "normal",
  };
}

export function buildSessionDesktopNotification(
  input: SessionNotificationInput,
): DesktopNotificationIntent | null {
  if (input.status !== "completed" && input.status !== "error") return null;
  if (isTaskSessionTitle(input.title)) return null;

  const isError = input.status === "error";
  const sessionTitle = normalizeLabel(input.title, "当前会话");
  const sessionLabel = pickSessionNotificationLabel(input);
  const body = buildNotificationBody([
    formatLine("工作区", formatWorkspaceName(input.workspacePath)),
    normalizeLabel(input.title, "") !== sessionLabel ? formatLine("会话", sessionTitle) : undefined,
    isError ? formatLine("错误", input.error) : undefined,
  ], "点击查看会话详情");

  return {
    body,
    dedupeKey: `session:${input.sessionId}:${input.status}`,
    id: `session:${input.sessionId}:${input.status}`,
    target: { type: "session", sessionId: input.sessionId },
    title: buildNotificationTitle(isError ? "出错" : "完成", sessionLabel),
    urgency: isError ? "critical" : "normal",
  };
}

export function buildCronDesktopNotification(input: CronNotificationInput): DesktopNotificationIntent | null {
  if (input.status === "skipped" || input.status === "missed") return null;

  const isError = input.status === "error";
  const jobName = normalizeLabel(input.jobName, "定时任务");
  const body = buildNotificationBody([
    formatLine("工作区", formatWorkspaceName(input.workspacePath)),
    formatLine("会话", input.conversationTitle),
    isError ? formatLine("错误", input.error) : undefined,
  ], "点击查看定时任务详情");

  return {
    body,
    dedupeKey: `cron:${input.jobId}:${input.status}`,
    id: `cron:${input.jobId}:${input.status}`,
    target: input.sessionId
      ? { type: "cron", jobId: input.jobId, sessionId: input.sessionId }
      : { type: "cron", jobId: input.jobId },
    title: buildNotificationTitle(isError ? "定时失败" : "定时完成", jobName),
    urgency: isError ? "critical" : "normal",
  };
}

function isTaskSessionTitle(title?: string): boolean {
  return TASK_SESSION_TITLE_PATTERN.test(title?.trim() ?? "");
}

function normalizeLabel(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

function pickSessionNotificationLabel(input: SessionNotificationInput): string {
  return normalizeLabel(input.lastPrompt, normalizeLabel(input.title, "当前会话"));
}

function buildNotificationTitle(prefix: string, label: string): string {
  return truncateSingleLine(`${prefix}：${label}`, MAX_NOTIFICATION_TITLE_CHARS);
}

function buildNotificationBody(lines: Array<string | undefined>, fallback: string): string {
  const body = lines.filter((line): line is string => Boolean(line?.trim())).join("\n");
  return truncateNotificationBody(body || fallback);
}

function formatLine(label: string, value?: string): string | undefined {
  const normalized = normalizeSingleLine(value);
  if (!normalized) return undefined;
  return `${label}：${truncateSingleLine(normalized, MAX_NOTIFICATION_LINE_CHARS)}`;
}

function formatWorkspaceName(path?: string): string | undefined {
  const normalized = normalizeSingleLine(path)?.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return undefined;
  const parts = normalized.split("/").filter(Boolean);
  return parts.at(-1) || normalized;
}

function normalizeSingleLine(value?: string): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function truncateSingleLine(value: string, maxChars: number): string {
  const normalized = normalizeSingleLine(value) ?? "";
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1)}…`;
}

function truncateNotificationBody(value: string): string {
  const normalized = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  if (normalized.length <= MAX_NOTIFICATION_BODY_CHARS) return normalized;
  return `${normalized.slice(0, MAX_NOTIFICATION_BODY_CHARS - 1)}…`;
}
