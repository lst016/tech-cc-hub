import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { useAppStore } from "../store/useAppStore";

interface SidebarProps {
  connected: boolean;
  onNewSession: (cwd?: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function Sidebar({
  connected,
  onNewSession,
  onDeleteSession
}: SidebarProps) {
  const sessions = useAppStore((state) => state.sessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const setActiveSessionId = useAppStore((state) => state.setActiveSessionId);
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const closeTimerRef = useRef<number | null>(null);

  const formatCwd = (cwd?: string) => {
    if (!cwd) return "工作目录不可用";
    const parts = cwd.split(/[\\/]+/).filter(Boolean);
    const tail = parts.slice(-2).join("/");
    return `/${tail || cwd}`;
  };

  const formatWorkspaceName = (cwd?: string) => {
    if (!cwd) return "未绑定工作区";
    const parts = cwd.split(/[\\/]+/).filter(Boolean);
    return parts.at(-1) || cwd;
  };

  const sessionList = useMemo(() => {
    const list = Object.values(sessions);
    list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return list;
  }, [sessions]);

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

  return (
    <aside className="fixed inset-y-0 left-0 flex h-full w-[320px] flex-col gap-4 border-r border-black/6 bg-[linear-gradient(180deg,rgba(248,249,252,0.96),rgba(238,241,246,0.94))] px-4 pb-4 pt-12 shadow-[inset_-1px_0_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
      <div 
        className="absolute top-0 left-0 right-0 h-12"
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      />
      <div className="flex flex-col gap-4 min-h-0 flex-1">
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-2xl border border-black/6 bg-white/82 px-4 py-3 text-sm font-medium text-ink-800 shadow-[0_8px_24px_rgba(30,38,52,0.08)] transition-all hover:-translate-y-[1px] hover:border-black/10 hover:bg-white"
            onClick={() => onNewSession()}
          >
            + 新建聊天
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="mb-3 px-1 text-[11px] font-semibold tracking-[0.22em] text-muted">工作区</div>

          {workspaceGroups.length === 0 && (
            <div className="rounded-3xl border border-black/6 bg-white/72 px-4 py-5 text-center text-xs leading-6 text-muted shadow-[0_14px_34px_rgba(30,38,52,0.06)]">
              还没有会话。直接在底部聊天框输入即可开始；系统会自动按工作区归档到左侧。
            </div>
          )}

          <div className="flex flex-col gap-3">
            {workspaceGroups.map((group) => (
              <div key={group.key} className="rounded-[26px] border border-black/6 bg-white/72 px-3 py-3 shadow-[0_14px_34px_rgba(30,38,52,0.06)] backdrop-blur">
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
                    aria-label={`在 ${formatWorkspaceName(group.cwd)} 中新增会话`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </div>

                <div className={`mt-3 flex flex-col gap-2 ${expandedGroups[group.key] ? "" : "hidden"}`}>
                  {group.sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`cursor-pointer rounded-2xl border px-3 py-3 text-left transition-all ${activeSessionId === session.id ? "border-accent/28 bg-[linear-gradient(180deg,rgba(253,244,241,1),rgba(255,255,255,0.92))] shadow-[0_10px_24px_rgba(210,106,61,0.10)]" : "border-black/6 bg-[#f7f9fc] hover:-translate-y-[1px] hover:bg-white"}`}
                      onClick={() => setActiveSessionId(session.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveSessionId(session.id); } }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className={`truncate text-[13px] font-medium ${session.status === "running" ? "text-info" : session.status === "completed" ? "text-success" : session.status === "error" ? "text-error" : "text-ink-800"}`}>
                            {session.title}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted">
                            <span className="truncate">{formatCwd(session.cwd)}</span>
                            <span className="shrink-0">
                              {session.status === "running" ? "执行中" : session.status === "completed" ? "已完成" : session.status === "error" ? "出错" : "待命"}
                            </span>
                          </div>
                        </div>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button className="flex-shrink-0 rounded-full p-1.5 text-ink-500 hover:bg-black/5" aria-label="打开会话菜单" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                <circle cx="5" cy="12" r="1.7" />
                                <circle cx="12" cy="12" r="1.7" />
                                <circle cx="19" cy="12" r="1.7" />
                              </svg>
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content className="z-50 min-w-[220px] rounded-xl border border-ink-900/10 bg-white p-1 shadow-lg" align="center" sideOffset={8}>
                              <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-ink-900/5" onSelect={() => onDeleteSession(session.id)}>
                                <svg viewBox="0 0 24 24" className="h-4 w-4 text-error/80" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12" />
                                </svg>
                                删除这个会话
                              </DropdownMenu.Item>
                              <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-ink-900/5" onSelect={() => setResumeSessionId(session.id)}>
                                <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path d="M4 5h16v14H4z" /><path d="M7 9h10M7 12h6" /><path d="M13 15l3 2-3 2" />
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
          <div className="rounded-2xl border border-black/6 bg-white/72 px-3 py-3 text-xs leading-6 text-muted shadow-[0_12px_28px_rgba(30,38,52,0.06)]">
            {connected ? "客户端已连接，默认直接走 Electron 会话。" : "客户端暂未连接，稍后会自动重试。"}
          </div>
          <button
            className="flex w-full items-center justify-between rounded-2xl border border-black/6 bg-white/82 px-4 py-3 text-sm font-medium text-ink-800 shadow-[0_10px_28px_rgba(30,38,52,0.06)] transition-all hover:-translate-y-[1px] hover:bg-white hover:border-black/10"
            onClick={() => useAppStore.getState().setShowSettingsModal(true)}
            aria-label="设置"
          >
            <span>设置</span>
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
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l4 4L19 6" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </aside>
  );
}
