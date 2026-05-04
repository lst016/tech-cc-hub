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
  onOpenCronPage?: () => void;
  onOpenTaskPanel?: () => void;
  width?: number;
}

export function Sidebar({
  connected: _connected,
  onNewSession,
  onArchiveSession,
  onUnarchiveSession,
  onRefreshArchivedSessions,
  onDeleteSession,
  onDeleteWorkspace,
  onOpenSettings,
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
    setExpandedGroups((current) => {
      const next: Record<string, boolean> = {};
      for (const group of workspaceGroups) {
        next[group.key] = current[group.key] ?? true;
      }
      return next;
    });
  }, [workspaceGroups]);

  useEffect(() => {
    setCopied(false);
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

  return (
    <aside
      className={`fixed bottom-0 left-0 ${sidebarHeaderOffsetClass} flex min-w-[250px] flex-col gap-4 border-r border-black/6 bg-[linear-gradient(180deg,rgba(248,249,252,0.96),rgba(238,241,246,0.94))] px-4 pb-4 pt-4 shadow-[inset_-1px_0_0_rgba(255,255,255,0.75)] backdrop-blur-xl`}
      style={{ width }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-2xl border border-black/6 bg-white/82 px-4 py-3 text-sm font-medium text-ink-800 shadow-[0_8px_24px_rgba(30,38,52,0.08)] transition-all hover:-translate-y-[1px] hover:border-black/10 hover:bg-white"
            onClick={() => onNewSession()}
          >
            + 新建会话
          </button>
          <button
            className={`rounded-2xl border px-3 py-3 text-xs font-semibold shadow-[0_8px_24px_rgba(30,38,52,0.08)] transition-all hover:-translate-y-[1px] ${showArchived ? "border-accent/25 bg-accent-subtle text-accent" : "border-black/6 bg-white/82 text-ink-700 hover:bg-white"}`}
            onClick={() => setShowArchived((current) => !current)}
          >
            归档
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {workspaceGroups.length === 0 && (
            <div className="rounded-3xl border border-black/6 bg-white/72 px-4 py-5 text-center text-xs leading-6 text-muted shadow-[0_14px_34px_rgba(30,38,52,0.06)]">
              还没有会话。直接在底部输入框开始聊天，系统会按工作区自动归档到左侧。
            </div>
          )}

          <div className="flex flex-col gap-3">
            {workspaceGroups.map((group) => (
              <div
                key={group.key}
                className="rounded-[26px] border border-black/6 bg-white/72 px-3 py-3 shadow-[0_14px_34px_rgba(30,38,52,0.06)] backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setExpandedGroups((current) => ({
                      ...current,
                      [group.key]: !current[group.key],
                    }))}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-10Z" />
                      </svg>
                      <span className="truncate">{formatWorkspaceName(group.cwd)}</span>
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 shrink-0 text-muted transition-transform ${expandedGroups[group.key] ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </div>
                    <div className="mt-1 truncate text-[11px] text-muted">{group.cwd || "未指定目录"}</div>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-black/6 bg-white/82 p-2 text-ink-600 transition-colors hover:bg-white hover:text-ink-800"
                    onClick={() => onNewSession(group.cwd)}
                    aria-label={`在 ${formatWorkspaceName(group.cwd)} 中新建会话`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-black/6 bg-white/82 p-2 text-ink-600 transition-colors hover:bg-white hover:text-error"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteWorkspace(
                        group.sessions.map((session) => session.id),
                        formatWorkspaceName(group.cwd),
                      );
                    }}
                    aria-label={`删除工作区 ${formatWorkspaceName(group.cwd)}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 7h16" />
                      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      <path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12" />
                    </svg>
                  </button>
                </div>

                    <div className={`mt-3 flex flex-col gap-1.5 ${expandedGroups[group.key] ? "" : "hidden"}`}>
                  {group.sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`cursor-pointer rounded-xl border px-2.5 py-1.5 text-left transition-all ${activeSessionId === session.id ? "border-accent/28 bg-[linear-gradient(180deg,rgba(253,244,241,1),rgba(255,255,255,0.92))] shadow-[0_8px_20px_rgba(210,106,61,0.10)]" : "border-black/6 bg-[#f7f9fc] hover:-translate-y-[1px] hover:bg-white"}`}
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
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink-800">
                          {session.title}
                        </div>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              className="flex-shrink-0 rounded-full p-1.5 text-ink-500 hover:bg-black/5"
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
                                onSelect={() => setResumeSessionId(session.id)}
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
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto space-y-2">
          <button
            className="flex w-full items-center justify-between rounded-2xl border border-black/6 bg-white/82 px-4 py-3 text-sm font-medium text-ink-800 shadow-[0_10px_28px_rgba(30,38,52,0.06)] transition-all hover:-translate-y-[1px] hover:border-black/10 hover:bg-white"
            onClick={() => onOpenTaskPanel?.()}
            aria-label="任务面板"
          >
            <span>任务面板</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M9 3v18" />
              <path d="M3 9h6" />
              <path d="M3 15h6" />
              <path d="M15 8l3 3-3 3" />
              <path d="M12 11h6" />
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
      <Dialog.Root open={!!resumeSessionId} onOpenChange={(open) => !open && setResumeSessionId(null)}>
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
  );
}
