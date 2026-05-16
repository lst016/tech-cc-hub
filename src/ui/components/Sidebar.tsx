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
  const [workspaceHoverCard, setWorkspaceHoverCard] = useState<{
    name: string;
    cwd: string;
    sessionCount: number;
    left: number;
    top: number;
  } | null>(null);

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

  const formatSessionAge = (updatedAt?: number) => {
    if (!updatedAt) return "";
    const updatedAtMs = updatedAt < 1_000_000_000_000 ? updatedAt * 1000 : updatedAt;
    const elapsedMs = Math.max(0, Date.now() - updatedAtMs);
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
          delete ensureNext()[sessionId];
        }
      }

      for (const [sessionId, status] of Object.entries(finishedUnreadSessions)) {
        if (next[sessionId] !== status) {
          ensureNext()[sessionId] = status;
        }
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
    const groups = new Map<string, { cwd?: string; sessions: typeof sessionList }>();
    for (const session of sessionList) {
      const key = session.cwd?.trim() || "__no_workspace__";
      const existing = groups.get(key);
      if (existing) {
        existing.sessions.push(session);
        continue;
      }
      groups.set(key, {
        cwd: session.cwd,
        sessions: [sessionList.find((item) => item.id === session.id)!],
      });
    }

    return Array.from(groups.entries())
      .map(([key, value]) => ({ key, cwd: value.cwd, sessions: value.sessions }))
      .sort((a, b) => {
        const aLatest = Math.max(...a.sessions.map((session) => session.updatedAt ?? 0));
        const bLatest = Math.max(...b.sessions.map((session) => session.updatedAt ?? 0));
        return bLatest - aLatest;
      });
  }, [sessionList]);

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, [resumeSessionId]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  const handleCopyCommand = async () => {
    if (!resumeSessionId) return;
    const command = `claude --resume ${resumeSessionId}`;
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      return;
    }
    setCopied(true);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setResumeSessionId(null);
    }, 3000);
  };

  const openSettings = (pageId?: SettingsPageId) => {
    if (onOpenSettings) {
      onOpenSettings(pageId);
      return;
    }
    useAppStore.getState().setShowSettingsModal(true);
  };

  const showWorkspaceHoverCard = (group: (typeof workspaceGroups)[number], anchor: HTMLElement) => {
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

  return (
    <>
      <aside
        className={`fixed bottom-0 left-0 ${sidebarHeaderOffsetClass} flex min-w-[250px] flex-col gap-3 border-r border-black/6 bg-[linear-gradient(180deg,rgba(248,249,252,0.96),rgba(238,241,246,0.94))] px-2 pb-3 pt-3 shadow-[inset_-1px_0_0_rgba(255,255,255,0.75)] backdrop-blur-xl`}
        style={{ width }}
      >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-xl border border-black/6 bg-white/82 px-3 py-2 text-sm font-medium text-ink-800 shadow-[0_8px_18px_rgba(30,38,52,0.06)] transition-all hover:-translate-y-[1px] hover:border-black/10 hover:bg-white"
            onClick={() => onNewSession()}
          >
            + 新建会话
          </button>
          <button
            className={`rounded-xl border px-3 py-2 text-xs font-semibold shadow-[0_8px_18px_rgba(30,38,52,0.06)] transition-all hover:-translate-y-[1px] ${showArchived ? "border-accent/25 bg-accent-subtle text-accent" : "border-black/6 bg-white/82 text-ink-700 hover:bg-white"}`}
            onClick={() => setShowArchived((current) => !current)}
          >
            归档
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {workspaceGroups.length === 0 && (
            <div className="rounded-3xl border border-black/6 bg-white/72 px-4 py-5 text-center text-xs leading-6 text-muted shadow-[0_14px_34px_rgba(30,38,52,0.06)]">
              还没有会话。直接在底部输入框开始聊天，系统会按工作区自动归档到左侧。
            </div>
          )}

          <div className="flex flex-col gap-1">
            {workspaceGroups.map((group) => (
              <div
                key={group.key}
                className="py-0.5"
              >
                <div
                  className="group/workspace flex items-center justify-between gap-1.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/80"
                  onMouseEnter={(event) => showWorkspaceHoverCard(group, event.currentTarget)}
                  onMouseLeave={() => setWorkspaceHoverCard(null)}
                  onFocus={(event) => showWorkspaceHoverCard(group, event.currentTarget)}
                  onBlur={() => setWorkspaceHoverCard(null)}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setExpandedGroups((current) => ({
                      ...current,
                      [group.key]: !current[group.key],
                    }))}
                  >
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-10Z" />
                      </svg>
                      <span className="truncate">{formatWorkspaceName(group.cwd)}</span>
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${expandedGroups[group.key] ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded-md p-1 text-ink-500 opacity-0 transition-all hover:bg-white hover:text-ink-800 group-hover/workspace:opacity-100 focus:opacity-100"
                    onClick={() => onNewSession(group.cwd)}
                    aria-label={`在 ${formatWorkspaceName(group.cwd)} 中新建会话`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded-md p-1 text-ink-500 opacity-0 transition-all hover:bg-white hover:text-error group-hover/workspace:opacity-100 focus:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteWorkspace(
                        group.sessions.map((session) => session.id),
                        formatWorkspaceName(group.cwd),
                      );
                    }}
                    aria-label={`删除工作区 ${formatWorkspaceName(group.cwd)}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 7h16" />
                      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      <path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12" />
                    </svg>
                  </button>
                </div>

                    <div className={`mt-0.5 flex flex-col gap-0.5 ${expandedGroups[group.key] ? "" : "hidden"}`}>
                  {group.sessions.map((session) => {
                    const isActiveSession = activeSessionId === session.id;
                    const isRunningSession = session.status === "running";
                    const unreadSessionStatus = unreadSessionIds[session.id];
                    const sessionAge = formatSessionAge(session.updatedAt);
                    return (
                    <div
                      key={session.id}
                      className={`group/session relative cursor-pointer overflow-hidden rounded-lg px-3 py-2 text-left transition-colors ${isActiveSession ? "bg-black/10 text-ink-900" : "text-ink-700 hover:bg-black/[0.045]"}`}
                      onClick={() => setActiveSessionId(session.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setActiveSessionId(session.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex min-h-7 items-center justify-between gap-2 pr-7">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {unreadSessionStatus ? (
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(210,106,61,0.12)] ${unreadSessionStatus === "error" ? "bg-error" : "bg-accent"}`}
                              title={unreadSessionStatus === "error" ? "执行失败，未查看" : "执行完成，未查看"}
                            />
                          ) : isRunningSession ? (
                            <span
                              className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-emerald-500/25 border-t-emerald-500"
                              title="正在聊天"
                            />
                          ) : (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-black/10" />
                          )}
                          <div className={`min-w-0 flex-1 truncate text-[13px] ${isActiveSession ? "font-semibold text-ink-900" : "font-medium text-ink-700"}`}>
                            {session.title}
                          </div>
                        </div>
                        {sessionAge && (
                          <span className="shrink-0 text-[12px] text-muted transition-opacity group-hover/session:opacity-0">
                            {sessionAge}
                          </span>
                        )}
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              className="absolute right-2 top-1/2 flex-shrink-0 -translate-y-1/2 rounded-md p-1.5 text-ink-500 opacity-0 transition-opacity hover:bg-black/5 group-hover/session:opacity-100 focus:opacity-100"
                              aria-label="打开会话菜单"
                              onClick={(event) => event.stopPropagation()}
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                <circle cx="5" cy="12" r="1.7" />
                                <circle cx="12" cy="12" r="1.7" />
                                <circle cx="19" cy="12" r="1.7" />
                              </svg>
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content className="z-50 min-w-[220px] rounded-xl border border-ink-900/10 bg-white p-1 shadow-lg" align="center" sideOffset={8}>
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-ink-900/5"
                                onSelect={() => showArchived ? onUnarchiveSession(session.id) : onArchiveSession(session.id)}
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  {showArchived ? (
                                    <path d="M4 12a8 8 0 1 0 2.34-5.66M4 4v6h6" />
                                  ) : (
                                    <path d="M4 7h16M6 7l1.2 11.2A2 2 0 0 0 9.2 20h5.6a2 2 0 0 0 2-1.8L18 7M9 7V5h6v2" />
                                  )}
                                </svg>
                                {showArchived ? "恢复这个会话" : "归档这个会话"}
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-ink-900/5"
                                onSelect={() => onDeleteSession(session.id)}
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4 text-error/80" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M4 7h16" />
                                  <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                  <path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12" />
                                </svg>
                                删除这个会话
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-ink-900/5"
                                onSelect={() => {
                                  setCopied(false);
                                  setResumeSessionId(session.id);
                                }}
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M4 5h16v14H4z" />
                                  <path d="M7 9h10M7 12h6" />
                                  <path d="M13 15l3 2-3 2" />
                                </svg>
                                在 Claude Code 中恢复
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto space-y-2">
          <button
            className="flex w-full items-center justify-between rounded-2xl border border-amber-200/70 bg-amber-50/85 px-4 py-3 text-sm font-semibold text-amber-800 shadow-[0_10px_28px_rgba(146,64,14,0.06)] transition-all hover:-translate-y-[1px] hover:border-amber-300 hover:bg-amber-50"
            onClick={() => window.electron.invoke("shell:openExternal", "https://github.com/lst016/tech-cc-hub/issues/new")}
            aria-label="需求反馈"
          >
            <span>需求反馈</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M12 8v4" />
              <circle cx="12" cy="16" r="0.5" fill="currentColor" />
            </svg>
          </button>
          <button
            className="flex w-full items-center justify-between rounded-2xl border border-black/6 bg-white/82 px-4 py-3 text-sm font-medium text-ink-800 shadow-[0_10px_28px_rgba(30,38,52,0.06)] transition-all hover:-translate-y-[1px] hover:border-black/10 hover:bg-white"
            onClick={() => onOpenKnowledgePanel?.()}
            aria-label="知识库（内测期）"
          >
            <span>知识库（内测期）</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5z" />
              <path d="M5 5.5v16" />
              <path d="M9 7h6" />
              <path d="M9 11h7" />
              <path d="M9 15h4" />
            </svg>
          </button>
          <button
            className="flex w-full items-center justify-between rounded-2xl border border-black/6 bg-white/82 px-4 py-3 text-sm font-medium text-ink-800 shadow-[0_10px_28px_rgba(30,38,52,0.06)] transition-all hover:-translate-y-[1px] hover:border-black/10 hover:bg-white"
            onClick={() => onOpenCronPage?.()}
            aria-label="定时任务"
          >
            <span>定时任务</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </button>
          <button
            className="flex w-full items-center justify-between rounded-2xl border border-black/6 bg-white/82 px-4 py-3 text-sm font-medium text-ink-800 shadow-[0_10px_28px_rgba(30,38,52,0.06)] transition-all hover:-translate-y-[1px] hover:border-black/10 hover:bg-white"
            onClick={() => openSettings()}
            aria-label="设置"
          >
            <span>设置</span>
            {hasUpdate && (
              <span className="ml-1.5 h-2 w-2 rounded-full bg-error" />
            )}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
      <Dialog.Root
        open={!!resumeSessionId}
        onOpenChange={(open) => {
          if (!open) {
            setCopied(false);
            setResumeSessionId(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <Dialog.Title className="text-lg font-semibold text-ink-800">恢复命令</Dialog.Title>
              <Dialog.Close asChild>
                <button className="rounded-full p-1 text-ink-500 hover:bg-ink-900/10" aria-label="关闭弹窗">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </Dialog.Close>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-ink-900/10 bg-surface px-3 py-2 font-mono text-xs text-ink-700">
              <span className="flex-1 break-all">{resumeSessionId ? `claude --resume ${resumeSessionId}` : ""}</span>
              <button className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-900/10" onClick={handleCopyCommand} aria-label="复制恢复命令">
                {copied ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12l4 4L19 6" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                  </svg>
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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
