import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { useIPC } from "./hooks/useIPC";
import { useMessageWindow } from "./hooks/useMessageWindow";
import { useAppStore } from "./store/useAppStore";
import type { ServerEvent, SettingsPageId, StreamMessage } from "./types";
import { Sidebar } from "./components/Sidebar";
import { StartSessionModal } from "./components/StartSessionModal";
import { SettingsModal } from "./components/SettingsModal";
import { PromptInput, usePromptActions } from "./components/PromptInput";
import { MessageCard } from "./components/EventCard";
import { ActivityRail } from "./components/ActivityRail";
import { SessionAnalysisPage } from "./components/SessionAnalysisPage";
import MDContent from "./render/markdown";

const SCROLL_THRESHOLD = 50;

function App() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const partialMessageRef = useRef("");
  const [partialMessage, setPartialMessage] = useState("");
  const [showPartialMessage, setShowPartialMessage] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [showSessionAnalysis, setShowSessionAnalysis] = useState(false);
  const prevMessagesLengthRef = useRef(0);
  const scrollHeightBeforeLoadRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);

  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const showStartModal = useAppStore((s) => s.showStartModal);
  const setShowStartModal = useAppStore((s) => s.setShowStartModal);
  const showSettingsModal = useAppStore((s) => s.showSettingsModal);
  const setShowSettingsModal = useAppStore((s) => s.setShowSettingsModal);
  const globalError = useAppStore((s) => s.globalError);
  const setGlobalError = useAppStore((s) => s.setGlobalError);
  const historyRequested = useAppStore((s) => s.historyRequested);
  const markHistoryRequested = useAppStore((s) => s.markHistoryRequested);
  const resolvePermissionRequest = useAppStore((s) => s.resolvePermissionRequest);
  const handleServerEvent = useAppStore((s) => s.handleServerEvent);
  const prompt = useAppStore((s) => s.prompt);
  const setPrompt = useAppStore((s) => s.setPrompt);
  const cwd = useAppStore((s) => s.cwd);
  const setCwd = useAppStore((s) => s.setCwd);
  const setApiConfigSettings = useAppStore((s) => s.setApiConfigSettings);
  const pendingStart = useAppStore((s) => s.pendingStart);
  const apiConfigChecked = useAppStore((s) => s.apiConfigChecked);
  const setApiConfigChecked = useAppStore((s) => s.setApiConfigChecked);
  const [settingsInitialPageId, setSettingsInitialPageId] = useState<SettingsPageId | null>(null);

  // Helper function to extract partial message content
  const getPartialMessageContent = (eventMessage: any) => {
    try {
      const realType = eventMessage.delta.type.split("_")[0];
      return eventMessage.delta[realType];
    } catch (error) {
      console.error(error);
      return "";
    }
  };

  // Handle partial messages from stream events
  const handlePartialMessages = useCallback((partialEvent: ServerEvent) => {
    if (partialEvent.type !== "stream.message" || partialEvent.payload.message.type !== "stream_event") return;

    const message = partialEvent.payload.message as any;
    if (message.event.type === "content_block_start") {
      partialMessageRef.current = "";
      setPartialMessage(partialMessageRef.current);
      setShowPartialMessage(true);
    }

    if (message.event.type === "content_block_delta") {
      partialMessageRef.current += getPartialMessageContent(message.event) || "";
      setPartialMessage(partialMessageRef.current);
      if (shouldAutoScroll) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        setHasNewMessages(true);
      }
    }

    if (message.event.type === "content_block_stop") {
      setShowPartialMessage(false);
      setTimeout(() => {
        partialMessageRef.current = "";
        setPartialMessage(partialMessageRef.current);
      }, 500);
    }
  }, [shouldAutoScroll]);

  // Combined event handler
  const onEvent = useCallback((event: ServerEvent) => {
    handleServerEvent(event);
    handlePartialMessages(event);
  }, [handleServerEvent, handlePartialMessages]);

  const { connected, sendEvent } = useIPC(onEvent);
  const { handleStartFromModal } = usePromptActions(sendEvent);

  const activeSession = activeSessionId ? sessions[activeSessionId] : undefined;
  const messages = activeSession?.messages ?? [];
  const permissionRequests = activeSession?.permissionRequests ?? [];
  const isRunning = activeSession?.status === "running";

  const {
    visibleMessages,
    hasMoreHistory,
    isLoadingHistory,
    loadMoreMessages,
    resetToLatest,
    totalMessages,
  } = useMessageWindow(messages, permissionRequests, activeSessionId);

  const displayMessages = visibleMessages.filter((item) => {
    const currentMessage = item.message;
    if (
      currentMessage.type === "system" &&
      "subtype" in currentMessage &&
      currentMessage.subtype === "init"
    ) {
      for (let index = 0; index < item.originalIndex; index += 1) {
        const previousMessage = messages[index];
        if (
          previousMessage?.type === "system" &&
          "subtype" in previousMessage &&
          previousMessage.subtype === "init"
        ) {
          return false;
        }
      }
    }
    return true;
  });

  const renderEntries = useMemo(() => {
    const entries: Array<
      | { type: "separator"; key: string; roundNumber: number }
      | { type: "message"; key: string; originalIndex: number; message: StreamMessage }
    > = [];

    for (const item of displayMessages) {
      if (item.message.type === "user_prompt") {
        const roundNumber = messages
          .slice(0, item.originalIndex + 1)
          .filter((message) => message.type === "user_prompt").length;
        entries.push({
          type: "separator",
          key: `${activeSessionId}-round-${item.originalIndex}`,
          roundNumber,
        });
      }

      entries.push({
        type: "message",
        key: `${activeSessionId}-msg-${item.originalIndex}`,
        originalIndex: item.originalIndex,
        message: item.message,
      });
    }

    return entries;
  }, [activeSessionId, displayMessages, messages]);

  // 启动时检查 API 配置
  useEffect(() => {
    if (!apiConfigChecked) {
      window.electron.checkApiConfig().then((result) => {
        setApiConfigChecked(true);
        if (!result.hasConfig) {
          setSettingsInitialPageId("profiles");
          setShowSettingsModal(true);
        }
      }).catch((err) => {
        console.error("Failed to check API config:", err);
        setApiConfigChecked(true);
      });
    }
  }, [apiConfigChecked, setApiConfigChecked, setShowSettingsModal]);

  useEffect(() => {
    window.electron.getApiConfig()
      .then((settings) => {
        setApiConfigSettings(settings);
      })
      .catch((error) => {
        console.error("Failed to load API config settings:", error);
      });
  }, [setApiConfigSettings]);

  useEffect(() => {
    if (connected) sendEvent({ type: "session.list" });
  }, [connected, sendEvent]);

  useEffect(() => {
    if (!activeSessionId || !connected) return;
    const session = sessions[activeSessionId];
    if (session && !session.hydrated && !historyRequested.has(activeSessionId)) {
      markHistoryRequested(activeSessionId);
      sendEvent({ type: "session.history", payload: { sessionId: activeSessionId } });
    }
  }, [activeSessionId, connected, sessions, historyRequested, markHistoryRequested, sendEvent]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - SCROLL_THRESHOLD;

    if (isAtBottom !== shouldAutoScroll) {
      setShouldAutoScroll(isAtBottom);
      if (isAtBottom) {
        setHasNewMessages(false);
      }
    }
  }, [shouldAutoScroll]);

  // Set up IntersectionObserver for top sentinel
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMoreHistory && !isLoadingHistory) {
          scrollHeightBeforeLoadRef.current = container.scrollHeight;
          shouldRestoreScrollRef.current = true;
          loadMoreMessages();
        }
      },
      {
        root: container,
        rootMargin: "100px 0px 0px 0px",
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMoreHistory, isLoadingHistory, loadMoreMessages]);

  // Restore scroll position after loading history
  useEffect(() => {
    if (shouldRestoreScrollRef.current && !isLoadingHistory) {
      const container = scrollContainerRef.current;
      if (container) {
        const newScrollHeight = container.scrollHeight;
        const scrollDiff = newScrollHeight - scrollHeightBeforeLoadRef.current;
        container.scrollTop += scrollDiff;
      }
      shouldRestoreScrollRef.current = false;
    }
  }, [visibleMessages, isLoadingHistory]);

  // Reset scroll state on session change
  useEffect(() => {
    setShouldAutoScroll(true);
    setHasNewMessages(false);
        setShowSessionAnalysis(false);
        prevMessagesLengthRef.current = 0;
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        }, 100);
  }, [activeSessionId]);

  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (messages.length > prevMessagesLengthRef.current && prevMessagesLengthRef.current > 0) {
      setHasNewMessages(true);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, partialMessage, shouldAutoScroll]);

  const scrollToBottom = useCallback(() => {
    setShouldAutoScroll(true);
    setHasNewMessages(false);
    resetToLatest();
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [resetToLatest]);

  const handleNewSession = useCallback((nextCwd?: string) => {
    useAppStore.getState().setActiveSessionId(null);
    setPrompt("");

    if (nextCwd) {
      setCwd(nextCwd);
      sendEvent({
        type: "session.create",
        payload: {
          title: "新聊天",
          cwd: nextCwd,
          allowedTools: "Read,Edit,Bash",
        },
      });
      return;
    }

    setCwd("");
    setShowStartModal(true);
  }, [sendEvent, setCwd, setPrompt, setShowStartModal]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    sendEvent({ type: "session.delete", payload: { sessionId } });
  }, [sendEvent]);

  const handlePermissionResult = useCallback((toolUseId: string, result: PermissionResult) => {
    if (!activeSessionId) return;
    sendEvent({ type: "permission.response", payload: { sessionId: activeSessionId, toolUseId, result } });
    resolvePermissionRequest(activeSessionId, toolUseId);
  }, [activeSessionId, sendEvent, resolvePermissionRequest]);

  const handleSendMessage = useCallback(() => {
    setShouldAutoScroll(true);
    setHasNewMessages(false);
    resetToLatest();
  }, [resetToLatest]);

  const openSettings = useCallback((pageId?: SettingsPageId) => {
    setSettingsInitialPageId(pageId ?? null);
    setShowSettingsModal(true);
  }, [setShowSettingsModal]);

  return (
    <div className="flex h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(243,246,250,0.97)_40%,_rgba(228,233,240,0.98)_100%)]">
      <Sidebar
        connected={connected}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={openSettings}
      />

      <main className="ml-[320px] flex flex-1 flex-col bg-transparent xl:mr-[340px]">
        <div
          className="flex h-12 items-center justify-center border-b border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(249,250,252,0.68))] backdrop-blur-md select-none"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <span className="text-sm font-semibold tracking-[0.01em] text-ink-700">{activeSession?.title || "tech-cc-hub"}</span>
        </div>

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="chat-scroll flex-1 overflow-y-auto px-8 pb-40 pt-8"
        >
          {showSessionAnalysis ? (
            <SessionAnalysisPage
              session={activeSession}
              partialMessage={partialMessage}
              onBack={() => setShowSessionAnalysis(false)}
            />
          ) : (
          <div className="mx-auto w-full max-w-[clamp(920px,_calc(100vw-420px),_1320px)] rounded-[34px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,252,0.82))] px-8 py-7 shadow-[0_24px_60px_rgba(30,38,52,0.08)] backdrop-blur-xl xl:max-w-[clamp(920px,_calc(100vw-780px),_1320px)]">
            <div ref={topSentinelRef} className="h-1" />

            {!hasMoreHistory && totalMessages > 0 && (
              <div className="flex items-center justify-center py-4 mb-4">
                <div className="flex items-center gap-3 text-xs text-muted">
                  <div className="h-px w-14 bg-ink-900/10" />
                  <span>对话开始</span>
                  <div className="h-px w-14 bg-ink-900/10" />
                </div>
              </div>
            )}

            {isLoadingHistory && (
              <div className="flex items-center justify-center py-4 mb-4">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>正在加载...</span>
                </div>
              </div>
            )}

            {renderEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="rounded-full border border-black/6 bg-[#f4f7fb] px-4 py-1 text-[11px] font-semibold tracking-[0.16em] text-muted">
                  CHAT FIRST
                </div>
                <div className="mt-5 text-2xl font-semibold text-ink-800">直接开始聊天</div>
                <p className="mt-3 max-w-md text-sm leading-7 text-muted">在下方输入需求就会自动开启新会话；只有需要切换工作目录时，再去左侧新建。</p>
              </div>
            ) : (
              renderEntries.map((entry, idx) => {
                if (entry.type === "separator") {
                  return (
                    <div key={entry.key} className="mb-5 mt-7 flex items-center justify-center">
                      <div className="flex items-center gap-3 rounded-full border border-black/6 bg-[#f5f7fb] px-4 py-2 text-xs font-medium text-muted shadow-[0_10px_24px_rgba(30,38,52,0.06)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        <span>第 {entry.roundNumber} 轮执行</span>
                      </div>
                    </div>
                  );
                }

                const isLastMessage = idx === renderEntries.length - 1;
                return (
                  <MessageCard
                    key={entry.key}
                    message={entry.message}
                    isLast={isLastMessage}
                    isRunning={isRunning}
                    permissionRequest={permissionRequests[0]}
                    onPermissionResult={handlePermissionResult}
                  />
                );
              })
            )}

            {/* Partial message display with skeleton loading */}
            <div className="partial-message rounded-[26px] border border-black/5 bg-[linear-gradient(180deg,rgba(245,247,250,0.95),rgba(255,255,255,0.86))] px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <MDContent text={partialMessage} />
              {showPartialMessage && (
                <div className="mt-3 flex flex-col gap-2 px-1">
                  <div className="relative h-3 w-2/12 overflow-hidden rounded-full bg-ink-900/10">
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/30 to-transparent animate-shimmer" />
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink-900/10">
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/30 to-transparent animate-shimmer" />
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink-900/10">
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/30 to-transparent animate-shimmer" />
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-ink-900/10">
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/30 to-transparent animate-shimmer" />
                  </div>
                  <div className="relative h-3 w-4/12 overflow-hidden rounded-full bg-ink-900/10">
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink-900/30 to-transparent animate-shimmer" />
                  </div>
                </div>
              )}
            </div>

            <div ref={messagesEndRef} />
          </div>
          )}
        </div>

        {!showSessionAnalysis && (
          <PromptInput sendEvent={sendEvent} onSendMessage={handleSendMessage} disabled={!connected} />
        )}

        {hasNewMessages && !shouldAutoScroll && (
          <button
            onClick={scrollToBottom}
            style={{ bottom: "calc(var(--composer-bottom-offset, 160px) + 0.5rem)" }}
            className="fixed left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-accent-hover hover:scale-105 animate-bounce-subtle lg:ml-[140px] xl:mr-[160px]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
            <span>有新消息</span>
          </button>
        )}
      </main>

      <ActivityRail
        session={activeSession}
        partialMessage={partialMessage}
        globalError={globalError}
        onOpenSessionAnalysis={() => setShowSessionAnalysis(true)}
      />

      {showStartModal && (
        <StartSessionModal
          cwd={cwd}
          prompt={prompt}
          pendingStart={pendingStart}
          onCwdChange={setCwd}
          onPromptChange={setPrompt}
          onStart={handleStartFromModal}
          onClose={() => setShowStartModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          onClose={() => {
            setShowSettingsModal(false);
            setSettingsInitialPageId(null);
          }}
          initialPageId={settingsInitialPageId ?? undefined}
        />
      )}

      {globalError && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-error/20 bg-error-light px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm text-error">{globalError}</span>
            <button className="text-error hover:text-error/80" onClick={() => setGlobalError(null)}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
