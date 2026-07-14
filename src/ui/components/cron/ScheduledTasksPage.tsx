import React, { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CircleAlert,
  Clock3,
  Folder,
  Link2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useAllCronJobs } from "../../pages/cron/useCronJobs.js";
import { formatSchedule, formatNextRun } from "../../pages/cron/cronUtils.js";
import type { CronJob } from "../../../types/cron.js";
import { useAppStore } from "../../store/useAppStore.js";
import CronStatusTag from "./CronStatusTag.js";
import CreateTaskDialog from "./CreateTaskDialog.js";
import { AppModalOverlay } from "../AppModalOverlay.js";

interface ScheduledTasksPageProps {
  onBack?: () => void;
}

type StatusFilter = "all" | "active" | "paused" | "error";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "active", label: "已启用" },
  { value: "paused", label: "已暂停" },
  { value: "error", label: "异常" },
];

function formatWorkspaceName(cwd?: string) {
  if (!cwd) return "未绑定工作区";
  const parts = cwd.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) || cwd;
}

function isManualJob(job: CronJob) {
  return job.schedule.kind === "cron" && !job.schedule.expr;
}

function isErrorJob(job: CronJob) {
  return job.state.lastStatus === "error" || job.state.lastStatus === "missed";
}

const ScheduledTasksPage: React.FC<ScheduledTasksPageProps> = ({ onBack }) => {
  const {
    jobs,
    loading,
    error,
    refetch,
    pauseJob,
    resumeJob,
    deleteJob,
    bindConversation,
  } = useAllCronJobs();
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<{ conversationId: string; conversationTitle: string } | null>(null);
  const [menuJobId, setMenuJobId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<CronJob | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const sessions = useAppStore((s) => s.sessions);
  const archivedSessions = useAppStore((s) => s.archivedSessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const allSessions = useMemo(() => ({ ...archivedSessions, ...sessions }), [sessions, archivedSessions]);
  const currentActiveSession = activeSessionId ? allSessions[activeSessionId] : undefined;

  const conversationMap = useMemo(() => {
    const map = new Map<string, { cwd?: string; title: string }>();
    for (const [id, session] of Object.entries(allSessions)) {
      map.set(id, { cwd: session.cwd, title: session.title });
    }
    return map;
  }, [allSessions]);

  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return jobs.filter((job) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && job.enabled) ||
        (statusFilter === "paused" && !job.enabled) ||
        (statusFilter === "error" && isErrorJob(job));

      if (!matchesStatus) return false;
      if (!query) return true;

      const conversation = job.metadata.conversationId
        ? conversationMap.get(job.metadata.conversationId)
        : undefined;
      const searchable = [
        job.name,
        job.description,
        formatSchedule(job),
        job.metadata.conversationTitle,
        conversation?.title,
        conversation?.cwd,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(query);
    });
  }, [conversationMap, jobs, searchQuery, statusFilter]);

  const workspaceGroups = useMemo(() => {
    const noWorkspace: CronJob[] = [];
    const groups = new Map<string, { cwd?: string; jobs: CronJob[] }>();

    for (const job of filteredJobs) {
      const convId = job.metadata.conversationId;
      if (convId === "__system__") {
        const existing = groups.get("__system__");
        if (existing) existing.jobs.push(job);
        else groups.set("__system__", { cwd: undefined, jobs: [job] });
        continue;
      }

      const session = convId ? conversationMap.get(convId) : undefined;
      if (!session?.cwd) {
        noWorkspace.push(job);
        continue;
      }

      const cwd = session.cwd;
      const normalizedCwd = cwd.replace(/\\/g, "/");
      const isSystem = normalizedCwd.endsWith("/system-workspace") || normalizedCwd.endsWith("/system-workspace/");
      const key = isSystem ? "__system__" : cwd;
      const existing = groups.get(key);
      if (existing) existing.jobs.push(job);
      else groups.set(key, { cwd, jobs: [job] });
    }

    const sorted = Array.from(groups.entries())
      .map(([key, value]) => ({ key, cwd: value.cwd, jobs: value.jobs }))
      .sort((a, b) => {
        if (a.key === "__system__") return -1;
        if (b.key === "__system__") return 1;
        const aLatest = Math.max(...a.jobs.map((job) => job.metadata.updatedAt ?? 0));
        const bLatest = Math.max(...b.jobs.map((job) => job.metadata.updatedAt ?? 0));
        return bLatest - aLatest;
      });

    return { noWorkspace, groups: sorted };
  }, [conversationMap, filteredJobs]);

  const availableWorkspaces = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ conversationId: string; conversationTitle: string; workspaceName: string }> = [];

    for (const [id, session] of Object.entries(allSessions)) {
      const cwd = session.cwd;
      if (!cwd || seen.has(cwd)) continue;
      seen.add(cwd);
      result.push({
        conversationId: id,
        conversationTitle: session.title,
        workspaceName: formatWorkspaceName(cwd),
      });
    }

    return result.sort((a, b) => {
      const aSystem = a.workspaceName === "system-workspace";
      const bSystem = b.workspaceName === "system-workspace";
      if (aSystem && !bSystem) return -1;
      if (!aSystem && bSystem) return 1;
      return a.workspaceName.localeCompare(b.workspaceName);
    });
  }, [allSessions]);

  const handleToggleEnabled = useCallback(async (job: CronJob) => {
    try {
      if (job.enabled) await pauseJob(job.id);
      else await resumeJob(job.id);
    } catch (toggleError) {
      console.error("切换任务状态失败:", toggleError);
    }
  }, [pauseJob, resumeJob]);

  const handleDelete = useCallback(async (jobId: string) => {
    try {
      await deleteJob(jobId);
      setConfirmDeleteId(null);
      if (detailJobId === jobId) setDetailJobId(null);
    } catch (deleteError) {
      console.error("删除任务失败:", deleteError);
    }
  }, [deleteJob, detailJobId]);

  const handleEdit = useCallback((job: CronJob) => {
    setEditingJob(job);
    setMenuJobId(null);
    setCreateDialogVisible(true);
  }, []);

  const handleBindToCurrentSession = useCallback(async (job: CronJob) => {
    if (!activeSessionId) return;
    const title = currentActiveSession?.title?.trim() || "当前会话";
    try {
      await bindConversation(job, activeSessionId, title);
    } catch (bindError) {
      console.error("绑定会话失败:", bindError);
    }
  }, [activeSessionId, bindConversation, currentActiveSession]);

  const handleNewTask = useCallback((workspace?: { conversationId: string; conversationTitle: string }) => {
    setEditingJob(undefined);
    setSelectedWorkspace(workspace ?? null);
    setCreateDialogVisible(true);
  }, []);

  const detailJob = detailJobId ? jobs.find((job) => job.id === detailJobId) ?? null : null;
  const deleteJobTarget = confirmDeleteId ? jobs.find((job) => job.id === confirmDeleteId) ?? null : null;
  const totalJobs = jobs.length;
  const enabledJobs = jobs.filter((job) => job.enabled).length;
  const pausedJobs = totalJobs - enabledJobs;
  const errorJobs = jobs.filter(isErrorJob).length;

  return (
    <div className="box-border min-h-full w-full overflow-y-auto" data-testid="scheduled-tasks-page">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-col gap-5">
          {onBack && (
            <button
              type="button"
              className="inline-flex w-fit items-center gap-2 rounded-lg px-1 py-1 text-sm font-medium text-ink-600 transition-colors hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              返回聊天
            </button>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                  <CalendarClock className="h-5 w-5" aria-hidden="true" />
                </span>
                <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] text-ink-900">定时任务</h1>
              </div>
              <p className="m-0 max-w-2xl text-sm leading-6 text-ink-600">
                让 AI 按计划处理巡检、汇总和跟进工作，状态与下一次执行时间集中可见。
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2"
              onClick={() => handleNewTask(availableWorkspaces[0])}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              新建任务
            </button>
          </div>

          {!loading && totalJobs > 0 && (
            <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-ink-900/8 bg-white/80 shadow-soft sm:grid-cols-4" aria-label="任务概览">
              {[
                { label: "全部任务", value: totalJobs, tone: "text-ink-900" },
                { label: "已启用", value: enabledJobs, tone: "text-success" },
                { label: "已暂停", value: pausedJobs, tone: "text-ink-600" },
                { label: "异常", value: errorJobs, tone: errorJobs ? "text-error" : "text-ink-600" },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className={`flex items-baseline justify-between gap-3 px-4 py-3.5 sm:block ${index % 2 ? "border-l border-ink-900/8" : ""} ${index >= 2 ? "border-t border-ink-900/8 sm:border-t-0" : ""} ${index > 0 ? "sm:border-l sm:border-ink-900/8" : ""}`}
                >
                  <span className="text-xs font-medium text-ink-500">{item.label}</span>
                  <strong className={`text-lg font-bold tabular-nums sm:mt-1 sm:block ${item.tone}`}>{item.value}</strong>
                </div>
              ))}
            </div>
          )}
        </header>

        {!loading && totalJobs > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-ink-900/8 bg-white/72 p-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <label className="relative min-w-0 flex-1 sm:max-w-[380px]">
              <span className="sr-only">搜索定时任务</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索任务、计划或工作区"
                className="h-10 w-full rounded-xl border border-ink-900/10 bg-surface-secondary pl-9 pr-3 text-sm text-ink-800 outline-none placeholder:text-ink-400 focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
              />
            </label>
            <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-surface-secondary p-1" aria-label="按状态筛选" role="group">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={statusFilter === filter.value}
                  className={`h-8 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${statusFilter === filter.value ? "bg-white text-ink-900 shadow-soft" : "text-ink-500 hover:text-ink-800"}`}
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && totalJobs > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/20 bg-warning-light px-4 py-3 text-sm text-ink-700">
            <span className="flex items-center gap-2">
              <CircleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              刷新失败，当前仍显示上次加载的任务。
            </span>
            <button type="button" className="font-semibold text-warning hover:underline" onClick={() => void refetch()}>重试</button>
          </div>
        )}

        {loading ? (
          <TaskGridSkeleton />
        ) : error && totalJobs === 0 ? (
          <StatePanel
            icon={<CircleAlert className="h-6 w-6" aria-hidden="true" />}
            title="定时任务加载失败"
            description={error.message || "暂时无法读取任务，请稍后重试。"}
            actionLabel="重新加载"
            onAction={() => void refetch()}
            tone="error"
          />
        ) : totalJobs === 0 ? (
          <StatePanel
            icon={<CalendarClock className="h-6 w-6" aria-hidden="true" />}
            title="还没有定时任务"
            description="创建一个固定计划，让重复的巡检、汇总或提醒自动完成。"
            actionLabel="新建第一个任务"
            onAction={() => handleNewTask(availableWorkspaces[0])}
          />
        ) : filteredJobs.length === 0 ? (
          <StatePanel
            icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
            title="没有匹配的任务"
            description="换一个关键词或清除状态筛选后再试。"
            actionLabel="清除筛选"
            onAction={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
          />
        ) : (
          <div className={`grid items-start gap-6 ${detailJob ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
            <div className="flex min-w-0 flex-col gap-7">
              {workspaceGroups.noWorkspace.length > 0 && (
                <WorkspaceJobGroup
                  label="未绑定工作区"
                  jobs={workspaceGroups.noWorkspace}
                  conversationMap={conversationMap}
                  detailJobId={detailJobId}
                  menuJobId={menuJobId}
                  activeSessionId={activeSessionId}
                  onToggleEnabled={handleToggleEnabled}
                  onSelectJob={setDetailJobId}
                  onEdit={handleEdit}
                  onDelete={setConfirmDeleteId}
                  onSetMenu={setMenuJobId}
                  onBindToCurrentSession={handleBindToCurrentSession}
                />
              )}

              {workspaceGroups.groups.map((group) => {
                const isSystem = group.key === "__system__";
                return (
                  <WorkspaceJobGroup
                    key={group.key}
                    label={isSystem ? "系统工作区" : formatWorkspaceName(group.cwd)}
                    subtitle={isSystem ? "系统维护与管理任务" : group.cwd}
                    jobs={group.jobs}
                    conversationMap={conversationMap}
                    detailJobId={detailJobId}
                    menuJobId={menuJobId}
                    activeSessionId={activeSessionId}
                    onToggleEnabled={handleToggleEnabled}
                    onSelectJob={setDetailJobId}
                    onEdit={handleEdit}
                    onDelete={setConfirmDeleteId}
                    onSetMenu={setMenuJobId}
                    onBindToCurrentSession={handleBindToCurrentSession}
                  />
                );
              })}
            </div>

            {detailJob && (
              <div className="min-w-0 lg:sticky lg:top-6">
                <CronTaskDetailInline
                  job={detailJob}
                  activeSessionId={activeSessionId}
                  activeSessionTitle={currentActiveSession?.title}
                  onClose={() => setDetailJobId(null)}
                  onEdit={() => handleEdit(detailJob)}
                  onToggleEnabled={handleToggleEnabled}
                  onBindToCurrentSession={handleBindToCurrentSession}
                  onRequestDelete={() => setConfirmDeleteId(detailJob.id)}
                />
              </div>
            )}
          </div>
        )}

        <CreateTaskDialog
          visible={createDialogVisible}
          onClose={() => {
            setCreateDialogVisible(false);
            setSelectedWorkspace(null);
            setEditingJob(undefined);
          }}
          editJob={editingJob}
          conversationId={selectedWorkspace?.conversationId}
          conversationTitle={selectedWorkspace?.conversationTitle}
          workspaces={availableWorkspaces}
          onSelectWorkspace={setSelectedWorkspace}
        />

        {confirmDeleteId && (
          <AppModalOverlay
            role="alertdialog"
            aria-labelledby="cron-delete-title"
            aria-describedby="cron-delete-description"
            className="z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
            onClick={() => setConfirmDeleteId(null)}
          >
            <div className="w-full max-w-[420px] rounded-2xl border border-ink-900/8 bg-white p-6 shadow-elevated" onClick={(event) => event.stopPropagation()}>
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-error-light text-error">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 id="cron-delete-title" className="m-0 text-lg font-bold text-ink-900">删除定时任务？</h2>
              <p id="cron-delete-description" className="mb-6 mt-2 text-sm leading-6 text-ink-600">
                {deleteJobTarget ? `“${deleteJobTarget.name}”将被永久删除，之后不会再按计划执行。` : "该任务将被永久删除，之后不会再按计划执行。"}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="h-10 rounded-xl border border-ink-900/10 bg-white px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="h-10 rounded-xl bg-error px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/25"
                  onClick={() => void handleDelete(confirmDeleteId)}
                >
                  确认删除
                </button>
              </div>
            </div>
          </AppModalOverlay>
        )}
      </div>
    </div>
  );
};

const WorkspaceJobGroup: React.FC<{
  label: string;
  subtitle?: string;
  jobs: CronJob[];
  conversationMap: Map<string, { cwd?: string; title: string }>;
  detailJobId: string | null;
  menuJobId: string | null;
  activeSessionId: string | null;
  onToggleEnabled: (job: CronJob) => void;
  onSelectJob: (id: string) => void;
  onEdit: (job: CronJob) => void;
  onDelete: (id: string) => void;
  onSetMenu: (id: string | null) => void;
  onBindToCurrentSession: (job: CronJob) => void;
}> = ({
  label,
  subtitle,
  jobs,
  conversationMap,
  detailJobId,
  menuJobId,
  activeSessionId,
  onToggleEnabled,
  onSelectJob,
  onEdit,
  onDelete,
  onSetMenu,
  onBindToCurrentSession,
}) => (
  <section className="flex flex-col gap-3" aria-label={`${label}任务`}>
    <div className="flex min-w-0 items-center gap-2 px-0.5">
      <Folder className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
      <h2 className="m-0 truncate text-sm font-bold text-ink-800">{label}</h2>
      <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-500">{jobs.length}</span>
      {subtitle && <span className="hidden min-w-0 truncate text-xs text-ink-400 sm:inline" title={subtitle}>{subtitle}</span>}
    </div>
    <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-2">
      {jobs.map((job) => (
        <CronTaskCard
          key={job.id}
          job={job}
          conversationMap={conversationMap}
          selected={detailJobId === job.id}
          menuOpen={menuJobId === job.id}
          activeSessionId={activeSessionId}
          onToggleEnabled={onToggleEnabled}
          onSelectJob={onSelectJob}
          onEdit={onEdit}
          onDelete={onDelete}
          onSetMenu={onSetMenu}
          onBindToCurrentSession={onBindToCurrentSession}
        />
      ))}
    </div>
  </section>
);

const CronTaskCard: React.FC<{
  job: CronJob;
  conversationMap: Map<string, { cwd?: string; title: string }>;
  selected: boolean;
  menuOpen: boolean;
  activeSessionId: string | null;
  onToggleEnabled: (job: CronJob) => void;
  onSelectJob: (id: string) => void;
  onEdit: (job: CronJob) => void;
  onDelete: (id: string) => void;
  onSetMenu: (id: string | null) => void;
  onBindToCurrentSession: (job: CronJob) => void;
}> = ({
  job,
  conversationMap,
  selected,
  menuOpen,
  activeSessionId,
  onToggleEnabled,
  onSelectJob,
  onEdit,
  onDelete,
  onSetMenu,
  onBindToCurrentSession,
}) => {
  const manualOnly = isManualJob(job);
  const conversation = job.metadata.conversationId ? conversationMap.get(job.metadata.conversationId) : undefined;
  const executionModeLabel = job.target.executionMode === "new_conversation" ? "每次新建会话" : "沿用现有会话";
  const workspaceLabel = job.metadata.conversationId === "__system__"
    ? "系统工作区"
    : conversation?.title || job.metadata.conversationTitle || executionModeLabel;
  const menuId = `cron-task-menu-${job.id}`;

  return (
    <article className={`relative flex min-h-[228px] flex-col rounded-2xl border p-4 transition-all duration-200 ${selected ? "border-accent/30 bg-accent-subtle shadow-soft" : "border-ink-900/8 bg-white/88 hover:-translate-y-0.5 hover:border-ink-900/15 hover:shadow-card"}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={`查看任务 ${job.name}`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          onClick={() => onSelectJob(job.id)}
        >
          <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${job.enabled ? "bg-accent-subtle text-accent" : "bg-surface-secondary text-ink-400"}`}>
            <CalendarClock className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold text-ink-900">{job.name}</span>
            <span className="mt-1 block line-clamp-2 min-h-9 text-xs leading-[18px] text-ink-500">
              {job.description || "没有任务描述"}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <CronStatusTag job={job} />
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-900/5 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            aria-label={`更多操作：${job.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => onSetMenu(menuOpen ? null : job.id)}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <AppModalOverlay className="z-10" role="presentation" onClick={() => onSetMenu(null)} />
          <div id={menuId} role="menu" className="absolute right-3 top-[52px] z-20 min-w-[168px] overflow-hidden rounded-xl border border-ink-900/8 bg-white py-1.5 shadow-elevated">
            <TaskMenuButton icon={<Pencil />} label="编辑任务" onClick={() => onEdit(job)} />
            {activeSessionId && job.metadata.conversationId !== activeSessionId && (
              <TaskMenuButton
                icon={<Link2 />}
                label="绑到当前会话"
                onClick={() => {
                  void onBindToCurrentSession(job);
                  onSetMenu(null);
                }}
              />
            )}
            {!manualOnly && (
              <TaskMenuButton
                icon={job.enabled ? <Pause /> : <Play />}
                label={job.enabled ? "暂停任务" : "恢复任务"}
                onClick={() => {
                  void onToggleEnabled(job);
                  onSetMenu(null);
                }}
              />
            )}
            <div className="my-1 border-t border-ink-900/8" />
            <TaskMenuButton
              danger
              icon={<Trash2 />}
              label="删除任务"
              onClick={() => {
                onSetMenu(null);
                onDelete(job.id);
              }}
            />
          </div>
        </>
      )}

      <dl className="my-4 grid gap-2.5 text-xs">
        <div className="flex min-w-0 items-center gap-2 text-ink-600">
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
          <dt className="sr-only">执行计划</dt>
          <dd className="m-0 truncate" title={formatSchedule(job)}>{formatSchedule(job)}</dd>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-ink-600">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
          <dt className="sr-only">下次运行</dt>
          <dd className="m-0 truncate">{job.state.nextRunAtMs ? `下次 ${formatNextRun(job.state.nextRunAtMs)}` : manualOnly ? "等待手动运行" : "等待排期"}</dd>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-ink-600">
          <Folder className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
          <dt className="sr-only">所属工作区</dt>
          <dd className="m-0 truncate" title={workspaceLabel}>{workspaceLabel}</dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-ink-900/8 pt-3">
        <span className="text-[11px] font-medium text-ink-400">已运行 {job.state.runCount} 次</span>
        {manualOnly ? (
          <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-[11px] font-semibold text-ink-500">仅手动</span>
        ) : (
          <label className="relative inline-flex cursor-pointer items-center gap-2">
            <span className="sr-only">{job.enabled ? "暂停" : "启用"}任务 {job.name}</span>
            <input
              type="checkbox"
              role="switch"
              aria-label={`${job.enabled ? "暂停" : "启用"}任务 ${job.name}`}
              className="peer sr-only"
              checked={job.enabled}
              onChange={() => void onToggleEnabled(job)}
            />
            <span className="relative h-5 w-9 rounded-full bg-ink-900/12 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-soft after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30" aria-hidden="true" />
          </label>
        )}
      </div>
    </article>
  );
};

const TaskMenuButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ icon, label, onClick, danger = false }) => (
  <button
    type="button"
    role="menuitem"
    className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors ${danger ? "text-error hover:bg-error-light" : "text-ink-700 hover:bg-surface-secondary"}`}
    onClick={onClick}
  >
    <span className="inline-flex [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>
    {label}
  </button>
);

const CronTaskDetailInline: React.FC<{
  job: CronJob;
  activeSessionId: string | null;
  activeSessionTitle?: string;
  onClose: () => void;
  onEdit: () => void;
  onToggleEnabled: (job: CronJob) => void;
  onBindToCurrentSession: (job: CronJob) => void;
  onRequestDelete: () => void;
}> = ({
  job,
  activeSessionId,
  activeSessionTitle,
  onClose,
  onEdit,
  onToggleEnabled,
  onBindToCurrentSession,
  onRequestDelete,
}) => {
  const manualOnly = isManualJob(job);
  const [runningNow, setRunningNow] = useState(false);
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const electron = (window as unknown as { electron: any }).electron;

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      await electron.invoke("cron:run-now", { jobId: job.id });
    } catch (runError) {
      console.error("立即运行失败:", runError);
    } finally {
      setRunningNow(false);
    }
  };

  const handleToggleClick = async () => {
    setBusy(true);
    try {
      await onToggleEnabled(job);
    } finally {
      setBusy(false);
    }
  };

  const handleBindClick = async () => {
    setBusy(true);
    try {
      await onBindToCurrentSession(job);
    } finally {
      setBusy(false);
    }
  };

  const canBind = Boolean(activeSessionId) && job.metadata.conversationId !== activeSessionId;
  const bindingLabel = job.metadata.conversationId
    ? (job.metadata.conversationTitle?.trim() || job.metadata.conversationId)
    : "未绑定工作区";

  return (
    <aside className="rounded-2xl border border-ink-900/8 bg-white p-5 shadow-card" aria-label={`任务详情：${job.name}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">任务详情</p>
          <h2 className="mb-0 mt-1.5 break-words text-lg font-bold text-ink-900">{job.name}</h2>
        </div>
        <button
          type="button"
          aria-label="关闭任务详情"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-surface-secondary hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          onClick={onClose}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {job.description && <p className="mb-4 mt-2 text-sm leading-6 text-ink-600">{job.description}</p>}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <CronStatusTag job={job} />
        <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-[11px] font-semibold text-ink-500">已运行 {job.state.runCount} 次</span>
      </div>

      <div className="grid gap-3 border-y border-ink-900/8 py-4 text-sm">
        <DetailRow icon={<CalendarClock />} label="执行计划" value={formatSchedule(job)} />
        <DetailRow icon={<Clock3 />} label="下次运行" value={job.state.nextRunAtMs ? formatNextRun(job.state.nextRunAtMs) : manualOnly ? "等待手动运行" : "等待排期"} />
        <DetailRow icon={<Folder />} label="运行位置" value={bindingLabel} />
        <DetailRow icon={<Zap />} label="执行方式" value={job.target.executionMode === "new_conversation" ? "每次新建会话" : "沿用现有会话"} />
      </div>

      <section className="mt-5">
        <h3 className="m-0 text-xs font-bold text-ink-500">任务指令</h3>
        <div className="mt-2 max-h-44 overflow-y-auto rounded-xl bg-surface-secondary p-3.5">
          <p className="m-0 whitespace-pre-wrap break-words text-sm leading-6 text-ink-700">{job.target.payload.text || "-"}</p>
        </div>
      </section>

      {job.state.lastError && (
        <div className="mt-4 rounded-xl border border-error/15 bg-error-light p-3 text-xs leading-5 text-error">
          {job.state.lastError}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          disabled={runningNow}
          onClick={() => void handleRunNow()}
        >
          {runningNow ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          {runningNow ? "正在启动..." : "立即运行"}
        </button>
        <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-ink-900/10 bg-white text-sm font-semibold text-ink-700 hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25" onClick={onEdit}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          编辑
        </button>
        {!manualOnly ? (
          <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-ink-900/10 bg-white text-sm font-semibold text-ink-700 hover:bg-surface-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25" disabled={busy} onClick={() => void handleToggleClick()}>
            {job.enabled ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            {job.enabled ? "暂停" : "恢复"}
          </button>
        ) : (
          <span className="inline-flex h-10 items-center justify-center rounded-xl bg-surface-secondary text-xs font-semibold text-ink-500">手动任务</span>
        )}
        {canBind && (
          <button type="button" className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-ink-900/10 bg-white px-3 text-sm font-semibold text-ink-700 hover:bg-surface-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25" disabled={busy} onClick={() => void handleBindClick()}>
            <Link2 className="h-4 w-4" aria-hidden="true" />
            绑到当前会话{activeSessionTitle ? `（${activeSessionTitle}）` : ""}
          </button>
        )}
        <button type="button" className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-error transition-colors hover:bg-error-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/25" onClick={onRequestDelete}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          删除任务
        </button>
      </div>
    </aside>
  );
};

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="grid grid-cols-[18px_70px_minmax(0,1fr)] items-start gap-2">
    <span className="mt-0.5 inline-flex text-ink-400 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>
    <span className="text-xs font-medium text-ink-400">{label}</span>
    <span className="min-w-0 break-words text-right text-xs font-semibold leading-5 text-ink-700">{value}</span>
  </div>
);

const StatePanel: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  tone?: "default" | "error";
}> = ({ icon, title, description, actionLabel, onAction, tone = "default" }) => (
  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-ink-900/8 bg-white/72 px-6 py-12 text-center shadow-soft">
    <span className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${tone === "error" ? "bg-error-light text-error" : "bg-accent-subtle text-accent"}`}>
      {icon}
    </span>
    <h2 className="mb-0 mt-4 text-lg font-bold text-ink-900">{title}</h2>
    <p className="mb-5 mt-2 max-w-md text-sm leading-6 text-ink-500">{description}</p>
    <button
      type="button"
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 ${tone === "error" ? "border border-error/20 bg-white text-error hover:bg-error-light focus-visible:ring-error/25" : "bg-accent text-white hover:bg-accent-hover focus-visible:ring-accent/30"}`}
      onClick={onAction}
    >
      {tone === "error" ? <RefreshCw className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
      {actionLabel}
    </button>
  </div>
);

const TaskGridSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-label="正在加载定时任务">
    {[0, 1, 2, 3].map((item) => (
      <div key={item} className="h-[228px] animate-pulse rounded-2xl border border-ink-900/8 bg-white/70 p-4">
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-xl bg-surface-tertiary" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-1/2 rounded bg-surface-tertiary" />
            <div className="h-2.5 w-4/5 rounded bg-surface-secondary" />
          </div>
        </div>
        <div className="mt-7 space-y-3">
          <div className="h-2.5 w-2/3 rounded bg-surface-secondary" />
          <div className="h-2.5 w-1/2 rounded bg-surface-secondary" />
          <div className="h-2.5 w-3/4 rounded bg-surface-secondary" />
        </div>
      </div>
    ))}
  </div>
);

export default ScheduledTasksPage;
