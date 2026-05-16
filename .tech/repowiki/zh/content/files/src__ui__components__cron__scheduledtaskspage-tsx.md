# src/ui/components/cron/ScheduledTasksPage.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：574

## 文件职责

定时任务管理页面，展示和操作所有定时任务

## 运行信号

- `electron.invoke: cron:run-now`
- `electron.invoke: cron:remove-job`

## 关键符号

- `formatWorkspaceName@0 - 格式化工作区名称显示`
- `ScheduledTasksPage@0 - 定时任务页面主组件，按工作区分组展示任务`

## 依赖输入

- `react`
- `../../pages/cron/useCronJobs.js`
- `../../pages/cron/cronUtils.js`
- `../../../types/cron.js`
- `../../store/useAppStore.js`
- `./CronStatusTag.js`
- `./CreateTaskDialog.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
// Source: CV from AionUi ScheduledTasksPage/index.tsx (252 lines)
// Adapted for tech-cc-hub: Tailwind CSS instead of arco-design, hardcoded Chinese,
// removed i18n, router, agent logos, keepAwake toggle, mobile layout, classnames

import React, { useCallback, useMemo, useState } from "react";
import { useAllCronJobs } from "../../pages/cron/useCronJobs.js";
import { formatSchedule, formatNextRun } from "../../pages/cron/cronUtils.js";
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
      if (
... (truncated)
```
