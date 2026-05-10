import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useGitWorkbench } from "../../hooks/useGitWorkbench";
import { GitBranchStashPanel } from "./GitBranchStashPanel";
import { GitChangesList } from "./GitChangesList";
import { GitCommitBox } from "./GitCommitBox";
import { GitConfirmDialog, type GitConfirmDialogState } from "./GitConfirmDialog";
import { GitDiffViewer } from "./GitDiffViewer";
import { GitHistoryPanel } from "./GitHistoryPanel";
import { GitStatusHeader } from "./GitStatusHeader";

export function GitWorkbenchPanel({ cwd }: { cwd?: string }) {
  const workbench = useGitWorkbench(cwd);
  const [confirm, setConfirm] = useState<GitConfirmDialogState | null>(null);
  const snapshot = workbench.snapshot;

  const closeConfirm = () => setConfirm(null);
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
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <GitStatusHeader
        snapshot={snapshot}
        loading={workbench.loading}
        actionBusy={workbench.actionBusy}
        onRefresh={() => { void workbench.refresh(); }}
      />

      {workbench.error && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{workbench.error}</span>
          </div>
        </div>
      )}

      {workbench.loading && !snapshot ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-600">读取 Git 仓库</p>
          </div>
        </div>
      ) : !snapshot ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center">
          <div>
            <AlertTriangle className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">没有可用 Git 仓库</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">切到有 cwd 的会话，或在 Git 仓库目录里开启会话后再试。</p>
            <button
              type="button"
              onClick={() => { void workbench.refresh(); }}
              className="mt-4 h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              重新检测
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid min-h-full grid-cols-1 xl:grid-cols-[310px_minmax(0,1fr)_310px]">
            <div className="min-w-0 border-r border-slate-200">
              <GitChangesList
                files={snapshot.files}
                selected={workbench.selectedFile}
                actionBusy={workbench.actionBusy}
                onSelect={workbench.selectFile}
                onStage={(paths) => { void workbench.stageFiles(paths); }}
                onUnstage={(paths) => { void workbench.unstageFiles(paths); }}
              />
              <GitCommitBox
                snapshot={snapshot}
                actionBusy={workbench.actionBusy}
                onCommit={(message, body) => { void workbench.commit(message, body); }}
                onPush={() => confirmAndClose({
                  title: "Push 当前分支",
                  description: "会把当前分支推送到 upstream。第一版不会强推，也不会改写历史。",
                  confirmLabel: "Push",
                  onConfirm: workbench.push,
                })}
              />
            </div>
            <div className="min-w-0 border-r border-slate-200">
              <GitDiffViewer
                file={workbench.selectedChangedFile}
                diffResult={workbench.diffResult}
                loading={workbench.diffLoading}
              />
            </div>
            <div className="min-w-0">
              <GitHistoryPanel history={snapshot.history} />
              <GitBranchStashPanel
                branches={snapshot.branches}
                stashes={snapshot.stashes}
                currentBranch={snapshot.status.currentBranch}
                actionBusy={workbench.actionBusy}
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
            </div>
          </div>
        </div>
      )}

      <GitConfirmDialog
        state={confirm}
        busy={Boolean(workbench.actionBusy)}
        onClose={closeConfirm}
      />
    </div>
  );
}
