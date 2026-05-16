import { AlertTriangle, Archive, GitBranch, History, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { UiGitOperationLogEntry, UiGitWorkbenchSnapshot } from "../../types";
import { useGitWorkbench } from "../../hooks/useGitWorkbench";
import { GitBranchStashPanel } from "./GitBranchStashPanel";
import { GitChangesList } from "./GitChangesList";
import { GitCommitBox } from "./GitCommitBox";
import { GitCommitDetailPanel } from "./GitCommitDetailPanel";
import { GitConfirmDialog, type GitConfirmDialogState } from "./GitConfirmDialog";
import { GitDiffViewer } from "./GitDiffViewer";
import { GitHistoryPanel } from "./GitHistoryPanel";
import { GitStatusHeader } from "./GitStatusHeader";
import { triggerKnowledgeRefreshAfterCommit } from "./git-knowledge-autoupdate";
import { formatAheadBehind } from "./git-ui-utils";

type GitWorkbenchTab = "changes" | "log" | "branches" | "stashes";

const TABS: Array<{ id: GitWorkbenchTab; label: string; icon: typeof History }> = [
  { id: "changes", label: "改动", icon: RefreshCw },
  { id: "log", label: "日志", icon: History },
  { id: "branches", label: "分支管理", icon: GitBranch },
  { id: "stashes", label: "Stash", icon: Archive },
];

export function GitWorkbenchPanel({ cwd }: { cwd?: string }) {
  const workbench = useGitWorkbench(cwd);
  const [confirm, setConfirm] = useState<GitConfirmDialogState | null>(null);
  const [activeTab, setActiveTab] = useState<GitWorkbenchTab>("changes");
  const [branchFilter, setBranchFilter] = useState("all");
  const snapshot = workbench.snapshot;
  const logMode = activeTab === "log";

  const tabCounts = useMemo(() => {
    const files = snapshot?.files ?? [];
    return {
      changes: files.length,
      log: snapshot?.history.length ?? 0,
      branches: snapshot?.branches.filter((branch) => !branch.remote).length ?? 0,
      stashes: snapshot?.stashes.length ?? 0,
    } satisfies Record<GitWorkbenchTab, number>;
  }, [snapshot]);

  const closeConfirm = () => setConfirm(null);
  const commitAndRefreshKnowledge = useCallback(async (message: string, body?: string) => {
    const committed = await workbench.commit(message, body);
    if (committed === false) return false;
    void triggerKnowledgeRefreshAfterCommit(cwd);
    return committed;
  }, [cwd, workbench.commit]);

  const confirmAndClose = (state: GitConfirmDialogState) => {
    setConfirm({
      ...state,
      onConfirm: async () => {
        await state.onConfirm();
        closeConfirm();
      },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <GitStatusHeader
        snapshot={snapshot}
        loading={workbench.loading}
        actionBusy={workbench.actionBusy}
        onRefresh={() => { void workbench.refresh(); }}
        onPull={() => confirmAndClose({
          title: "拉取当前分支",
          description: "会从 upstream 拉取当前分支。若 Git 检测到冲突或未提交改动风险，本次操作会失败并显示错误。",
          confirmLabel: "拉取",
          onConfirm: workbench.pull,
        })}
        onPush={() => confirmAndClose({
          title: "Push 当前分支",
          description: "会把当前分支推送到 upstream。第一版不会强推，也不会改写历史。",
          confirmLabel: "Push",
          onConfirm: workbench.push,
        })}
        onCheckoutBranch={(name) => confirmAndClose({
          title: `切换到 ${name}`,
          description: "切换分支前请确认当前改动已经处理。Git 如果检测到冲突风险会拒绝本次操作。",
          confirmLabel: "切换",
          onConfirm: () => workbench.checkoutBranch(name),
        })}
      />

      {workbench.error && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{workbench.error}</span>
          </div>
        </div>
      )}

      {workbench.loading && !snapshot ? (
        <GitEmptyState loading title="读取 Git 仓库" description="正在读取当前工作区的 Git 状态。" />
      ) : !snapshot ? (
        <GitEmptyState
          title="没有可用 Git 仓库"
          description="切到有 cwd 的会话，或在 Git 仓库目录里开启会话后再试。"
          actionLabel="重新检测"
          onAction={() => { void workbench.refresh(); }}
        />
      ) : (
        <>
          <div className="flex h-10 shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex h-9 items-center gap-1.5 border-b-2 px-2 text-xs font-semibold ${
                    active
                      ? "border-blue-600 text-slate-950"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${active ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                    {tabCounts[tab.id]}
                  </span>
                </button>
              );
            })}
            <div className="ml-auto hidden text-[11px] text-slate-500 min-[900px]:block">
              {snapshot.status.currentBranch || "-"} · {formatAheadBehind(snapshot.status)} · 改动 {snapshot.status.changedCount}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden bg-slate-50">
            <div className={`flex h-full min-h-0 flex-col bg-white ${logMode ? "min-w-[860px]" : "min-w-[960px]"}`}>
              <div className={`grid min-h-0 flex-1 overflow-hidden ${logMode ? "grid-cols-[minmax(440px,0.9fr)_minmax(380px,0.7fr)]" : "grid-cols-[300px_minmax(360px,1fr)_300px]"}`}>
                {!logMode && (
                  <aside className="flex min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
                  <GitChangesList
                    files={snapshot.files}
                    selected={workbench.selectedFile}
                    actionBusy={workbench.actionBusy}
                    onSelect={(file) => {
                      setActiveTab("changes");
                      workbench.selectFile(file);
                    }}
                    onStage={(paths) => { void workbench.stageFiles(paths); }}
                    onUnstage={(paths) => { void workbench.unstageFiles(paths); }}
                  />
                  {activeTab === "changes" && (
                    <GitCommitBox
                      compact
                      snapshot={snapshot}
                      actionBusy={workbench.actionBusy}
                      onCommit={commitAndRefreshKnowledge}
                      onGenerateMessage={workbench.generateCommitMessage}
                      onGenerateMessageRefined={workbench.generateCommitMessageRefined}
                      onPush={workbench.push}
                    />
                  )}
                  </aside>
                )}

                <main className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
                  {activeTab === "log" && (
                    <GitHistoryPanel
                      history={snapshot.history}
                      branches={snapshot.branches}
                      currentBranch={snapshot.status.currentBranch}
                      selectedHash={workbench.selectedCommitHash}
                      branchFilter={branchFilter}
                      onBranchFilterChange={setBranchFilter}
                      onSelectCommit={workbench.selectCommit}
                    />
                  )}
                  {activeTab === "changes" && (
                    <GitDiffViewer
                      file={workbench.selectedChangedFile}
                      diffResult={workbench.diffResult}
                      loading={workbench.diffLoading}
                    />
                  )}
                  {activeTab === "branches" && (
                    <GitBranchStashPanel
                      branches={snapshot.branches}
                      stashes={snapshot.stashes}
                      currentBranch={snapshot.status.currentBranch}
                      actionBusy={workbench.actionBusy}
                      initialMode="branches"
                      onCreateBranch={(name, checkout) => { void workbench.createBranch(name, checkout); }}
                      onCheckoutBranch={(name) => confirmAndClose({
                        title: `切换到 ${name}`,
                        description: "切换分支前请确认当前改动已经处理。Git 如果检测到冲突风险会拒绝本次操作。",
                        confirmLabel: "切换",
                        onConfirm: () => workbench.checkoutBranch(name),
                      })}
                      onStashSave={(message) => { void workbench.stashSave(message); }}
                      onStashApply={(ref) => confirmAndClose({
                        title: `应用 ${ref}`,
                        description: "应用 stash 可能把改动写回工作区；如果发生冲突，Git 工作台会显示失败信息。",
                        confirmLabel: "Apply",
                        onConfirm: () => workbench.stashApply(ref),
                      })}
                      onStashDrop={(ref) => confirmAndClose({
                        title: `删除 ${ref}`,
                        description: "删除 stash 后无法从 Git 工作台恢复，请确认这条 stash 不再需要。",
                        confirmLabel: "删除",
                        tone: "danger",
                        onConfirm: () => workbench.stashDrop(ref),
                      })}
                    />
                  )}
                  {activeTab === "stashes" && (
                    <GitBranchStashPanel
                      branches={snapshot.branches}
                      stashes={snapshot.stashes}
                      currentBranch={snapshot.status.currentBranch}
                      actionBusy={workbench.actionBusy}
                      initialMode="stashes"
                      onCreateBranch={(name, checkout) => { void workbench.createBranch(name, checkout); }}
                      onCheckoutBranch={(name) => confirmAndClose({
                        title: `切换到 ${name}`,
                        description: "切换分支前请确认当前改动已经处理。Git 如果检测到冲突风险会拒绝本次操作。",
                        confirmLabel: "切换",
                        onConfirm: () => workbench.checkoutBranch(name),
                      })}
                      onStashSave={(message) => { void workbench.stashSave(message); }}
                      onStashApply={(ref) => confirmAndClose({
                        title: `应用 ${ref}`,
                        description: "应用 stash 可能把改动写回工作区；如果发生冲突，Git 工作台会显示失败信息。",
                        confirmLabel: "Apply",
                        onConfirm: () => workbench.stashApply(ref),
                      })}
                      onStashDrop={(ref) => confirmAndClose({
                        title: `删除 ${ref}`,
                        description: "删除 stash 后无法从 Git 工作台恢复，请确认这条 stash 不再需要。",
                        confirmLabel: "删除",
                        tone: "danger",
                        onConfirm: () => workbench.stashDrop(ref),
                      })}
                    />
                  )}
                </main>

                {activeTab === "log" ? (
                  <GitCommitDetailPanel
                    detail={workbench.commitDetail}
                    loading={workbench.commitDetailLoading}
                  />
                ) : (
                  <GitSideInspector snapshot={snapshot} operationLog={snapshot.operationLog} />
                )}
              </div>

            </div>
          </div>
        </>
      )}

      <GitConfirmDialog
        state={confirm}
        busy={Boolean(workbench.actionBusy)}
        onClose={closeConfirm}
      />
    </div>
  );
}

function GitEmptyState({
  loading,
  title,
  description,
  actionLabel,
  onAction,
}: {
  loading?: boolean;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center">
      <div>
        {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /> : <AlertTriangle className="mx-auto h-8 w-8 text-slate-300" />}
        <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function GitSideInspector({
  snapshot,
  operationLog,
}: {
  snapshot: UiGitWorkbenchSnapshot;
  operationLog: UiGitOperationLogEntry[];
}) {
  return (
    <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex h-10 items-center border-b border-slate-200 px-3 text-xs font-semibold text-slate-950">仓库状态</div>
      <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-3 text-xs">
        <Metric label="当前分支" value={snapshot.status.currentBranch ?? "-"} />
        <Metric label="远端" value={formatAheadBehind(snapshot.status)} />
        <Metric label="改动" value={snapshot.status.changedCount} />
        <Metric label="Stash" value={snapshot.status.stashCount} />
      </div>
      <div className="flex h-10 items-center justify-between border-b border-slate-200 px-3 text-xs font-semibold text-slate-950">
        <span>操作记录</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{operationLog.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {operationLog.length === 0 ? (
          <div className="mt-12 text-center text-xs text-slate-400">暂无 Git 操作记录</div>
        ) : operationLog.map((entry) => (
          <div key={entry.id} className="mb-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-800">{entry.operation}</span>
              <span className={entry.success ? "text-emerald-600" : "text-red-600"}>{entry.success ? "成功" : "失败"}</span>
            </div>
            <div className="mt-1 truncate text-slate-500" title={entry.summary}>{entry.summary}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
      <div className="truncate text-[11px] text-slate-400">{label}</div>
      <div className="mt-1 truncate font-semibold text-slate-800" title={String(value)}>{value}</div>
    </div>
  );
}
