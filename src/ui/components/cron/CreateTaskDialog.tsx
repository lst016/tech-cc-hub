// Source: CV from AionUi CreateTaskDialog.tsx (777 lines)
// Adapted for tech-cc-hub: simplified — removed agent/model selection, arco-design → Tailwind,
// hardcoded Chinese, removed i18n, WorkspaceFolderSelect, AcpConfigSelector, GuidModelSelector

import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { CronJob, CronSchedule, CreateCronJobParams } from "../../../types/cron.js";

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

function parseCronExpr(expr: string): { frequency: FrequencyType; time: string; weekday: string } {
  if (!expr) return { frequency: "manual", time: "09:00", weekday: "MON" };

  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return { frequency: "daily", time: "09:00", weekday: "MON" };

  const [min, hour, day, month, dow] = parts;

  if (hour === "*" && min === "0" && day === "*" && month === "*" && dow === "*") {
    return { frequency: "hourly", time: "09:00", weekday: "MON" };
  }

  if (dow === "MON-FRI" && day === "*" && month === "*") {
    const hh = String(hour).padStart(2, "0");
    const mm = String(min).padStart(2, "0");
    return { frequency: "weekdays", time: `${hh}:${mm}`, weekday: "MON" };
  }

  if (dow !== "*" && day === "*" && month === "*") {
    const dayUpper = dow.toUpperCase();
    const matched = WEEKDAYS.find((d) => d.value === dayUpper);
    if (matched) {
      const hh = String(hour).padStart(2, "0");
      const mm = String(min).padStart(2, "0");
      return { frequency: "weekly", time: `${hh}:${mm}`, weekday: dayUpper };
    }
    return { frequency: "daily", time: "09:00", weekday: "MON" };
  }

  if (day === "*" && month === "*" && dow === "*") {
    const hourNum = Number(hour);
    const minNum = Number(min);
    if (!isNaN(hourNum) && !isNaN(minNum) && hourNum >= 0 && hourNum <= 23 && minNum >= 0 && minNum <= 59) {
      const hh = String(hourNum).padStart(2, "0");
      const mm = String(minNum).padStart(2, "0");
      return { frequency: "daily", time: `${hh}:${mm}`, weekday: "MON" };
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
  const isEditMode = !!editJob;

  // Form state
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState(conversationId ?? "");
  const [selectedConvTitle, setSelectedConvTitle] = useState(conversationTitle ?? "");

  // Populate form for edit mode
  useEffect(() => {
    if (!visible) return;
    if (editJob) {
      const cronExpr = editJob.schedule.kind === "cron" ? editJob.schedule.expr : "";
      const parsed = parseCronExpr(cronExpr);
      setName(editJob.name);
      setDescription(editJob.description ?? "");
      setPrompt(editJob.target.payload.text);
      setFrequency(parsed.frequency);
      setTime(parsed.time);
      setWeekday(parsed.weekday);
      setCustomCronExpr(parsed.frequency === "custom" ? cronExpr : "");
      setExecutionMode(editJob.target.executionMode || "existing");
      setSelectedConvId(editJob.metadata.conversationId ?? conversationId ?? "");
      setSelectedConvTitle(editJob.metadata.conversationTitle ?? conversationTitle ?? "");
      setError(null);
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
      setError(null);
    }
  }, [visible, editJob, conversationId, conversationTitle]);

  const showTimePicker = frequency === "daily" || frequency === "weekdays" || frequency === "weekly";
  const showWeekdayPicker = frequency === "weekly";

  // Build schedule from frequency settings
  const scheduleInfo = useMemo(() => {
    const [hour, minute] = time.split(":").map(Number);
    switch (frequency) {
      case "manual":
        return { kind: "cron" as const, expr: "", description: "手动触发" };
      case "hourly":
        return { kind: "cron" as const, expr: "0 * * * *", description: "每小时" };
      case "daily":
        return { kind: "cron" as const, expr: `${minute} ${hour} * * *`, description: `每天 ${time}` };
      case "weekdays":
        return { kind: "cron" as const, expr: `${minute} ${hour} * * MON-FRI`, description: `工作日 ${time}` };
      case "weekly": {
        const dayLabel = WEEKDAYS.find((d) => d.value === weekday)?.label ?? weekday;
        return { kind: "cron" as const, expr: `${minute} ${hour} * * ${weekday}`, description: `每${dayLabel} ${time}` };
      }
      case "custom":
        return { kind: "cron" as const, expr: customCronExpr, description: customCronExpr || "自定义" };
      default:
        return { kind: "cron" as const, expr: "", description: "" };
    }
  }, [frequency, time, weekday, customCronExpr]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = (window as unknown as { electron: any }).electron;

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { setError("请输入任务名称"); return; }
    if (!description.trim()) { setError("请输入任务描述"); return; }
    if (!prompt.trim()) { setError("请输入提示词"); return; }

    setSubmitting(true);
    setError(null);

    try {
      if (isEditMode) {
        await el.invoke("cron:update-job", {
          jobId: editJob!.id,
          updates: {
            name: name.trim(),
            description: description.trim() || undefined,
            schedule: { kind: "cron", expr: scheduleInfo.expr, description: scheduleInfo.description } as CronSchedule,
            target: {
              ...editJob!.target,
              payload: { kind: "message", text: prompt.trim() },
              executionMode,
            },
            metadata: { ...editJob!.metadata, updatedAt: Date.now() },
          },
        });
      } else {
        const params: CreateCronJobParams = {
          name: name.trim(),
          description: description.trim() || undefined,
          schedule: { kind: "cron", expr: scheduleInfo.expr, description: scheduleInfo.description } as CronSchedule,
          prompt: prompt.trim(),
          conversationId: selectedConvId || conversationId || "",
          conversationTitle: selectedConvTitle || conversationTitle || "",
          agentType: "claude",
          createdBy: "user",
          executionMode,
        };
        await el.invoke("cron:add-job", params);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }, [name, description, prompt, scheduleInfo, executionMode, isEditMode, editJob, selectedConvId, selectedConvTitle, conversationId, conversationTitle, el, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-[min(560px,calc(100vw-32px))] max-w-[560px] rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-muted/20">
          <h2 className="m-0 text-lg font-semibold text-ink">
            {isEditMode ? "编辑任务" : "新建定时任务"}
          </h2>
          <button
            type="button"
            className="text-muted hover:text-ink transition-colors text-xl leading-none"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 max-h-[min(70vh,600px)] space-y-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">任务名称</label>
            <input
              type="text"
              className="rounded-lg border border-muted/30 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent"
              placeholder="例如：每日早报"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">任务描述</label>
            <input
              type="text"
              className="rounded-lg border border-muted/30 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent"
              placeholder="例如：每天早上 9 点获取新闻摘要"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Prompt */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">提示词</label>
            <textarea
              className="rounded-lg border border-muted/30 px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent resize-none"
              placeholder="输入要让 AI 执行的任务..."
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {/* Execution mode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">执行方式</label>
            <div className="flex gap-4">
              {([
                { value: "existing" as const, label: "现有会话" },
                { value: "new_conversation" as const, label: "新建会话" },
              ]).map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="executionMode"
                    className="accent-accent"
                    checked={executionMode === opt.value}
                    onChange={() => setExecutionMode(opt.value)}
                  />
                  <span className="text-sm text-ink">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Workspace selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">所属工作区</label>
            <select
              className="rounded-lg border border-muted/30 px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-accent"
              value={selectedConvId}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "__system__") {
                  setSelectedConvId("__system__");
                  setSelectedConvTitle("系统工作区");
                  onSelectWorkspace?.({ conversationId: "__system__", conversationTitle: "系统工作区" });
                  return;
                }
                const ws = workspaces?.find((w) => w.conversationId === value);
                setSelectedConvId(value);
                setSelectedConvTitle(ws?.conversationTitle ?? "");
                onSelectWorkspace?.(ws ?? { conversationId: value, conversationTitle: "" });
              }}
            >
              <option value="">不绑定工作区</option>
              <option value="__system__">系统工作区 — 全局任务</option>
              {workspaces?.map((ws) => (
                <option key={ws.conversationId} value={ws.conversationId}>
                  {ws.workspaceName} — {ws.conversationTitle}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">选择定时任务关联的工作区，任务将在该工作区的会话中执行</p>
          </div>

          {/* Frequency */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">执行频率</label>
            <select
              className="rounded-lg border border-muted/30 px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-accent"
              value={frequency}
              onChange={(e) => {
                const v = e.target.value as FrequencyType;
                setFrequency(v);
                if (v !== "custom") setCustomCronExpr("");
              }}
            >
              <option value="manual">手动触发</option>
              <option value="hourly">每小时</option>
              <option value="daily">每天</option>
              <option value="weekdays">工作日</option>
              <option value="weekly">每周</option>
              <option value="custom">自定义 Cron</option>
            </select>
            {frequency === "custom" && (
              <div className="mt-1">
                <input
                  type="text"
                  className="w-full rounded-lg border border-muted/30 px-3 py-2 text-sm font-mono text-ink placeholder:text-muted focus:outline-none focus:border-accent"
                  placeholder="分 时 日 月 周 (例如: 0 9 * * *)"
                  value={customCronExpr}
                  onChange={(e) => setCustomCronExpr(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted">
                  格式: 分(0-59) 时(0-23) 日(1-31) 月(1-12) 周(0-7)
                  {customCronExpr && ` → 当前: ${customCronExpr}`}
                </p>
              </div>
            )}
          </div>

          {/* Time picker */}
          {showTimePicker && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">执行时间</label>
              <input
                type="time"
                className="w-32 rounded-lg border border-muted/30 px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          )}

          {/* Weekday picker */}
          {showWeekdayPicker && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">星期</label>
              <select
                className="rounded-lg border border-muted/30 px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-accent"
                value={weekday}
                onChange={(e) => setWeekday(e.target.value)}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Advanced */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm font-medium text-ink hover:text-accent transition-colors"
              onClick={() => setAdvancedOpen((o) => !o)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${advancedOpen ? "rotate-90" : ""}`}
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
              高级设置
            </button>

            {advancedOpen && (
              <div className="mt-3 p-4 rounded-xl border border-muted/20 bg-muted/5">
                <div className="text-xs text-muted mb-2">
                  在现有会话中执行: 消息发送到指定会话，会话历史提供上下文<br />
                  新建会话: 每次执行创建一个新会话
                </div>
                <p className="text-xs text-muted">
                  提示: 手动触发频率的任务不会自动运行，需要手动点击"立即运行"
                </p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-muted/20">
          <button
            type="button"
            className="rounded-lg border border-muted/30 px-4 py-2 text-sm text-ink hover:bg-muted/5 transition-colors"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskDialog;
