import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { SessionView } from "../../store/useAppStore";
import { getImageGenerationDisplayPromptFromSerialized } from "../prompt-input/image-generation-plugin";

export const WORKSPACE_SESSION_PREVIEW_LIMIT = 5;

export type SidebarWorkspaceGroup = {
  key: string;
  cwd?: string;
  sessions: SessionView[];
};

export type SidebarUnreadSessionStatus = "completed" | "error";

interface SidebarWorkspaceListProps {
  workspaceGroups: SidebarWorkspaceGroup[];
  expandedGroups: Record<string, boolean>;
  linkedWorkspacesByGroup: Record<string, string[]>;
  activeSessionId: string | null;
  unreadSessionIds: Record<string, SidebarUnreadSessionStatus>;
  showArchived: boolean;
  formatWorkspaceName: (cwd?: string) => string;
  formatSessionAge: (updatedAt?: number) => string;
  onToggleWorkspaceGroup: (groupKey: string) => void;
  onShowWorkspaceHoverCard: (group: SidebarWorkspaceGroup, anchor: HTMLElement) => void;
  onHideWorkspaceHoverCard: () => void;
  onNewSession: (cwd?: string) => void;
  onOpenWorkspaceLinkDialog: (group: SidebarWorkspaceGroup) => void;
  onDeleteWorkspace: (sessionIds: string[], workspaceName: string) => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onArchiveSession: (sessionId: string) => void;
  onUnarchiveSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenResumeDialog: (sessionId: string) => void;
}

export function SidebarWorkspaceList({
  workspaceGroups,
  expandedGroups,
  linkedWorkspacesByGroup,
  activeSessionId,
  unreadSessionIds,
  showArchived,
  formatWorkspaceName,
  formatSessionAge,
  onToggleWorkspaceGroup,
  onShowWorkspaceHoverCard,
  onHideWorkspaceHoverCard,
  onNewSession,
  onOpenWorkspaceLinkDialog,
  onDeleteWorkspace,
  onSelectSession,
  onRenameSession,
  onArchiveSession,
  onUnarchiveSession,
  onDeleteSession,
  onOpenResumeDialog,
}: SidebarWorkspaceListProps) {
  const [expandedSessionLists, setExpandedSessionLists] = useState<Record<string, boolean>>({});

  return (
    <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto">
      {workspaceGroups.length === 0 && (
        <div className="rounded-xl border border-black/6 bg-white/70 px-3 py-4 text-center text-xs leading-6 text-muted">
          还没有会话。直接在底部输入框开始聊天，系统会按工作区自动归档到左侧。
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {workspaceGroups.map((group) => {
          const linkedWorkspaceCount = linkedWorkspacesByGroup[group.key]?.length ?? 0;
          const workspaceGroupExpanded = Boolean(expandedGroups[group.key]);
          const sessionListExpanded = Boolean(expandedSessionLists[group.key]);
          const hasSessionOverflow = group.sessions.length > WORKSPACE_SESSION_PREVIEW_LIMIT;
          const visibleSessions = sessionListExpanded || !hasSessionOverflow
            ? group.sessions
            : group.sessions.slice(0, WORKSPACE_SESSION_PREVIEW_LIMIT);
          return (
            <div
              key={group.key}
              className="py-px"
            >
              <div
                data-session-workspace
                className="group/workspace flex items-center justify-between gap-1 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-[#e7e7e7]"
                onMouseEnter={(event) => onShowWorkspaceHoverCard(group, event.currentTarget)}
                onMouseLeave={onHideWorkspaceHoverCard}
                onFocus={(event) => onShowWorkspaceHoverCard(group, event.currentTarget)}
                onBlur={onHideWorkspaceHoverCard}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onToggleWorkspaceGroup(group.key)}
                >
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-700">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-10Z" />
                    </svg>
                    <span className="truncate">{formatWorkspaceName(group.cwd)}</span>
                    {linkedWorkspaceCount > 0 && (
                      <span
                        className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/10 px-1.5 text-[11px] font-semibold text-accent"
                        title={`已关联 ${linkedWorkspaceCount} 个工作区`}
                      >
                        {linkedWorkspaceCount}
                      </span>
                    )}
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${workspaceGroupExpanded ? "rotate-90" : ""}`}
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
                  className="shrink-0 rounded-md p-1 text-ink-500 opacity-0 transition-all hover:bg-white hover:text-ink-800 group-hover/workspace:opacity-100 focus:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenWorkspaceLinkDialog(group);
                  }}
                  aria-label={`关联工作区到 ${formatWorkspaceName(group.cwd)}`}
                  title="关联其他工作区"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9.75 8.5H7a4 4 0 1 0 0 8h2.75" />
                    <path d="M14.25 8.5H17a4 4 0 1 1 0 8h-2.75" />
                    <path d="M8.75 12h6.5" />
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

              <div className={`mt-0.5 flex flex-col gap-0.5 ${workspaceGroupExpanded ? "" : "hidden"}`}>
                {visibleSessions.map((session) => {
                  const isActiveSession = activeSessionId === session.id;
                  const isRunningSession = session.status === "running";
                  const isBackgroundSession = session.executionMode === "background";
                  const unreadSessionStatus = unreadSessionIds[session.id];
                  const sessionAge = formatSessionAge(session.updatedAt);
                  return (
                    <div
                      key={session.id}
                      data-session-item
                      data-session-active={isActiveSession ? "true" : "false"}
                      data-session-status={unreadSessionStatus ?? session.status}
                      className={`group/session relative cursor-pointer overflow-hidden rounded-lg px-2.5 py-1.5 text-left transition-colors ${isActiveSession ? "bg-[#dedede] text-ink-900" : "text-ink-700 hover:bg-[#e7e7e7]"}`}
                      onClick={() => onSelectSession(session.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectSession(session.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex min-h-7 items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {unreadSessionStatus ? (
                            <span
                              data-session-status-indicator
                              className={`h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(210,106,61,0.12)] ${unreadSessionStatus === "error" ? "bg-error" : "bg-accent"}`}
                              title={unreadSessionStatus === "error" ? "执行失败，未查看" : "执行完成，未查看"}
                            />
                          ) : isRunningSession ? (
                            <span
                              data-session-status-indicator
                              className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-emerald-500/25 border-t-emerald-500"
                              title="正在聊天"
                            />
                          ) : (
                            <span data-session-status-indicator className="h-2 w-2 shrink-0 rounded-full bg-black/10" />
                          )}
                          <div className={`min-w-0 flex-1 truncate text-[13px] ${isActiveSession ? "font-semibold text-ink-900" : "font-medium text-ink-700"}`}>
                            {getImageGenerationDisplayPromptFromSerialized(session.title)}
                          </div>
                          {isBackgroundSession && (
                            <span
                              className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-emerald-700"
                              title="Background session"
                            >
                              BG
                            </span>
                          )}
                        </div>
                        {sessionAge && (
                          <span className="pointer-events-none shrink-0 text-[12px] text-muted transition-opacity group-hover/session:opacity-0 group-focus-within/session:opacity-0">
                            {sessionAge}
                          </span>
                        )}
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              data-session-menu-trigger
                              className={`absolute right-1.5 top-1/2 z-10 flex-shrink-0 -translate-y-1/2 rounded-md bg-[var(--session-action-bg)] p-1.5 text-ink-500 opacity-0 shadow-[0_0_0_4px_var(--session-action-bg)] transition hover:brightness-95 group-hover/session:opacity-100 focus:opacity-100 ${isActiveSession ? "[--session-action-bg:#dedede]" : "[--session-action-bg:#e7e7e7]"}`}
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
                                onSelect={() => onRenameSession(session.id, session.title)}
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M4 20h4l10.5-10.5a2.12 2.12 0 1 0-3-3L5.5 17v3z" />
                                  <path d="M13.5 6.5l4 4" />
                                </svg>
                                重命名这个会话
                              </DropdownMenu.Item>
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
                                onSelect={() => onOpenResumeDialog(session.id)}
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
                {hasSessionOverflow && (
                  <button
                    type="button"
                    className="ml-8 mt-0.5 w-fit px-0 py-0.5 text-xs font-medium text-muted transition-colors hover:text-ink-800 focus:outline-none focus-visible:text-ink-800"
                    aria-expanded={sessionListExpanded}
                    aria-label={`${sessionListExpanded ? "折叠" : "展开显示"} ${formatWorkspaceName(group.cwd)} 的会话列表`}
                    onClick={() => setExpandedSessionLists((current) => ({
                      ...current,
                      [group.key]: !current[group.key],
                    }))}
                  >
                    {sessionListExpanded ? "折叠" : "展开显示"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
