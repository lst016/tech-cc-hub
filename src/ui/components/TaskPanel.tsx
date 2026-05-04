import { useCallback, useEffect, useMemo, useState } from "react";
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
  done: "已完成(外部)",
  cancelled: "已取消",
  executing: "AI 执行中",
  completed: "AI 已完成",
  failed: "执行失败",
};

const STATUS_COLORS: Record<UiTaskStatus, string> = {
  pending: "bg-ink-100 text-ink-600",
  in_progress: "bg-sky-100 text-sky-700",
  done: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-ink-100 text-ink-400",
  executing: "bg-amber-100 text-amber-700 animate-pulse",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-ink-400",
  medium: "text-ink-600",
  high: "text-amber-600",
  urgent: "text-red-600",
};

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
  const setSelectedTaskId = useTaskStore((s) => s.setSelectedTaskId);
  const setSyncing = useTaskStore((s) => s.setSyncing);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Request task data on mount
  useEffect(() => {
    if (!connected) return;
    sendEvent({ type: "task.list" });
    sendEvent({ type: "task.stats" });
  }, [connected, sendEvent]);

  // Listen for task events
  useEffect(() => {
    if (!connected) return;

    const unsubscribeCallbacks: Array<() => void> = [];

    // Task list event
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
          setSyncNotice(`飞书同步完成，拉取 ${(e.payload as { count?: number }).count ?? 0} 条任务`);
          sendEvent({ type: "task.list" });
          sendEvent({ type: "task.stats" });
          break;
        case "task.error":
          setSyncing(false);
          setSyncNotice(null);
          setSyncError((e.payload as { message?: string }).message ?? "任务同步失败");
          break;
      }
    });

    if (unsubList) unsubscribeCallbacks.push(unsubList);

    return () => {
      unsubscribeCallbacks.forEach((fn) => fn());
    };
  }, [connected, sendEvent, setTasks, upsertTask, setStats, setSyncing, setExecutionData, addExecutionLog]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const taskExecutions = useMemo(
    () => (selectedTaskId ? executions[selectedTaskId] ?? [] : []),
    [executions, selectedTaskId]
  );

  const taskLogs = useMemo(
    () => (selectedTaskId ? executionLogs[selectedTaskId] ?? [] : []),
    [executionLogs, selectedTaskId]
  );

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
        (t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [tasks, statusFilter, providerFilter, searchQuery]);

  const handleSync = useCallback(
    (provider: string) => {
      setSyncing(true);
      setSyncNotice(null);
      setSyncError(null);
      sendEvent({ type: "task.sync", payload: { provider } });
    },
    [sendEvent, setSyncing]
  );

  const handleExecute = useCallback(
    (taskId: string) => {
      sendEvent({ type: "task.execute", payload: { taskId } });
    },
    [sendEvent]
  );

  const selectTask = useCallback(
    (taskId: string) => {
      setSelectedTaskId(taskId);
      sendEvent({ type: "task.execution.logs", payload: { taskId } });
    },
    [sendEvent, setSelectedTaskId]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(243,246,250,0.97)_40%,_rgba(228,233,240,0.98)_100%)]">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-black/8 px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-ink-600 transition hover:bg-ink-900/5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-ink-800">任务面板</h1>
        </div>

        <div className="flex items-center gap-2">
          {stats && (
            <div className="flex items-center gap-1 text-xs text-muted">
              <span className="rounded-full bg-ink-100 px-2 py-0.5">{stats.total} 总计</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{stats.executing} 执行中</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{stats.completed} 已完成</span>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">{stats.failed} 失败</span>
            </div>
          )}
          <button
            onClick={() => handleSync("lark")}
            disabled={syncing || !connected}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-ink-700 transition hover:bg-ink-900/5 disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-9-9" />
              <path d="M21 3v6h-6" />
            </svg>
            {syncing ? "同步中..." : "同步飞书"}
          </button>
          <button
            onClick={() => handleSync("tb")}
            disabled
            title="TB Provider 未注册"
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-ink-400 transition opacity-50 cursor-not-allowed"
          >
            同步 TB
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex shrink-0 items-center gap-2 border-b border-black/5 px-5 py-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-ink-700"
        >
          <option value="all">全部状态</option>
          <option value="pending">待处理</option>
          <option value="done">已标记完成</option>
          <option value="executing">AI 执行中</option>
          <option value="completed">AI 已完成</option>
          <option value="failed">执行失败</option>
        </select>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-ink-700"
        >
          <option value="all">全部来源</option>
          <option value="lark">飞书</option>
          <option value="tb">TB</option>
        </select>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索任务..."
          className="flex-1 rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-ink-700 placeholder:text-ink-400"
        />
      </div>

      {(syncError || syncNotice) && (
        <div
          className={`shrink-0 border-b px-5 py-2 text-xs ${
            syncError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {syncError ?? syncNotice}
        </div>
      )}

      {/* Main content: 3-column layout */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Task list */}
        <div className="w-80 shrink-0 overflow-y-auto border-r border-black/5">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full border border-black/6 bg-[#f4f7fb] px-4 py-1 text-[11px] font-semibold tracking-[0.16em] text-muted">
                暂无任务
              </div>
              <p className="mt-3 text-sm text-muted">点击上方"同步"按钮拉取任务</p>
              {syncError && (
                <p className="mt-2 max-w-[260px] text-xs leading-relaxed text-red-600">{syncError}</p>
              )}
            </div>
          ) : (
            filteredTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => selectTask(task.id)}
                className={`w-full border-b border-black/3 px-4 py-3 text-left transition hover:bg-ink-900/3 ${
                  selectedTaskId === task.id ? "bg-accent/8 border-l-2 border-l-accent" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-800">{task.title}</p>
                    {task.description && (
                      <p className="mt-0.5 truncate text-xs text-muted">{task.description}</p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[task.priority]}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[task.localStatus] ?? "bg-ink-100 text-ink-600"}`}>
                    {STATUS_LABELS[task.localStatus]}
                  </span>
                  <span className="text-[10px] text-muted">{task.provider === "lark" ? "飞书" : "TB"}</span>
                  {task.assignee && (
                    <span className="text-[10px] text-muted">{task.assignee}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Center: Task detail */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!selectedTask ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">
              选择左侧任务查看详情
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-y-auto p-5">
              {/* Task info */}
              <div className="mb-4">
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-ink-900">{selectedTask.title}</h2>
                  <button
                    onClick={() => handleExecute(selectedTask.id)}
                    disabled={selectedTask.localStatus === "executing" || !connected}
                    className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    {selectedTask.localStatus === "executing" ? "执行中..." : "AI 执行"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[selectedTask.localStatus]}`}>
                    {STATUS_LABELS[selectedTask.localStatus]}
                  </span>
                  <span className={`font-medium ${PRIORITY_COLORS[selectedTask.priority]}`}>
                    {PRIORITY_LABELS[selectedTask.priority]}优先级
                  </span>
                  <span className="text-muted">
                    来源: {selectedTask.provider === "lark" ? "飞书" : "TB"}
                  </span>
                  <span className="text-muted">ID: {selectedTask.externalId}</span>
                </div>

                {selectedTask.assignee && (
                  <p className="mt-2 text-xs text-muted">负责人: {selectedTask.assignee}</p>
                )}
                {selectedTask.dueDate && (
                  <p className="mt-1 text-xs text-muted">
                    截止: {new Date(selectedTask.dueDate).toLocaleDateString("zh-CN")}
                  </p>
                )}
              </div>

              {selectedTask.description && (
                <div className="mb-4 rounded-xl border border-black/6 bg-white/70 p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">任务描述</h3>
                  <p className="whitespace-pre-wrap text-sm text-ink-700">{selectedTask.description}</p>
                </div>
              )}

              {/* Execution history */}
              {taskExecutions.length > 0 && (
                <div className="mb-4 rounded-xl border border-black/6 bg-white/70 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    执行记录 ({taskExecutions.length})
                  </h3>
                  <div className="space-y-2">
                    {taskExecutions.map((exec) => (
                      <div
                        key={exec.id}
                        className="flex items-center gap-3 rounded-lg border border-black/4 bg-white/50 px-3 py-2"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            exec.status === "completed"
                              ? "bg-emerald-500"
                              : exec.status === "failed"
                                ? "bg-red-500"
                                : "bg-amber-500 animate-pulse"
                          }`}
                        />
                        <span className="text-xs text-ink-700">
                          {exec.status === "completed" ? "已完成" : exec.status === "failed" ? "失败" : "执行中"}
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(exec.startedAt).toLocaleTimeString("zh-CN")}
                        </span>
                        {exec.result && (
                          <span className="truncate text-xs text-muted">{exec.result.slice(0, 60)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Execution logs */}
        <div className="w-72 shrink-0 overflow-y-auto border-l border-black/5 bg-[#f8fafc]/60">
          {!selectedTask ? (
            <div className="flex items-center justify-center py-16 text-xs text-muted">
              选择任务查看日志
            </div>
          ) : taskLogs.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-xs text-muted">
              暂无执行日志
            </div>
          ) : (
            <div className="p-3">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                执行日志
              </h3>
              <div className="space-y-1.5 font-mono">
                {taskLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`rounded px-2 py-1 text-[11px] leading-relaxed ${
                      log.level === "error"
                        ? "bg-red-50 text-red-700"
                        : log.level === "warn"
                          ? "bg-amber-50 text-amber-700"
                          : "text-ink-600"
                    }`}
                  >
                    <span className="text-[10px] text-muted">
                      {new Date(log.timestamp).toLocaleTimeString("zh-CN")}
                    </span>{" "}
                    <span className="break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
