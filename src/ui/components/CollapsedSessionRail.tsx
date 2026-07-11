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
  unreadSessionIds: Record<string, UnreadSessionStatus>;
  topClassName: string;
  onPreviewSession: (sessionId: string) => void;
  onClearUnreadSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
}

export type UnreadSessionStatus = "completed" | "error";

interface PreviewState {
  sessionId: string;
  anchor: { right: number; top: number };
  position: { left: number; top: number };
}

const PREVIEW_CLOSE_DELAY_MS = 140;
const PREVIEW_ESTIMATED_HEIGHT = 132;
const INACTIVE_MARK_WIDTH_CLASSES = ["w-4", "w-6", "w-8"] as const;

export function CollapsedSessionRail({
  sessions,
  activeSessionId,
  partialMessagesBySessionId,
  unreadSessionIds,
  topClassName,
  onPreviewSession,
  onClearUnreadSession,
  onSelectSession,
}: CollapsedSessionRailProps) {
  const railSessions = useMemo(() => selectCollapsedRailSessions(sessions), [sessions]);
  const previewSessionIdRef = useRef<string | null>(null);
  const previewAnchorRef = useRef<{ right: number; top: number } | null>(null);
  const previewCardRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const hoveredTriggerSessionIdRef = useRef<string | null>(null);
  const focusedTriggerSessionIdRef = useRef<string | null>(null);
  const hoveredCardSessionIdRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const cancelPreviewClose = useCallback(() => {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const closePreview = useCallback(() => {
    cancelPreviewClose();
    hoveredCardSessionIdRef.current = null;
    previewSessionIdRef.current = null;
    previewAnchorRef.current = null;
    setPreview(null);
  }, [cancelPreviewClose]);

  const canClosePreview = useCallback((sessionId: string) => (
    previewSessionIdRef.current === sessionId &&
    hoveredTriggerSessionIdRef.current !== sessionId &&
    focusedTriggerSessionIdRef.current !== sessionId &&
    hoveredCardSessionIdRef.current !== sessionId
  ), []);

  const schedulePreviewClose = useCallback((sessionId: string) => {
    cancelPreviewClose();
    if (previewSessionIdRef.current !== sessionId) return;
    if (!canClosePreview(sessionId)) return;
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      if (previewSessionIdRef.current !== sessionId) return;
      if (!canClosePreview(sessionId)) return;
      closePreview();
    }, PREVIEW_CLOSE_DELAY_MS);
  }, [cancelPreviewClose, canClosePreview, closePreview]);

  const openPreview = useCallback((session: SessionView, trigger: HTMLButtonElement) => {
    cancelPreviewClose();
    const anchorRect = trigger.getBoundingClientRect();
    const anchor = {
      right: Math.max(anchorRect.right, COLLAPSED_SESSION_RAIL_WIDTH),
      top: anchorRect.top,
    };
    previewAnchorRef.current = anchor;
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
    closePreview();
    onClearUnreadSession(sessionId);
    onSelectSession(sessionId);
  }, [closePreview, onClearUnreadSession, onSelectSession]);

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

  const clampPreviewCard = useCallback(() => {
    const card = previewCardRef.current;
    const anchor = previewAnchorRef.current;
    if (!card || !anchor) return;
    const nextPosition = clampSessionPreviewPosition(
      anchor,
      { width: window.innerWidth, height: window.innerHeight },
      card.offsetWidth,
      card.offsetHeight,
    );
    card.style.left = `${nextPosition.left}px`;
    card.style.top = `${nextPosition.top}px`;
  }, []);

  useLayoutEffect(() => {
    const card = previewCardRef.current;
    if (!preview || !card) return;
    clampPreviewCard();
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(clampPreviewCard);
    resizeObserver?.observe(card);
    window.addEventListener("resize", clampPreviewCard);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", clampPreviewCard);
    };
  }, [clampPreviewCard, preview]);

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
        className={`fixed bottom-0 left-0 z-30 border-r border-black/8 bg-white/95 ${topClassName}`}
        style={{ width: COLLAPSED_SESSION_RAIL_WIDTH }}
      >
        <div className="flex h-full flex-col items-stretch gap-1.5 overflow-y-auto py-3">
          {railSessions.map((session, index) => {
            const isActive = session.id === activeSessionId;
            const isPreviewOpen = session.id === preview?.sessionId;
            const isRunning = session.status === "running";
            const unreadStatus = unreadSessionIds[session.id];
            const inactiveMarkWidthClass = INACTIVE_MARK_WIDTH_CLASSES[index % INACTIVE_MARK_WIDTH_CLASSES.length];
            const sessionPreviewCardId = `collapsed-session-preview-${session.id}`;
            return (
              <button
                key={session.id}
                type="button"
                aria-label={`打开会话：${session.title}`}
                aria-current={isActive ? "page" : undefined}
                aria-expanded={isPreviewOpen}
                aria-controls={isPreviewOpen ? sessionPreviewCardId : undefined}
                className="group relative flex h-9 w-full items-center justify-start pl-4 pr-1 shrink-0 rounded-xl outline-none transition hover:bg-black/[0.035] focus-visible:ring-2 focus-visible:ring-ink-400/35"
                onPointerEnter={(event) => {
                  hoveredTriggerSessionIdRef.current = session.id;
                  cancelPreviewClose();
                  openPreview(session, event.currentTarget);
                }}
                onPointerLeave={() => {
                  if (hoveredTriggerSessionIdRef.current === session.id) {
                    hoveredTriggerSessionIdRef.current = null;
                  }
                  schedulePreviewClose(session.id);
                }}
                onFocus={(event) => {
                  focusedTriggerSessionIdRef.current = session.id;
                  cancelPreviewClose();
                  openPreview(session, event.currentTarget);
                }}
                onBlur={() => {
                  if (focusedTriggerSessionIdRef.current === session.id) {
                    focusedTriggerSessionIdRef.current = null;
                  }
                  schedulePreviewClose(session.id);
                }}
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
                      ? "h-1 w-10 bg-ink-900"
                      : unreadStatus === "error"
                        ? `h-1 ${inactiveMarkWidthClass} bg-error`
                        : unreadStatus === "completed"
                          ? `h-1 ${inactiveMarkWidthClass} bg-accent`
                          : isRunning
                            ? `h-1 ${inactiveMarkWidthClass} animate-pulse bg-emerald-500`
                            : `h-1 ${inactiveMarkWidthClass} bg-black/20 group-hover:bg-black/40`
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
          className="fixed z-[70] w-[min(480px,calc(100vw-88px))] rounded-[20px] border border-black/10 bg-white px-3 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.14)]"
          style={{ left: preview?.position.left, top: preview?.position.top }}
          onPointerEnter={() => {
            hoveredCardSessionIdRef.current = previewSession.id;
            cancelPreviewClose();
          }}
          onPointerLeave={() => {
            if (hoveredCardSessionIdRef.current === previewSession.id) {
              hoveredCardSessionIdRef.current = null;
            }
            schedulePreviewClose(previewSession.id);
          }}
        >
          <div id={previewTitleId} className="truncate text-xl leading-6 font-bold text-ink-900">
            {previewSession.title}
          </div>
          <p className="mt-2 line-clamp-3 text-xl leading-[30px] text-muted">
            {previewSummary}
          </p>
        </div>,
        document.body,
      )}
    </>
  );
}
