import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Help } from "@icon-park/react";
import { useAppStore } from "../store/useAppStore";
import type { AppUpdateStatus, SettingsPageId } from "../types";
import {
  LINKED_WORKSPACE_STORAGE_KEY,
  normalizeLinkedWorkspacesByGroup,
  normalizeWorkspacePath,
  readLinkedWorkspacesFromStorage,
} from "./prompt-input/linked-workspaces";
import {
  SidebarWorkspaceList,
  type SidebarWorkspaceGroup,
  type SidebarUnreadSessionStatus,
} from "./sidebar/SidebarWorkspaceList";
import {
  SidebarRenameDialog,
  SidebarResumeDialog,
  SidebarSessionSearchDialog,
  WorkspaceLinkDialog,
  type SidebarRenameDialogState,
  type WorkspaceLinkDialogState,
} from "./sidebar/SidebarDialogs";
import { WooAuthDialog, WooAvatar } from "./WooAuthDialog";

interface SidebarProps {
  connected: boolean;
  onNewSession: (cwd?: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onUnarchiveSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onRefreshArchivedSessions: () => void;
  onDeleteSession: (sessionId: string) => void;
  onDeleteWorkspace: (sessionIds: string[], workspaceName: string) => void;
  onOpenSettings?: (pageId?: SettingsPageId) => void;
  onOpenCronPage?: () => void;
  width?: number;
}

export const DEFAULT_SIDEBAR_WIDTH = 280;
export const SIDEBAR_EXPANDED_WORKSPACE_GROUPS_STORAGE_KEY = "tech-cc-hub:sidebar-expanded-workspace-groups";

function readExpandedWorkspaceGroupsFromStorage(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SIDEBAR_EXPANDED_WORKSPACE_GROUPS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, boolean] => typeof entry[0] === "string" && typeof entry[1] === "boolean"),
    );
  } catch {
    return {};
  }
}

function writeExpandedWorkspaceGroupsToStorage(groups: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    const expandedOnly = Object.fromEntries(Object.entries(groups).filter(([, expanded]) => expanded));
    if (Object.keys(expandedOnly).length === 0) {
      window.localStorage.removeItem(SIDEBAR_EXPANDED_WORKSPACE_GROUPS_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SIDEBAR_EXPANDED_WORKSPACE_GROUPS_STORAGE_KEY, JSON.stringify(expandedOnly));
  } catch {
    // Losing this preference is better than breaking the sidebar render path.
  }
}

export function Sidebar({
  onNewSession,
  onArchiveSession,
  onUnarchiveSession,
  onRenameSession,
  onRefreshArchivedSessions,
  onDeleteSession,
  onDeleteWorkspace,
  onOpenSettings,
  onOpenCronPage,
  width = DEFAULT_SIDEBAR_WIDTH,
}: SidebarProps) {
  const sidebarHeaderOffsetClass = typeof window !== "undefined" && window.electron?.platform === "darwin" ? "top-12" : "top-10";
  const sessions = useAppStore((state) => state.sessions);
  const archivedSessions = useAppStore((state) => state.archivedSessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const setActiveSessionId = useAppStore((state) => state.setActiveSessionId);
  const [showArchived, setShowArchived] = useState(false);
  const [sessionSearchOpen, setSessionSearchOpen] = useState(false);
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);
  const [renameDialog, setRenameDialog] = useState<SidebarRenameDialogState>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => readExpandedWorkspaceGroupsFromStorage());
  const [hasUpdate, setHasUpdate] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const previousSessionStatusRef = useRef<Record<string, string | undefined>>({});
  const [unreadSessionIds, setUnreadSessionIds] = useState<Record<string, SidebarUnreadSessionStatus>>({});
  const [workspaceLinkDialog, setWorkspaceLinkDialog] = useState<WorkspaceLinkDialogState>(null);
  const [linkedWorkspacesByGroup, setLinkedWorkspacesByGroup] = useState<Record<string, string[]>>({});
  const [linkedWorkspacesHydrated, setLinkedWorkspacesHydrated] = useState(false);
  const [recentCwds, setRecentCwds] = useState<string[]>([]);
  const [workspaceHoverCard, setWorkspaceHoverCard] = useState<{
    name: string;
    cwd: string;
    sessionCount: number;
    left: number;
    top: number;
  } | null>(null);
  const [wooAuthDialogOpen, setWooAuthDialogOpen] = useState(false);
  const [wooAuthState, setWooAuthState] = useState<{
    status: "anonymous" | "authenticated";
    user: { realName?: string; userHandle?: string; avatarUrl?: string } | null;
  }>({ status: "anonymous", user: null });
  const handleWooAuthStateChange = useCallback((state: {
    status: "anonymous" | "authenticated";
    user: { realName?: string; userHandle?: string; avatarUrl?: string } | null;
  }) => {
    setWooAuthState({ status: state.status, user: state.user });
  }, []);
  const handleWooAuthTriggerClick = useCallback(async () => {
    if (wooAuthState.status === "authenticated") {
      setWooAuthDialogOpen((current) => !current);
      return;
    }

    setWooAuthDialogOpen(true);
  }, [wooAuthState.status]);

  useEffect(() => {
    const unsubscribe = window.electron.onAppUpdateStatus((status: AppUpdateStatus) => {
      setHasUpdate(status.status === "available" || status.status === "downloaded");
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const refreshCurrentTime = () => setCurrentTimeMs(Date.now());
    refreshCurrentTime();
    const timer = window.setInterval(refreshCurrentTime, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      setLinkedWorkspacesByGroup(readLinkedWorkspacesFromStorage());
    } catch (error) {
      console.warn("Failed to parse linked workspace storage:", error);
    } finally {
      setLinkedWorkspacesHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!linkedWorkspacesHydrated) return;
    try {
      const normalizedGroups = normalizeLinkedWorkspacesByGroup(linkedWorkspacesByGroup);
      const hasEntries = Object.keys(normalizedGroups).length > 0;
      if (!hasEntries) {
        window.localStorage.removeItem(LINKED_WORKSPACE_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(LINKED_WORKSPACE_STORAGE_KEY, JSON.stringify(normalizedGroups));
    } catch (error) {
      console.warn("Failed to persist linked workspace storage:", error);
    }
  }, [linkedWorkspacesByGroup, linkedWorkspacesHydrated]);

  useEffect(() => {
    window.electron.getRecentCwds(20)
      .then((items) => {
        setRecentCwds(Array.isArray(items)
          ? items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : []);
      })
      .catch(() => {
        setRecentCwds([]);
      });
  }, []);

  useEffect(() => {
    void window.electron.invoke("woo-auth:get-state")
      .then((state: unknown) => {
        if (!state || typeof state !== "object") return;
        const authState = state as { status?: unknown; user?: unknown };
        setWooAuthState({
          status: authState.status === "authenticated" ? "authenticated" : "anonymous",
          user: authState.user && typeof authState.user === "object" ? authState.user as { realName?: string; userHandle?: string; avatarUrl?: string } : null,
        });
      })
      .catch(() => undefined);
  }, []);

  const formatWorkspaceName = (cwd?: string) => {
    if (!cwd) return "未绑定工作区";
    const parts = cwd.split(/[\\/]+/).filter(Boolean);
    return parts.at(-1) || cwd;
  };

  const formatSessionAge = (updatedAt?: number) => {
    if (!updatedAt || !currentTimeMs) return "";
    const updatedAtMs = updatedAt < 1_000_000_000_000 ? updatedAt * 1000 : updatedAt;
    const elapsedMs = Math.max(0, currentTimeMs - updatedAtMs);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (elapsedMs < minute) return "刚刚";
    if (elapsedMs < hour) return `${Math.floor(elapsedMs / minute)}分钟`;
    if (elapsedMs < day) return `${Math.floor(elapsedMs / hour)}小时`;
    return `${Math.floor(elapsedMs / day)}天`;
  };

  const sessionList = useMemo(() => {
    const list = Object.values(showArchived ? archivedSessions : sessions);
    list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return list;
  }, [archivedSessions, sessions, showArchived]);

  useEffect(() => {
    if (showArchived) onRefreshArchivedSessions();
  }, [onRefreshArchivedSessions, showArchived]);

  useEffect(() => {
    const previousStatuses = previousSessionStatusRef.current;
    const nextStatuses: Record<string, string | undefined> = {};
    const runningSessionIds = new Set<string>();
    const finishedUnreadSessions: Record<string, SidebarUnreadSessionStatus> = {};

    for (const session of Object.values(sessions)) {
      const previousStatus = previousStatuses[session.id];
      nextStatuses[session.id] = session.status;
      if (session.status === "running") runningSessionIds.add(session.id);
      if (
        previousStatus === "running"
        && (session.status === "completed" || session.status === "error")
        && session.id !== activeSessionId
      ) {
        finishedUnreadSessions[session.id] = session.status;
      }
    }

    previousSessionStatusRef.current = nextStatuses;
    if (runningSessionIds.size === 0 && Object.keys(finishedUnreadSessions).length === 0) return;

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
        if (next[sessionId]) delete ensureNext()[sessionId];
      }
      for (const [sessionId, status] of Object.entries(finishedUnreadSessions)) {
        if (next[sessionId] !== status) ensureNext()[sessionId] = status;
      }
      return changed ? next : current;
    });
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (!activeSessionId) return;
    setUnreadSessionIds((current) => {
      if (!current[activeSessionId]) return current;
      const next = { ...current };
      delete next[activeSessionId];
      return next;
    });
  }, [activeSessionId]);

  const workspaceGroups = useMemo(() => {
    const groups = new Map<string, SidebarWorkspaceGroup>();
    for (const session of sessionList) {
      const key = normalizeWorkspacePath(session.cwd ?? "") || "__no_workspace__";
      const existing = groups.get(key);
      if (existing) {
        existing.sessions.push(session);
        continue;
      }
      groups.set(key, { key, cwd: session.cwd, sessions: [session] });
    }

    return Array.from(groups.values())
      .sort((a, b) => {
        const aLatest = Math.max(...a.sessions.map((session) => session.updatedAt ?? 0));
        const bLatest = Math.max(...b.sessions.map((session) => session.updatedAt ?? 0));
        return bLatest - aLatest;
      });
  }, [sessionList]);

  const toggleWorkspaceGroup = (groupKey: string) => {
    setExpandedGroups((current) => {
      const next = { ...current, [groupKey]: !current[groupKey] };
      writeExpandedWorkspaceGroupsToStorage(next);
      return next;
    });
  };

  const openSettings = (pageId?: SettingsPageId) => {
    if (onOpenSettings) {
      onOpenSettings(pageId);
      return;
    }
    useAppStore.getState().setShowSettingsModal(true);
  };

  const showWorkspaceHoverCard = (group: SidebarWorkspaceGroup, anchor: HTMLElement) => {
    const cardWidth = 340;
    const cardHeight = 104;
    const rect = anchor.getBoundingClientRect();
    const maxLeft = window.innerWidth - cardWidth - 12;
    const maxTop = window.innerHeight - cardHeight - 12;
    setWorkspaceHoverCard({
      name: formatWorkspaceName(group.cwd),
      cwd: group.cwd || "未指定目录",
      sessionCount: group.sessions.length,
      left: Math.max(12, Math.min(rect.right + 10, maxLeft)),
      top: Math.max(12, Math.min(rect.top - 4, maxTop)),
    });
  };

  const addLinkedWorkspace = (groupKey: string, primaryCwd: string | undefined, path: string) => {
    const normalizedGroupKey = normalizeWorkspacePath(groupKey);
    const normalizedPath = normalizeWorkspacePath(path);
    const normalizedPrimary = normalizeWorkspacePath(primaryCwd ?? "");
    if (!normalizedGroupKey || !normalizedPath || (normalizedPrimary && normalizedPath === normalizedPrimary)) return;

    setLinkedWorkspacesByGroup((current) => {
      const currentItems = current[normalizedGroupKey] ?? [];
      if (currentItems.includes(normalizedPath)) return current;
      return { ...current, [normalizedGroupKey]: [...currentItems, normalizedPath] };
    });
    setRecentCwds((current) => [normalizedPath, ...current.filter((item) => item !== normalizedPath)].slice(0, 20));
  };

  const removeLinkedWorkspace = (groupKey: string, path: string) => {
    const normalizedGroupKey = normalizeWorkspacePath(groupKey);
    const normalizedPath = normalizeWorkspacePath(path);
    if (!normalizedGroupKey || !normalizedPath) return;
    setLinkedWorkspacesByGroup((current) => {
      const items = current[normalizedGroupKey] ?? [];
      const nextItems = items.filter((item) => item !== normalizedPath);
      if (nextItems.length === items.length) return current;
      if (nextItems.length === 0) {
        const next = { ...current };
        delete next[normalizedGroupKey];
        return next;
      }
      return { ...current, [normalizedGroupKey]: nextItems };
    });
  };

  const openWorkspaceLinkDialog = (group: SidebarWorkspaceGroup) => {
    setWorkspaceLinkDialog({ key: group.key, name: formatWorkspaceName(group.cwd), cwd: group.cwd });
    window.electron.getRecentCwds(20)
      .then((items) => {
        setRecentCwds(Array.isArray(items)
          ? items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : []);
      })
      .catch(() => {
        // Keep the previous recent list if refresh failed.
      });
  };

  const pickLinkedWorkspace = async () => {
    if (!workspaceLinkDialog) return;
    const result = await window.electron.selectDirectory();
    const path = result?.trim();
    if (path) addLinkedWorkspace(workspaceLinkDialog.key, workspaceLinkDialog.cwd, path);
  };

  const linkedWorkspacePaths = workspaceLinkDialog
    ? (linkedWorkspacesByGroup[workspaceLinkDialog.key] ?? [])
    : [];
  const suggestedWorkspacePaths = workspaceLinkDialog
    ? recentCwds
      .map((item) => normalizeWorkspacePath(item))
      .filter(Boolean)
      .filter((item) => item !== normalizeWorkspacePath(workspaceLinkDialog.cwd ?? ""))
      .filter((item) => !linkedWorkspacePaths.includes(item))
      .slice(0, 8)
    : [];

  return (
    <>
      <aside
        data-session-sidebar
        className={`fixed bottom-0 left-0 ${sidebarHeaderOffsetClass} flex min-w-[250px] flex-col gap-2 border-r border-black/8 bg-[#f3f3f3] px-2 pb-2 pt-2 shadow-[inset_-1px_0_0_rgba(255,255,255,0.7)]`}
        style={{ width }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex gap-1.5">
            <button
              data-session-sidebar-new
              className="flex-1 rounded-lg border border-black/6 bg-white/75 px-3 py-1.5 text-sm font-medium text-ink-800 transition-colors hover:border-black/10 hover:bg-white"
              onClick={() => onNewSession()}
            >
              + 新建工作区
            </button>
            <button
              data-session-sidebar-archive
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${showArchived ? "border-accent/20 bg-accent/10 text-accent" : "border-black/6 bg-white/65 text-ink-600 hover:bg-white"}`}
              onClick={() => setShowArchived((current) => !current)}
            >
              归档
            </button>
            <button
              type="button"
              data-session-sidebar-search
              className="rounded-lg border border-black/6 bg-white/65 p-2 text-ink-600 transition-colors hover:bg-white hover:text-ink-800"
              onClick={() => setSessionSearchOpen(true)}
              aria-label="搜索会话"
              title="搜索会话"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4.25 4.25" />
              </svg>
            </button>
          </div>

          <SidebarWorkspaceList
            workspaceGroups={workspaceGroups}
            expandedGroups={expandedGroups}
            linkedWorkspacesByGroup={linkedWorkspacesByGroup}
            activeSessionId={activeSessionId}
            unreadSessionIds={unreadSessionIds}
            showArchived={showArchived}
            formatWorkspaceName={formatWorkspaceName}
            formatSessionAge={formatSessionAge}
            onToggleWorkspaceGroup={toggleWorkspaceGroup}
            onShowWorkspaceHoverCard={showWorkspaceHoverCard}
            onHideWorkspaceHoverCard={() => setWorkspaceHoverCard(null)}
            onNewSession={onNewSession}
            onOpenWorkspaceLinkDialog={openWorkspaceLinkDialog}
            onDeleteWorkspace={onDeleteWorkspace}
            onSelectSession={setActiveSessionId}
            onRenameSession={(sessionId, title) => setRenameDialog({ sessionId, initialTitle: title })}
            onArchiveSession={onArchiveSession}
            onUnarchiveSession={onUnarchiveSession}
            onDeleteSession={onDeleteSession}
            onOpenResumeDialog={setResumeSessionId}
          />

          <div className="mt-auto space-y-1">
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-[#e2e2e2] hover:text-ink-950"
              onClick={() => onOpenCronPage?.()}
              aria-label="定时任务"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="min-w-0 truncate">定时任务</span>
            </button>
            {wooAuthState.status === "anonymous" && (
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-[#e2e2e2] hover:text-ink-950"
                onClick={() => openSettings()}
                aria-label="设置"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span className="min-w-0 truncate">设置</span>
                {hasUpdate && <span className="h-2 w-2 shrink-0 rounded-full bg-error" />}
              </button>
            )}
            <div className="relative">
              <WooAuthDialog
                open={wooAuthDialogOpen}
                onOpenChange={setWooAuthDialogOpen}
                onStateChange={handleWooAuthStateChange}
                onOpenSettings={() => openSettings("global-json")}
              />
              <button
                type="button"
                data-woo-auth-trigger
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[#e2e2e2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                onClick={() => void handleWooAuthTriggerClick()}
                aria-label={wooAuthState.status === "authenticated" ? "Woo 账号" : "登录 Woo 账号"}
                aria-haspopup="dialog"
                aria-expanded={wooAuthDialogOpen}
              >
                <WooAvatar key={wooAuthState.user?.avatarUrl ?? "anonymous"} user={wooAuthState.user} size="menu" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">
                  {wooAuthState.status === "authenticated"
                    ? (wooAuthState.user?.realName || wooAuthState.user?.userHandle || "Woo 用户")
                    : "登录 Woo 账号"}
                </span>
                <Help theme="outline" size={20} fill="currentColor" strokeWidth={2.2} className="shrink-0 text-ink-400" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <SidebarSessionSearchDialog
          open={sessionSearchOpen}
          sessions={sessionList}
          formatWorkspaceName={formatWorkspaceName}
          onOpenChange={setSessionSearchOpen}
          onSelectSession={setActiveSessionId}
        />
        <SidebarRenameDialog
          dialog={renameDialog}
          onOpenChange={(open) => {
            if (!open) setRenameDialog(null);
          }}
          onRenameSession={onRenameSession}
        />
        <SidebarResumeDialog
          sessionId={resumeSessionId}
          onOpenChange={(open) => {
            if (!open) setResumeSessionId(null);
          }}
        />
        <WorkspaceLinkDialog
          dialog={workspaceLinkDialog}
          linkedWorkspacePaths={linkedWorkspacePaths}
          suggestedWorkspacePaths={suggestedWorkspacePaths}
          onOpenChange={(open) => {
            if (!open) setWorkspaceLinkDialog(null);
          }}
          onRemoveLinkedWorkspace={(path) => {
            if (workspaceLinkDialog) removeLinkedWorkspace(workspaceLinkDialog.key, path);
          }}
          onAddLinkedWorkspace={(path) => {
            if (workspaceLinkDialog) addLinkedWorkspace(workspaceLinkDialog.key, workspaceLinkDialog.cwd, path);
          }}
          onPickLinkedWorkspace={() => { void pickLinkedWorkspace(); }}
        />
      </aside>
      {workspaceHoverCard && (
        <div
          className="pointer-events-none fixed z-[80] w-[min(340px,calc(100vw-24px))] rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-ink-800 shadow-[0_18px_44px_rgba(15,23,42,0.16)]"
          style={{ left: workspaceHoverCard.left, top: workspaceHoverCard.top }}
        >
          <div className="truncate font-semibold">{workspaceHoverCard.name}</div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 5h6l2 2h8v12H4z" />
            </svg>
            <span className="min-w-0 truncate">{workspaceHoverCard.cwd}</span>
          </div>
          <div className="mt-1.5 text-xs text-muted">{workspaceHoverCard.sessionCount} 个会话</div>
        </div>
      )}
    </>
  );
}
