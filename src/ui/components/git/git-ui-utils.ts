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
