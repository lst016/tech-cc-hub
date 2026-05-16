# src/ui/components/TaskPanel.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：1136

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `isRecord@104`
- `getAssigneeCount@108`
- `getProviderLabel@117`
- `formatShortId@121`
- `formatDate@126`
- `formatTime@133`
- `formatDateTime@137`
- `formatCost@144`
- `formatTokens@149`
- `formatWorkspaceName@155`
- `cx@161`
- `StatusBadge@171`
- `PriorityPill@182`
- `EmptyState@190`
- `TaskPanel@203`
- `members@110`
- `date@129`
- `date@140`
- `normalized@151`
- `parts@158`
- `electronApi@167`
- `tone@173`
- `Icon@174`
- `tasks@205`
- `stats@206`
- `executions@207`
- `executionLogs@208`
- `subtasks@209`
- `artifacts@210`
- `selectedTaskId@211`
- `syncing@212`
- `settings@213`
- `sessions@214`
- `archivedSessions@215`
- `cwd@216`
- `apiConfigSettings@217`
- `runtimeModel@218`
- `setTasks@219`
- `upsertTask@220`
- `setStats@221`

## 依赖输入

- `react`
- `lucide-react`
- `sonner`
- `../store/taskStore`
- `../store/useAppStore`
- `./settings/settings-utils`
- `../types`

## 对外暴露

- `TaskPanel`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  DollarSign,
  ExternalLink,
  FileText,
  Filter,
  FolderOpen,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Square,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTaskStore } from "../store/taskStore";
import { useAppStore } from "../store/useAppStore";
import { getAvailableModelsForProfiles, getEnabledProfiles } from "./settings/settings-utils";
import type {
  ClientEvent,
  ServerEvent,
  UiTask,
  UiTaskArtifact,
  UiTaskExecution,
  UiTaskExecutionBundle,
  UiTaskExecutionLog,
  UiTaskExecutionOptions,
  UiTaskStats,
  UiTaskStatus,
  UiTaskSubtask,
  UiTaskProviderState,
  UiTaskWorkflowSettings,
} from "../types";

type Props = {
  connected: boolean;
  sendEvent: (event: ClientEvent) => void;
  onBack: () => void;
};

const STATUS_LABELS: Record<UiTaskStatus, string> = {
  pending: "待处理",
  in_progress: "进行中",
  done: "外部完成",
  cancelled: "已取消",
  queued: "排队中",
  executing: "AI 执行中",
  retrying: "自动重试",
  paused: "已暂停",
  completed: "AI 已完成",
  failed: "执行失败",
};

const STATUS_TONES: Record<UiTaskStatus, { badge: string; dot: string; icon: typeof Circle }> = {
  pending: { badge: "border-slate-200 bg-slate-50 text-slate-700", dot: "bg-slate-400", icon: Circle },
  in_progress: { badge: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-500", icon: Clock3 },
  done: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
  cancelled: { badge: "border-slate-200 bg-slate-100 text-slate-500", dot: "bg-slate-300", icon: Circle },
  queued: { badge: "border-indigo-200 bg-indigo-50 text-indigo-700", dot: "bg-indigo-500", icon: Clock3 },
  executing: { badge: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500", icon: Loader2 },
  retrying: { badge: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-500", icon: RefreshCw },
  paused: { badge: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-400", icon: Pause },
  completed: { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
  failed: { badge: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500", icon: AlertCircle },
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

const PRIORITY_TONES: Record<string, string> = {
  low: "bg-slate-50 text-slate-500 ring-slate-200",
  medium: "bg-slate-50 text-slate-700 ring-slate-200",
  high: "bg-amber-50 text-amber-700 ring-amber-200",
  urgent: "bg-red-50 text-red-700 ring-red-200",
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "pending", label: "待处理" },
  { value: "queued", label: "排队中" },
  { value: "executing", label: "执行中" },
  { value: "retrying", label: "重试中" },
  { value: "paused", label: "已暂停" },
  { value: "completed", label: "AI 已完成" },
  { value: "failed", label: "失败" },
  { value: "done", label: "外部完成" },
  { value: "all", label: "全部" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAssigneeCount(task: UiTask): number {
  const members = task.sourceData?.members;
  if (Array.isArray(members)) {
    return members.filter(isRecord).length;
  }
  if (!task.assignee) return 0;
  return task.assignee.split(/[、,，]/).map((item) => item.trim()).filter(Boolean).length;
}

function getProviderLabel(task: UiTask): string {
  return task.provider === "lark" ? "飞书" : "TB";
}

function formatShortId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function formatDate(value?: number): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeStrin
... (truncated)
```
