import type { ClientEvent, ServerEvent, StreamMessage } from "./types";

const browserPreviewSessionId = "browser-preview-session";
const browserPreviewCwd = "/Users/lst01/Desktop/学习/tech-cc-hub";
const browserPreviewSlashCommands = ["codex", "review", "plan"];

const buildBrowserPreviewTitle = (input: string) => {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return "新聊天";
  return normalized.slice(0, 24);
};

export const installDevElectronShim = () => {
  if (typeof window === "undefined" || window.electron) return;

  let sessionCreatedAt = Date.now();
  let sessionUpdatedAt = sessionCreatedAt;
  let sessionStatus: "idle" | "running" | "completed" = "idle";
  let sessionTitle = "新聊天";
  let sessionMessages: StreamMessage[] = [];
  let browserState: BrowserWorkbenchState = {
    url: "",
    title: "浏览器预览",
    loading: false,
    canGoBack: false,
    canGoForward: false,
    annotationMode: false,
  };
  const platform = "browser";

  const buildSessionListEvent = (): ServerEvent => ({
    type: "session.list",
    payload: {
      sessions: [
        {
          id: browserPreviewSessionId,
          title: sessionTitle,
          status: sessionStatus,
          cwd: browserPreviewCwd,
          runSurface: "development",
          slashCommands: browserPreviewSlashCommands,
          createdAt: sessionCreatedAt,
          updatedAt: sessionUpdatedAt,
        },
      ],
    },
  });

  const buildSessionHistoryEvent = (): ServerEvent => ({
    type: "session.history",
    payload: {
      sessionId: browserPreviewSessionId,
      status: sessionStatus,
      mode: "replace",
      hasMore: false,
      slashCommands: browserPreviewSlashCommands,
      messages: sessionMessages,
    },
  });

  const listeners = new Set<(event: ServerEvent) => void>();
  const emit = (event: ServerEvent) => {
    window.setTimeout(() => {
      for (const listener of listeners) {
        listener(event);
      }
    }, 0);
  };

  const syncSession = () => {
    emit(buildSessionListEvent());
    emit(buildSessionHistoryEvent());
  };

  window.electron = {
    platform,
    subscribeStatistics: () => () => {},
    getStaticData: async () => ({
      totalStorage: 0,
      cpuModel: "Browser Preview",
      totalMemoryGB: 0,
    }),
    sendClientEvent: (event: ClientEvent) => {
      if (event.type === "session.list") {
        emit(buildSessionListEvent());
      }
      if (event.type === "session.history") {
        emit(buildSessionHistoryEvent());
      }
      if (event.type === "session.create") {
        sessionCreatedAt = Date.now();
        sessionUpdatedAt = sessionCreatedAt;
        sessionStatus = "idle";
        sessionTitle = event.payload.title?.trim() || "新聊天";
        sessionMessages = [];
        syncSession();
      }
      if (event.type === "session.start") {
        sessionUpdatedAt = Date.now();
        sessionStatus = "completed";
        sessionTitle = event.payload.title?.trim() || buildBrowserPreviewTitle(event.payload.prompt);
        sessionMessages = [
          {
            type: "user_prompt",
            prompt: event.payload.prompt,
            attachments: event.payload.attachments,
            capturedAt: sessionUpdatedAt,
          },
        ];
        syncSession();
      }
      if (event.type === "session.continue") {
        sessionUpdatedAt = Date.now();
        sessionStatus = "completed";
        sessionMessages = [
          ...sessionMessages,
          {
            type: "user_prompt",
            prompt: event.payload.prompt,
            attachments: event.payload.attachments,
            capturedAt: sessionUpdatedAt,
          },
        ];
        syncSession();
      }
    },
    onServerEvent: (callback: (event: ServerEvent) => void) => {
      listeners.add(callback);
      emit(buildSessionListEvent());
      return () => {
        listeners.delete(callback);
      };
    },
    generateSessionTitle: async (userInput: string | null) => userInput?.slice(0, 24) || "新聊天",
    getRecentCwds: async () => ["/Users/lst01/Desktop/学习/tech-cc-hub"],
    getSystemWorkspace: async () => "/Users/lst01/Desktop/学习/tech-cc-hub",
    selectDirectory: async () => "/Users/lst01/Desktop/学习/tech-cc-hub",
    getApiConfig: async () => ({ profiles: [] }),
    saveApiConfig: async () => ({ success: true }),
    getGlobalConfig: async () => ({}),
    saveGlobalConfig: async () => ({ success: true }),
    getSkillInventory: async () => ({ rootPath: "", skills: [] }),
    saveSkillInventory: async () => ({ success: true }),
    syncSkillSources: async () => ({ results: [] }),
    checkApiConfig: async () => ({ hasConfig: true, config: null }),
    debugSaveTraceSnapshot: async () => ({ success: true }),
    preprocessImageAttachments: async (payload) => ({
      success: true,
      attachments: payload.attachments,
    }),
    openBrowserWorkbench: async (url) => {
      browserState = {
        ...browserState,
        url,
        title: url ? `浏览器预览：${url}` : "浏览器预览",
      };
      return browserState;
    },
    closeBrowserWorkbench: async () => {
      browserState = {
        ...browserState,
        url: "",
        title: "浏览器预览",
        annotationMode: false,
      };
      return browserState;
    },
    setBrowserWorkbenchBounds: async () => browserState,
    reloadBrowserWorkbench: async () => browserState,
    goBackBrowserWorkbench: async () => browserState,
    goForwardBrowserWorkbench: async () => browserState,
    getBrowserWorkbenchState: async () => browserState,
    getBrowserWorkbenchConsoleLogs: async () => [],
    captureBrowserWorkbenchVisible: async () => ({
      success: false,
      error: "浏览器预览态暂不支持真实截图，请在 Electron 窗口使用。",
    }),
    inspectBrowserWorkbenchAtPoint: async () => null,
    setBrowserWorkbenchAnnotationMode: async (enabled) => {
      browserState = { ...browserState, annotationMode: enabled };
      return browserState;
    },
    onBrowserWorkbenchEvent: () => () => {},
  };
};
