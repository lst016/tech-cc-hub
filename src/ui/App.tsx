import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { useIPC } from "./hooks/useIPC";
import { useMessageWindow } from "./hooks/useMessageWindow";
import { useAppStore } from "./store/useAppStore";
import type { ServerEvent, SettingsPageId, StreamMessage } from "./types";
import { Sidebar } from "./components/Sidebar";
import { StartSessionModal } from "./components/StartSessionModal";
import { SettingsModal } from "./components/SettingsModal";
import { TooltipButton } from "./components/TooltipButton";
import { PromptInput, usePromptActions } from "./components/PromptInput";
import { MessageCard } from "./components/EventCard";
import { ActivityRail } from "./components/ActivityRail";
import { SessionAnalysisPage } from "./components/SessionAnalysisPage";
import { BrowserWorkbenchPage } from "./components/BrowserWorkbenchPage";
import MDContent, { OPEN_BROWSER_WORKBENCH_URL_EVENT, type OpenBrowserWorkbenchUrlDetail } from "./render/markdown";
import {
  DEV_BRIDGE_READY_EVENT,
  getDevElectronRuntimeSource,
  type DevElectronRuntimeSource,
} from "./dev-electron-shim";

const SCROLL_THRESHOLD = 50;
const INITIAL_HISTORY_LIMIT = 400;
const HISTORY_PAGE_LIMIT = 200;
const MIN_CENTER_WIDTH = 300;
const MIN_SIDEBAR_WIDTH = 250;
const MIN_ACTIVITY_RAIL_WIDTH = 400;
const EMPTY_MESSAGES: StreamMessage[] = [];
const EMPTY_PERMISSION_REQUESTS: NonNullable<ReturnType<typeof useAppStore.getState>["sessions"][string]["permissionRequests"]> = [];
type GlobalRuntimeConfig = Record<string, unknown>;

type StreamEventPayload = {
  type?: string;
  delta?: {
    type?: string;
    [key: string]: unknown;
  };
};

type StreamEventMessage = StreamMessage & {
  event?: StreamEventPayload;
};

type WorkspaceView = "chat" | "browser";

function getToolUseCount(message: StreamMessage): number {
  if (message.type !== "assistant") return 0;
  const content = (message as { message?: { content?: unknown[] } }).message?.content;
  if (!Array.isArray(content)) return 0;
  return content.filter((item) => item && typeof item === "object" && (item as { type?: string }).type === "tool_use").length;
}

const runtimeSourceMeta: Record<DevElectronRuntimeSource, { label: string; tooltip: string; className: string; dotClassName: string }> = {
  bridge: {
    label: "Dev Bridge",
    tooltip: "localhost 正在连接 Electron 开发后端",
    className: "border-emerald-500/20 bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
  fallback: {
    label: "Fallback",
    tooltip: "当前使用浏览器预览占位后端",
    className: "border-amber-500/24 bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-500",
  },
  electron: {
    label: "Electron IPC",
    tooltip: "当前连接桌面端 preload IPC",
    className: "border-sky-500/20 bg-sky-50 text-sky-700",
    dotClassName: "bg-sky-500",
  },
};

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("clipboard copy failed");
  }
}

function App() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const partialMessageRef = useRef("");
  const partialFlushFrameRef = useRef<number | null>(null);
  const [partialMessage, setPartialMessage] = useState("");
  const [showPartialMessage, setShowPartialMessage] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [showSessionAnalysis, setShowSessionAnalysis] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [closeSidebarOnBrowserOpen, setCloseSidebarOnBrowserOpen] = useState(true);
  const [showActivityRail, setShowActivityRail] = useState(true);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("chat");
  const [activityRailTab, setActivityRailTab] = useState<"trace" | "usage">("trace");
  const [browserWorkbenchUrl, setBrowserWorkbenchUrl] = useState("");
  const [runtimeSource, setRuntimeSource] = useState<DevElectronRuntimeSource>(() => getDevElectronRuntimeSource());
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [activityRailWidth, setActivityRailWidth] = useState(420);
  const [resizingPane, setResizingPane] = useState<"sidebar" | "activityRail" | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState(false);
  const runtimeModelSessionSyncRef = useRef<string | null>(null);
  const prevMessagesLengthRef = useRef(0);
  const scrollHeightBeforeLoadRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);
  const isMac =
    typeof window !== "undefined" &&
    (window.electron?.platform === "darwin" ||
      (typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent || "")));
  const headerHeightClass = isMac ? "h-12 items-center" : "h-10 items-center";
  const sidebarHeaderOffsetClass = isMac ? "top-12" : "top-10";

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessions = useAppStore((s) => s.sessions);
  const archivedSessions = useAppStore((s) => s.archivedSessions);
  const activeSession = useAppStore((s) => (s.activeSessionId ? (s.sessions[s.activeSessionId] ?? s.archivedSessions[s.activeSessionId]) : undefined));
  const activeHistoryCursor = useAppStore((s) => (s.activeSessionId ? (s.sessions[s.activeSessionId] ?? s.archivedSessions[s.activeSessionId])?.historyCursor : undefined));
  const activeSessionHydrated = useAppStore((s) => (s.activeSessionId ? (s.sessions[s.activeSessionId] ?? s.archivedSessions[s.activeSessionId])?.hydrated : undefined));
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
  const setPrompt = useAppStore((s) => s.setPrompt);
  const cwd = useAppStore((s) => s.cwd);
  const setCwd = useAppStore((s) => s.setCwd);
  const apiConfigSettings = useAppStore((s) => s.apiConfigSettings);
  const runtimeModel = useAppStore((s) => s.runtimeModel);
  const setBrowserWorkbenchSessionUrl = useAppStore((s) => s.setBrowserWorkbenchUrl);
  const browserWorkbenchBySessionId = useAppStore((s) => s.browserWorkbenchBySessionId);
  const reasoningMode = useAppStore((s) => s.reasoningMode);
  const permissionMode = useAppStore((s) => s.permissionMode);
  const setApiConfigSettings = useAppStore((s) => s.setApiConfigSettings);
  const setRuntimeModel = useAppStore((s) => s.setRuntimeModel);
  const pendingStart = useAppStore((s) => s.pendingStart);
  const setPendingStart = useAppStore((s) => s.setPendingStart);
  const apiConfigChecked = useAppStore((s) => s.apiConfigChecked);
  const setApiConfigChecked = useAppStore((s) => s.setApiConfigChecked);
  const [settingsInitialPageId, setSettingsInitialPageId] = useState<SettingsPageId | null>(null);

  // Helper function to extract partial message content
  const getPartialMessageContent = (eventMessage: StreamEventPayload) => {
    try {
      const realType = eventMessage.delta?.type?.split("_")[0];
      const value = realType ? eventMessage.delta?.[realType] : undefined;
      return typeof value === "string" ? value : "";
    } catch (error) {
      console.error(error);
      return "";
    }
  };

  // Handle partial messages from stream events
  const flushPartialMessage = useCallback(() => {
    partialFlushFrameRef.current = null;
    setPartialMessage(partialMessageRef.current);
    if (shouldAutoScroll) {
      scrollChatToBottom("auto");
    } else {
      setHasNewMessages(true);
    }
  }, [scrollChatToBottom, shouldAutoScroll]);

  const schedulePartialFlush = useCallback(() => {
    if (partialFlushFrameRef.current !== null) return;
    partialFlushFrameRef.current = window.requestAnimationFrame(flushPartialMessage);
  }, [flushPartialMessage]);

  const handlePartialMessages = useCallback((partialEvent: ServerEvent) => {
    if (partialEvent.type !== "stream.message" || partialEvent.payload.message.type !== "stream_event") return;
    if (partialEvent.payload.sessionId !== activeSessionId) return;

    const message = partialEvent.payload.message as StreamEventMessage;
    if (message.event?.type === "content_block_start") {
      partialMessageRef.current = "";
      setPartialMessage(partialMessageRef.current);
      setShowPartialMessage(true);
    }

    if (message.event?.type === "content_block_delta") {
      partialMessageRef.current += getPartialMessageContent(message.event) || "";
      schedulePartialFlush();
    }

    if (message.event?.type === "content_block_stop") {
      if (partialFlushFrameRef.current !== null) {
        window.cancelAnimationFrame(partialFlushFrameRef.current);
        partialFlushFrameRef.current = null;
      }
      setPartialMessage(partialMessageRef.current);
      setShowPartialMessage(false);
      setTimeout(() => {
        partialMessageRef.current = "";
        setPartialMessage(partialMessageRef.current);
      }, 500);
    }
  }, [activeSessionId, schedulePartialFlush]);

  // Combined event handler
  const onEvent = useCallback((event: ServerEvent) => {
    if (event.type === "session.history" || event.type === "session.deleted") {
      setIsLoadingHistory(false);
    }
    handleServerEvent(event);
    handlePartialMessages(event);
  }, [handleServerEvent, handlePartialMessages]);

  const { connected, sendEvent } = useIPC(onEvent);
  const { handleStartFromModal } = usePromptActions(sendEvent);

  const messages = activeSession?.messages ?? EMPTY_MESSAGES;
  const permissionRequests = activeSession?.permissionRequests ?? EMPTY_PERMISSION_REQUESTS;
  const isRunning = activeSession?.status === "running";
  const activeBrowserWorkbenchState = activeSessionId ? browserWorkbenchBySessionId[activeSessionId] : undefined;
  const activeHasBrowserTab = activeBrowserWorkbenchState?.hasBrowserTab ?? Boolean(activeBrowserWorkbenchState?.url);
  const selectedUsageModel =
    activeSession?.model?.trim() ||
    runtimeModel?.trim() ||
    apiConfigSettings.profiles.find((profile) => profile.enabled)?.model ||
    apiConfigSettings.profiles[0]?.model ||
    "";
  const selectedUsageModelConfig = useMemo(() => {
    const modelName = selectedUsageModel.trim();
    if (!modelName) return undefined;

    const profiles = [
      ...apiConfigSettings.profiles.filter((profile) => profile.enabled),
      ...apiConfigSettings.profiles.filter((profile) => !profile.enabled),
    ];

    for (const profile of profiles) {
      const candidates = [
        ...(profile.models ?? []),
        { name: profile.model, contextWindow: undefined, compressionThresholdPercent: undefined },
        profile.expertModel ? { name: profile.expertModel, contextWindow: undefined, compressionThresholdPercent: undefined } : null,
        profile.imageModel ? { name: profile.imageModel, contextWindow: undefined, compressionThresholdPercent: undefined } : null,
        profile.analysisModel ? { name: profile.analysisModel, contextWindow: undefined, compressionThresholdPercent: undefined } : null,
      ].filter(Boolean);
      const matched = candidates.find((model) => model?.name === modelName);
      if (matched) return matched;
    }

    return undefined;
  }, [apiConfigSettings.profiles, selectedUsageModel]);
  const hasPersistedHistory = activeSession?.hasMoreHistory ?? false;
  const requestOlderHistory = useCallback(() => {
    if (!activeSessionId || !connected || isLoadingHistory) {
      return;
    }

    const cursor = activeHistoryCursor;
    if (!cursor) {
      return;
    }

    setIsLoadingHistory(true);
    sendEvent({
      type: "session.history",
      payload: {
        sessionId: activeSessionId,
        before: cursor,
        limit: HISTORY_PAGE_LIMIT,
      },
    });
  }, [activeHistoryCursor, activeSessionId, connected, isLoadingHistory, sendEvent]);

  const {
    visibleMessages,
    hasMoreHistory,
    loadMoreMessages,
    resetToLatest,
    totalMessages,
  } = useMessageWindow(messages, {
    hasMoreHistory: hasPersistedHistory,
    isLoadingHistory,
    onLoadMore: requestOlderHistory,
  });

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
    let roundNumber = messages
      .slice(0, displayMessages[0]?.originalIndex ?? 0)
      .filter((message) => message.type === "user_prompt").length;

    for (const item of displayMessages) {
      if (item.message.type === "user_prompt") {
        roundNumber += 1;
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

  const chatOverview = useMemo(() => {
    const latestUserEntry = [...renderEntries].reverse().find((entry) => entry.type === "message" && entry.message.type === "user_prompt");
    return {
      rounds: renderEntries.filter((entry) => entry.type === "separator").length,
      tools: displayMessages.reduce((total, item) => total + getToolUseCount(item.message), 0),
      latestUserIndex: latestUserEntry?.type === "message" ? latestUserEntry.originalIndex : null,
    };
  }, [displayMessages, renderEntries]);

  const scrollToMessageIndex = useCallback((index: number | null) => {
    if (index === null) return;
    document.getElementById(`chat-message-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // 閸氼垰濮╅弮鑸殿梾閺?API 闁板秶鐤?
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
    if (activeSession && !activeSessionHydrated && !historyRequested.has(activeSessionId)) {
      markHistoryRequested(activeSessionId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoadingHistory(true);
      sendEvent({
        type: "session.history",
        payload: { sessionId: activeSessionId, limit: INITIAL_HISTORY_LIMIT },
      });
    }
  }, [activeSession, activeSessionHydrated, activeSessionId, connected, historyRequested, markHistoryRequested, sendEvent]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShouldAutoScroll(true);
    setHasNewMessages(false);
    setShowSessionAnalysis(false);
    setIsLoadingHistory(false);
    prevMessagesLengthRef.current = 0;
    setTimeout(() => {
      scrollChatToBottom("auto");
    }, 100);
  }, [activeSessionId, scrollChatToBottom]);

  useEffect(() => {
    if (shouldAutoScroll) {
      scrollChatToBottom("auto");
    } else if (messages.length > prevMessagesLengthRef.current && prevMessagesLengthRef.current > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasNewMessages(true);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, partialMessage, scrollChatToBottom, shouldAutoScroll]);

  useEffect(() => {
    if (!showSessionAnalysis) {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const scrollingElement = document.scrollingElement as HTMLElement | null;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    const resetViewport = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      html.scrollTop = 0;
      body.scrollTop = 0;
      scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    resetViewport();

    const animationFrameId = window.requestAnimationFrame(resetViewport);
    const timeoutId = window.setTimeout(resetViewport, 180);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [showSessionAnalysis]);

  useEffect(() => {
    if (!activeSessionId) {
      runtimeModelSessionSyncRef.current = null;
      return;
    }

    const nextSession = activeSession ?? archivedSessions[activeSessionId];
    const fallbackProfile = apiConfigSettings.profiles.find((profile) => profile.enabled) ?? apiConfigSettings.profiles[0];
    const selectedSessionModel = nextSession?.model?.trim();
    const fallbackModel = fallbackProfile?.model?.trim();
    const nextModel = selectedSessionModel || fallbackModel;
    if (!nextModel) {
      return;
    }

    const syncKey = `${activeSessionId}:${nextModel}`;
    if (runtimeModelSessionSyncRef.current !== syncKey) {
      runtimeModelSessionSyncRef.current = syncKey;
      setRuntimeModel(nextModel);
    }
  }, [activeSessionId, activeSession?.model, archivedSessions, apiConfigSettings, setRuntimeModel]);

  useEffect(() => {
    return () => {
      if (partialFlushFrameRef.current !== null) {
        window.cancelAnimationFrame(partialFlushFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!resizingPane) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const viewportWidth = window.innerWidth;
      if (resizingPane === "sidebar") {
        const maxSidebarWidth = Math.max(
          MIN_SIDEBAR_WIDTH,
          viewportWidth - (showActivityRail ? activityRailWidth : 0) - MIN_CENTER_WIDTH,
        );
        const nextWidth = Math.min(Math.max(event.clientX, MIN_SIDEBAR_WIDTH), maxSidebarWidth);
        setSidebarWidth(nextWidth);
        return;
      }

      const proposedWidth = viewportWidth - event.clientX;
      const maxRailWidth = Math.max(
        MIN_ACTIVITY_RAIL_WIDTH,
        viewportWidth - (showSidebar ? sidebarWidth : 0) - MIN_CENTER_WIDTH,
      );
      const nextWidth = Math.min(Math.max(proposedWidth, MIN_ACTIVITY_RAIL_WIDTH), maxRailWidth);
      setActivityRailWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setResizingPane(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activityRailWidth, resizingPane, showActivityRail, showSidebar, sidebarWidth]);

  const scrollToBottom = useCallback(() => {
    setShouldAutoScroll(true);
    setHasNewMessages(false);
    resetToLatest();
    scrollChatToBottom("smooth");
  }, [resetToLatest, scrollChatToBottom]);

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

  const handleNewSessionClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setWorkspaceView("chat");
    handleNewSession();
  }, [handleNewSession]);

  useEffect(() => {
    const handleOpenBrowserWorkbenchUrl = (event: Event) => {
      const url = (event as CustomEvent<OpenBrowserWorkbenchUrlDetail>).detail?.url?.trim();
      if (!url) return;

      setShowSessionAnalysis(false);
      setShowActivityRail(true);
      setBrowserWorkbenchUrl(url);
      if (activeSessionId) {
        setBrowserWorkbenchSessionUrl(activeSessionId, url);
      }
      setWorkspaceView("browser");
      if (closeSidebarOnBrowserOpen && showSidebar) {
        setShowSidebar(false);
      }
    };

    window.addEventListener(OPEN_BROWSER_WORKBENCH_URL_EVENT, handleOpenBrowserWorkbenchUrl);
    return () => {
      window.removeEventListener(OPEN_BROWSER_WORKBENCH_URL_EVENT, handleOpenBrowserWorkbenchUrl);
    };
  }, [activeSessionId, closeSidebarOnBrowserOpen, setBrowserWorkbenchSessionUrl, showSidebar]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    sendEvent({ type: "session.delete", payload: { sessionId } });
  }, [sendEvent]);

  const handleArchiveSession = useCallback((sessionId: string) => {
    sendEvent({ type: "session.archive", payload: { sessionId } });
  }, [sendEvent]);

  const handleUnarchiveSession = useCallback((sessionId: string) => {
    sendEvent({ type: "session.unarchive", payload: { sessionId } });
  }, [sendEvent]);

  const handleRefreshArchivedSessions = useCallback(() => {
    sendEvent({ type: "session.list", payload: { archived: true } });
  }, [sendEvent]);

  const handleDeleteWorkspace = useCallback((sessionIds: string[], workspaceName: string) => {
    if (sessionIds.length === 0) return;

    const shouldDelete = window.confirm(
      `确认删除工作区 "${workspaceName}" 下的 ${sessionIds.length} 个会话吗？`,
    );
    if (!shouldDelete) return;

    for (const sessionId of sessionIds) {
      sendEvent({ type: "session.delete", payload: { sessionId } });
    }
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


  useEffect(() => {
    if (workspaceView !== "chat" || showSessionAnalysis) return;
    setShouldAutoScroll(true);
    setHasNewMessages(false);
    resetToLatest();
    requestAnimationFrame(() => {
      scrollChatToBottom("auto");
    });
  }, [resetToLatest, scrollChatToBottom, showSessionAnalysis, workspaceView]);

  const openSettings = useCallback((pageId?: SettingsPageId) => {
    setSettingsInitialPageId(pageId ?? null);
    setShowSettingsModal(true);
  }, [setShowSettingsModal]);

  const refreshBrowserWorkbenchPreference = useCallback(() => {
    window.electron.getGlobalConfig()
      .then((config) => {
        const normalizedConfig = typeof config === "object" && config !== null && !Array.isArray(config)
          ? config as GlobalRuntimeConfig
          : {};
        const configured = normalizedConfig.closeSidebarOnBrowserOpen;
        setCloseSidebarOnBrowserOpen(configured !== false);
      })
      .catch((error) => {
        console.error("Failed to load browser workbench preference:", error);
      });
  }, []);

  useEffect(() => {
    const handleDevBridgeReady = () => {
      setRuntimeSource(getDevElectronRuntimeSource());
      window.electron.getApiConfig()
        .then((settings) => {
          setApiConfigSettings(settings);
        })
        .catch((error) => {
          console.error("Failed to refresh API config settings after bridge ready:", error);
        });

      refreshBrowserWorkbenchPreference();
    };

    window.addEventListener(DEV_BRIDGE_READY_EVENT, handleDevBridgeReady);
    return () => window.removeEventListener(DEV_BRIDGE_READY_EVENT, handleDevBridgeReady);
  }, [refreshBrowserWorkbenchPreference, setApiConfigSettings]);

  const startMaintenanceSession = useCallback(async (maintenancePrompt: string) => {
    const trimmedPrompt = maintenancePrompt.trim();
    if (!trimmedPrompt) {
      throw new Error("维护指令不能为空。");
    }

    const getSystemWorkspace = (
      window.electron as typeof window.electron & { getSystemWorkspace?: () => Promise<string> }
    ).getSystemWorkspace;
    if (typeof getSystemWorkspace !== "function") {
      throw new Error("当前窗口还是旧版本运行时，请刷新或重启应用后再试。");
    }

    const systemWorkspace = await getSystemWorkspace();
    let title = "系统维护";
    try {
      setPendingStart(true);
      title = await window.electron.generateSessionTitle("系统维护");
    } catch (error) {
      setPendingStart(false);
      console.error("Failed to generate maintenance title:", error);
      throw new Error("生成维护会话标题失败。");
    }

    sendEvent({
      type: "session.start",
      payload: {
        title,
        prompt: trimmedPrompt,
        cwd: systemWorkspace,
        allowedTools: "Read,Edit,MultiEdit,Write,Bash,Glob,Search,TodoWrite",
        runtime: {
          runSurface: "maintenance",
          agentId: "system-maintenance",
        },
      },
    });
  }, [sendEvent, setPendingStart]);

  const resolveSessionRuntimeModel = useCallback((): string => {
    const trimmedSessionModel = activeSession?.model?.trim();
    if (trimmedSessionModel) {
      return trimmedSessionModel;
    }

    const messages = activeSession?.messages ?? [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const messageModel = "model" in messages[index] ? (messages[index] as { model?: string }).model : undefined;
      if (typeof messageModel === "string") {
        const trimmedMessageModel = messageModel.trim();
        if (trimmedMessageModel) {
          return trimmedMessageModel;
        }
      }
    }

    return "";
  }, [activeSession?.messages, activeSession?.model]);

  const sendWorkflowOptimizationPrompt = useCallback((workflowPrompt: string) => {
    const trimmedPrompt = workflowPrompt.trim();
    if (!activeSessionId || !trimmedPrompt) {
      setGlobalError("当前没有可续聊的会话。");
      return;
    }
    if (activeSession?.status === "running") {
      setGlobalError("当前会话仍在执行中，请等待这一轮完成后再发送工作流优化任务。");
      return;
    }

    const activeProfile = apiConfigSettings.profiles.find((profile) => profile.enabled) ?? apiConfigSettings.profiles[0];
    const selectedModel = runtimeModel.trim() || resolveSessionRuntimeModel() || activeProfile?.model?.trim();
    if (!selectedModel) {
      setGlobalError("当前没有可用模型，请先在设置里启用配置。");
      return;
    }

    sendEvent({
      type: "session.continue",
      payload: {
        sessionId: activeSessionId,
        prompt: trimmedPrompt,
        runtime: {
          model: selectedModel,
          reasoningMode,
          permissionMode,
        },
      },
    });
    setShowSessionAnalysis(false);
    setGlobalError(null);
  }, [
    activeSession?.status,
    activeSessionId,
    apiConfigSettings,
    permissionMode,
    reasoningMode,
    runtimeModel,
    resolveSessionRuntimeModel,
    sendEvent,
    setGlobalError,
  ]);

  const sidebarOffset = showSidebar ? sidebarWidth : 0;
  const activityRailOffset = !showSessionAnalysis && showActivityRail ? activityRailWidth : 0;
  const runtimeMeta = runtimeSourceMeta[runtimeSource];
  const latestSessionId = useMemo(() => {
    const latestSession = Object.values(sessions).sort((left, right) => {
      const leftTime = left.updatedAt ?? left.createdAt ?? 0;
      const rightTime = right.updatedAt ?? right.createdAt ?? 0;
      return rightTime - leftTime;
    })[0];
    return latestSession?.id ?? activeSessionId ?? null;
  }, [activeSessionId, sessions]);

  const handleCopyLatestSessionId = useCallback(async () => {
    if (!latestSessionId) return;
    try {
      await copyTextToClipboard(latestSessionId);
      setCopiedSessionId(true);
      window.setTimeout(() => setCopiedSessionId(false), 1400);
    } catch {
      setGlobalError("复制会话 ID 失败，请重试。");
    }
  }, [latestSessionId, setGlobalError]);

  useEffect(() => {
    refreshBrowserWorkbenchPreference();
  }, [refreshBrowserWorkbenchPreference]);

  useEffect(() => {
    if (!globalError) return;
    const timer = window.setTimeout(() => setGlobalError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [globalError, setGlobalError]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(243,246,250,0.97)_40%,_rgba(228,233,240,0.98)_100%)]">
      <header
        className={`relative z-[20000] flex shrink-0 justify-between border-b border-black/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(246,248,251,0.86))] px-4 shadow-[inset_0_-1px_0_rgba(15,23,42,0.08)] backdrop-blur-md ${headerHeightClass}`}
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div
          className={`flex items-center gap-2 ${isMac ? "pl-[86px]" : ""}`}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <TooltipButton
            type="button"
            tooltip={showSidebar ? "收起左侧栏" : "展开左侧栏"}
            onClick={() => setShowSidebar((current) => !current)}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-ink-700 transition hover:bg-ink-900/5 ${showSidebar ? "" : "bg-[#f3f6fb]"}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="14" rx="2" />
              <path d="M9 5v14" />
            <path d="m7 12-2-2m2 2-2 2" />
            </svg>
          </TooltipButton>
          <TooltipButton
            type="button"
            tooltip="新建会话"
            onClick={handleNewSessionClick}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-ink-700 transition hover:bg-ink-900/5"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M4 20h4.5l9.4-9.4a2.1 2.1 0 0 0 0-3L16.4 6a2.1 2.1 0 0 0-3 0L4 15.4V20Z" />
              <path d="m12.5 6.9 4.6 4.6" />
            </svg>
          </TooltipButton>
        </div>
        <div
          className="flex items-center justify-end gap-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {import.meta.env.DEV && (
            <TooltipButton
              type="button"
              tooltip={runtimeMeta.tooltip}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition hover:brightness-[0.98] ${runtimeMeta.className}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${runtimeMeta.dotClassName}`} />
              <span>{runtimeMeta.label}</span>
            </TooltipButton>
          )}
          <TooltipButton
            type="button"
            tooltip={latestSessionId ? `复制最新会话 ID：${latestSessionId}` : "暂无会话 ID"}
            onClick={handleCopyLatestSessionId}
            disabled={!latestSessionId}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${
              copiedSessionId
                ? "border-emerald-500/24 bg-emerald-50 text-emerald-700"
                : "border-black/10 bg-white text-ink-700 hover:bg-ink-900/5"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="8" y="8" width="10" height="12" rx="2" />
              <path d="M6 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
            </svg>
            <span>{copiedSessionId ? "已复制" : "会话 ID"}</span>
          </TooltipButton>
          <TooltipButton
            type="button"
            tooltip="打开执行复盘"
            onClick={() => setShowSessionAnalysis(true)}
            disabled={!activeSessionId}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-medium text-ink-700 transition hover:bg-ink-900/5 disabled:cursor-not-allowed disabled:opacity-45"
          >
            执行复盘
          </TooltipButton>
          <TooltipButton
            type="button"
            tooltip={showActivityRail ? "收起右侧栏" : "展开右侧栏"}
            onClick={() => setShowActivityRail((current) => !current)}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-ink-700 transition hover:bg-ink-900/5 ${showActivityRail ? "" : "bg-[#f3f6fb]"}`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="14" rx="2" />
              <path d="M15 5v14" />
              <path d="m17 12 2-2m-2 2 2 2" />
            </svg>
          </TooltipButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showSidebar && (
          <Sidebar
            connected={connected}
            onNewSession={handleNewSession}
            onArchiveSession={handleArchiveSession}
            onUnarchiveSession={handleUnarchiveSession}
            onRefreshArchivedSessions={handleRefreshArchivedSessions}
            onDeleteSession={handleDeleteSession}
            onDeleteWorkspace={handleDeleteWorkspace}
            onOpenSettings={openSettings}
            width={sidebarWidth}
          />
        )}
        {showSidebar && (
          <div
            className={`fixed bottom-0 ${sidebarHeaderOffsetClass} z-30 w-3 -translate-x-1/2 cursor-col-resize`}
            style={{ left: sidebarWidth }}
            onPointerDown={(event) => {
              event.preventDefault();
              setResizingPane("sidebar");
            }}
          >
            <div className="mx-auto h-full w-px bg-black/8" />
          </div>
        )}

        <main
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent"
          style={{
            marginLeft: `${sidebarOffset}px`,
            marginRight: `${activityRailOffset}px`,
          }}
        >

          {showSessionAnalysis ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <SessionAnalysisPage
                session={activeSession}
                partialMessage={partialMessage}
                onBack={() => setShowSessionAnalysis(false)}
                onSendWorkflowOptimizationPrompt={sendWorkflowOptimizationPrompt}
              />
            </div>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col">
                <div
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="chat-scroll flex-1 overflow-y-auto px-8 pb-40 pt-8"
                >
                <div className="chat-stream-content mx-auto w-full max-w-[clamp(920px,_calc(100vw-420px),_1320px)] rounded-[34px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,252,0.82))] px-8 py-7 shadow-[0_24px_60px_rgba(30,38,52,0.08)] backdrop-blur-xl xl:max-w-[clamp(920px,_calc(100vw-780px),_1320px)]">
                  <div ref={topSentinelRef} className="h-1" />
                  {renderEntries.length > 0 && (
                    <div className="sticky top-3 z-10 mb-5 flex justify-end">
                      <div className="flex items-center gap-1 rounded-full border border-black/6 bg-white/88 px-2 py-1 text-[11px] text-muted shadow-[0_14px_34px_rgba(30,38,52,0.10)] backdrop-blur-xl">
                        <span className="rounded-full bg-[#eef2f8] px-2 py-1">轮次 {chatOverview.rounds}</span>
                        <span className="rounded-full bg-[#eef2f8] px-2 py-1">工具 {chatOverview.tools}</span>
                        <button
                          type="button"
                          className="rounded-full px-2 py-1 font-semibold text-accent transition hover:bg-accent/10"
                          onClick={() => scrollToMessageIndex(chatOverview.latestUserIndex)}
                        >
                          最新提问
                        </button>
                        <button
                          type="button"
                          className="rounded-full px-2 py-1 font-semibold text-accent transition hover:bg-accent/10"
                          onClick={() => scrollChatToBottom("smooth")}
                        >
                          到底部
                        </button>
                      </div>
                    </div>
                  )}

                  {!hasMoreHistory && totalMessages > 0 && (
                    <div className="mb-4 flex items-center justify-center py-4">
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <div className="h-px w-14 bg-ink-900/10" />
                        <span>对话开始</span>
                        <div className="h-px w-14 bg-ink-900/10" />
                      </div>
                    </div>
                  )}

                  {isLoadingHistory && (
                    <div className="mb-4 flex items-center justify-center py-4">
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
                        <div key={entry.key} id={`chat-message-${entry.originalIndex}`}>
                          <MessageCard
                            message={entry.message}
                            isLast={isLastMessage}
                            isRunning={isRunning}
                            permissionRequest={permissionRequests[0]}
                            onPermissionResult={handlePermissionResult}
                          />
                        </div>
                      );
                    })
                  )}

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

                  <div ref={messagesEndRef} className="chat-bottom-anchor" />
                </div>
                </div>
              </div>
            </>
          )}

          {!showSessionAnalysis && (
            <PromptInput
              sendEvent={sendEvent}
              onSendMessage={handleSendMessage}
              disabled={!connected}
              leftOffset={sidebarOffset}
              rightOffset={activityRailOffset}
            />
          )}

          {hasNewMessages && !shouldAutoScroll && (
            <div
              style={{
                left: `${sidebarOffset}px`,
                right: `${activityRailOffset}px`,
                bottom: "calc(var(--composer-bottom-offset, 160px) + 0.5rem)",
              }}
              className="pointer-events-none fixed z-40 flex justify-center"
            >
              <button
                onClick={scrollToBottom}
                className="pointer-events-auto flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-accent-hover hover:scale-105 animate-bounce-subtle"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
                    <span>有新消息</span>
              </button>
            </div>
          )}
        </main>

        {!showSessionAnalysis && showActivityRail && workspaceView !== "browser" && (
          <ActivityRail
            session={activeSession}
            partialMessage={partialMessage}
            globalError={globalError}
            activeTab={activityRailTab}
            onActiveTabChange={setActivityRailTab}
            onOpenBrowserWorkbench={() => {
              setShowActivityRail(true);
              setShowSessionAnalysis(false);
              setWorkspaceView("browser");
            }}
            selectedModel={selectedUsageModel}
            contextWindow={selectedUsageModelConfig?.contextWindow}
            compressionThresholdPercent={selectedUsageModelConfig?.compressionThresholdPercent}
            hasBrowserTab={activeHasBrowserTab}
            onOpenSessionAnalysis={() => setShowSessionAnalysis(true)}
            width={activityRailWidth}
          />
        )}
        {!showSessionAnalysis && showActivityRail && (
          <aside
            className={`fixed bottom-0 right-0 ${sidebarHeaderOffsetClass} z-40 min-w-[400px] overflow-hidden border-l border-black/5 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.94),rgba(240,244,248,0.98)_42%,rgba(234,239,245,0.99))] shadow-[inset_1px_0_0_rgba(255,255,255,0.72)] backdrop-blur-xl ${workspaceView === "browser" ? "hidden lg:flex lg:flex-col" : "pointer-events-none hidden"}`}
            style={{ width: activityRailWidth }}
          >
            <BrowserWorkbenchPage
              key={activeSessionId ?? "browser-workbench"}
              active={workspaceView === "browser"}
              initialUrl={browserWorkbenchUrl}
              occluded={showSettingsModal || showStartModal}
              sessionId={activeSessionId}
              onOpenTrace={() => {
                setActivityRailTab("trace");
                setWorkspaceView("chat");
              }}
              onOpenUsage={() => {
                setActivityRailTab("usage");
                setWorkspaceView("chat");
              }}
            />
          </aside>
        )}
        {!showSessionAnalysis && showActivityRail && (
          <div
            className={`fixed bottom-0 ${sidebarHeaderOffsetClass} z-30 w-3 translate-x-1/2 cursor-col-resize`}
            style={{ right: activityRailWidth }}
            onPointerDown={(event) => {
              event.preventDefault();
              setResizingPane("activityRail");
            }}
          >
            <div className="mx-auto h-full w-px bg-black/8" />
          </div>
        )}
      </div>

      {showStartModal && (
        <StartSessionModal
          cwd={cwd}
          pendingStart={pendingStart}
          onCwdChange={setCwd}
          onStart={handleStartFromModal}
          onClose={() => setShowStartModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          onClose={() => {
            setShowSettingsModal(false);
            setSettingsInitialPageId(null);
            refreshBrowserWorkbenchPreference();
          }}
          initialPageId={settingsInitialPageId ?? undefined}
          onStartMaintenanceSession={startMaintenanceSession}
        />
      )}

      {globalError && (
        <div className="fixed bottom-28 left-1/2 z-50 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-error/15 bg-white/92 px-3.5 py-3 text-ink-800 shadow-[0_18px_45px_rgba(15,23,42,0.16)] backdrop-blur-xl">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-error" />
            <span className="min-w-0 flex-1 truncate text-sm" title={globalError}>{globalError}</span>
            <button
              type="button"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-400 transition hover:bg-error-light hover:text-error"
              onClick={() => setGlobalError(null)}
              aria-label="关闭提示"
              title="关闭提示"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
