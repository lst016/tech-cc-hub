import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SessionView } from "../store/useAppStore";
import {
  clampSessionPreviewPosition,
  extractLatestAssistantSummary,
  selectCollapsedRailSessions,
} from "../utils/session-rail-preview";

export const COLLAPSED_SESSION_RAIL_WIDTH = 64;

export interface CollapsedSessionRailProps {
  sessions: Record<string, SessionView>;
  activeSessionId: string | null;
  partialMessagesBySessionId: Record<string, string>;
  topClassName: string;
  onPreviewSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
}

type UnreadSessionStatus = "completed" | "error";

interface PreviewState {
  sessionId: string;
  anchor: { right: number; top: number };
  position: { left: number; top: number };
}

const PREVIEW_CLOSE_DELAY_MS = 140;
const PREVIEW_ESTIMATED_HEIGHT = 132;

function collectSessionStatuses(sessions: Record<string, SessionView>) {
  return Object.fromEntries(
    Object.values(sessions).map((session) => [session.id, session.status]),
  ) as Record<string, SessionView["status"] | undefined>;
}

export function CollapsedSessionRail({
  sessions,
  activeSessionId,
  partialMessagesBySessionId,
  topClassName,
  onPreviewSession,
  onSelectSession,
}: CollapsedSessionRailProps) {
  const railSessions = useMemo(() => selectCollapsedRailSessions(sessions), [sessions]);
  const previousSessionStatusesRef = useRef(collectSessionStatuses(sessions));
  const previewSessionIdRef = useRef<string | null>(null);
  const previewCardRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [unreadSessionIds, setUnreadSessionIds] = useState<Record<string, UnreadSessionStatus>>({});
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const cancelPreviewClose = useCallback(() => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const closePreview = useCallback(() => {
    cancelPreviewClose();
    previewSessionIdRef.current = null;
    setPreview(null);
  }, [cancelPreviewClose]);

  const schedulePreviewClose = useCallback(() => {
    cancelPreviewClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      previewSessionIdRef.current = null;
      setPreview(null);
    }, PREVIEW_CLOSE_DELAY_MS);
  }, [cancelPreviewClose]);

  const openPreview = useCallback((session: SessionView, trigger: HTMLButtonElement) => {
    cancelPreviewClose();
    const anchorRect = trigger.getBoundingClientRect();
    const anchor = { right: anchorRect.right, top: anchorRect.top };
    const cardWidth = Math.min(480, Math.max(0, window.innerWidth - 88));
    const position = clampSessionPreviewPosition(
      anchor,
      { width: window.innerWidth, height: window.innerHeight },
      cardWidth,
      PREVIEW_ESTIMATED_HEIGHT,
    );

    if (previewSessionIdRef.current !== session.id) {
      previewSessionIdRef.current = session.id;
      onPreviewSession(session.id);
    }
    setPreview({ sessionId: session.id, anchor, position });
  }, [cancelPreviewClose, onPreviewSession]);

  const selectSession = useCallback((sessionId: string) => {
    setUnreadSessionIds((current) => {
      if (!current[sessionId]) return current;
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    onSelectSession(sessionId);
  }, [onSelectSession]);

  useEffect(() => {
    const previousStatuses = previousSessionStatusesRef.current;
    const nextStatuses: Record<string, SessionView["status"] | undefined> = {};
    const finishedUnreadSessions: Record<string, UnreadSessionStatus> = {};
    const runningSessionIds = new Set<string>();

    for (const session of Object.values(sessions)) {
      const previousStatus = previousStatuses[session.id];
      nextStatuses[session.id] = session.status;
      if (session.status === "running") {
        runningSessionIds.add(session.id);
      } else if (
        previousStatus === "running" &&
        (session.status === "completed" || session.status === "error") &&
        session.id !== activeSessionId
      ) {
        finishedUnreadSessions[session.id] = session.status;
      }
    }
    previousSessionStatusesRef.current = nextStatuses;

    // Unread state is derived specifically from status transitions observed after render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnreadSessionIds((current) => {
      let next = current;
      const removeSession = (sessionId: string) => {
        if (!next[sessionId]) return;
        if (next === current) next = { ...current };
        delete next[sessionId];
      };
      for (const sessionId of runningSessionIds) removeSession(sessionId);
      if (activeSessionId) removeSession(activeSessionId);
      for (const [sessionId, status] of Object.entries(finishedUnreadSessions)) {
        if (next[sessionId] === status) continue;
        if (next === current) next = { ...current };
        next[sessionId] = status;
      }
      return next;
    });
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (!preview || railSessions.some((session) => session.id === preview.sessionId)) return;
    // A filtered or removed session must not leave a detached portal visible.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    closePreview();
  }, [closePreview, preview, railSessions]);

  useEffect(() => () => cancelPreviewClose(), [cancelPreviewClose]);

  useEffect(() => {
    if (!preview) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closePreview, preview]);

  useLayoutEffect(() => {
    if (!preview || !previewCardRef.current) return;
    const card = previewCardRef.current;
    const nextPosition = clampSessionPreviewPosition(
      preview.anchor,
      { width: window.innerWidth, height: window.innerHeight },
      card.offsetWidth,
      card.offsetHeight,
    );
    if (nextPosition.left === preview.position.left && nextPosition.top === preview.position.top) return;
    setPreview((current) => current ? { ...current, position: nextPosition } : current);
  }, [preview]);

  const previewSession = preview ? sessions[preview.sessionId] : undefined;
  const previewCardId = previewSession ? `collapsed-session-preview-${previewSession.id}` : undefined;
  const previewTitleId = previewSession ? `${previewCardId}-title` : undefined;
  const previewSummary = previewSession
    ? extractLatestAssistantSummary(
      previewSession.messages,
      partialMessagesBySessionId[previewSession.id],
    )
    : "";

  return (
    <>
      <aside
        data-collapsed-session-rail
        aria-label="最近会话"
        className={`fixed bottom-0 left-0 z-30 border-r border-black/8 bg-[#f6f7f9]/95 ${topClassName}`}
        style={{ width: COLLAPSED_SESSION_RAIL_WIDTH }}
      >
        <div className="flex h-full flex-col items-center gap-1.5 overflow-y-auto py-3">
          {railSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isPreviewOpen = session.id === preview?.sessionId;
            const isRunning = session.status === "running";
            const unreadStatus = unreadSessionIds[session.id];
            const sessionPreviewCardId = `collapsed-session-preview-${session.id}`;
            return (
              <button
                key={session.id}
                type="button"
                aria-label={`打开会话：${session.title}`}
                aria-current={isActive ? "page" : undefined}
                aria-expanded={isPreviewOpen}
                aria-controls={isPreviewOpen ? sessionPreviewCardId : undefined}
                className="group relative grid h-9 w-12 shrink-0 place-items-center rounded-xl outline-none transition hover:bg-black/[0.035] focus-visible:ring-2 focus-visible:ring-ink-400/35"
                onPointerEnter={(event) => openPreview(session, event.currentTarget)}
                onPointerLeave={schedulePreviewClose}
                onFocus={(event) => openPreview(session, event.currentTarget)}
                onBlur={schedulePreviewClose}
                onClick={() => selectSession(session.id)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    closePreview();
                  } else if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectSession(session.id);
                  }
                }}
              >
                <span
                  aria-hidden="true"
                  className={`block rounded-full transition-all ${
                    isActive
                      ? "h-7 w-1.5 bg-ink-900"
                      : unreadStatus === "error"
                        ? "h-4 w-1 bg-error"
                        : unreadStatus === "completed"
                          ? "h-4 w-1 bg-accent"
                          : isRunning
                            ? "h-5 w-1 animate-pulse bg-emerald-500"
                            : "h-4 w-1 bg-black/20 group-hover:bg-black/40"
                  }`}
                />
                {(isRunning || unreadStatus) && (
                  <span
                    aria-hidden="true"
                    className={`absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full ${
                      unreadStatus === "error"
                        ? "bg-error"
                        : unreadStatus === "completed"
                          ? "bg-accent"
                          : "animate-pulse bg-emerald-500"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {previewSession && previewCardId && previewTitleId && createPortal(
        <div
          ref={previewCardRef}
          id={previewCardId}
          data-session-preview-card
          role="region"
          aria-labelledby={previewTitleId}
          className="fixed z-[70] w-[min(480px,calc(100vw-88px))] rounded-[20px] border border-black/10 bg-white px-5 py-4 shadow-[0_20px_55px_rgba(15,23,42,0.16)]"
          style={{ left: preview?.position.left, top: preview?.position.top }}
          onPointerEnter={cancelPreviewClose}
          onPointerLeave={schedulePreviewClose}
        >
          <div id={previewTitleId} className="truncate text-sm font-bold text-ink-900">
            {previewSession.title}
          </div>
          <p className="mt-2 line-clamp-3 text-sm leading-5 text-muted">
            {previewSummary}
          </p>
        </div>,
        document.body,
      )}
    </>
  );
}
