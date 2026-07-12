import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Atom, FileCode2, ImageIcon, SquareTerminal } from "lucide-react";
import {
  advanceConversationTurnPreviewContent,
  CONVERSATION_TURN_TIMELINE_LEFT_OFFSET,
  findActiveConversationTurnIndex,
  getConversationTurnMarkWidth,
  getConversationTurnPreviewOffset,
  shouldShowConversationTurnTimeline,
  type ConversationTurn,
  type ConversationTurnPreviewContentState,
} from "../utils/conversation-turn-timeline";

export interface ConversationTurnTimelineProps {
  turns: ConversationTurn[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  contentContainerRef: RefObject<HTMLDivElement | null>;
  onSelectTurn: (originalIndex: number) => void;
}

const MAGNETIC_SPRING_EASING = "linear(0, 0.06 9%, 0.22 18%, 0.48 30%, 0.72 42%, 0.9 55%, 1.01 70%, 1.015 78%, 1.006 88%, 1)";
const MAGNETIC_SPRING_FALLBACK = "cubic-bezier(0.22, 1, 0.36, 1)";
const INITIAL_PREVIEW_CONTENT: ConversationTurnPreviewContentState = {
  currentIndex: null,
  previousIndex: null,
  version: 0,
};

function getMagneticSpringEasing(): string {
  return typeof CSS !== "undefined"
    && CSS.supports("transition-timing-function", MAGNETIC_SPRING_EASING)
    ? MAGNETIC_SPRING_EASING
    : MAGNETIC_SPRING_FALLBACK;
}

function formatTurnTime(capturedAt?: number): string {
  if (typeof capturedAt !== "number") return "";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(capturedAt);
}

function buildTurnLabel(turn: ConversationTurn): string {
  const time = formatTurnTime(turn.capturedAt);
  return [`第 ${turn.index + 1} 轮`, time, turn.summary].filter(Boolean).join(" · ");
}

function ActivityIcon({ label }: { label: string }) {
  if (/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(label)) {
    return <ImageIcon aria-hidden="true" className="size-4 shrink-0" />;
  }
  if (/\.[jt]sx$/i.test(label)) {
    return <Atom aria-hidden="true" className="size-4 shrink-0" />;
  }
  return <FileCode2 aria-hidden="true" className="size-4 shrink-0" />;
}

function PreviewTurnContent({ turn }: { turn: ConversationTurn }) {
  return (
    <>
      <div className="truncate text-[18px] font-semibold leading-7 text-ink-900">
        {turn.summary || `第 ${turn.index + 1} 轮`}
      </div>
      <p className="mt-1.5 line-clamp-3 text-[16px] leading-7 text-[#8b919a]">
        {turn.assistantSummary || "等待助手回复…"}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[#8b919a]">
        {turn.activityLabels?.slice(0, 2).map((label) => (
          <span key={label} className="flex max-w-44 items-center gap-1.5 truncate">
            <ActivityIcon label={label} />
            <span className="truncate">{label}</span>
          </span>
        ))}
        {turn.toolCount && (
          <span className="flex items-center gap-1.5">
            <SquareTerminal aria-hidden="true" className="size-4" />
            运行了 {turn.toolCount} 个工具
          </span>
        )}
        {!turn.activityLabels?.length && !turn.toolCount && (
          <>
            <span>第 {turn.index + 1} 轮</span>
            {formatTurnTime(turn.capturedAt) && <span>{formatTurnTime(turn.capturedAt)}</span>}
          </>
        )}
      </div>
    </>
  );
}

export function ConversationTurnTimeline({
  turns,
  scrollContainerRef,
  contentContainerRef,
  onSelectTurn,
}: ConversationTurnTimelineProps) {
  const frameRef = useRef<number | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const previewCloseTimerRef = useRef<number | null>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, turns.length - 1));
  const [isVisible, setIsVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState<ConversationTurnPreviewContentState>(INITIAL_PREVIEW_CONTENT);
  const [previewVisible, setPreviewVisible] = useState(false);
  const previewId = "conversation-turn-preview";
  const magneticSpringEasing = useMemo(() => getMagneticSpringEasing(), []);
  const previewTurnIndex = previewContent.currentIndex;

  const measure = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    const contentContainer = contentContainerRef.current;
    if (!scrollContainer || !contentContainer) return;

    const viewportRect = scrollContainer.getBoundingClientRect();
    setIsVisible(shouldShowConversationTurnTimeline(viewportRect.width));
    const viewportCenterY = viewportRect.top + viewportRect.height / 2;
    const turnTops = turns.map((turn) => (
      document.getElementById(`chat-message-${turn.originalIndex}`)?.getBoundingClientRect().top
      ?? Number.POSITIVE_INFINITY
    ));
    const nextActiveIndex = findActiveConversationTurnIndex(turnTops, viewportCenterY);
    if (nextActiveIndex >= 0) setActiveIndex(nextActiveIndex);
  }, [contentContainerRef, scrollContainerRef, turns]);

  const scheduleMeasure = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      measure();
    });
  }, [measure]);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const contentContainer = contentContainerRef.current;
    if (!scrollContainer || !contentContainer) return;

    scheduleMeasure();
    scrollContainer.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(scrollContainer);
    resizeObserver.observe(contentContainer);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      scrollContainer.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      resizeObserver.disconnect();
    };
  }, [contentContainerRef, scheduleMeasure, scrollContainerRef]);

  const cancelPreviewClose = useCallback(() => {
    if (previewCloseTimerRef.current === null) return;
    window.clearTimeout(previewCloseTimerRef.current);
    previewCloseTimerRef.current = null;
  }, []);

  const openPreview = useCallback((turnIndex: number) => {
    cancelPreviewClose();
    if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
    const retainPrevious = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPreviewContent((current) => advanceConversationTurnPreviewContent(current, turnIndex, retainPrevious));
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null;
      setPreviewVisible(true);
    });
  }, [cancelPreviewClose]);

  const closePreview = useCallback(() => {
    cancelPreviewClose();
    setPreviewVisible(false);
    previewCloseTimerRef.current = window.setTimeout(() => {
      previewCloseTimerRef.current = null;
      setPreviewContent((current) => ({
        currentIndex: null,
        previousIndex: null,
        version: current.version + 1,
      }));
    }, 180);
  }, [cancelPreviewClose]);

  useEffect(() => () => {
    cancelPreviewClose();
    if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
  }, [cancelPreviewClose]);

  useLayoutEffect(() => {
    if (!previewContentRef.current || previewContent.previousIndex === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = previewContentRef.current.animate([
      { opacity: 0.78, transform: "translate3d(0, 2px, 0)" },
      { opacity: 1, transform: "translate3d(0, 0, 0)" },
    ], {
      duration: 140,
      easing: MAGNETIC_SPRING_FALLBACK,
      fill: "both",
    });
    return () => animation.cancel();
  }, [previewContent.previousIndex, previewContent.version]);

  const previewTurn = previewTurnIndex === null
    ? null
    : turns.find((turn) => turn.index === previewTurnIndex) ?? null;
  const previewOffset = getConversationTurnPreviewOffset(
    turns.map((turn) => turn.index),
    previewTurnIndex,
  );
  const isExpanded = previewTurn !== null;

  if (turns.length < 2 || !isVisible) return null;

  return (
    <nav
      data-conversation-turn-timeline
      aria-label="会话轮次时间轴"
      className="pointer-events-none absolute top-1/2 z-20 hidden -translate-y-1/2 md:block"
      style={{ left: CONVERSATION_TURN_TIMELINE_LEFT_OFFSET }}
      onPointerEnter={cancelPreviewClose}
      onPointerLeave={closePreview}
      onFocusCapture={cancelPreviewClose}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closePreview();
      }}
    >
      <div className="relative flex flex-col gap-1 py-1">
        {turns.map((turn) => {
          const isActive = turn.index === activeIndex;
          const isPreviewed = turn.index === previewTurnIndex;
          const isHighlighted = turn.index === (previewTurnIndex ?? activeIndex);
          const label = buildTurnLabel(turn);
          return (
            <button
              key={turn.originalIndex}
              type="button"
              data-conversation-turn-index={turn.index}
              aria-label={`跳转到${label}`}
              aria-current={isActive ? "step" : undefined}
              aria-describedby={isPreviewed ? previewId : undefined}
              title={label}
              className="pointer-events-auto group flex h-2 w-10 items-center justify-start rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              onPointerEnter={() => openPreview(turn.index)}
              onFocus={() => openPreview(turn.index)}
              onKeyDown={(event) => {
                if (event.key === "Escape") closePreview();
              }}
              onClick={() => {
                setActiveIndex(turn.index);
                onSelectTurn(turn.originalIndex);
              }}
            >
              <span
                aria-hidden="true"
                className={`block h-[2px] w-10 origin-left rounded-full transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none ${
                  isHighlighted
                    ? "bg-ink-900"
                    : isExpanded
                      ? "bg-black/20 group-hover:bg-black/40"
                      : "bg-black/20 group-hover:bg-black/35"
                }`}
                style={{
                  transform: `scaleX(${getConversationTurnMarkWidth(turn.index, activeIndex, previewTurnIndex) / 40})`,
                  transitionDuration: "300ms",
                  transitionTimingFunction: magneticSpringEasing,
                }}
              />
            </button>
          );
        })}
        {previewTurn && (
          <div
            id={previewId}
            role="tooltip"
            data-conversation-turn-preview
            className="absolute left-14 top-0 w-[min(480px,calc(100vw-120px))] rounded-[20px] border border-black/[0.12] bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.13)] transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform motion-reduce:transition-none"
            style={{
              opacity: previewVisible ? 1 : 0,
              pointerEvents: previewVisible ? "auto" : "none",
              transform: `translate3d(${previewVisible ? 0 : -8}px, ${previewOffset ?? 0}px, 0) translateY(-50%) scale(${previewVisible ? 1 : 0.98})`,
              transitionDuration: previewVisible ? "320ms" : "160ms",
              transitionTimingFunction: previewVisible ? magneticSpringEasing : MAGNETIC_SPRING_FALLBACK,
            }}
          >
            <div ref={previewContentRef} data-conversation-turn-preview-content>
              <PreviewTurnContent turn={previewTurn} />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
