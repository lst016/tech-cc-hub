# src/ui/components/git/git-ui-utils.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：75

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `fileStatusLabel@2`
- `fileStatusClassName@21`
- `shortenPath@38`
- `repoDisplayName@48`
- `formatAheadBehind@53`
- `formatRelativeTime@61`
- `parts@41`
- `fileName@42`
- `parent@43`
- `prefix@44`
- `budget@45`
- `parts@56`
- `time@63`
- `diffMs@65`
- `minutes@66`
- `hours@69`
- `days@71`

## 依赖输入

- `../../types`

## 对外暴露

- `fileStatusLabel`
- `fileStatusClassName`
- `shortenPath`
- `repoDisplayName`
- `formatAheadBehind`
- `formatRelativeTime`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { UiGitChangedFile, UiGitRepoStatus } from "../../types";

export function fileStatusLabel(status: UiGitChangedFile["status"]) {
  switch (status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    case "conflicted":
      return "!";
    case "untracked":
      return "?";
    default:
      return "M";
  }
}

export function fileStatusClassName(status: UiGitChangedFile["status"]) {
  switch (status) {
    case "added":
    case "untracked":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "deleted":
      return "border-red-200 bg-red-50 text-red-700";
    case "renamed":
    case "copied":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "conflicted":
      return "border-orange-200 bg-orange-50 text-orange-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function shortenPath(path: string, maxLength = 54) {
  if (path.length <= maxLength) return path;
  const parts = path.split("/");
  const fileName = parts.pop() ?? path;
  const parent = parts.pop();
  const prefix = parent ? `.../${parent}/` : ".../";
  const budget = Math.max(12, maxLength - prefix.length);
  return `${prefix}${fileName.length > budget ? `${fileName.slice(0, budget - 1)}...` : fileName}`;
}

export function repoDisplayName(status?: UiGitRepoStatus | null) {
  if (!status?.repoRoot) return "Git 工作台";
  return status.repoRoot.split(/[\\/]/).filter(Boolean).pop() || status.repoRoot;
}

export function formatAheadBehind(status?: UiGitRepoStatus | null) {
  if (!status) return "-";
  const parts = [];
  if (status.ahead > 0) parts.push(`↑ ${status.ahead}`);
  if (status.behind > 0) parts.push(`↓ ${status.behind}`);
  return parts.length ? parts.join("  ") : "同步";
}

export function formatRelativeTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  const diffMs = Date.now() - time;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(value).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

```
