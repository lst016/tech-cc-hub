# src/ui/components/git/GitWorkbenchPanel.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：341

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `GitWorkbenchPanel@23`
- `GitEmptyState@262`
- `GitSideInspector@295`
- `Metric@332`
- `workbench@25`
- `snapshot@29`
- `logMode@30`
- `tabCounts@31`
- `files@33`
- `closeConfirm@41`
- `confirmAndClose@43`
- `Icon@102`
- `active@103`
- `GitWorkbenchTab@14`
- `onConfirm@46`
- `onConfirm@76`
- `onConfirm@189`
- `onConfirm@196`
- `onConfirm@203`
- `onConfirm@219`
- `onConfirm@226`
- `onConfirm@233`

## 依赖输入

- `lucide-react`
- `react`
- `../../types`
- `../../hooks/useGitWorkbench`
- `./GitBranchStashPanel`
- `./GitChangesList`
- `./GitCommitBox`
- `./GitCommitDetailPanel`
- `./GitConfirmDialog`
- `./GitDiffViewer`
- `./GitHistoryPanel`
- `./GitStatusHeader`
- `./git-ui-utils`

## 对外暴露

- `GitWorkbenchPanel`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { AlertTriangle, Archive, GitBranch, History, Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
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
                  type="butt
... (truncated)
```
