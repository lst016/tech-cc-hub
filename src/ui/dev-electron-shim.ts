import type { ClientEvent, PromptAttachment, ServerEvent, StreamMessage } from "./types";
import type { AppUpdateActionResult, AppUpdateStatus } from "./types";

const browserPreviewSessionId = "browser-preview-session";
const browserPreviewCwd = "/Users/lst01/Desktop/学习/tech-cc-hub";
const browserPreviewSlashCommands = ["codex", "review", "plan"];
const DEV_BACKEND_BRIDGE_ORIGIN = "/__dev_bridge";
const BRIDGE_BOOT_RETRY_COUNT = 20;
const BRIDGE_BOOT_RETRY_DELAY_MS = 250;
export const DEV_BRIDGE_READY_EVENT = "tech-cc-hub:dev-bridge-ready";
const DEV_SHIM_MARKER = "__techCCHubDevShim";

export type DevElectronRuntimeSource = "bridge" | "fallback" | "electron";

async function invokePreviewFs<T>(endpoint: "list" | "read", payload: { cwd: string; path?: string }): Promise<T> {
  const url = new URL(`/__tech_preview/${endpoint}`, window.location.origin);
  url.searchParams.set("cwd", payload.cwd);
  if (payload.path) {
    url.searchParams.set("path", payload.path);
  }
  const response = await fetch(url, { cache: "no-store" });
  return await response.json() as T;
}

const unsupportedPreviewMutation = async () => ({
  success: false,
  error: "浏览器预览态暂不支持修改文件，请在 Electron 客户端里操作。",
});

const createPreviewUpdateStatus = (): AppUpdateStatus => ({
  status: "disabled",
  currentVersion: "0.1.1",
  isPackaged: false,
  provider: "github",
  error: "浏览器预览态不会检查 GitHub Releases 更新，请在打包后的 Electron 客户端里使用。",
});

const createPreviewUpdateResult = async (): Promise<AppUpdateActionResult> => {
  const status = createPreviewUpdateStatus();
  return { success: false, status, error: status.error };
};

export function getDevElectronRuntimeSource(): DevElectronRuntimeSource {
  if (typeof window === "undefined" || !window.electron) {
    return "fallback";
  }

  const marker = (window.electron as typeof window.electron & Record<string, unknown>)[DEV_SHIM_MARKER];
  if (marker === "bridge") return "bridge";
  if (marker === "fallback") return "fallback";
  return "electron";
}

const buildBrowserPreviewTitle = (input: string) => {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return "新聊天";
  return normalized.slice(0, 24);
};

function createFallbackElectron(): typeof window.electron & Record<string, unknown> {
  let sessionCreatedAt = Date.now();
  let sessionUpdatedAt = sessionCreatedAt;
  let sessionStatus: "idle" | "running" | "completed" = "idle";
  let sessionTitle = "新聊天";
  let sessionMessages: StreamMessage[] = [];
  const browserStateBySessionId: Record<string, BrowserWorkbenchState> = {};
  const createEmptyBrowserState = (): BrowserWorkbenchState => ({
    url: "",
    title: "浏览器预览",
    loading: false,
    canGoBack: false,
    canGoForward: false,
    annotationMode: false,
  });
  const getBrowserState = (sessionId?: string) => {
    const resolvedSessionId = sessionId?.trim() || "global";
    browserStateBySessionId[resolvedSessionId] ??= createEmptyBrowserState();
    return browserStateBySessionId[resolvedSessionId];
  };
  const setBrowserState = (sessionId: string | undefined, nextState: BrowserWorkbenchState) => {
    const resolvedSessionId = sessionId?.trim() || "global";
    browserStateBySessionId[resolvedSessionId] = nextState;
    return nextState;
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

  return {
    [DEV_SHIM_MARKER]: "fallback",
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
      if (event.type === "agent.list") {
        emit({ type: "agent.list", payload: { agents: [] } });
      }
    },
    onServerEvent: (callback: (event: ServerEvent) => void) => {
      listeners.add(callback);
      emit(buildSessionListEvent());
      return () => {
        listeners.delete(callback);
      };
    },
    generateSessionTitle: async (userInput: string | null, _options?: { model?: string }) => userInput?.slice(0, 24) || "新聊天",
    getRecentCwds: async () => ["/Users/lst01/Desktop/学习/tech-cc-hub"],
    getSystemWorkspace: async () => "/Users/lst01/Desktop/学习/tech-cc-hub",
    selectDirectory: async () => "/Users/lst01/Desktop/学习/tech-cc-hub",
    getApiConfig: async () => ({ profiles: [] }),
    saveApiConfig: async () => ({ success: true }),
    fetchApiModels: async () => ({ success: false, error: "当前没有连接 Electron 后端，无法拉取模型。" }),
    getAppUpdateStatus: async () => createPreviewUpdateStatus(),
    checkForAppUpdates: createPreviewUpdateResult,
    downloadAppUpdate: createPreviewUpdateResult,
    installAppUpdate: createPreviewUpdateResult,
    onAppUpdateStatus: () => () => {},
    getGlobalConfig: async () => ({}),
    saveGlobalConfig: async () => ({ success: true }),
    getAgentRuleDocuments: async () => ({
      systemDefaultMarkdown: [
        "# tech-cc-hub 系统默认规则",
        "",
        "这部分由应用内置生成，只用于展示当前软件默认加载的系统级 Agent 规则，不会写入用户目录。",
        "",
        "## 内置浏览器默认规则",
        "",
        "默认要求：涉及网页查看、抓取、调试、标注、截图的场景，默认优先使用 Electron 内置浏览器工作台（BrowserView）。",
        "",
        "禁止默认走外部 browse skill。请优先用浏览器 MCP（browser_get_state / browser_extract_page / browser_capture_visible ...）。",
        "",
        "设计还原默认规则：只要用户提供截图、Figma 图、页面参考图，并要求生成或修改 UI/前端代码，请优先使用设计 MCP。单张参考图先用 design_inspect_image 生成结构化视觉摘要；已有页面后再用 design_capture_current_view / design_compare_current_view / design_compare_images 生成当前截图、三栏比照图和差异图，再按差异修 UI。",
      ].join("\n"),
      userClaudeRoot: "/Users/lst01/.claude",
      userAgentsPath: "/Users/lst01/.claude/AGENTS.md",
      userAgentsMarkdown: [
        "# 用户级 Agent 规则",
        "",
        "在这里写的内容会保存到 `~/.claude/AGENTS.md`。",
      ].join("\n"),
    }),
    saveUserAgentRuleDocument: async () => ({ success: true }),
    getSkillInventory: async () => ({ rootPath: "", skills: [] }),
    saveSkillInventory: async () => ({ success: true }),
    syncSkillSources: async () => ({ results: [] }),
    listAvailableSkills: async () => [],
    listBuiltinAutoSkills: async () => [],
    getSkillPaths: async () => ({ userSkillsDir: "", builtinSkillsDir: "" }),
    detectAndCountExternalSkills: async () => ({ success: true, data: [] }),
    importSkillWithSymlink: async () => ({ success: false, msg: "浏览器预览态暂不支持导入 Skill，请在 Electron 客户端里操作。" }),
    deleteSkill: async () => ({ success: false, msg: "浏览器预览态暂不支持删除 Skill，请在 Electron 客户端里操作。" }),
    checkApiConfig: async () => ({ hasConfig: true, config: null }),
    debugSaveTraceSnapshot: async () => ({ success: true }),
    preprocessImageAttachments: async (payload: { attachments: PromptAttachment[] }) => ({
      success: true,
      attachments: payload.attachments,
    }),
    readPreviewFile: async (payload) => await invokePreviewFs("read", payload),
    listPreviewDirectory: async (payload) => await invokePreviewFs("list", payload),
    getPreviewImageBase64: async (payload) => await invokePreviewFs("read", payload),
    getPreviewFileMetadata: async () => null,
    writePreviewFile: unsupportedPreviewMutation,
    removePreviewEntry: unsupportedPreviewMutation,
    renamePreviewEntry: unsupportedPreviewMutation,
    openPreviewFile: async () => ({ success: false, error: "浏览器预览态暂不支持用系统应用打开文件。" }),
    showPreviewItemInFolder: async () => ({ success: false, error: "浏览器预览态暂不支持在 Finder 中定位。" }),
    openPreviewDirectoryDialog: async () => [],
    openBrowserWorkbench: async (url: string, sessionId?: string) => {
      const browserState = getBrowserState(sessionId);
      return setBrowserState(sessionId, {
        ...browserState,
        url,
        title: url ? `浏览器预览：${url}` : "浏览器预览",
      });
    },
    closeBrowserWorkbench: async (sessionId?: string) => {
      const browserState = getBrowserState(sessionId);
      return setBrowserState(sessionId, {
        ...browserState,
        url: "",
        title: "浏览器预览",
        annotationMode: false,
      });
    },
    setBrowserWorkbenchBounds: async (_bounds: unknown, sessionId?: string) => getBrowserState(sessionId),
    reloadBrowserWorkbench: async (sessionId?: string) => getBrowserState(sessionId),
    goBackBrowserWorkbench: async (sessionId?: string) => getBrowserState(sessionId),
    goForwardBrowserWorkbench: async (sessionId?: string) => getBrowserState(sessionId),
    getBrowserWorkbenchState: async (sessionId?: string) => getBrowserState(sessionId),
    getBrowserWorkbenchConsoleLogs: async () => [],
    captureBrowserWorkbenchVisible: async () => ({
      success: false,
      error: "浏览器预览态暂不支持真实截图，请在 Electron 窗口使用。",
    }),
    inspectBrowserWorkbenchAtPoint: async () => null,
    clearBrowserWorkbenchAnnotations: async (sessionId?: string) => getBrowserState(sessionId),
    setBrowserWorkbenchAnnotationMode: async (enabled: boolean, sessionId?: string) => (
      setBrowserState(sessionId, { ...getBrowserState(sessionId), annotationMode: enabled })
    ),
    openBrowserWorkbenchDevTools: async () => ({ opened: false }),
    closeBrowserWorkbenchDevTools: async () => ({ opened: false }),
    isBrowserWorkbenchDevToolsOpen: async () => false,
    onBrowserWorkbenchEvent: () => () => {},
  };
}

async function invokeBridge<T>(method: string, ...args: unknown[]): Promise<T> {
  const response = await fetch(`${DEV_BACKEND_BRIDGE_ORIGIN}/rpc/${encodeURIComponent(method)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ args }),
  });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || `Bridge call failed: ${method}`);
  }
  return payload.result as T;
}

async function createBridgeElectron(): Promise<(typeof window.electron & Record<string, unknown>) | null> {
  try {
    const response = await fetch(`${DEV_BACKEND_BRIDGE_ORIGIN}/health`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const health = await response.json();
    const serverListeners = new Set<(event: ServerEvent) => void>();
    const replayEventTypes = new Set<ClientEvent["type"]>([
      "session.list",
      "session.history",
      "session.workflow.catalog.list",
    ]);

    return {
      [DEV_SHIM_MARKER]: "bridge",
      platform: health.platform ?? "browser",
      subscribeStatistics: () => () => {},
      getStaticData: async () => await invokeBridge("getStaticData"),
      sendClientEvent: (event: ClientEvent) => {
        void invokeBridge<{ events?: ServerEvent[] }>("sendClientEvent", event)
          .then((result) => {
            if (!replayEventTypes.has(event.type)) return;
            for (const emittedEvent of result.events ?? []) {
              for (const listener of serverListeners) {
                listener(emittedEvent);
              }
            }
          })
          .catch((error) => {
            console.error("Failed to send bridged client event:", error);
          });
      },
      onServerEvent: (callback: (event: ServerEvent) => void) => {
        serverListeners.add(callback);
        const source = new EventSource(`${DEV_BACKEND_BRIDGE_ORIGIN}/events/server`);
        source.onmessage = (message) => {
          callback(JSON.parse(message.data) as ServerEvent);
        };
        return () => {
          serverListeners.delete(callback);
          source.close();
        };
      },
      generateSessionTitle: async (userInput: string | null, options?: { model?: string }) => await invokeBridge("generateSessionTitle", userInput, options),
      getRecentCwds: async (limit?: number) => await invokeBridge("getRecentCwds", limit),
      getSystemWorkspace: async () => await invokeBridge("getSystemWorkspace"),
      selectDirectory: async () => await invokeBridge("selectDirectory"),
      getApiConfig: async () => await invokeBridge("getApiConfig"),
      saveApiConfig: async (config) => await invokeBridge("saveApiConfig", config),
      fetchApiModels: async (payload) => await invokeBridge("fetchApiModels", payload),
      getAppUpdateStatus: async () => await invokeBridge("getAppUpdateStatus"),
      checkForAppUpdates: async () => await invokeBridge("checkForAppUpdates"),
      downloadAppUpdate: async () => await invokeBridge("downloadAppUpdate"),
      installAppUpdate: async () => await invokeBridge("installAppUpdate"),
      onAppUpdateStatus: () => () => {},
      getGlobalConfig: async () => await invokeBridge("getGlobalConfig"),
      saveGlobalConfig: async (config) => await invokeBridge("saveGlobalConfig", config),
      getAgentRuleDocuments: async () => await invokeBridge("getAgentRuleDocuments"),
      saveUserAgentRuleDocument: async (markdown: string) => await invokeBridge("saveUserAgentRuleDocument", markdown),
      getSkillInventory: async () => await invokeBridge("getSkillInventory"),
      saveSkillInventory: async (inventory) => await invokeBridge("saveSkillInventory", inventory),
      syncSkillSources: async (request) => await invokeBridge("syncSkillSources", request),
      listAvailableSkills: async () => await invokeBridge("listAvailableSkills"),
      listBuiltinAutoSkills: async () => await invokeBridge("listBuiltinAutoSkills"),
      getSkillPaths: async () => await invokeBridge("getSkillPaths"),
      detectAndCountExternalSkills: async () => await invokeBridge("detectAndCountExternalSkills"),
      importSkillWithSymlink: async (skillPath) => await invokeBridge("importSkillWithSymlink", skillPath),
      deleteSkill: async (skillName) => await invokeBridge("deleteSkill", skillName),
      checkApiConfig: async () => await invokeBridge("checkApiConfig"),
      debugSaveTraceSnapshot: async (snapshot) => await invokeBridge("debugSaveTraceSnapshot", snapshot),
      preprocessImageAttachments: async (payload) => await invokeBridge("preprocessImageAttachments", payload),
      readPreviewFile: async (payload) => await invokePreviewFs("read", payload),
      listPreviewDirectory: async (payload) => await invokePreviewFs("list", payload),
      getPreviewImageBase64: async (payload) => await invokePreviewFs("read", payload),
      getPreviewFileMetadata: async () => null,
      writePreviewFile: unsupportedPreviewMutation,
      removePreviewEntry: unsupportedPreviewMutation,
      renamePreviewEntry: unsupportedPreviewMutation,
      openPreviewFile: async () => ({ success: false, error: "浏览器预览态暂不支持用系统应用打开文件。" }),
      showPreviewItemInFolder: async () => ({ success: false, error: "浏览器预览态暂不支持在 Finder 中定位。" }),
      openPreviewDirectoryDialog: async () => [],
      openBrowserWorkbench: async (url, sessionId?: string) => await invokeBridge("openBrowserWorkbench", url, sessionId),
      closeBrowserWorkbench: async (sessionId?: string) => await invokeBridge("closeBrowserWorkbench", sessionId),
      setBrowserWorkbenchBounds: async (bounds, sessionId?: string) => await invokeBridge("setBrowserWorkbenchBounds", bounds, sessionId),
      reloadBrowserWorkbench: async (sessionId?: string) => await invokeBridge("reloadBrowserWorkbench", sessionId),
      goBackBrowserWorkbench: async (sessionId?: string) => await invokeBridge("goBackBrowserWorkbench", sessionId),
      goForwardBrowserWorkbench: async (sessionId?: string) => await invokeBridge("goForwardBrowserWorkbench", sessionId),
      getBrowserWorkbenchState: async (sessionId?: string) => await invokeBridge("getBrowserWorkbenchState", sessionId),
      getBrowserWorkbenchConsoleLogs: async (limit?: number, sessionId?: string) => await invokeBridge("getBrowserWorkbenchConsoleLogs", limit, sessionId),
      captureBrowserWorkbenchVisible: async (sessionId?: string) => await invokeBridge("captureBrowserWorkbenchVisible", sessionId),
      inspectBrowserWorkbenchAtPoint: async (point, sessionId?: string) => await invokeBridge("inspectBrowserWorkbenchAtPoint", point, sessionId),
      clearBrowserWorkbenchAnnotations: async (sessionId?: string) => await invokeBridge("clearBrowserWorkbenchAnnotations", sessionId),
      setBrowserWorkbenchAnnotationMode: async (enabled: boolean, sessionId?: string) => await invokeBridge("setBrowserWorkbenchAnnotationMode", enabled, sessionId),
      openBrowserWorkbenchDevTools: async (sessionId?: string) => await invokeBridge("openBrowserWorkbenchDevTools", sessionId),
      closeBrowserWorkbenchDevTools: async (sessionId?: string) => await invokeBridge("closeBrowserWorkbenchDevTools", sessionId),
      isBrowserWorkbenchDevToolsOpen: async (sessionId?: string) => await invokeBridge("isBrowserWorkbenchDevToolsOpen", sessionId),
      onBrowserWorkbenchEvent: (callback: (event: any) => void) => {
        const source = new EventSource(`${DEV_BACKEND_BRIDGE_ORIGIN}/events/browser`);
        source.onmessage = (message) => {
          callback(JSON.parse(message.data));
        };
        return () => source.close();
      },
    };
  } catch {
    return null;
  }
}

async function waitForBridgeElectron(): Promise<(typeof window.electron & Record<string, unknown>) | null> {
  for (let attempt = 0; attempt < BRIDGE_BOOT_RETRY_COUNT; attempt += 1) {
    const bridgeElectron = await createBridgeElectron();
    if (bridgeElectron) {
      return bridgeElectron;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, BRIDGE_BOOT_RETRY_DELAY_MS);
    });
  }

  return null;
}

export const installDevElectronShim = async () => {
  if (typeof window === "undefined") return;
  const existingElectron = window.electron as (typeof window.electron & Record<string, unknown>) | undefined;
  if (existingElectron && existingElectron[DEV_SHIM_MARKER] !== "fallback" && existingElectron[DEV_SHIM_MARKER] !== "bridge") {
    return;
  }
  const bridgeElectron = await waitForBridgeElectron();
  if (bridgeElectron) {
    window.electron = bridgeElectron;
    window.dispatchEvent(new CustomEvent(DEV_BRIDGE_READY_EVENT));
    return;
  }

  let currentElectron: typeof window.electron & Record<string, unknown> = createFallbackElectron();
  const electronProxy = new Proxy({} as typeof window.electron, {
    get(_target, property) {
      const value = (currentElectron as any)[property];
      return typeof value === "function" ? value.bind(currentElectron) : value;
    },
  });

  window.electron = electronProxy;

  void (async () => {
    const nextBridgeElectron = await waitForBridgeElectron();
    if (!nextBridgeElectron) {
      return;
    }

    currentElectron = nextBridgeElectron;
    window.dispatchEvent(new CustomEvent(DEV_BRIDGE_READY_EVENT));
  })();
};
