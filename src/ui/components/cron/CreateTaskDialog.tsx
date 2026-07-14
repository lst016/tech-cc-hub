import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Clock3,
  Folder,
  Link2,
  MessageSquareText,
  Sparkles,
  X,
} from "lucide-react";
import type { CronJob, CronSchedule, CreateCronJobParams } from "../../../types/cron.js";
import { useAppStore } from "../../store/useAppStore.js";
import { AppModalOverlay } from "../AppModalOverlay.js";

function formatWorkspaceName(cwd?: string) {
  if (!cwd) return "未绑定工作区";
  const parts = cwd.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) || cwd;
}

interface CreateTaskDialogProps {
  visible: boolean;
  onClose: () => void;
  editJob?: CronJob;
  conversationId?: string;
  conversationTitle?: string;
  workspaces?: Array<{ conversationId: string; conversationTitle: string; workspaceName: string }>;
  onSelectWorkspace?: (workspace: { conversationId: string; conversationTitle: string }) => void;
}

type FrequencyType = "manual" | "hourly" | "daily" | "weekdays" | "weekly" | "custom";
type ExecutionMode = "new_conversation" | "existing";

const WEEKDAYS = [
  { value: "MON", label: "周一" },
  { value: "TUE", label: "周二" },
  { value: "WED", label: "周三" },
  { value: "THU", label: "周四" },
  { value: "FRI", label: "周五" },
  { value: "SAT", label: "周六" },
  { value: "SUN", label: "周日" },
];

const FREQUENCY_OPTIONS: Array<{ value: FrequencyType; label: string }> = [
  { value: "manual", label: "手动" },
  { value: "hourly", label: "每小时" },
  { value: "daily", label: "每天" },
  { value: "weekdays", label: "工作日" },
  { value: "weekly", label: "每周" },
  { value: "custom", label: "Cron" },
];

const CONTROL_CLASSES = "h-10 w-full rounded-xl border border-ink-900/10 bg-white px-3 text-sm text-ink-800 outline-none transition-colors placeholder:text-ink-400 focus:border-accent/40 focus:ring-2 focus:ring-accent/15";

function parseCronExpr(expr: string): { frequency: FrequencyType; time: string; weekday: string } {
  if (!expr) return { frequency: "manual", time: "09:00", weekday: "MON" };

  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return { frequency: "custom", time: "09:00", weekday: "MON" };
  const [minute, hour, day, month, dayOfWeek] = parts;

  if (hour === "*" && minute === "0" && day === "*" && month === "*" && dayOfWeek === "*") {
    return { frequency: "hourly", time: "09:00", weekday: "MON" };
  }

  if (dayOfWeek === "MON-FRI" && day === "*" && month === "*") {
    return { frequency: "weekdays", time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, weekday: "MON" };
  }

  if (dayOfWeek !== "*" && day === "*" && month === "*") {
    const normalizedDay = dayOfWeek.toUpperCase();
    if (WEEKDAYS.some((item) => item.value === normalizedDay)) {
      return { frequency: "weekly", time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, weekday: normalizedDay };
    }
  }

  if (day === "*" && month === "*" && dayOfWeek === "*") {
    const hourNumber = Number(hour);
    const minuteNumber = Number(minute);
    if (Number.isInteger(hourNumber) && Number.isInteger(minuteNumber) && hourNumber >= 0 && hourNumber <= 23 && minuteNumber >= 0 && minuteNumber <= 59) {
      return { frequency: "daily", time: `${String(hourNumber).padStart(2, "0")}:${String(minuteNumber).padStart(2, "0")}`, weekday: "MON" };
    }
  }

  return { frequency: "custom", time: "09:00", weekday: "MON" };
}

const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  visible,
  onClose,
  editJob,
  conversationId,
  conversationTitle,
  workspaces,
  onSelectWorkspace,
}) => {
  const isEditMode = Boolean(editJob);
  const preserveOriginalSchedule = Boolean(editJob && editJob.schedule.kind !== "cron");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [frequency, setFrequency] = useState<FrequencyType>("daily");
  const [time, setTime] = useState("09:00");
  const [weekday, setWeekday] = useState("MON");
  const [customCronExpr, setCustomCronExpr] = useState("");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("existing");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedConvId, setSelectedConvId] = useState(conversationId ?? "");
  const [selectedConvTitle, setSelectedConvTitle] = useState(conversationTitle ?? "");

  const sessions = useAppStore((state) => state.sessions);
  const archivedSessions = useAppStore((state) => state.archivedSessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const activeSession = activeSessionId ? sessions[activeSessionId] ?? archivedSessions[activeSessionId] : undefined;

  const effectiveWorkspaces = useMemo(() => {
    const map = new Map<string, { conversationId: string; conversationTitle: string; workspaceName: string }>();
    for (const workspace of workspaces ?? []) map.set(workspace.conversationId, workspace);

    for (const [id, session] of Object.entries({ ...archivedSessions, ...sessions })) {
      if (map.has(id) || !session.cwd) continue;
      map.set(id, {
        conversationId: id,
        conversationTitle: session.title,
        workspaceName: formatWorkspaceName(session.cwd),
      });
    }

    return Array.from(map.values()).sort((a, b) => a.workspaceName.localeCompare(b.workspaceName));
  }, [archivedSessions, sessions, workspaces]);

  useEffect(() => {
    if (!visible) return;
    if (editJob) {
      const cronExpression = editJob.schedule.kind === "cron" ? editJob.schedule.expr : "";
      const parsed = parseCronExpr(cronExpression);
      setName(editJob.name);
      setDescription(editJob.description ?? "");
      setPrompt(editJob.target.payload.text);
      setFrequency(parsed.frequency);
      setTime(parsed.time);
      setWeekday(parsed.weekday);
      setCustomCronExpr(parsed.frequency === "custom" ? cronExpression : "");
      setExecutionMode(editJob.target.executionMode || "existing");
      setSelectedConvId(editJob.metadata.conversationId ?? conversationId ?? "");
      setSelectedConvTitle(editJob.metadata.conversationTitle ?? conversationTitle ?? "");
    } else {
      setName("");
      setDescription("");
      setPrompt("");
      setFrequency("daily");
      setTime("09:00");
      setWeekday("MON");
      setCustomCronExpr("");
      setExecutionMode("existing");
      setSelectedConvId(conversationId ?? "");
      setSelectedConvTitle(conversationTitle ?? "");
    }
    setError(null);
  }, [conversationId, conversationTitle, editJob, visible]);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting, visible]);

  const showTimePicker = frequency === "daily" || frequency === "weekdays" || frequency === "weekly";
  const showWeekdayPicker = frequency === "weekly";

  const scheduleInfo = useMemo(() => {
    const [hour, minute] = time.split(":").map(Number);
    switch (frequency) {
      case "manual":
        return { expr: "", description: "手动触发" };
      case "hourly":
        return { expr: "0 * * * *", description: "每小时整点执行" };
      case "daily":
        return { expr: `${minute} ${hour} * * *`, description: `每天 ${time} 执行` };
      case "weekdays":
        return { expr: `${minute} ${hour} * * MON-FRI`, description: `每个工作日 ${time} 执行` };
      case "weekly": {
        const dayLabel = WEEKDAYS.find((item) => item.value === weekday)?.label ?? weekday;
        return { expr: `${minute} ${hour} * * ${weekday}`, description: `每${dayLabel} ${time} 执行` };
      }
      case "custom":
        return { expr: customCronExpr.trim(), description: customCronExpr.trim() ? `按 Cron ${customCronExpr.trim()} 执行` : "等待填写 Cron 表达式" };
      default:
        return { expr: "", description: "" };
    }
  }, [customCronExpr, frequency, time, weekday]);

  const planSummary = preserveOriginalSchedule
    ? editJob?.schedule.description || "保留原有调度计划"
    : scheduleInfo.description;
  const locationSummary = selectedConvId === "__system__"
    ? "系统工作区"
    : selectedConvTitle || "未绑定工作区";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const electron = (window as unknown as { electron: any }).electron;

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { setError("请输入任务名称"); return; }
    if (!description.trim()) { setError("请输入任务描述"); return; }
    if (!prompt.trim()) { setError("请输入任务指令"); return; }
    if (!preserveOriginalSchedule && frequency === "custom" && !customCronExpr.trim()) {
      setError("请输入 Cron 表达式");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const schedule: CronSchedule = preserveOriginalSchedule && editJob
        ? editJob.schedule
        : { kind: "cron", expr: scheduleInfo.expr, description: scheduleInfo.description };

      if (isEditMode && editJob) {
        await electron.invoke("cron:update-job", {
          jobId: editJob.id,
          updates: {
            name: name.trim(),
            description: description.trim(),
            schedule,
            target: {
              ...editJob.target,
              payload: { kind: "message", text: prompt.trim() },
              executionMode,
            },
            metadata: {
              ...editJob.metadata,
              conversationId: selectedConvId,
              conversationTitle: selectedConvTitle,
              updatedAt: Date.now(),
            },
          },
        });
      } else {
        const params: CreateCronJobParams = {
          name: name.trim(),
          description: description.trim(),
          schedule,
          prompt: prompt.trim(),
          conversationId: selectedConvId || conversationId || "",
          conversationTitle: selectedConvTitle || conversationTitle || "",
          agentType: "claude",
          createdBy: "user",
          executionMode,
        };
        await electron.invoke("cron:add-job", params);
      }
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }, [
    conversationId,
    conversationTitle,
    customCronExpr,
    description,
    editJob,
    electron,
    executionMode,
    frequency,
    isEditMode,
    name,
    onClose,
    preserveOriginalSchedule,
    prompt,
    scheduleInfo,
    selectedConvId,
    selectedConvTitle,
  ]);

  if (!visible) return null;

  return (
    <AppModalOverlay
      aria-label={isEditMode ? "编辑定时任务" : "新建定时任务"}
      className="z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
      onClick={() => { if (!submitting) onClose(); }}
    >
      <div
        className="flex max-h-[calc(100vh-32px)] w-full max-w-[880px] flex-col overflow-hidden rounded-[22px] border border-ink-900/8 bg-surface shadow-elevated"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-900/8 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
              <CalendarClock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="m-0 text-lg font-bold text-ink-900">{isEditMode ? "编辑定时任务" : "新建定时任务"}</h2>
              <p className="mb-0 mt-1 text-xs text-ink-500">配置任务内容、运行位置和调度计划</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭定时任务弹窗"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-surface-secondary hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            disabled={submitting}
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <FormSection icon={<MessageSquareText />} title="任务内容" description="告诉 AI 要做什么，以及完成这项工作的上下文。">
              <Field label="任务名称" htmlFor="cron-task-name">
                <input
                  id="cron-task-name"
                  autoFocus
                  type="text"
                  className={CONTROL_CLASSES}
                  placeholder="例如：每日项目早报"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label="任务描述" htmlFor="cron-task-description">
                <input
                  id="cron-task-description"
                  type="text"
                  className={CONTROL_CLASSES}
                  placeholder="用一句话说明任务目的"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
              <Field label="任务指令" htmlFor="cron-task-prompt" hint="执行时会将这段内容发送给 AI">
                <textarea
                  id="cron-task-prompt"
                  className={`${CONTROL_CLASSES} min-h-[132px] resize-y py-3 leading-6 lg:min-h-[172px]`}
                  placeholder="例如：汇总过去 24 小时的提交，提炼关键变化、风险和今日建议..."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
              </Field>
            </FormSection>

            <div className="flex min-w-0 flex-col gap-5">
              <FormSection icon={<Folder />} title="运行位置" description="选择任务使用的会话上下文。" compact>
                <Field label="执行方式" htmlFor="cron-execution-mode">
                  <div id="cron-execution-mode" className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="执行方式">
                    {([
                      { value: "existing" as const, label: "沿用会话", description: "保留上下文" },
                      { value: "new_conversation" as const, label: "新建会话", description: "每次独立" },
                    ]).map((option) => (
                      <label key={option.value} className="cursor-pointer">
                        <input
                          type="radio"
                          name="executionMode"
                          className="peer sr-only"
                          checked={executionMode === option.value}
                          onChange={() => setExecutionMode(option.value)}
                        />
                        <span className="flex min-h-[58px] flex-col justify-center rounded-xl border border-ink-900/10 bg-white px-3 transition-colors peer-checked:border-accent/35 peer-checked:bg-accent-subtle peer-focus-visible:ring-2 peer-focus-visible:ring-accent/25">
                          <span className="text-sm font-semibold text-ink-800">{option.label}</span>
                          <span className="mt-0.5 text-[11px] text-ink-400">{option.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="所属工作区" htmlFor="cron-workspace">
                  <select
                    id="cron-workspace"
                    className={CONTROL_CLASSES}
                    value={selectedConvId}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "__system__") {
                        setSelectedConvId(value);
                        setSelectedConvTitle("系统工作区");
                        onSelectWorkspace?.({ conversationId: value, conversationTitle: "系统工作区" });
                        return;
                      }
                      const workspace = effectiveWorkspaces.find((item) => item.conversationId === value);
                      setSelectedConvId(value);
                      setSelectedConvTitle(workspace?.conversationTitle ?? "");
                      onSelectWorkspace?.(workspace ?? { conversationId: value, conversationTitle: "" });
                    }}
                  >
                    <option value="">不绑定工作区</option>
                    <option value="__system__">系统工作区 — 全局任务</option>
                    {effectiveWorkspaces.map((workspace) => (
                      <option key={workspace.conversationId} value={workspace.conversationId}>
                        {workspace.workspaceName} — {workspace.conversationTitle}
                      </option>
                    ))}
                  </select>
                </Field>

                {activeSessionId && activeSession && selectedConvId !== activeSessionId && (
                  <button
                    type="button"
                    className="inline-flex w-fit items-center gap-2 rounded-lg px-1 py-1 text-xs font-semibold text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                    onClick={() => {
                      setSelectedConvId(activeSessionId);
                      setSelectedConvTitle(activeSession.title || "当前会话");
                      onSelectWorkspace?.({ conversationId: activeSessionId, conversationTitle: activeSession.title || "当前会话" });
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                    使用当前会话{activeSession.title ? `（${activeSession.title}）` : ""}
                  </button>
                )}
              </FormSection>

              <FormSection icon={<Clock3 />} title="调度计划" description="选择任务自动运行的时间。" compact>
                {preserveOriginalSchedule ? (
                  <div className="rounded-xl border border-warning/20 bg-warning-light px-3.5 py-3 text-xs leading-5 text-ink-700">
                    该任务使用一次性或间隔计划。本次编辑会保留原计划，避免把它误写成 Cron。
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="执行频率">
                      {FREQUENCY_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={frequency === option.value}
                          className={`h-9 rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 ${frequency === option.value ? "bg-accent text-white shadow-soft" : "border border-ink-900/8 bg-white text-ink-600 hover:bg-surface-secondary"}`}
                          onClick={() => {
                            setFrequency(option.value);
                            if (option.value !== "custom") setCustomCronExpr("");
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {(showTimePicker || showWeekdayPicker) && (
                      <div className={`grid gap-3 ${showWeekdayPicker ? "grid-cols-2" : "grid-cols-1"}`}>
                        {showWeekdayPicker && (
                          <Field label="星期" htmlFor="cron-weekday">
                            <select id="cron-weekday" className={CONTROL_CLASSES} value={weekday} onChange={(event) => setWeekday(event.target.value)}>
                              {WEEKDAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                            </select>
                          </Field>
                        )}
                        {showTimePicker && (
                          <Field label="执行时间" htmlFor="cron-time">
                            <input id="cron-time" type="time" className={CONTROL_CLASSES} value={time} onChange={(event) => setTime(event.target.value)} />
                          </Field>
                        )}
                      </div>
                    )}

                    {frequency === "custom" && (
                      <Field label="Cron 表达式" htmlFor="cron-expression" hint="格式：分 时 日 月 周">
                        <input
                          id="cron-expression"
                          type="text"
                          className={`${CONTROL_CLASSES} font-mono`}
                          placeholder="0 9 * * *"
                          value={customCronExpr}
                          onChange={(event) => setCustomCronExpr(event.target.value)}
                        />
                      </Field>
                    )}
                  </>
                )}

                <div className="rounded-xl border border-accent/15 bg-accent-subtle p-3.5" aria-live="polite">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                    计划摘要
                  </div>
                  <p className="mb-0 mt-2 text-sm font-semibold leading-5 text-ink-800">{planSummary}</p>
                  <p className="mb-0 mt-1 flex items-center gap-1.5 text-[11px] text-ink-500">
                    <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    {locationSummary} · {executionMode === "existing" ? "沿用会话" : "新建会话"}
                  </p>
                </div>
              </FormSection>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-error/15 bg-error-light px-4 py-3 text-sm text-error">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-ink-900/8 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0 text-xs text-ink-500">
            <span className="font-semibold text-ink-700">{planSummary}</span>
            <span className="mx-1.5 text-ink-300">·</span>
            <span>{locationSummary}</span>
          </div>
          <div className="flex shrink-0 justify-end gap-3">
            <button
              type="button"
              className="h-10 rounded-xl border border-ink-900/10 bg-white px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
              disabled={submitting}
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="inline-flex h-10 min-w-24 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {submitting ? "保存中..." : isEditMode ? "保存修改" : "创建任务"}
            </button>
          </div>
        </footer>
      </div>
    </AppModalOverlay>
  );
};

const FormSection: React.FC<{
  icon: React.ReactElement;
  title: string;
  description: string;
  compact?: boolean;
  children: React.ReactNode;
}> = ({ icon, title, description, compact = false, children }) => (
  <section className={`rounded-2xl border border-ink-900/8 ${compact ? "bg-surface-secondary/55 p-4" : "bg-white p-5"}`}>
    <div className="mb-4 flex items-start gap-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
        {icon}
      </span>
      <div>
        <h3 className="m-0 text-sm font-bold text-ink-900">{title}</h3>
        <p className="mb-0 mt-1 text-xs leading-5 text-ink-500">{description}</p>
      </div>
    </div>
    <div className="flex flex-col gap-4">{children}</div>
  </section>
);

const Field: React.FC<{
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-xs font-bold text-ink-700">{label}</label>
      {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
    </div>
    {children}
  </div>
);

export default CreateTaskDialog;
