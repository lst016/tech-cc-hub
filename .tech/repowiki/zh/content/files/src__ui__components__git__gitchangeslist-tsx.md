# src/ui/components/git/GitChangesList.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：187

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `GitChangesList@5`
- `FileGroup@83`
- `renderFileRow@132`
- `splitFilePath@178`
- `normalizedQuery@22`
- `filtered@23`
- `staged@27`
- `unstaged@28`
- `disabled@29`
- `sortedFiles@105`
- `active@145`
- `parts@180`
- `name@181`
- `onSelect@17`
- `onStage@18`
- `onUnstage@19`
- `onSelect@102`
- `onAction@103`
- `onSelect@140`
- `onAction@141`

## 依赖输入

- `lucide-react`
- `react`
- `../../types`
- `./git-ui-utils`

## 对外暴露

- `GitChangesList`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { FileText, Minus, Plus, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { UiGitChangedFile } from "../../types";
import { fileStatusClassName, fileStatusLabel } from "./git-ui-utils";

export function GitChangesList({
  files,
  selected,
  actionBusy,
  onSelect,
  onStage,
  onUnstage,
}: {
  files: UiGitChangedFile[];
  selected: { path: string; staged: boolean } | null;
  actionBusy: string | null;
  onSelect: (file: UiGitChangedFile) => void;
  onStage: (paths: string[]) => void;
  onUnstage: (paths: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return files;
    return files.filter((file) => file.path.toLowerCase().includes(normalizedQuery));
  }, [files, normalizedQuery]);
  const staged = filtered.filter((file) => file.staged);
  const unstaged = filtered.filter((file) => !file.staged);
  const disabled = Boolean(actionBusy);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="shrink-0 border-b border-slate-200 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-950">改动</div>
          <div className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{files.length}</div>
        </div>
        <label className="mt-2 flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] text-slate-500 focus-within:border-blue-300 focus-within:bg-white">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
            placeholder="搜索文件"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 text-xs">
        <FileGroup
          title="未暂存"
          files={unstaged}
          selected={selected}
          disabled={disabled}
          actionIcon={<Plus className="h-3.5 w-3.5" />}
          actionLabel="暂存"
          emptyLabel="没有未暂存改动"
          onSelect={onSelect}
          onAction={onStage}
        />
        <FileGroup
          title="已暂存"
          files={staged}
          selected={selected}
          disabled={disabled}
          actionIcon={<Minus className="h-3.5 w-3.5" />}
          actionLabel="取消暂存"
          emptyLabel="没有已暂存文件"
          onSelect={onSelect}
          onAction={onUnstage}
        />

        {filtered.length === 0 && (
          <div className="mt-8 flex flex-col items-center justify-center text-center text-xs text-slate-400">
            <FileText className="h-5 w-5" />
            <p className="mt-2">没有匹配文件</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FileGroup({
  title,
  files,
  selected,
  disabled,
  actionIcon,
  actionLabel,
  emptyLabel,
  onSelect,
  onAction,
}: {
  title: string;
  files: UiGitChangedFile[];
  selected: { path: string; staged: boolean } | null;
  disabled: boolean;
  actionIcon: ReactNode;
  actionLabel: string;
  emptyLabel: string;
  onSelect: (file: UiGitChangedFile) => void;
  onAction: (paths: string[]) => void;
}) {
  const sortedFiles = useMemo(() => [...files].sort((a, b) => a.path.localeCompare(b.path)), [files]);

  return (
    <section className="mb-3">
      <div className="mb-1 flex h-7 items-center justify-between rounded px-1 text-[11px] font-semibold text-slate-500">
        <span>{title} ({files.length})</span>
        {files.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction(files.map((file) => file.path))}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
            title={`${actionLabel}全部文件`}
            aria-label={`${actionLabel}全部文件`}
          >
            {actionIcon}
          </button>
        )
... (truncated)
```
