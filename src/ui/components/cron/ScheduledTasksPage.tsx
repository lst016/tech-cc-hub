// Source: CV from AionUi ScheduledTasksPage/index.tsx (252 lines)
// Adapted for tech-cc-hub: Tailwind CSS instead of arco-design, hardcoded Chinese,
// removed i18n, router, agent logos, keepAwake toggle, mobile layout, classnames

import React, { useCallback, useMemo, useState } from "react";
import { useAllCronJobs } from "../../../renderer/pages/cron/useCronJobs.js";
import { formatSchedule, formatNextRun } from "../../../renderer/pages/cron/cronUtils.js";
import type { CronJob } from "../../../types/cron.js";
import { useAppStore } from "../../store/useAppStore.js";
import CronStatusTag from "./CronStatusTag.js";
import CreateTaskDialog from "./CreateTaskDialog.js";

interface ScheduledTasksPageProps {
  onBack?: () => void;
}

function formatWorkspaceName(cwd?: string) {
  if (!cwd) return "未绑定工作区";
  const parts = cwd.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) || cwd;
}

const ScheduledTasksPage: React.FC<ScheduledTasksPageProps> = ({ onBack }) => {
  const { jobs, loading, pauseJob, resumeJob, deleteJob } = useAllCronJobs();
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<{ conversationId: string; conversationTitle: string } | null>(null);
  const [menuJobId, setMenuJobId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<CronJob | undefined>(undefined);

  // Build workspace map from sessions
  const sessions = useAppStore((s) => s.sessions);
  const archivedSessions = useAppStore((s) => s.archivedSessions);
  const allSessions = useMemo(() => ({ ...archivedSessions, ...sessions }), [sessions, archivedSessions]);

  const conversationMap = useMemo(() => {
    const map = new Map<string, { cwd?: string; title: string }>();
    for (const [id, session] of Object.entries(allSessions)) {
      map.set(id, { cwd: session.cwd, title: session.title });
    }
    return map;
  }, [allSessions]);

  // Group jobs by workspace
  const workspaceGroups = useMemo(() => {
    const noWorkspace: CronJob[] = [];
    const groups = new Map<string, { cwd?: string; jobs: CronJob[] }>();

    for (const job of jobs) {
      const convId = job.metadata.conversationId;

      // System workspace by special marker
      if (convId === "__system__") {
        const existing = groups.get("__system__");
        if (existing) {
          existing.jobs.push(job);
        } else {
          groups.set("__system__", { cwd: undefined, jobs: [job] });
        }
        continue;
      }

      const session = convId ? conversationMap.get(convId) : undefined;

      if (!session?.cwd) {
        noWorkspace.push(job);
        continue;
      }

      const cwd = session.cwd;
      const systemWorkspaceSuffix = "/system-workspace";
      const isSystem = cwd.endsWith(systemWorkspaceSuffix) || cwd.endsWith(systemWorkspaceSuffix + "/");
      const key = isSystem ? "__system__" : cwd;

      const existing = groups.get(key);
      if (existing) {
        existing.jobs.push(job);
      } else {
        groups.set(key, {
          cwd: isSystem ? cwd : cwd,
          jobs: [job],
        });
      }
    }

    // Sort: system first, then by latest job
    const sorted = Array.from(groups.entries())
      .map(([key, value]) => ({ key, cwd: value.cwd, jobs: value.jobs }))
      .sort((a, b) => {
        if (a.key === "__system__") return -1;
        if (b.key === "__system__") return 1;
        const aLatest = Math.max(...a.jobs.map((j) => j.metadata.updatedAt ?? 0));
        const bLatest = Math.max(...b.jobs.map((j) => j.metadata.updatedAt ?? 0));
        return bLatest - aLatest;
      });

    return { noWorkspace, groups: sorted };
  }, [jobs, conversationMap]);

  // Available workspaces for new task dialog
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

    result.sort((a, b) => {
      const aSys = a.workspaceName === "system-workspace";
      const bSys = b.workspaceName === "system-workspace";
      if (aSys && !bSys) return -1;
      if (!aSys && bSys) return 1;
      return a.workspaceName.localeCompare(b.workspaceName);
    });

    return result;
  }, [allSessions]);

  const handleToggleEnabled = useCallback(
    async (job: CronJob) => {
      try {
        if (job.enabled) await pauseJob(job.id);
        else await resumeJob(job.id);
      } catch (err) {
        console.error("切换任务状态失败:", err);
      }
    },
    [pauseJob, resumeJob],
  );

  const handleDelete = useCallback(async (jobId: string) => {
    try {
      await deleteJob(jobId);
      setConfirmDeleteId(null);
      if (detailJobId === jobId) setDetailJobId(null);
    } catch (err) {
      console.error("删除任务失败:", err);
    }
  }, [deleteJob, detailJobId]);

  const handleEdit = useCallback((job: CronJob) => {
    setEditingJob(job);
    setMenuJobId(null);
    setCreateDialogVisible(true);
  }, []);

  const handleNewTask = useCallback((workspace?: { conversationId: string; conversationTitle: string }) => {
    setSelectedWorkspace(workspace ?? null);
    setCreateDialogVisible(true);
  }, []);

  const detailJob = detailJobId ? jobs.find((j) => j.id === detailJobId) ?? null : null;

  const totalJobs = jobs.length;
  const hasAnyJobs = totalJobs > 0;

  return (
    <div className="w-full min-h-full box-border overflow-y-auto">
      {/* Top navigation bar */}
      {onBack && (
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 bg-white/80 backdrop-blur-sm border-b border-muted/20">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-900/5 transition-colors"
            onClick={onBack}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>返回</span>
          </button>
          <span className="text-sm font-medium text-ink-700">定时任务</span>
        </div>
      )}
      <div className="px-10 py-6">
      <div className="mx-auto flex w-full max-w-800px box-border flex-col gap-4">
        {/* Header */}
        <div className="flex w-full flex-col gap-2">
          <div className="flex w-full items-start justify-between gap-3">
            <h1 className="m-0 min-w-0 flex-1 font-bold text-ink text-2xl">定时任务</h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="shrink-0 inline-flex items-center gap-1 rounded-full border border-muted/30 px-4 py-1.5 text-sm font-medium text-ink hover:bg-ink-900/5 transition-colors"
                onClick={() => {
                  setEditingJob(undefined);
                  handleNewTask(availableWorkspaces[0]);
                }}
              >
                <PlusIcon />
                新建任务
              </button>
            </div>
          </div>
          <p className="m-0 w-full text-sm text-muted">管理和调度定时执行的任务，让 AI 按计划自动工作。</p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-muted/30">
            <span className="text-muted text-sm">加载中...</span>
          </div>
        ) : !hasAnyJobs ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-muted/30">
            <span className="text-muted text-sm">暂无定时任务，点击上方按钮创建</span>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* No-workspace group */}
            {workspaceGroups.noWorkspace.length > 0 && (
              <WorkspaceJobGroup
                label="未绑定工作区"
                jobs={workspaceGroups.noWorkspace}
                conversationMap={conversationMap}
                detailJobId={detailJobId}
                menuJobId={menuJobId}
                onToggleEnabled={handleToggleEnabled}
                onSelectJob={setDetailJobId}
                onEdit={handleEdit}
                onDelete={(id) => setConfirmDeleteId(id)}
                onSetMenu={setMenuJobId}
              />
            )}

            {/* Workspace groups */}
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
                  onToggleEnabled={handleToggleEnabled}
                  onSelectJob={setDetailJobId}
                  onEdit={handleEdit}
                  onDelete={(id) => setConfirmDeleteId(id)}
                  onSetMenu={setMenuJobId}
                />
              );
            })}
          </div>
        )}

        {/* Detail panel (inline) */}
        {detailJob && (
          <CronTaskDetailInline
            job={detailJob}
            onClose={() => setDetailJobId(null)}
            onEdit={() => handleEdit(detailJob)}
          />
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

        {/* Delete confirmation dialog */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setConfirmDeleteId(null)}>
            <div className="w-[min(400px,calc(100vw-32px))] rounded-2xl bg-white shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="m-0 text-lg font-semibold text-ink mb-2">确认删除</h3>
              <p className="text-sm text-muted mb-6">删除后该定时任务将无法恢复，确定删除？</p>
              <div className="flex items-center justify-end gap-3">
                <button type="button" className="rounded-lg border border-muted/30 px-4 py-2 text-sm text-ink hover:bg-muted/5 transition-colors" onClick={() => setConfirmDeleteId(null)}>取消</button>
                <button type="button" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors" onClick={() => handleDelete(confirmDeleteId)}>确认删除</button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

// ── WorkspaceJobGroup ──

const WorkspaceJobGroup: React.FC<{
  label: string;
  subtitle?: string;
  jobs: CronJob[];
  conversationMap: Map<string, { cwd?: string; title: string }>;
  detailJobId: string | null;
  menuJobId: string | null;
  onToggleEnabled: (job: CronJob) => void;
  onSelectJob: (id: string) => void;
  onEdit: (job: CronJob) => void;
  onDelete: (id: string) => void;
  onSetMenu: (id: string | null) => void;
}> = ({ label, subtitle, jobs, conversationMap, menuJobId, onToggleEnabled, onSelectJob, onEdit, onDelete, onSetMenu }) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-10Z" />
        </svg>
        <span className="text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">{label}</span>
        <span className="text-[10px] text-muted bg-muted/10 rounded-full px-1.5 py-0.5">{jobs.length}</span>
      </div>
      {subtitle && (
        <div className="px-1 text-[11px] text-muted truncate" title={subtitle}>{subtitle}</div>
      )}
      <div className="grid w-full items-start grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => {
          const isManualOnly = job.schedule.kind === "cron" && !job.schedule.expr;
          const executionModeLabel =
            job.target.executionMode === "new_conversation" ? "新建会话" : "现有会话";
          const convInfo = job.metadata.conversationId
            ? conversationMap.get(job.metadata.conversationId)
            : undefined;
          const isMenuOpen = menuJobId === job.id;

          return (
            <div
              key={job.id}
              className="group relative flex cursor-pointer flex-col rounded-xl border border-muted/20 bg-white px-5 py-4 transition-colors hover:border-muted/40 hover:shadow-sm"
              onClick={() => onSelectJob(job.id)}
            >
              {/* Top row: name + status + menu trigger */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="mr-2 min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                  {job.name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <CronStatusTag job={job} />
                  {/* ⋯ menu trigger */}
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted hover:text-ink hover:bg-muted/10 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetMenu(isMenuOpen ? null : job.id);
                    }}
                    title="更多操作"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Dropdown menu */}
              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => { e.stopPropagation(); onSetMenu(null); }}
                  />
                  <div className="absolute right-2 top-10 z-20 flex flex-col rounded-lg border border-muted/20 bg-white shadow-lg py-1 min-w-[120px]">
                    <button
                      type="button"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-muted/5 transition-colors text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(job);
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      编辑
                    </button>
                    {!isManualOnly && (
                      <button
                        type="button"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-muted/5 transition-colors text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleEnabled(job);
                          onSetMenu(null);
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {job.enabled
                            ? <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></>
                            : <><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>
                          }
                        </svg>
                        {job.enabled ? "停用" : "启用"}
                      </button>
                    )}
                    <div className="border-t border-muted/10 my-1" />
                    <button
                      type="button"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetMenu(null);
                        onDelete(job.id);
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/></svg>
                      删除
                    </button>
                  </div>
                </>
              )}

              <div className="min-w-0 break-words text-sm text-muted" title={formatSchedule(job)}>
                {formatSchedule(job)}
              </div>

              <div className="mt-4 min-w-0 break-words text-[13px] text-muted">
                {job.state.nextRunAtMs ? `下次运行 ${formatNextRun(job.state.nextRunAtMs)}` : "-"}
              </div>

              <div className="mt-3.5 flex items-center justify-between gap-2.5">
                <span className="min-w-0 truncate text-xs text-muted">
                  {convInfo?.title ?? executionModeLabel}
                </span>
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  {!isManualOnly && (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={job.enabled}
                        onChange={() => onToggleEnabled(job)}
                      />
                      <div className="w-8 h-5 bg-gray-200 rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Inline detail view (simplified from TaskDetailPage)
const CronTaskDetailInline: React.FC<{
  job: CronJob;
  onClose: () => void;
  onEdit: () => void;
}> = ({ job, onClose }) => {
  const isManualOnly = job.schedule.kind === "cron" && !job.schedule.expr;
  const [runningNow, setRunningNow] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = (window as unknown as { electron: any }).electron;

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      await el.invoke("cron:run-now", { jobId: job.id });
    } catch (err) {
      console.error("立即运行失败:", err);
    } finally {
      setRunningNow(false);
    }
  };

  const handleDelete = async () => {
    try {
      await el.invoke("cron:remove-job", { jobId: job.id });
      onClose();
    } catch (err) {
      console.error("删除任务失败:", err);
    }
  };

  return (
    <div className="rounded-xl border border-muted/20 bg-white p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="m-0 text-xl font-bold text-ink">{job.name}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs text-muted hover:text-ink transition-colors"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      </div>

      {job.description && (
        <p className="m-0 mb-4 text-sm text-muted">{job.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <CronStatusTag job={job} />
        {job.state.nextRunAtMs && (
          <span className="text-sm text-muted">下次运行 {formatNextRun(job.state.nextRunAtMs)}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px] gap-6">
        <div>
          <h3 className="text-[13px] font-medium text-muted mb-3">任务指令</h3>
          <div className="rounded-xl border border-muted/20 bg-muted/5 p-4">
            <pre className="whitespace-pre-wrap break-words text-sm text-ink m-0 font-sans">
              {job.target.payload.text || "-"}
            </pre>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <section>
            <h3 className="text-[13px] font-medium text-muted mb-2">重复频率</h3>
            <p className="text-sm text-ink">{formatSchedule(job)}</p>
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-muted mb-2">状态</h3>
            <p className="text-sm text-ink">
              已运行 {job.state.runCount} 次
              {job.state.lastStatus === "error" && <span className="text-red-500 ml-2">上次执行失败</span>}
            </p>
            {job.state.lastError && (
              <p className="text-xs text-red-500 mt-1">{job.state.lastError}</p>
            )}
          </section>

          <div className="flex flex-wrap gap-2 mt-2">
            {!isManualOnly && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/90 transition-colors"
                disabled={runningNow}
                onClick={handleRunNow}
              >
                {runningNow ? "运行中..." : "立即运行"}
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-muted/30 px-3 py-1.5 text-sm text-ink hover:bg-muted/5 transition-colors"
              onClick={handleDelete}
            >
              删除任务
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

const PlusIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

export default ScheduledTasksPage;
