import type { ApiConfigSettings, ClientEvent, PromptAttachment, ServerEvent, StreamMessage, UiGitCommitDetail, UiGitCommitMessageSuggestion, UiGitDiffResult, UiGitResult, UiGitWorkbenchSnapshot } from "./types";
import type { AppUpdateActionResult, AppUpdateStatus } from "./types";
import type { BuiltinMcpServerName } from "../shared/builtin-mcp-registry";

const browserPreviewSessionId = "browser-preview-session";
const browserPreviewCwd = "/Users/lst01/Desktop/学习/tech-cc-hub";
const browserPreviewSlashCommands = [
  { name: "codex", description: "Codex 会话命令" },
  { name: "review", description: "进入代码审查模式" },
  { name: "plan", description: "生成计划，不直接执行" },
];
const browserPreviewSlashCommandNames = browserPreviewSlashCommands.map((command) => command.name);
const DEV_BACKEND_BRIDGE_ORIGIN = "/__dev_bridge";
const BRIDGE_BOOT_RETRY_COUNT = 20;
const BRIDGE_BOOT_RETRY_DELAY_MS = 250;
const BRIDGE_HEALTH_TIMEOUT_MS = 500;
export const DEV_BRIDGE_READY_EVENT = "tech-cc-hub:dev-bridge-ready";
export const DEV_BROWSER_PREVIEW_FLAG = "__tech_cc_hub_browser_preview";
const DEV_SHIM_MARKER = "__techCCHubDevShim";
const DEV_BUILTIN_MCP_SERVER_NAMES: readonly BuiltinMcpServerName[] = [
  "tech-cc-hub-browser",
  "tech-cc-hub-admin",
  "tech-cc-hub-design",
  "tech-cc-hub-figma",
  "tech-cc-hub-cron",
  "tech-cc-hub-idea",
  "tech-cc-hub-plan",
  "tech-cc-hub-knowledge",
];
const devEnabledBuiltinMcpServers = new Set<BuiltinMcpServerName>([
  "tech-cc-hub-browser",
  "tech-cc-hub-admin",
  "tech-cc-hub-design",
  "tech-cc-hub-cron",
  "tech-cc-hub-plan",
  "tech-cc-hub-knowledge",
]);

export type DevElectronRuntimeSource = "bridge" | "fallback" | "electron";

async function invokePreviewFs<T>(endpoint: "list" | "files" | "read" | "write", payload: { cwd: string; path?: string; limit?: number; data?: string }): Promise<T> {
  const url = new URL(`/__tech_preview/${endpoint}`, window.location.origin);
  if (endpoint === "write") {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return await response.json() as T;
  }
  url.searchParams.set("cwd", payload.cwd);
  if (payload.path) {
    url.searchParams.set("path", payload.path);
  }
  if (payload.limit) {
    url.searchParams.set("limit", String(payload.limit));
  }
  const response = await fetch(url, { cache: "no-store" });
  return await response.json() as T;
}

async function invokePreviewTerminal<T>(endpoint: "run" | "start" | "list" | "stop", payload?: unknown): Promise<T> {
  const response = await fetch(`/__tech_terminal/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload ?? {}),
    cache: "no-store",
  });
  return await response.json() as T;
}

const unsupportedPreviewMutation = async () => ({
  success: false,
  error: "浏览器预览态暂不支持修改文件，请在 Electron 客户端里操作。",
});

const createPreviewGitResult = <T,>(): UiGitResult<T> => ({
  success: false,
  error: {
    code: "not_a_repo",
    message: "浏览器预览态没有可操作的 Git 仓库，请在 Electron 客户端里使用 Git 工作台。",
  },
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

function getPreviewQaApiConfig(): ApiConfigSettings | null {
  const config = (window as Window & { __TECH_CC_HUB_QA_API_CONFIG__?: unknown }).__TECH_CC_HUB_QA_API_CONFIG__;
  if (!config || typeof config !== "object") return null;
  if (!Array.isArray((config as { profiles?: unknown }).profiles)) return null;
  return config as ApiConfigSettings;
}

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
  const qaPlanPreviewEnabled = new URLSearchParams(window.location.search).get("qaPlanPreview") === "1";
  let sessionCreatedAt = Date.now();
  let sessionUpdatedAt = sessionCreatedAt;
  let sessionStatus: "idle" | "running" | "completed" = qaPlanPreviewEnabled ? "running" : "idle";
  let sessionTitle = qaPlanPreviewEnabled ? "聊天列表计划预览" : "新聊天";
  let sessionModel = "";
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
          model: sessionModel,
          runSurface: "development",
          slashCommands: browserPreviewSlashCommandNames,
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
      slashCommands: browserPreviewSlashCommandNames,
      messages: sessionMessages,
    },
  });

  const buildPlanPreviewEvent = (completed = false): ServerEvent => ({
    type: "session.plan.updated",
    payload: {
      sessionId: browserPreviewSessionId,
      source: "update_plan",
      updatedAt: Date.now(),
      explanation: "聊天列表底部计划验收",
      plan: [
        { step: "检查聊天列表现有数据链路", status: "completed" },
        { step: "实现计划清单底部固定展示", status: "completed" },
        { step: "验证固定位置与自动消失", status: completed ? "completed" : "in_progress" },
        { step: "运行定向测试与视觉验收", status: completed ? "completed" : "pending" },
      ],
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

  if (qaPlanPreviewEnabled) {
    const qaWindow = window as Window & {
      __TECH_CC_HUB_PLAN_QA__?: { complete: () => void };
    };
    qaWindow.__TECH_CC_HUB_PLAN_QA__ = {
      complete: () => {
        sessionUpdatedAt = Date.now();
        sessionStatus = "completed";
        emit(buildPlanPreviewEvent(true));
        emit(buildSessionListEvent());
      },
    };
  }

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
        sessionModel = "";
        sessionTitle = event.payload.title?.trim() || "新聊天";
        sessionMessages = [];
        syncSession();
      }
      if (event.type === "session.start") {
        sessionUpdatedAt = Date.now();
        sessionStatus = "completed";
        sessionTitle = event.payload.title?.trim() || buildBrowserPreviewTitle(event.payload.prompt);
        sessionModel = event.payload.runtime?.model?.trim() || sessionModel;
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
      if (event.type === "channel.message.receive") {
        sessionUpdatedAt = Date.now();
        sessionStatus = "completed";
        sessionTitle = event.payload.title?.trim()
          || `${event.payload.provider} · ${event.payload.channelName || event.payload.senderName || event.payload.externalConversationId || "default"}`;
        sessionMessages = [
          ...sessionMessages,
          {
            type: "user_prompt",
            prompt: event.payload.text,
            attachments: event.payload.attachments,
            capturedAt: sessionUpdatedAt,
          },
        ];
        syncSession();
      }
      if (event.type === "session.continue") {
        sessionUpdatedAt = Date.now();
        sessionStatus = "completed";
        sessionModel = event.payload.runtime?.model?.trim() || sessionModel;
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
      if (event.type === "session.set_model") {
        sessionUpdatedAt = Date.now();
        sessionModel = event.payload.model.trim();
        emit({
          type: "session.status",
          payload: {
            sessionId: event.payload.sessionId,
            status: sessionStatus,
            title: sessionTitle,
            cwd: browserPreviewCwd,
            model: sessionModel,
            slashCommands: browserPreviewSlashCommandNames,
          },
        });
        emit(buildSessionListEvent());
      }
      if (event.type === "agent.list") {
        emit({ type: "agent.list", payload: { agents: [] } });
      }
      if (event.type === "mcp.list") {
        emit({
          type: "mcp.list",
          payload: {
            builtin: DEV_BUILTIN_MCP_SERVER_NAMES.map((name) => ({
              name,
              type: "builtin",
              command: "builtin",
              args: [],
              envKeys: [],
              enabled: devEnabledBuiltinMcpServers.has(name),
            })),
            external: [],
          },
        });
      }
      if (event.type === "mcp.builtin.setEnabled") {
        if (event.payload.enabled) {
          devEnabledBuiltinMcpServers.add(event.payload.name);
        } else {
          devEnabledBuiltinMcpServers.delete(event.payload.name);
        }
        emit({
          type: "mcp.list",
          payload: {
            builtin: DEV_BUILTIN_MCP_SERVER_NAMES.map((name) => ({
              name,
              type: "builtin",
              command: "builtin",
              args: [],
              envKeys: [],
              enabled: devEnabledBuiltinMcpServers.has(name),
            })),
            external: [],
          },
        });
      }
    },
    onServerEvent: (callback: (event: ServerEvent) => void) => {
      listeners.add(callback);
      emit(buildSessionListEvent());
      if (qaPlanPreviewEnabled) {
        emit(buildPlanPreviewEvent());
      }
      return () => {
        listeners.delete(callback);
      };
    },
    generateSessionTitle: async (userInput: string | null) => userInput?.slice(0, 24) || "新聊天",
    getRecentCwds: async () => ["/Users/lst01/Desktop/学习/tech-cc-hub"],
    getSystemWorkspace: async () => "/Users/lst01/Desktop/学习/tech-cc-hub",
    selectDirectory: async () => "/Users/lst01/Desktop/学习/tech-cc-hub",
    getApiConfig: async () => getPreviewQaApiConfig() ?? { profiles: [] },
    saveApiConfig: async () => ({ success: true }),
    fetchApiModels: async () => ({ success: false, error: "当前没有连接 Electron 后端，无法拉取模型。" }),
    testApiConfig: async () => ({ success: false, error: "当前没有连接 Electron 后端，无法测试连接。" }),
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
        "禁止默认走外部 browse skill。请优先用浏览器 MCP（browser_get_state / browser_extract_page / browser_fetch_logs / browser_capture_visible ...）。",
        "",
        "设计还原默认规则：只要用户提供截图、Figma 图、页面参考图，并要求生成或修改 UI/前端代码，请优先使用设计 MCP。单张参考图先用 design_inspect_image 生成结构化视觉摘要；已有页面后再用 design_capture_current_view / design_compare_current_view / design_compare_images 生成当前截图、三栏比照图、差异图和 JSON report，再根据 differenceRatio、diffBoundingBox、topDiffRegions 修 UI。动态区域用 ignoreRegions，验收阈值用 maxDifferenceRatio。后续轮次先用 design_list_artifacts 找回产物，再用 design_read_comparison_report 读取历史 report。",
        "",
        "## Karpathy Coding Guardrails 默认规则",
        "",
        "来源：https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md",
        "",
        "编码前先澄清假设、歧义和取舍；不确定时要显式说明，不要假装已经理解。",
        "",
        "优先选择能解决问题的最小实现；不要增加用户没有要求的功能、抽象、配置项或防御性复杂度。",
        "",
        "修改必须外科手术式收敛；只触碰完成本次请求必需的代码，匹配现有风格，不顺手重构无关区域。",
        "",
        "多步骤任务需要先定义可验证的成功标准；修 bug 和重构应优先有复现/验收路径，再进入实现闭环。",
      ].join("\n"),
      userClaudeRoot: "/Users/lst01/.claude",
      userAgentsPath: "/Users/lst01/.claude/CLAUDE.md",
      userAgentsMarkdown: [
        "# 用户级 Agent 规则",
        "",
        "在这里写的内容会保存到 `~/.claude/CLAUDE.md`。",
      ].join("\n"),
    }),
    saveUserAgentRuleDocument: async () => ({ success: true }),
    invoke: async <T,>(channel: string, ...args: unknown[]): Promise<T> => {
      if (channel === "sessions:list") {
        const payload = args[0] && typeof args[0] === "object" ? args[0] as { archived?: unknown } : {};
        const archived = payload.archived === true;
        const sessionListPayload = buildSessionListEvent().payload as { sessions: unknown[] };
        return {
          sessions: archived ? [] : sessionListPayload.sessions,
          archived,
        } as T;
      }
      if (channel === "slash-commands:list") {
        try {
          return await invokeBridge("listSlashCommands", args[0]) as T;
        } catch {
          return { commands: browserPreviewSlashCommands } as T;
        }
      }
      if (channel === "terminal:run") {
        return await invokePreviewTerminal("run", args[0]) as T;
      }
      if (channel === "terminal:start") {
        return await invokePreviewTerminal("start", args[0]) as T;
      }
      if (channel === "terminal:stop") {
        return await invokePreviewTerminal("stop", args[0]) as T;
      }
      if (channel === "terminal:list") {
        return await invokePreviewTerminal("list") as T;
      }
      throw new Error("浏览器预览态不支持 IPC invoke，请在 Electron 客户端里操作。");
    },
    checkApiConfig: async () => ({ hasConfig: true, config: null }),
    debugSaveTraceSnapshot: async () => ({ success: true }),
    preprocessImageAttachments: async (payload: { attachments: PromptAttachment[] }) => ({
      success: true,
      attachments: payload.attachments,
    }),
    getGitSnapshot: async () => createPreviewGitResult<UiGitWorkbenchSnapshot>(),
    getGitDiff: async () => createPreviewGitResult<UiGitDiffResult>(),
    getGitCommitDetail: async () => createPreviewGitResult<UiGitCommitDetail>(),
    gitStageFiles: async () => createPreviewGitResult<UiGitWorkbenchSnapshot>(),
    gitUnstageFiles: async () => createPreviewGitResult<UiGitWorkbenchSnapshot>(),
    gitCommit: async () => createPreviewGitResult<UiGitWorkbenchSnapshot>(),
    generateGitCommitMessageFast: async () => createPreviewGitResult<UiGitCommitMessageSuggestion>(),
    generateGitCommitMessage: async () => createPreviewGitResult<UiGitCommitMessageSuggestion>(),
    gitPull: async () => createPreviewGitResult<UiGitWorkbenchSnapshot>(),
    gitPush: async () => createPreviewGitResult<UiGitWorkbenchSnapshot>(),
    gitCreateBranch: async () => createPreviewGitResult<UiGitWorkbenchSnapshot>(),
    gitCheckoutBranch: async () => createPreviewGitResult<UiGitWorkbenchSnapshot>(),
    gitStashSave: async () => createPreviewGitResult<UiGitWorkbenchSnapshot>(),
    gitStashApply: async () => createPreviewGitResult<UiGitWorkbenchSnapshot>(),
    gitStashDrop: async () => createPreviewGitResult<UiGitWorkbenchSnapshot>(),
    readPreviewFile: async (payload) => await invokePreviewFs("read", payload),
    listPreviewDirectory: async (payload) => await invokePreviewFs("list", payload),
    listPreviewFiles: async (payload) => await invokePreviewFs("files", payload),
    getPreviewImageBase64: async (payload) => await invokePreviewFs("read", payload),
    getPreviewFileMetadata: async () => null,
    writePreviewFile: async (payload) => await invokePreviewFs("write", payload),
    removePreviewEntry: unsupportedPreviewMutation,
    renamePreviewEntry: unsupportedPreviewMutation,
    openPreviewFile: async () => ({ success: false, error: "浏览器预览态暂不支持用系统应用打开文件。" }),
    showPreviewItemInFolder: async () => ({ success: false, error: "浏览器预览态暂不支持在 Finder 中定位。" }),
    openPreviewDirectoryDialog: async () => [],
    workspacePlugins: {
      list: async () => [],
      open: async () => {
        throw new Error("Workspace plugins require the Electron desktop runtime.");
      },
      close: async () => {},
    },
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
    hideAllBrowserWorkbenches: async () => [],
    reloadBrowserWorkbench: async (sessionId?: string) => getBrowserState(sessionId),
    goBackBrowserWorkbench: async (sessionId?: string) => getBrowserState(sessionId),
    goForwardBrowserWorkbench: async (sessionId?: string) => getBrowserState(sessionId),
    getBrowserWorkbenchState: async (sessionId?: string) => getBrowserState(sessionId),
    getBrowserWorkbenchConsoleLogs: async () => [],
    getBrowserWorkbenchFetchLogs: async () => ({
      success: true,
      result: { url: "", captureEnabled: false, count: 0, entries: [] },
    }),
    captureBrowserWorkbenchVisible: async () => ({
      success: false,
      error: "浏览器预览态暂不支持真实截图，请在 Electron 窗口使用。",
    }),
    inspectBrowserWorkbenchAtPoint: async () => null,
    clickBrowserWorkbenchAtPoint: async (_point: { x: number; y: number; dblClick?: boolean }, sessionId?: string) => ({
      success: false,
      action: "click",
      state: getBrowserState(sessionId),
      error: "浏览器预览态暂不支持真实点击，请在 Electron 窗口中操作。",
    }),
    clearBrowserWorkbenchAnnotations: async (sessionId?: string) => getBrowserState(sessionId),
    removeBrowserWorkbenchAnnotation: async (_annotationId: string, sessionId?: string) => getBrowserState(sessionId),
    setBrowserWorkbenchAnnotationMode: async (enabled: boolean, sessionId?: string) => (
      setBrowserState(sessionId, { ...getBrowserState(sessionId), annotationMode: enabled })
    ),
    openBrowserWorkbenchDevTools: async () => ({ opened: false }),
    closeBrowserWorkbenchDevTools: async () => ({ opened: false }),
    isBrowserWorkbenchDevToolsOpen: async () => false,
    startBrowserWorkbenchRecording: async () => ({
      success: false,
      recording: false,
      actionCount: 0,
      error: "浏览器预览态暂不支持录制，请在 Electron 窗口中操作。",
    }),
    stopBrowserWorkbenchRecording: async () => ({
      success: false,
      recording: false,
      actionCount: 0,
      error: "浏览器预览态没有正在运行的录制。",
    }),
    getBrowserWorkbenchRecordingState: async () => ({ recording: false, actionCount: 0 }),
    setBrowserWorkbenchRecordingAssertionMode: async () => ({ recording: false, actionCount: 0, assertionMode: false }),
    runBrowserWorkbenchRecording: async () => ({
      success: false,
      status: "error",
      recordingId: "",
      startedAt: Date.now(),
      endedAt: Date.now(),
      durationMs: 0,
      workspaceRoot: "",
      rootPath: "",
      specPath: "",
      outputDir: "",
      command: "",
      args: [],
      stdout: "",
      stderr: "",
      events: [],
      attachments: {
        traceFiles: [],
        screenshotFiles: [],
        videoFiles: [],
        otherFiles: [],
      },
      error: "浏览器预览态暂不支持运行录制测试，请在 Electron 窗口中操作。",
    }),
    cancelBrowserWorkbenchRecordingRun: async () => ({
      success: false,
      error: "浏览器预览态没有正在运行的录制测试。",
    }),
    openBrowserWorkbenchRecordingRunOutput: async () => ({
      success: false,
      error: "浏览器预览态暂不支持打开运行输出。",
    }),
    openBrowserWorkbenchRecordingTraceViewer: async () => ({
      success: false,
      error: "浏览器预览态暂不支持打开 trace。",
    }),
    listBrowserWorkbenchRecordings: async () => [],
    loadBrowserWorkbenchRecording: async () => ({
      success: false,
      recording: false,
      actionCount: 0,
      error: "浏览器预览态暂不支持加载录制历史。",
    }),
    updateBrowserWorkbenchRecordingArtifact: async () => ({
      success: false,
      recordingPackage: {
        id: "",
        createdAt: Date.now(),
        rootPathHint: "",
        recordingPath: "",
        generatedSpecPath: "",
        recording: undefined as never,
        environment: undefined as never,
        dataScenarios: [],
        suite: undefined as never,
        diagnostics: [],
        artifacts: [],
      },
      artifactPath: "",
      error: "浏览器预览态暂不支持保存录制文件。",
    }),
    startBrowserWorkbenchRecordingLocatorPick: async () => ({ recording: false, actionCount: 0 }),
    cancelBrowserWorkbenchRecordingLocatorPick: async () => ({ recording: false, actionCount: 0 }),
    addBrowserWorkbenchRecordingAssertion: async () => ({
      success: false,
      recording: false,
      actionCount: 0,
      error: "浏览器预览态暂不支持添加录制断言。",
    }),
    repairBrowserWorkbenchRecordingLocator: async () => ({
      success: false,
      recording: false,
      actionCount: 0,
      error: "浏览器预览态暂不支持修复录制包。",
    }),
    onBrowserWorkbenchEvent: () => () => {},
    onCronJobCreated: () => () => {},
    onCronJobUpdated: () => () => {},
    onCronJobRemoved: () => () => {},
    onCronJobExecuted: () => () => {},
    captureScreenshot: async () => null,
    submitFeedback: async () => ({ success: false, error: "浏览器预览态不支持提交反馈，请在 Electron 窗口中操作。" }),
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
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), BRIDGE_HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${DEV_BACKEND_BRIDGE_ORIGIN}/health`, {
      cache: "no-store",
      signal: controller.signal,
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
      "agent.list",
      "mcp.list",
      "mcp.builtin.setEnabled",
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
      getApiConfig: async () => getPreviewQaApiConfig() ?? await invokeBridge("getApiConfig"),
      saveApiConfig: async (config) => await invokeBridge("saveApiConfig", config),
      fetchApiModels: async (payload) => await invokeBridge("fetchApiModels", payload),
      testApiConfig: async (payload) => await invokeBridge("testApiConfig", payload),
      getAppUpdateStatus: async () => await invokeBridge("getAppUpdateStatus"),
      checkForAppUpdates: async () => await invokeBridge("checkForAppUpdates"),
      downloadAppUpdate: async () => await invokeBridge("downloadAppUpdate"),
      installAppUpdate: async () => await invokeBridge("installAppUpdate"),
      onAppUpdateStatus: () => () => {},
      getGlobalConfig: async () => await invokeBridge("getGlobalConfig"),
      saveGlobalConfig: async (config) => await invokeBridge("saveGlobalConfig", config),
      getAgentRuleDocuments: async () => await invokeBridge("getAgentRuleDocuments"),
      saveUserAgentRuleDocument: async (markdown: string) => await invokeBridge("saveUserAgentRuleDocument", markdown),
      invoke: async <T,>(channel: string, ...args: unknown[]): Promise<T> => {
        if (channel === "sessions:list") {
          return await invokeBridge("listSessions", args[0]) as T;
        }
        if (channel === "slash-commands:list") {
          return await invokeBridge("listSlashCommands", args[0]) as T;
        }
        return await invokeBridge("invoke", channel, ...args);
      },
      checkApiConfig: async () => await invokeBridge("checkApiConfig"),
      debugSaveTraceSnapshot: async (snapshot) => await invokeBridge("debugSaveTraceSnapshot", snapshot),
      preprocessImageAttachments: async (payload) => await invokeBridge("preprocessImageAttachments", payload),
      getGitSnapshot: async (payload) => await invokeBridge("invoke", "git:snapshot", payload),
      getGitDiff: async (payload) => await invokeBridge("invoke", "git:diff", payload),
      getGitCommitDetail: async (payload) => await invokeBridge("invoke", "git:commitDetail", payload),
      gitStageFiles: async (payload) => await invokeBridge("invoke", "git:stage", payload),
      gitUnstageFiles: async (payload) => await invokeBridge("invoke", "git:unstage", payload),
      gitCommit: async (payload) => await invokeBridge("invoke", "git:commit", payload),
      generateGitCommitMessageFast: async (payload) => await invokeBridge("invoke", "git:generateCommitMessageFast", payload),
      generateGitCommitMessage: async (payload) => await invokeBridge("invoke", "git:generateCommitMessage", payload),
      gitPull: async (payload) => await invokeBridge("invoke", "git:pull", payload),
      gitPush: async (payload) => await invokeBridge("invoke", "git:push", payload),
      gitCreateBranch: async (payload) => await invokeBridge("invoke", "git:createBranch", payload),
      gitCheckoutBranch: async (payload) => await invokeBridge("invoke", "git:checkoutBranch", payload),
      gitStashSave: async (payload) => await invokeBridge("invoke", "git:stashSave", payload),
      gitStashApply: async (payload) => await invokeBridge("invoke", "git:stashApply", payload),
      gitStashDrop: async (payload) => await invokeBridge("invoke", "git:stashDrop", payload),
      readPreviewFile: async (payload) => await invokePreviewFs("read", payload),
      listPreviewDirectory: async (payload) => await invokePreviewFs("list", payload),
      listPreviewFiles: async (payload) => await invokePreviewFs("files", payload),
      getPreviewImageBase64: async (payload) => await invokePreviewFs("read", payload),
      getPreviewFileMetadata: async () => null,
      writePreviewFile: async (payload) => await invokePreviewFs("write", payload),
      removePreviewEntry: unsupportedPreviewMutation,
      renamePreviewEntry: unsupportedPreviewMutation,
      openPreviewFile: async () => ({ success: false, error: "浏览器预览态暂不支持用系统应用打开文件。" }),
      showPreviewItemInFolder: async () => ({ success: false, error: "浏览器预览态暂不支持在 Finder 中定位。" }),
      openPreviewDirectoryDialog: async () => [],
      workspacePlugins: {
        list: async () => [],
        open: async () => {
          throw new Error("Workspace plugins require the Electron desktop runtime.");
        },
        close: async () => {},
      },
      openBrowserWorkbench: async (url, sessionId?: string) => await invokeBridge("openBrowserWorkbench", url, sessionId),
      closeBrowserWorkbench: async (sessionId?: string) => await invokeBridge("closeBrowserWorkbench", sessionId),
      setBrowserWorkbenchBounds: async (bounds, sessionId?: string) => await invokeBridge("setBrowserWorkbenchBounds", bounds, sessionId),
      hideAllBrowserWorkbenches: async () => await invokeBridge("hideAllBrowserWorkbenches"),
      reloadBrowserWorkbench: async (sessionId?: string) => await invokeBridge("reloadBrowserWorkbench", sessionId),
      goBackBrowserWorkbench: async (sessionId?: string) => await invokeBridge("goBackBrowserWorkbench", sessionId),
      goForwardBrowserWorkbench: async (sessionId?: string) => await invokeBridge("goForwardBrowserWorkbench", sessionId),
      getBrowserWorkbenchState: async (sessionId?: string) => await invokeBridge("getBrowserWorkbenchState", sessionId),
      getBrowserWorkbenchConsoleLogs: async (limit?: number, sessionId?: string) => await invokeBridge("getBrowserWorkbenchConsoleLogs", limit, sessionId),
      getBrowserWorkbenchFetchLogs: async (input?: BrowserWorkbenchNetworkLogInput, sessionId?: string) => await invokeBridge("getBrowserWorkbenchFetchLogs", input, sessionId),
      captureBrowserWorkbenchVisible: async (sessionId?: string) => await invokeBridge("captureBrowserWorkbenchVisible", sessionId),
      inspectBrowserWorkbenchAtPoint: async (point, sessionId?: string) => await invokeBridge("inspectBrowserWorkbenchAtPoint", point, sessionId),
      clickBrowserWorkbenchAtPoint: async (point: { x: number; y: number; dblClick?: boolean }, sessionId?: string) => await invokeBridge("clickBrowserWorkbenchAtPoint", point, sessionId),
      clearBrowserWorkbenchAnnotations: async (sessionId?: string) => await invokeBridge("clearBrowserWorkbenchAnnotations", sessionId),
      removeBrowserWorkbenchAnnotation: async (annotationId: string, sessionId?: string) => await invokeBridge("removeBrowserWorkbenchAnnotation", annotationId, sessionId),
      setBrowserWorkbenchAnnotationMode: async (enabled: boolean, sessionId?: string) => await invokeBridge("setBrowserWorkbenchAnnotationMode", enabled, sessionId),
      openBrowserWorkbenchDevTools: async (sessionId?: string) => await invokeBridge("openBrowserWorkbenchDevTools", sessionId),
      closeBrowserWorkbenchDevTools: async (sessionId?: string) => await invokeBridge("closeBrowserWorkbenchDevTools", sessionId),
      isBrowserWorkbenchDevToolsOpen: async (sessionId?: string) => await invokeBridge("isBrowserWorkbenchDevToolsOpen", sessionId),
      startBrowserWorkbenchRecording: async (sessionId?: string) => await invokeBridge("startBrowserWorkbenchRecording", sessionId),
      stopBrowserWorkbenchRecording: async (sessionId?: string) => await invokeBridge("stopBrowserWorkbenchRecording", sessionId),
      getBrowserWorkbenchRecordingState: async (sessionId?: string) => await invokeBridge("getBrowserWorkbenchRecordingState", sessionId),
      setBrowserWorkbenchRecordingAssertionMode: async (enabled: boolean, sessionId?: string) => await invokeBridge("setBrowserWorkbenchRecordingAssertionMode", enabled, sessionId),
      runBrowserWorkbenchRecording: async (sessionId?: string) => await invokeBridge("runBrowserWorkbenchRecording", sessionId),
      cancelBrowserWorkbenchRecordingRun: async (sessionId?: string) => await invokeBridge("cancelBrowserWorkbenchRecordingRun", sessionId),
      openBrowserWorkbenchRecordingRunOutput: async (sessionId?: string) => await invokeBridge("openBrowserWorkbenchRecordingRunOutput", sessionId),
      openBrowserWorkbenchRecordingTraceViewer: async (sessionId?: string) => await invokeBridge("openBrowserWorkbenchRecordingTraceViewer", sessionId),
      listBrowserWorkbenchRecordings: async (sessionId?: string, limit?: number) => await invokeBridge("listBrowserWorkbenchRecordings", sessionId, limit),
      loadBrowserWorkbenchRecording: async (rootPath: string, sessionId?: string) => await invokeBridge("loadBrowserWorkbenchRecording", rootPath, sessionId),
      updateBrowserWorkbenchRecordingArtifact: async (artifactPath: string, content: string, sessionId?: string) => await invokeBridge("updateBrowserWorkbenchRecordingArtifact", artifactPath, content, sessionId),
      startBrowserWorkbenchRecordingLocatorPick: async (actionId: string, sessionId?: string) => await invokeBridge("startBrowserWorkbenchRecordingLocatorPick", actionId, sessionId),
      cancelBrowserWorkbenchRecordingLocatorPick: async (sessionId?: string) => await invokeBridge("cancelBrowserWorkbenchRecordingLocatorPick", sessionId),
      addBrowserWorkbenchRecordingAssertion: async (input: { kind: string; value?: string; key?: string; selector?: string }, sessionId?: string) => await invokeBridge("addBrowserWorkbenchRecordingAssertion", input, sessionId),
      repairBrowserWorkbenchRecordingLocator: async (actionId: string, selector: string, sessionId?: string) => await invokeBridge("repairBrowserWorkbenchRecordingLocator", actionId, selector, sessionId),
      onBrowserWorkbenchEvent: (callback: (event: BrowserWorkbenchEvent) => void) => {
        const source = new EventSource(`${DEV_BACKEND_BRIDGE_ORIGIN}/events/browser`);
        source.onmessage = (message) => {
          callback(JSON.parse(message.data) as BrowserWorkbenchEvent);
        };
        return () => source.close();
      },
      onCronJobCreated: () => () => {},
      onCronJobUpdated: () => () => {},
      onCronJobRemoved: () => () => {},
      onCronJobExecuted: () => () => {},
      captureScreenshot: async () => await invokeBridge("captureScreenshot"),
      submitFeedback: async (payload) => await invokeBridge("submitFeedback", payload),
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
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

  let currentElectron: typeof window.electron & Record<string, unknown> = createFallbackElectron();
  const electronProxy = new Proxy({} as typeof window.electron, {
    get(_target, property) {
      const value = (currentElectron as Record<PropertyKey, unknown>)[property];
      return typeof value === "function" ? value.bind(currentElectron) : value;
    },
  });

  window.electron = electronProxy;

  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.has(DEV_BROWSER_PREVIEW_FLAG) || currentUrl.hash.includes(DEV_BROWSER_PREVIEW_FLAG)) {
    return;
  }

  void (async () => {
    const nextBridgeElectron = await waitForBridgeElectron();
    if (!nextBridgeElectron) {
      return;
    }

    currentElectron = nextBridgeElectron;
    window.dispatchEvent(new CustomEvent(DEV_BRIDGE_READY_EVENT));
  })();
};
