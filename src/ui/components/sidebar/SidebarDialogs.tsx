import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import type { SessionView } from "../../store/useAppStore";

interface SidebarSessionSearchDialogProps {
  open: boolean;
  sessions: SessionView[];
  formatWorkspaceName: (cwd?: string) => string;
  onOpenChange: (open: boolean) => void;
  onSelectSession: (sessionId: string) => void;
}

export function SidebarSessionSearchDialog({
  open,
  sessions,
  formatWorkspaceName,
  onOpenChange,
  onSelectSession,
}: SidebarSessionSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [requestedActiveIndex, setRequestedActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return sessions.slice(0, 12);

    return sessions.filter((session) => (
      [session.title, formatWorkspaceName(session.cwd), session.cwd ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
    )).slice(0, 12);
  }, [formatWorkspaceName, query, sessions]);
  const activeIndex = Math.min(requestedActiveIndex, Math.max(0, results.length - 1));

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setRequestedActiveIndex(0);
    }
    onOpenChange(nextOpen);
  };

  const selectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    handleOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[21000] bg-ink-900/15 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed left-1/2 top-[18%] z-[21010] w-[min(600px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border border-black/8 bg-white p-2 shadow-[0_20px_50px_rgba(15,23,42,0.18)] outline-none"
          aria-describedby={undefined}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setRequestedActiveIndex(Math.min(activeIndex + 1, results.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setRequestedActiveIndex(Math.max(activeIndex - 1, 0));
            }
            if (event.key === "Enter") {
              const session = results[activeIndex];
              if (session) {
                event.preventDefault();
                selectSession(session.id);
              }
            }
          }}
        >
          <Dialog.Title className="sr-only">搜索会话</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-black/8 px-3 py-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.9">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.25 4.25" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setRequestedActiveIndex(0);
              }}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-ink-900 outline-none placeholder:text-muted"
              placeholder="搜索会话"
            />
            <kbd className="rounded bg-surface-secondary px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
          </div>
          <div className="max-h-[min(480px,calc(100vh-220px))] overflow-y-auto p-1">
            {results.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted">没有匹配的会话</div>
            ) : (
              results.map((session, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={session.id}
                    type="button"
                    className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left transition-colors ${isActive ? "bg-surface-secondary" : "hover:bg-surface-secondary"}`}
                    onMouseEnter={() => setRequestedActiveIndex(index)}
                    onClick={() => selectSession(session.id)}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${session.status === "running" ? "bg-success" : "bg-black/15"}`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{session.title}</span>
                    <span className="max-w-36 shrink-0 truncate text-xs text-muted">{formatWorkspaceName(session.cwd)}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t border-black/8 px-3 py-2 text-[11px] text-muted">
            <span>输入关键词模糊匹配会话</span>
            <span>↑↓ 选择 · Enter 打开</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export type SidebarRenameDialogState = { sessionId: string; initialTitle: string } | null;

interface SidebarRenameDialogProps {
  dialog: SidebarRenameDialogState;
  onOpenChange: (open: boolean) => void;
  onRenameSession: (sessionId: string, title: string) => void;
}

export function SidebarRenameDialog({ dialog, onOpenChange, onRenameSession }: SidebarRenameDialogProps) {
  if (!dialog) {
    return <Dialog.Root open={false} onOpenChange={onOpenChange} />;
  }

  return (
    <SidebarRenameDialogContent
      key={dialog.sessionId}
      dialog={dialog}
      onOpenChange={onOpenChange}
      onRenameSession={onRenameSession}
    />
  );
}

interface SidebarRenameDialogContentProps {
  dialog: Exclude<SidebarRenameDialogState, null>;
  onOpenChange: (open: boolean) => void;
  onRenameSession: (sessionId: string, title: string) => void;
}

function SidebarRenameDialogContent({ dialog, onOpenChange, onRenameSession }: SidebarRenameDialogContentProps) {
  const [title, setTitle] = useState(dialog.initialTitle);

  const submit = () => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      toast.error("会话标题不能为空");
      return;
    }
    if (nextTitle === dialog.initialTitle.trim()) {
      onOpenChange(false);
      return;
    }
    onRenameSession(dialog.sessionId, nextTitle);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[21000] bg-ink-900/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[21010] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-ink-800">重命名会话</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                改一个更好找的标题，方便后续继续使用这个会话。
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-full p-1 text-ink-500 hover:bg-ink-900/10" aria-label="关闭弹窗">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </button>
            </Dialog.Close>
          </div>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-light">会话标题</span>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                className="w-full rounded-xl border border-black/10 bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-accent/40 focus:bg-white focus:ring-2 focus:ring-accent/10"
                placeholder="输入新的会话标题"
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink-700 transition hover:bg-surface-tertiary"
                >
                  取消
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
              >
                保存
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface SidebarResumeDialogProps {
  sessionId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function SidebarResumeDialog({ sessionId, onOpenChange }: SidebarResumeDialogProps) {
  const [copied, setCopied] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  const close = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setCopied(false);
    onOpenChange(false);
  };

  const copyCommand = async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(`claude --resume ${sessionId}`);
    } catch {
      return;
    }
    setCopied(true);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(close, 3000);
  };

  return (
    <Dialog.Root open={Boolean(sessionId)} onOpenChange={(open) => {
      if (!open) close();
    }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[21000] bg-ink-900/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[21010] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
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
            <span className="flex-1 break-all">{sessionId ? `claude --resume ${sessionId}` : ""}</span>
            <button className="rounded-lg p-1.5 text-ink-600 hover:bg-ink-900/10" onClick={copyCommand} aria-label="复制恢复命令">
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
  );
}

export type WorkspaceLinkDialogState = { key: string; name: string; cwd?: string } | null;

interface WorkspaceLinkDialogProps {
  dialog: WorkspaceLinkDialogState;
  linkedWorkspacePaths: string[];
  suggestedWorkspacePaths: string[];
  onOpenChange: (open: boolean) => void;
  onRemoveLinkedWorkspace: (path: string) => void;
  onAddLinkedWorkspace: (path: string) => void;
  onPickLinkedWorkspace: () => void;
}

export function WorkspaceLinkDialog({
  dialog,
  linkedWorkspacePaths,
  suggestedWorkspacePaths,
  onOpenChange,
  onRemoveLinkedWorkspace,
  onAddLinkedWorkspace,
  onPickLinkedWorkspace,
}: WorkspaceLinkDialogProps) {
  return (
    <Dialog.Root open={Boolean(dialog)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[21000] bg-ink-900/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[21010] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-ink-800">关联工作区</Dialog.Title>
              <div className="mt-1 text-xs text-muted">
                主工作区：{dialog?.name || "未绑定工作区"}
              </div>
              <div className="mt-1 text-[11px] text-muted-light">
                {dialog?.cwd || "未绑定工作区路径"}
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-full p-1 text-ink-500 hover:bg-ink-900/10" aria-label="关闭弹窗">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-light">已关联</div>
              {linkedWorkspacePaths.length === 0 ? (
                <div className="rounded-xl border border-black/8 bg-surface px-3 py-3 text-sm text-muted">
                  还没有关联工作区。点击下方「选择目录」或最近目录快速添加。
                </div>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {linkedWorkspacePaths.map((path) => (
                    <div
                      key={path}
                      className="flex items-center justify-between gap-3 rounded-xl border border-black/8 bg-surface px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm text-ink-800" title={path}>{path}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-black/5 hover:text-error"
                        onClick={() => onRemoveLinkedWorkspace(path)}
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {suggestedWorkspacePaths.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-light">最近目录</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedWorkspacePaths.map((path) => (
                    <button
                      key={path}
                      type="button"
                      className="max-w-full truncate rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-ink-700 transition hover:border-accent/30 hover:bg-accent/5"
                      title={path}
                      onClick={() => onAddLinkedWorkspace(path)}
                    >
                      {path}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink-700 transition hover:bg-surface-tertiary"
              onClick={onPickLinkedWorkspace}
            >
              选择目录...
            </button>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
              >
                完成
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
