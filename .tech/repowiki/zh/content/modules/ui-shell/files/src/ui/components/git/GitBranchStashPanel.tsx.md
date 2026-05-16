# src/ui/components/git/GitBranchStashPanel.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：204

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `GitBranchStashPanel@7`
- `BranchGroup@160`
- `localBranches@34`
- `remoteBranches@35`
- `disabled@36`
- `current@184`
- `BranchStashMode@4`
- `MaybePromise@6`
- `onCreateBranch@25`
- `onCheckoutBranch@26`
- `onStashSave@27`
- `onStashApply@28`
- `onStashDrop@29`
- `onCheckoutBranch@172`

## 依赖输入

- `lucide-react`
- `react`
- `../../types`

## 对外暴露

- `GitBranchStashPanel`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { Archive, GitBranch, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { UiGitBranch, UiGitStashEntry } from "../../types";

type BranchStashMode = "branches" | "stashes";
type MaybePromise<T> = T | Promise<T>;

export function GitBranchStashPanel({
  branches,
  stashes,
  currentBranch,
  actionBusy,
  initialMode = "branches",
  onCreateBranch,
  onCheckoutBranch,
  onStashSave,
  onStashApply,
  onStashDrop,
}: {
  branches: UiGitBranch[];
  stashes: UiGitStashEntry[];
  currentBranch?: string | null;
  actionBusy: string | null;
  initialMode?: BranchStashMode;
  onCreateBranch: (name: string, checkout: boolean) => MaybePromise<unknown>;
  onCheckoutBranch: (name: string) => MaybePromise<unknown>;
  onStashSave: (message?: string) => MaybePromise<unknown>;
  onStashApply: (ref: string) => MaybePromise<unknown>;
  onStashDrop: (ref: string) => MaybePromise<unknown>;
}) {
  const [mode, setMode] = useState<BranchStashMode>(initialMode);
  const [branchName, setBranchName] = useState("");
  const [stashMessage, setStashMessage] = useState("");
  const localBranches = useMemo(() => branches.filter((branch) => !branch.remote), [branches]);
  const remoteBranches = useMemo(() => branches.filter((branch) => branch.remote), [branches]);
  const disabled = Boolean(actionBusy);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex h-10 shrink-0 items-center gap-4 border-b border-slate-200 px-3">
        <button
          type="button"
          onClick={() => setMode("branches")}
          className={`h-10 border-b-2 px-1 text-xs font-semibold ${mode === "branches" ? "border-blue-600 text-slate-950" : "border-transparent text-slate-500"}`}
        >
          分支管理 ({localBranches.length})
        </button>
        <button
          type="button"
          onClick={() => setMode("stashes")}
          className={`h-10 border-b-2 px-1 text-xs font-semibold ${mode === "stashes" ? "border-blue-600 text-slate-950" : "border-transparent text-slate-500"}`}
        >
          Stash ({stashes.length})
        </button>
      </div>

      {mode === "branches" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex gap-2">
            <input
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-300"
              placeholder="new-branch"
            />
            <button
              type="button"
              disabled={disabled || !branchName.trim()}
              onClick={() => {
                onCreateBranch(branchName, true);
                setBranchName("");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Plus className="h-3.5 w-3.5" />
              新建
            </button>
          </div>
          <BranchGroup
            title="本地分支"
            branches={localBranches}
            currentBranch={currentBranch}
            disabled={disabled}
            onCheckoutBranch={onCheckoutBranch}
          />
          <BranchGroup
            title="远端分支"
            branches={remoteBranches}
            currentBranch={currentBranch}
            disabled={disabled}
            onCheckoutBranch={onCheckoutBranch}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex gap-2">
            <input
              value={stashMessage}
              onChange={(event) => setStashMessage(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-300"
              placeholder="stash message"
            />
... (truncated)
```
