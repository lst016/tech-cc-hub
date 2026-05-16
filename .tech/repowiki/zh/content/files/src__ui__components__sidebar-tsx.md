# src/ui/components/Sidebar.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：501

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `Sidebar@21`
- `sidebarHeaderOffsetClass@35`
- `sessions@36`
- `archivedSessions@37`
- `activeSessionId@38`
- `setActiveSessionId@39`
- `closeTimerRef@44`
- `previousSessionStatusRef@46`
- `unsubscribe@50`
- `formatWorkspaceName@55`
- `parts@58`
- `sessionList@61`
- `list@63`
- `previousStatuses@75`
- `sessionValues@77`
- `runningSessionIds@78`
- `previousStatus@82`
- `next@105`
- `changed@106`
- `ensureNext@107`
- `next@135`
- `workspaceGroups@140`
- `groups@142`
- `key@144`
- `existing@145`
- `aLatest@159`
- `bLatest@160`
- `handleCopyCommand@180`
- `command@183`
- `openSettings@197`
- `isActiveSession@298`
- `isRunningSession@299`
- `unreadSessionStatus@300`
- `SidebarProps@6`
- `onNewSession@9`
- `onArchiveSession@10`
- `onUnarchiveSession@11`
- `onRefreshArchivedSessions@12`
- `onDeleteSession@13`
- `onDeleteWorkspace@14`

## 依赖输入

- `react`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-dialog`
- `../store/useAppStore`
- `../types`

## 对外暴露

- `Sidebar`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { useAppStore } from "../store/useAppStore";
import type { AppUpdateStatus, SettingsPageId } from "../types";

interface SidebarProps {
  connected: boolean;
  onNewSession: (cwd?: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onUnarchiveSession: (sessionId: string) => void;
  onRefreshArchivedSessions: () => void;
  onDeleteSession: (sessionId: string) => void;
  onDeleteWorkspace: (sessionIds: string[], workspaceName: string) => void;
  onOpenSettings?: (pageId?: SettingsPageId) => void;
  onOpenKnowledgePanel?: () => void;
  onOpenCronPage?: () => void;
  onOpenTaskPanel?: () => void;
  width?: number;
}

export function Sidebar({
  onNewSession,
  onArchiveSession,
  onUnarchiveSession,
  onRefreshArchivedSessions,
  onDeleteSession,
  onDeleteWorkspace,
  onOpenSettings,
  onOpenKnowledgePanel,
  onOpenCronPage,
  onOpenTaskPanel,
  width = 320,
}: SidebarProps) {
  const sidebarHeaderOffsetClass = typeof window !== "undefined" && window.electron?.platform === "darwin" ? "top-14" : "top-10";
  const sessions = useAppStore((state) => state.sessions);
  const archivedSessions = useAppStore((state) => state.archivedSessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const setActiveSessionId = useAppStore((state) => state.setActiveSessionId);
  const [showArchived, setShowArchived] = useState(false);
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const closeTimerRef = useRef<number | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const previousSessionStatusRef = useRef<Record<string, string | undefined>>({});
  const [unreadSessionIds, setUnreadSessionIds] = useState<Record<string, "completed" | "error">>({});

  useEffect(() => {
    const unsubscribe = window.electron.onAppUpdateStatus((status: AppUpdateStatus) => {
      setHasUpdate(status.status === "available" || status.status === "downloaded");
    });
    return unsubscribe;
  }, []);

  const formatWorkspaceName = (cwd?: string) => {
    if (!cwd) return "未绑定工作区";
    const parts = cwd.split(/[\\/]+/).filter(Boolean);
    return parts.at(-1) || cwd;
  };

  const sessionList = useMemo(() => {
    const list = Object.values(showArchived ? archivedSessions : sessions);
    list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return list;
  }, [archivedSessions, sessions, showArchived]);

  useEffect(() => {
    if (showArchived) {
      onRefreshArchivedSessions();
    }
  }, [onRefreshArchivedSessions, showArchived]);

  useEffect(() => {
    const previousStatuses = previousSessionStatusRef.current;
    const nextStatuses: Record<string, string | undefined> = {};
    const sessionValues = Object.values(sessions);
    const runningSessionIds = new Set<string>();
    const finishedUnreadSessions: Record<string, "completed" | "error"> = {};

    for (const session of sessionValues) {
      const previousStatus = previousStatuses[session.id];
      nextStatuses[session.id] = session.status;

      if (session.status === "running") {
        runningSessionIds.add(session.id);
      }

      if (
        previousStatus === "running" &&
        (session.status === "completed" || session.status === "error") &&
        session.id !== activeSessionId
      ) {
        finishedUnreadSessions[session.id] = session.status;
      }
    }

    previousSessionStatusRef.current = nextStatuses;

    if (runningSessionIds.size === 0 && Object.keys(finishedUnreadSessions).length === 0) {
      return;
    }

    setUnreadSessionIds((current) => {
      let next = current;
      let changed = false;
      const ensureNext = () => {
        if (!changed) {
          next = { ...current };
          changed = true;
        }
        return next;
      };

      for (const sessionId of runningSessionIds) {
        if (next[sessionId]) {
          delete ens
... (truncated)
```
