import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  Filter,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useTaskStore } from "../store/taskStore";
import type { ClientEvent, ServerEvent, UiTask, UiTaskExecution, UiTaskExecutionLog, UiTaskStats, UiTaskStatus } from "../types";

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
  executing: "AI 执行中",
  completed: "AI 已完成",
  failed: "执行失败",
};

const STATUS_TONES: Record<UiTaskStatus, { badge: string; dot: string; icon: typeof Circle }> = {
  pending: { badge: "border-slate-200 bg-slate-50 text-slate-700", dot: "bg-slate-400", icon: Circle },
  in_progress: { badge: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-500", icon: Clock3 },
  done: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
  cancelled: { badge: "border-slate-200 bg-slate-100 text-slate-500", dot: "bg-slate-300", icon: Circle },
  executing: { badge: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500", icon: Loader2 },
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
  { value: "executing", label: "执行中" },
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

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function StatusBadge({ status, compact = false }: { status: UiTaskStatus; compact?: boolean }) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES.pending;
  const Icon = tone.icon;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-md border font-medium", tone.badge, compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs")}>
      <Icon className={cx("h-3 w-3", status === "executing" && "animate-spin")} />
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
  const selectedTaskId = useTaskStore((s) => s.selectedTaskId);
  const syncing = useTaskStore((s) => s.syncing);
  const setTasks = useTaskStore((s) => s.setTasks);
  const upsertTask = useTaskStore((s) => s.upsertTask);
  const setStats = useTaskStore((s) => s.setStats);
  const setExecutionData = useTaskStore((s) => s.setExecutionData);
  const addExecutionLog = useTaskStore((s) => s.addExecutionLog);
  const removeTask = useTaskStore((s) => s.removeTask);
  const setSelectedTaskId = useTaskStore((s) => s.setSelectedTaskId);
  const setSyncing = useTaskStore((s) => s.setSyncing);

  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;
    sendEvent({ type: "task.list" });
    sendEvent({ type: "task.stats" });
  }, [connected, sendEvent]);

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
          const p = e.payload as { taskId: string; executions: UiTaskExecution[]; logs: UiTaskExecutionLog[] };
          setExecutionData(p.taskId, p.executions, p.logs);
          break;
        }
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
  }, [connected, sendEvent, setTasks, upsertTask, removeTask, setStats, setSyncing, setExecutionData, addExecutionLog]);

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
      sendEvent({ type: "task.execute", payload: { taskId } });
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

  const statTiles = [
    { label: "总任务", value: stats?.total ?? tasks.length, className: "text-slate-900", icon: FileText },
    { label: "执行中", value: stats?.executing ?? 0, className: "text-amber-700", icon: Loader2 },
    { label: "AI 完成", value: stats?.completed ?? 0, className: "text-emerald-700", icon: CheckCircle2 },
    { label: "失败", value: stats?.failed ?? 0, className: "text-red-700", icon: AlertCircle },
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
              onClick={() => handleSync("lark")}
              disabled={syncing || !connected}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={cx("h-3.5 w-3.5", syncing && "animate-spin")} />
              {syncing ? "同步中" : "同步飞书"}
            </button>
            <button
              type="button"
              disabled
              title="TB Provider 未注册"
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-400"
            >
              同步 TB
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-px border-t border-slate-100 bg-slate-100">
          {statTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <div key={tile.label} className="flex items-center gap-2 bg-white px-5 py-2.5">
                <Icon className={cx("h-4 w-4", tile.className, tile.label === "执行中" && syncing && "animate-spin")} />
                <div>
                  <p className="text-[11px] font-medium text-slate-500">{tile.label}</p>
                  <p className={cx("text-sm font-semibold", tile.className)}>{tile.value}</p>
                </div>
              </div>
            );
          })}
        </div>

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
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={selectedTask.localStatus} />
                      <PriorityPill priority={selectedTask.priority} />
                      <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600">
                        {getProviderLabel(selectedTask)}
                      </span>
                    </div>
                    <h2 className="text-xl font-semibold leading-snug text-slate-950">{selectedTask.title}</h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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
                      {selectedTask.localStatus === "executing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      {selectedTask.localStatus === "executing" ? "执行中" : "AI 执行"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
