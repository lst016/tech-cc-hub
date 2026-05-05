import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  DollarSign,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Square,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTaskStore } from "../store/taskStore";
import { useAppStore } from "../store/useAppStore";
import type {
  ClientEvent,
  ServerEvent,
  UiTask,
  UiTaskArtifact,
  UiTaskExecution,
  UiTaskExecutionBundle,
  UiTaskExecutionLog,
  UiTaskExecutionOptions,
  UiTaskStats,
  UiTaskStatus,
  UiTaskSubtask,
  UiTaskProviderState,
  UiTaskWorkflowSettings,
} from "../types";

type Props = {
  connected: boolean;
  sendEvent: (event: ClientEvent) => void;
  onBack: () => void;
};

const STATUS_LABELS: Record<UiTaskStatus, string> = {
  pending: "待处理",
  in_progress: "进行中",
  done: "外部完成",
  cancelled: "已取消",
  queued: "排队中",
  executing: "AI 执行中",
  retrying: "自动重试",
  paused: "已暂停",
  completed: "AI 已完成",
  failed: "执行失败",
};

const STATUS_TONES: Record<UiTaskStatus, { badge: string; dot: string; icon: typeof Circle }> = {
  pending: { badge: "border-slate-200 bg-slate-50 text-slate-700", dot: "bg-slate-400", icon: Circle },
  in_progress: { badge: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-500", icon: Clock3 },
  done: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
  cancelled: { badge: "border-slate-200 bg-slate-100 text-slate-500", dot: "bg-slate-300", icon: Circle },
  queued: { badge: "border-indigo-200 bg-indigo-50 text-indigo-700", dot: "bg-indigo-500", icon: Clock3 },
  executing: { badge: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500", icon: Loader2 },
  retrying: { badge: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-500", icon: RefreshCw },
  paused: { badge: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400", icon: Pause },
  completed: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
  failed: { badge: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500", icon: AlertCircle },
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

const PRIORITY_TONES: Record<string, string> = {
  low: "bg-slate-50 text-slate-500 ring-slate-200",
  medium: "bg-slate-50 text-slate-700 ring-slate-200",
  high: "bg-amber-50 text-amber-700 ring-amber-200",
  urgent: "bg-red-50 text-red-700 ring-red-200",
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "pending", label: "待处理" },
  { value: "queued", label: "排队中" },
  { value: "executing", label: "执行中" },
  { value: "retrying", label: "重试中" },
  { value: "paused", label: "已暂停" },
  { value: "completed", label: "AI 已完成" },
  { value: "failed", label: "失败" },
  { value: "done", label: "外部完成" },
  { value: "all", label: "全部" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAssigneeCount(task: UiTask): number {
  const members = task.sourceData?.members;
  if (Array.isArray(members)) {
    return members.filter(isRecord).length;
  }
  if (!task.assignee) return 0;
  return task.assignee.split(/[、,，]/).map((item) => item.trim()).filter(Boolean).length;
}

function getProviderLabel(task: UiTask): string {
  return task.provider === "lark" ? "飞书" : "TB";
}

function formatShortId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function formatDate(value?: number): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value?: number): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatCost(value?: number): string {
  if (!value || !Number.isFinite(value)) return "$0.00";
  return `$${value.toFixed(value < 1 ? 4 : 2)}`;
}

function formatTokens(value?: number): string {
  const normalized = Number(value ?? 0);
  if (normalized >= 1000) return `${Math.round(normalized / 1000)}k`;
  return String(normalized);
}

function formatWorkspaceName(path?: string): string {
  if (!path) return "未绑定工作区";
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) || path;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function getElectronInvoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const electronApi = window.electron as typeof window.electron & { invoke?: (c: string, ...a: unknown[]) => Promise<T> };
  if (electronApi.invoke) return electronApi.invoke(channel, ...args);
  return Promise.reject(new Error("Electron invoke bridge unavailable"));
}

function StatusBadge({ status, compact = false }: { status: UiTaskStatus; compact?: boolean }) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES.pending;
  const Icon = tone.icon;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-md border font-medium", tone.badge, compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs")}>
      <Icon className={cx("h-3 w-3", (status === "executing" || status === "retrying") && "animate-spin")} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1", PRIORITY_TONES[priority] ?? PRIORITY_TONES.medium)}>
      P-{PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

function EmptyState({ syncError }: { syncError: string | null }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
        <FileText className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-700">没有匹配任务</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">调整筛选条件，或点击同步飞书刷新最近一个月任务。</p>
      {syncError && <p className="mt-3 max-w-[260px] text-xs leading-relaxed text-red-600">{syncError}</p>}
    </div>
  );
}

export function TaskPanel({ connected, sendEvent, onBack }: Props) {
  const tasks = useTaskStore((s) => s.tasks);
  const stats = useTaskStore((s) => s.stats);
  const executions = useTaskStore((s) => s.executions);
  const executionLogs = useTaskStore((s) => s.executionLogs);
  const subtasks = useTaskStore((s) => s.subtasks);
  const artifacts = useTaskStore((s) => s.artifacts);
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const syncing = useTaskStore((s) => s.syncing);
  const settings = useTaskStore((s) => s.settings);
  const providers = useTaskStore((s) => s.providers);
  const sessions = useAppStore((s) => s.sessions);
  const archivedSessions = useAppStore((s) => s.archivedSessions);
  const cwd = useAppStore((s) => s.cwd);
  const apiConfigSettings = useAppStore((s) => s.apiConfigSettings);
  const runtimeModel = useAppStore((s) => s.runtimeModel);
  const setTasks = useTaskStore((s) => s.setTasks);
  const upsertTask = useTaskStore((s) => s.upsertTask);
  const setStats = useTaskStore((s) => s.setStats);
  const setExecutionData = useTaskStore((s) => s.setExecutionData);
  const setTaskSettings = useTaskStore((s) => s.setTaskSettings);
  const setProviders = useTaskStore((s) => s.setProviders);
  const addExecutionLog = useTaskStore((s) => s.addExecutionLog);
  const removeTask = useTaskStore((s) => s.removeTask);
  const setSelectedTaskId = useTaskStore((s) => s.setSelectedTaskId);
  const setSyncing = useTaskStore((s) => s.setSyncing);
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId);

  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [draftSettings, setDraftSettings] = useState<UiTaskWorkflowSettings | null>(null);
  const [executeOptions, setExecuteOptions] = useState<UiTaskExecutionOptions>({});
  const [recentCwds, setRecentCwds] = useState<string[]>([]);

  useEffect(() => {
    if (!connected) return;
    sendEvent({ type: "task.list" });
    sendEvent({ type: "task.stats" });
    sendEvent({ type: "task.settings.get" });
    sendEvent({ type: "task.providers" });
  }, [connected, sendEvent]);

  useEffect(() => {
    window.electron.getRecentCwds?.(20)
      .then((items) => setRecentCwds(Array.isArray(items) ? items.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []))
      .catch(() => setRecentCwds([]));
  }, []);

  useEffect(() => {
    if (!connected) return;

    const unsubscribeCallbacks: Array<() => void> = [];
    const unsubList = window.electron.onServerEvent?.((raw: unknown) => {
      const e = raw as ServerEvent;
      switch (e.type) {
        case "task.list":
          setTasks((e.payload as { tasks: UiTask[] }).tasks);
          break;
        case "task.updated":
          upsertTask((e.payload as { task: UiTask }).task);
          sendEvent({ type: "task.stats" });
          break;
        case "task.deleted":
          removeTask((e.payload as { taskId: string }).taskId);
          sendEvent({ type: "task.stats" });
          break;
        case "task.stats":
          setStats((e.payload as { stats: UiTaskStats }).stats);
          break;
        case "task.execution.list": {
          const p = e.payload as UiTaskExecutionBundle;
          setExecutionData(p.taskId, p.executions, p.logs, p.subtasks, p.artifacts);
          break;
        }
        case "task.execution.bundle": {
          const p = e.payload as UiTaskExecutionBundle;
          setExecutionData(p.taskId, p.executions, p.logs, p.subtasks, p.artifacts);
          break;
        }
        case "task.settings": {
          const next = (e.payload as { settings: UiTaskWorkflowSettings }).settings;
          setTaskSettings(next);
          setDraftSettings(next);
          break;
        }
        case "task.providers":
          setProviders((e.payload as { providers: UiTaskProviderState[] }).providers);
          break;
        case "task.execution.started":
          sendEvent({ type: "task.execution.logs", payload: { taskId: (e.payload as { execution: UiTaskExecution }).execution.taskId } });
          break;
        case "task.execution.completed":
          sendEvent({ type: "task.execution.logs", payload: { taskId: (e.payload as { execution: UiTaskExecution }).execution.taskId } });
          sendEvent({ type: "task.stats" });
          break;
        case "task.execution.log": {
          const log = (e.payload as { log: UiTaskExecutionLog }).log;
          if (log) addExecutionLog(log);
          break;
        }
        case "task.sync.completed":
          setSyncing(false);
          setSyncError(null);
          toast.success(`飞书同步完成，拉取 ${(e.payload as { count?: number }).count ?? 0} 条任务`, {
            id: "task-sync",
          });
          sendEvent({ type: "task.list" });
          sendEvent({ type: "task.stats" });
          break;
        case "task.error":
          setSyncing(false);
          {
            const message = (e.payload as { message?: string }).message ?? "任务同步失败";
            setSyncError(message);
            toast.error(message, { id: "task-sync" });
          }
          break;
      }
    });

    if (unsubList) unsubscribeCallbacks.push(unsubList);

    return () => {
      unsubscribeCallbacks.forEach((fn) => fn());
    };
  }, [connected, sendEvent, setTasks, upsertTask, removeTask, setStats, setSyncing, setExecutionData, setTaskSettings, setProviders, addExecutionLog]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  const taskExecutions = useMemo(
    () => (selectedTaskId ? executions[selectedTaskId] ?? [] : []),
    [executions, selectedTaskId],
  );

  const taskLogs = useMemo(
    () => (selectedTaskId ? executionLogs[selectedTaskId] ?? [] : []),
    [executionLogs, selectedTaskId],
  );

  const taskSubtasks = useMemo(
    () => (selectedTaskId ? subtasks[selectedTaskId] ?? [] : []),
    [subtasks, selectedTaskId],
  );

  const taskArtifacts = useMemo(
    () => (selectedTaskId ? artifacts[selectedTaskId] ?? [] : []),
    [artifacts, selectedTaskId],
  );

  useEffect(() => {
    if (!selectedTask && !settings) return;
    setExecuteOptions({
      driverId: selectedTask?.driverId ?? settings?.defaultDriverId ?? "claude",
      reasoningMode: selectedTask?.reasoningMode ?? settings?.defaultReasoningMode ?? "high",
      model: selectedTask?.model ?? "",
      workspacePath: selectedTask?.workspacePath ?? "",
      maxCostUsd: selectedTask?.maxCostUsd ?? settings?.maxCostUsd,
    });
  }, [selectedTask?.id, settings?.defaultDriverId, settings?.defaultReasoningMode, settings?.maxCostUsd]);

  const modelOptions = useMemo(() => {
    const enabledProfile = apiConfigSettings.profiles.find((profile) => profile.enabled) ?? apiConfigSettings.profiles[0];
    const values = new Set<string>();
    if (runtimeModel.trim()) values.add(runtimeModel.trim());
    if (enabledProfile?.model?.trim()) values.add(enabledProfile.model.trim());
    for (const model of enabledProfile?.models ?? []) {
      if (model.name?.trim()) values.add(model.name.trim());
    }
    if (selectedTask?.model?.trim()) values.add(selectedTask.model.trim());
    if (executeOptions.model?.trim()) values.add(executeOptions.model.trim());
    return Array.from(values);
  }, [apiConfigSettings.profiles, executeOptions.model, runtimeModel, selectedTask?.model]);

  const workspaceOptions = useMemo(() => {
    const values = new Set<string>();
    const add = (path?: string) => {
      const trimmed = path?.trim();
      if (trimmed) values.add(trimmed);
    };
    add(cwd);
    add(selectedTask?.workspacePath);
    add(executeOptions.workspacePath);
    for (const session of Object.values(sessions)) add(session.cwd);
    for (const session of Object.values(archivedSessions)) add(session.cwd);
    for (const path of recentCwds) add(path);
    return Array.from(values).map((path) => ({
      value: path,
      label: `${formatWorkspaceName(path)} · ${path}`,
    }));
  }, [archivedSessions, cwd, executeOptions.workspacePath, recentCwds, selectedTask?.workspacePath, sessions]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tasks.length };
    for (const task of tasks) {
      counts[task.localStatus] = (counts[task.localStatus] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (statusFilter !== "all") {
      result = result.filter((t) => t.localStatus === statusFilter);
    }
    if (providerFilter !== "all") {
      result = result.filter((t) => t.provider === providerFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          t.externalId.toLowerCase().includes(q),
      );
    }

    return result;
  }, [tasks, statusFilter, providerFilter, searchQuery]);

  const handleSync = useCallback(
    (provider: string) => {
      setSyncing(true);
      setSyncError(null);
      toast.loading(provider === "lark" ? "正在同步飞书任务..." : "正在同步任务...", {
        id: "task-sync",
      });
      sendEvent({ type: "task.sync", payload: { provider } });
    },
    [sendEvent, setSyncing],
  );

  const handleExecute = useCallback(
    (taskId: string) => {
      const options: UiTaskExecutionOptions = {
        ...executeOptions,
        model: executeOptions.model?.trim() || undefined,
        workspacePath: executeOptions.workspacePath?.trim() || undefined,
        promptTemplate: executeOptions.promptTemplate?.trim() || undefined,
      };
      sendEvent({ type: "task.execute", payload: { taskId, options } });
    },
    [executeOptions, sendEvent],
  );

  const handleControl = useCallback(
    (taskId: string, action: "pause" | "resume" | "cancel" | "cancel-retry") => {
      sendEvent({ type: "task.control", payload: { taskId, action } });
    },
    [sendEvent],
  );

  const handleDelete = useCallback(
    (task: UiTask) => {
      const confirmed = window.confirm(`从任务面板删除「${task.title}」？\n\n只删除本地缓存和执行日志，不会删除飞书里的原任务；后续同步也会保持隐藏。`);
      if (!confirmed) return;
      sendEvent({ type: "task.delete", payload: { taskId: task.id } });
    },
    [sendEvent],
  );

  const selectTask = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId);
      sendEvent({ type: "task.execution.logs", payload: { taskId } });
    },
    [sendEvent, setSelectedTaskId],
  );

  const handleSaveSettings = useCallback(() => {
    if (!draftSettings) return;
    sendEvent({ type: "task.settings.update", payload: { settings: draftSettings } });
    sendEvent({ type: "task.providers" });
    toast.success("任务系统配置已保存");
  }, [draftSettings, sendEvent]);

  const handleOpenWorkspace = useCallback(async (path?: string) => {
    if (!path) return;
    try {
      await getElectronInvoke("preview-show-item-in-folder", { path });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "打开工作区失败");
    }
  }, []);

  const handleOpenSession = useCallback((sessionId?: string) => {
    if (!sessionId) return;
    setActiveSessionId(sessionId);
    sendEvent({ type: "session.history", payload: { sessionId } });
    onBack();
  }, [onBack, sendEvent, setActiveSessionId]);

  const statTiles = [
    { label: "总任务", value: stats?.total ?? tasks.length, className: "text-slate-900", icon: FileText },
    { label: "排队", value: stats?.queued ?? 0, className: "text-indigo-700", icon: Clock3 },
    { label: "执行中", value: stats?.executing ?? 0, className: "text-amber-700", icon: Loader2 },
    { label: "待重试", value: stats?.retrying ?? 0, className: "text-blue-700", icon: RefreshCw },
    { label: "暂停", value: stats?.paused ?? 0, className: "text-slate-600", icon: Pause },
    { label: "AI 完成", value: stats?.completed ?? 0, className: "text-emerald-700", icon: CheckCircle2 },
    { label: "失败", value: stats?.failed ?? 0, className: "text-red-700", icon: AlertCircle },
    { label: "费用", value: formatCost(stats?.estimatedCostUsd), className: "text-slate-700", icon: DollarSign },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 text-slate-900">
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              title="返回聊天"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-slate-950">任务面板</h1>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  30 天同步
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">同步飞书任务，拆解并交给本地 Agent 执行。</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings((value) => !value)}
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition",
                showSettings ? "border-orange-200 bg-orange-50 text-orange-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              <Settings2 className="h-3.5 w-3.5" />
              配置
            </button>
            <button
              type="button"
              onClick={() => handleSync("lark")}
              disabled={syncing || !connected}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={cx("h-3.5 w-3.5", syncing && "animate-spin")} />
              {syncing ? "同步中" : "同步飞书"}
            </button>
            <button
              type="button"
              onClick={() => handleSync("tb")}
              disabled={syncing || !connected || providers.find((item) => item.id === "tb")?.enabled === false}
              title={providers.find((item) => item.id === "tb")?.error ?? "同步 TB"}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            >
              同步 TB
            </button>
          </div>
        </div>

        <div className="grid grid-cols-8 gap-px border-t border-slate-100 bg-slate-100">
          {statTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <div key={tile.label} className="flex items-center gap-2 bg-white px-5 py-2.5">
                <Icon className={cx("h-4 w-4", tile.className, ((tile.label === "执行中" && syncing) || (tile.label === "待重试" && Number(tile.value) > 0)) && "animate-spin")} />
                <div>
                  <p className="text-[11px] font-medium text-slate-500">{tile.label}</p>
                  <p className={cx("text-sm font-semibold", tile.className)}>{tile.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {showSettings && draftSettings && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-3">
              <section className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900">调度策略</h3>
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md bg-slate-950 px-2.5 text-[11px] font-semibold text-white"
                  >
                    <Save className="h-3 w-3" />
                    保存
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[11px] font-medium text-slate-500">
                    并发数
                    <input
                      type="number"
                      min={1}
                      value={draftSettings.maxConcurrentAgents}
                      onChange={(e) => setDraftSettings({ ...draftSettings, maxConcurrentAgents: Number(e.target.value) })}
                      className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs text-slate-800 outline-none"
                    />
                  </label>
                  <label className="text-[11px] font-medium text-slate-500">
                    自动重试
                    <input
                      type="number"
                      min={0}
                      value={draftSettings.maxAutoRetries}
                      onChange={(e) => setDraftSettings({ ...draftSettings, maxAutoRetries: Number(e.target.value) })}
                      className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs text-slate-800 outline-none"
                    />
                  </label>
                  <label className="text-[11px] font-medium text-slate-500">
                    卡住判定秒
                    <input
                      type="number"
                      min={30}
                      value={Math.round(draftSettings.stallTimeoutMs / 1000)}
                      onChange={(e) => setDraftSettings({ ...draftSettings, stallTimeoutMs: Number(e.target.value) * 1000 })}
                      className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs text-slate-800 outline-none"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-3">
                <h3 className="mb-2 text-xs font-semibold text-slate-900">默认执行</h3>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-medium text-slate-500">
                    Driver
                    <select
                      value={draftSettings.defaultDriverId}
                      onChange={(e) => setDraftSettings({ ...draftSettings, defaultDriverId: e.target.value as UiTaskWorkflowSettings["defaultDriverId"] })}
                      className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none"
                    >
                      <option value="claude">Claude 主运行器</option>
                      <option value="codex-app-server">Codex app-server</option>
                    </select>
                  </label>
                  <label className="text-[11px] font-medium text-slate-500">
                    预算 $
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={draftSettings.maxCostUsd ?? ""}
                      onChange={(e) => setDraftSettings({ ...draftSettings, maxCostUsd: e.target.value ? Number(e.target.value) : undefined })}
                      className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-xs text-slate-800 outline-none"
                    />
                  </label>
                </div>
                <label className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={draftSettings.writeBackEnabled}
                    onChange={(e) => setDraftSettings({ ...draftSettings, writeBackEnabled: e.target.checked })}
                  />
                  执行结果回写到来源任务
                </label>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-3">
                <h3 className="mb-2 text-xs font-semibold text-slate-900">TB Provider</h3>
                <div className="grid gap-2">
                  <input
                    value={draftSettings.tbCliCommand ?? ""}
                    onChange={(e) => setDraftSettings({ ...draftSettings, tbCliCommand: e.target.value })}
                    placeholder="CLI 命令"
                    className="h-8 rounded-md border border-slate-200 px-2 text-xs text-slate-800 outline-none"
                  />
                  <input
                    value={draftSettings.tbFetchArgsTemplate ?? ""}
                    onChange={(e) => setDraftSettings({ ...draftSettings, tbFetchArgsTemplate: e.target.value })}
                    placeholder="拉取参数模板，输出 JSON items"
                    className="h-8 rounded-md border border-slate-200 px-2 text-xs text-slate-800 outline-none"
                  />
                </div>
              </section>
            </div>
          </div>
        )}

      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(420px,1fr)_320px]">
        <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Queue</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-900">任务队列</h2>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                {filteredTasks.length} / {tasks.length}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索标题、描述或任务 ID"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Filter className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 text-xs font-medium text-slate-700 outline-none"
                >
                  <option value="all">全部来源</option>
                  <option value="lark">飞书</option>
                  <option value="tb">TB</option>
                </select>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {STATUS_FILTERS.map((item) => {
                  const active = statusFilter === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setStatusFilter(item.value)}
                      className={cx(
                        "inline-flex h-7 min-w-0 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-semibold transition",
                        active ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/70 hover:text-slate-800",
                      )}
                    >
                      <span className="truncate">{item.label}</span>
                      <span className={cx("rounded-full px-1.5 text-[10px]", active ? "bg-slate-100 text-slate-700" : "bg-white text-slate-500")}>
                        {statusCounts[item.value] ?? 0}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredTasks.length === 0 ? (
              <EmptyState syncError={syncError} />
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const assigneeCount = getAssigneeCount(task);
                  const updatedLabel = formatDate(task.updatedAt);
                  const tone = STATUS_TONES[task.localStatus] ?? STATUS_TONES.pending;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => selectTask(task.id)}
                      className={cx(
                        "group flex w-full gap-3 px-4 py-3 text-left transition",
                        selectedTaskId === task.id ? "bg-orange-50/80" : "bg-white hover:bg-slate-50",
                      )}
                    >
                      <span className={cx("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", tone.dot)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{task.title}</p>
                          <ChevronRight className={cx("mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition", selectedTaskId === task.id && "text-orange-500")} />
                        </div>
                        {task.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{task.description}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={task.localStatus} compact />
                          <PriorityPill priority={task.priority} />
                          <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                            {getProviderLabel(task)}
                          </span>
                          {assigneeCount > 0 && (
                            <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                              {assigneeCount} 人
                            </span>
                          )}
                          {updatedLabel && (
                            <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                              {updatedLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col bg-slate-50">
          {!selectedTask ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">选择任务查看详情</p>
                <p className="mt-1 text-xs text-slate-500">详情区会显示任务内容、执行记录和原始来源信息。</p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 bg-white px-6 py-4">
                <div className="space-y-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={selectedTask.localStatus} />
                      <PriorityPill priority={selectedTask.priority} />
                      <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600">
                        {getProviderLabel(selectedTask)}
                      </span>
                    </div>
                    <h2 className="break-words text-xl font-semibold leading-snug text-slate-950">{selectedTask.title}</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenWorkspace(selectedTask.workspacePath)}
                      disabled={!selectedTask.workspacePath}
                      title="在 Finder 中打开任务工作区"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      工作区
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenSession(selectedTask.executionSessionId)}
                      disabled={!selectedTask.executionSessionId}
                      title="打开本任务对应会话"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      会话
                    </button>
                    {selectedTask.localStatus === "executing" ? (
                      <button
                        type="button"
                        onClick={() => handleControl(selectedTask.id, "pause")}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        暂停
                      </button>
                    ) : selectedTask.localStatus === "paused" ? (
                      <button
                        type="button"
                        onClick={() => handleControl(selectedTask.id, "resume")}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        恢复
                      </button>
                    ) : null}
                    {(selectedTask.localStatus === "retrying" || selectedTask.localStatus === "queued") && (
                      <button
                        type="button"
                        onClick={() => handleControl(selectedTask.id, "cancel-retry")}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        取消重试
                      </button>
                    )}
                    {selectedTask.localStatus !== "completed" && selectedTask.localStatus !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => handleControl(selectedTask.id, "cancel")}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        <Square className="h-3.5 w-3.5" />
                        取消
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedTask)}
                      disabled={selectedTask.localStatus === "executing" || !connected}
                      title="只从任务面板删除，不删除飞书任务"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecute(selectedTask.id)}
                      disabled={selectedTask.localStatus === "executing" || !connected}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {selectedTask.localStatus === "executing" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : selectedTask.localStatus === "retrying" ? (
                        <RefreshCw className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {selectedTask.localStatus === "executing" ? "执行中" : selectedTask.localStatus === "retrying" ? "立即重试" : "AI 执行"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <section className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">手动执行参数</h3>
                    <span className="text-[11px] text-slate-400">重跑时覆盖默认模型、强度、工作区与预算</span>
                  </div>
                  <div className="grid grid-cols-[1fr_150px_150px_120px] gap-2">
                    <select
                      value={executeOptions.model ?? ""}
                      onChange={(e) => setExecuteOptions((current) => ({ ...current, model: e.target.value }))}
                      className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none"
                    >
                      <option value="">
                        {runtimeModel.trim() ? `使用当前主模型：${runtimeModel.trim()}` : "使用当前主模型"}
                      </option>
                      {modelOptions.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                    <select
                      value={executeOptions.reasoningMode ?? settings?.defaultReasoningMode ?? "high"}
                      onChange={(e) => setExecuteOptions((current) => ({ ...current, reasoningMode: e.target.value as UiTaskExecutionOptions["reasoningMode"] }))}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none"
                    >
                      <option value="disabled">不思考</option>
                      <option value="low">低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                      <option value="xhigh">超高</option>
                    </select>
                    <select
                      value={executeOptions.driverId ?? settings?.defaultDriverId ?? "claude"}
                      onChange={(e) => setExecuteOptions((current) => ({ ...current, driverId: e.target.value as UiTaskExecutionOptions["driverId"] }))}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none"
                    >
                      <option value="claude">主运行器</option>
                      <option value="codex-app-server">app-server</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={executeOptions.maxCostUsd ?? ""}
                      onChange={(e) => setExecuteOptions((current) => ({ ...current, maxCostUsd: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="预算 $"
                      className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 outline-none"
                    />
                  </div>
                  <select
                    value={executeOptions.workspacePath ?? ""}
                    onChange={(e) => setExecuteOptions((current) => ({ ...current, workspacePath: e.target.value }))}
                    className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none"
                  >
                    <option value="">自动创建任务工作区</option>
                    {workspaceOptions.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </section>

                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-medium text-slate-500">外部 ID</p>
                    <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-800" title={selectedTask.externalId}>{formatShortId(selectedTask.externalId)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-medium text-slate-500">负责人</p>
                    <p className="mt-1 text-xs font-semibold text-slate-800">{getAssigneeCount(selectedTask) || "-"} 人</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-medium text-slate-500">更新</p>
                    <p className="mt-1 text-xs font-semibold text-slate-800">{formatDate(selectedTask.updatedAt) ?? "-"}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-medium text-slate-500">截止</p>
                    <p className="mt-1 text-xs font-semibold text-slate-800">{formatDate(selectedTask.dueDate) ?? "-"}</p>
                  </div>
                </div>

                <section className="mt-4 rounded-lg border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">任务说明</h3>
                  </div>
                  <div className="px-4 py-4">
                    {selectedTask.description ? (
                      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedTask.description}</p>
                    ) : (
                      <p className="text-sm text-slate-400">暂无描述。</p>
                    )}
                  </div>
                </section>

                <section className="mt-4 rounded-lg border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">调度信息</h3>
                  </div>
                  <div className="grid gap-3 px-4 py-4 text-xs text-slate-600">
                    <div className="flex items-start justify-between gap-4">
                      <span className="shrink-0 font-medium text-slate-500">工作区</span>
                      <span className="min-w-0 truncate font-mono text-slate-800" title={selectedTask.workspacePath ?? "-"}>{selectedTask.workspacePath ?? "-"}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="shrink-0 font-medium text-slate-500">模型</span>
                      <span className="min-w-0 truncate font-mono text-slate-800" title={selectedTask.model ?? "-"}>{selectedTask.model ?? "-"}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="shrink-0 font-medium text-slate-500">Driver / 强度</span>
                      <span className="text-slate-800">{selectedTask.driverId ?? settings?.defaultDriverId ?? "-"} · {selectedTask.reasoningMode ?? settings?.defaultReasoningMode ?? "-"}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="shrink-0 font-medium text-slate-500">用量 / 费用</span>
                      <span className="text-slate-800">{formatTokens(selectedTask.inputTokens)} in · {formatTokens(selectedTask.outputTokens)} out · {formatCost(selectedTask.estimatedCostUsd)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <span className="shrink-0 font-medium text-slate-500">重试</span>
                      <span className="text-slate-800">
                        第 {selectedTask.retryAttempt ?? 0} 次{selectedTask.retryDueAt ? ` · ${formatDateTime(selectedTask.retryDueAt)} 触发` : ""}
                      </span>
                    </div>
                    {selectedTask.lastError && (
                      <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-red-700">
                        {selectedTask.lastError}
                      </div>
                    )}
                  </div>
                </section>

                <section className="mt-4 rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">子任务拆解</h3>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{taskSubtasks.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {taskSubtasks.length === 0 ? (
                      <div className="px-4 py-5 text-sm text-slate-400">执行后会从 Agent 输出中提取子任务。</div>
                    ) : (
                      taskSubtasks.map((item: UiTaskSubtask) => (
                        <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                          <span className={cx("mt-1 h-2.5 w-2.5 rounded-full", item.status === "done" ? "bg-emerald-500" : item.status === "blocked" ? "bg-red-500" : "bg-slate-300")} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                            {item.detail && <p className="mt-1 text-xs text-slate-500">{item.detail}</p>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="mt-4 rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">执行产物</h3>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{taskArtifacts.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {taskArtifacts.length === 0 ? (
                      <div className="px-4 py-5 text-sm text-slate-400">暂无文件变更记录。</div>
                    ) : (
                      taskArtifacts.map((item: UiTaskArtifact) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleOpenWorkspace(item.path)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-xs font-semibold text-slate-800" title={item.path}>{item.path}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">{item.summary ?? item.kind}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <section className="mt-4 rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">执行记录</h3>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{taskExecutions.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {taskExecutions.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-slate-400">还没有执行记录。</div>
                    ) : (
                      taskExecutions.map((exec) => (
                        <div key={exec.id} className="flex items-center gap-3 px-4 py-3">
                          <span
                            className={cx(
                              "h-2.5 w-2.5 shrink-0 rounded-full",
                              exec.status === "completed" ? "bg-emerald-500" : exec.status === "failed" ? "bg-red-500" : "animate-pulse bg-amber-500",
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800">
                              {exec.status === "completed" ? "执行完成" : exec.status === "failed" ? "执行失败" : "正在执行"}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              Attempt {exec.attempt ?? 0}{exec.terminalReason ? ` · ${exec.terminalReason}` : ""}
                            </p>
                            {exec.result && <p className="mt-0.5 truncate text-xs text-slate-500">{exec.result}</p>}
                            {exec.error && <p className="mt-0.5 truncate text-xs text-red-600">{exec.error}</p>}
                          </div>
                          <span className="text-xs text-slate-400">{formatTime(exec.startedAt)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </main>

        <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">执行时间线</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">Agent 调度和执行日志。</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!selectedTask ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-xs text-slate-400">选择任务后显示日志</div>
            ) : taskLogs.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-xs text-slate-400">暂无执行日志</div>
            ) : (
              <div className="px-4 py-4">
                <div className="relative space-y-4 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-slate-200">
                  {taskLogs.map((log) => (
                    <div key={log.id} className="relative flex gap-3">
                      <span
                        className={cx(
                          "relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white",
                          log.level === "error" ? "bg-red-500" : log.level === "warn" ? "bg-amber-500" : "bg-slate-400",
                        )}
                      />
                      <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className={cx("text-[10px] font-semibold uppercase", log.level === "error" ? "text-red-600" : log.level === "warn" ? "text-amber-600" : "text-slate-500")}>
                            {log.level}
                          </span>
                          <span className="text-[10px] text-slate-400">{formatTime(log.timestamp)}</span>
                        </div>
                        <p className="break-words text-xs leading-relaxed text-slate-700">{log.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
