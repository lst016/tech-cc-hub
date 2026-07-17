import type { ApiConfigSettings, ClientEvent, PromptAttachment, ServerEvent, StreamMessage, UiGitCommitDetail, UiGitCommitMessageSuggestion, UiGitDiffResult, UiGitResult, UiGitWorkbenchSnapshot } from "./types";
import type { AppUpdateActionResult, AppUpdateStatus } from "./types";
import type { BuiltinMcpServerName } from "../shared/builtin-mcp-registry";
import type { CreateCronJobParams, CronJob } from "../types/cron";

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
  const previewUrl = new URL(window.location.href);
  const browserPreviewEnabled = previewUrl.searchParams.has(DEV_BROWSER_PREVIEW_FLAG)
    || previewUrl.hash.includes(DEV_BROWSER_PREVIEW_FLAG);
  const qaPlanPreviewEnabled = new URLSearchParams(window.location.search).get("qaPlanPreview") === "1";
  const qaCronScenario = new URLSearchParams(window.location.search).get("qaCron");
  let sessionCreatedAt = Date.now();
  let sessionUpdatedAt = sessionCreatedAt;
  let sessionStatus: "idle" | "running" | "completed" = qaPlanPreviewEnabled ? "running" : "idle";
  let sessionTitle = qaPlanPreviewEnabled ? "聊天列表计划预览" : "新聊天";
  let sessionModel = "";
  let sessionMessages: StreamMessage[] = [];
  const qaCollapsedSessionRailEnabled = new URL(window.location.href).searchParams.get("qaCollapsedSessionRail") === "1";
  const qaConversationTurnTimelineEnabled = new URL(window.location.href).searchParams.get("qaConversationTurnTimeline") === "1";
  const qaSideConversationEnabled = new URL(window.location.href).searchParams.get("qaSideConversation") === "1";
  const qaSessionCwd = "D:/tool/tech-cc-hub";
  const qaSessionTimestamp = 1_783_800_000_000;
  const qaBackgroundSessionId = "qa-rail-background";
  let qaBackgroundStatus: "running" | "completed" = "running";
  let qaBackgroundCompletionScheduled = false;
  const qaHistoryScheduledSessionIds = new Set<string>();
  const qaHistoryEmittedSessionIds = new Set<string>();
  const qaCronTimestamp = 1_783_904_400_000;
  let qaCronJobs: CronJob[] = [
    {
      id: "qa-cron-daily-brief",
      name: "每日产品晨报",
      description: "整理产品、技术与客户反馈，生成当天的行动摘要。",
      enabled: true,
      schedule: { kind: "cron", expr: "0 9 * * MON-FRI", description: "工作日 09:00" },
      target: {
        payload: { kind: "message", text: "汇总昨天的关键进展、风险和今天的优先事项。" },
        executionMode: "existing",
      },
      metadata: {
        conversationId: browserPreviewSessionId,
        conversationTitle: "tech-cc-hub",
        agentType: "claude",
        createdBy: "user",
        createdAt: qaCronTimestamp - 86_400_000,
        updatedAt: qaCronTimestamp - 3_600_000,
      },
      state: {
        nextRunAtMs: qaCronTimestamp + 3_600_000,
        lastRunAtMs: qaCronTimestamp - 82_800_000,
        lastStatus: "ok",
        runCount: 18,
        retryCount: 0,
        maxRetries: 2,
      },
    },
    {
      id: "qa-cron-weekly-review",
      name: "周度项目复盘",
      description: "每周五汇总交付、质量与下周计划。",
      enabled: false,
      schedule: { kind: "cron", expr: "30 17 * * FRI", description: "每周五 17:30" },
      target: {
        payload: { kind: "message", text: "生成本周项目复盘，并列出下周三项最高优先级工作。" },
        executionMode: "new_conversation",
      },
      metadata: {
        conversationId: browserPreviewSessionId,
        conversationTitle: "tech-cc-hub",
        agentType: "codex",
        createdBy: "user",
        createdAt: qaCronTimestamp - 604_800_000,
        updatedAt: qaCronTimestamp - 172_800_000,
      },
      state: {
        lastRunAtMs: qaCronTimestamp - 604_800_000,
        lastStatus: "ok",
        runCount: 7,
        retryCount: 0,
        maxRetries: 1,
        paused: true,
      },
    },
    {
      id: "qa-cron-health-check",
      name: "发布健康检查",
      description: "检查安装包、更新元数据与公开下载地址。",
      enabled: true,
      schedule: { kind: "every", everyMs: 7_200_000, description: "每 2 小时" },
      target: {
        payload: { kind: "message", text: "验证最新 Windows 安装包及 latest.yml 是否可以公开下载。" },
        executionMode: "new_conversation",
      },
      metadata: {
        conversationId: "__system__",
        conversationTitle: "系统工作区",
        agentType: "codex",
        createdBy: "agent",
        createdAt: qaCronTimestamp - 259_200_000,
        updatedAt: qaCronTimestamp - 900_000,
      },
      state: {
        nextRunAtMs: qaCronTimestamp + 6_300_000,
        lastRunAtMs: qaCronTimestamp - 900_000,
        lastStatus: "error",
        lastError: "公开下载地址返回 504，请检查发布链路。",
        runCount: 31,
        retryCount: 2,
        maxRetries: 3,
      },
    },
    {
      id: "qa-cron-manual-cleanup",
      name: "手动整理变更记录",
      description: "需要时手动生成当前工作区的变更说明。",
      enabled: true,
      schedule: { kind: "cron", expr: "", description: "手动触发" },
      target: {
        payload: { kind: "message", text: "按功能、修复和验证结果整理变更记录。" },
        executionMode: "existing",
      },
      metadata: {
        conversationId: "",
        agentType: "claude",
        createdBy: "user",
        createdAt: qaCronTimestamp - 43_200_000,
        updatedAt: qaCronTimestamp - 43_200_000,
      },
      state: {
        runCount: 0,
        retryCount: 0,
        maxRetries: 0,
      },
    },
  ];

  const getQaCronPayload = <T,>(args: unknown[]): T => (
    args[0] && typeof args[0] === "object" ? args[0] as T : {} as T
  );

  const updateQaCronJob = (jobId: string, updates: Partial<CronJob>): CronJob => {
    const index = qaCronJobs.findIndex((job) => job.id === jobId);
    if (index < 0) throw new Error(`定时任务不存在: ${jobId}`);
    const current = qaCronJobs[index]!;
    const updated = {
      ...current,
      ...updates,
      metadata: updates.metadata ?? current.metadata,
      state: updates.state ? { ...current.state, ...updates.state } : current.state,
    };
    qaCronJobs = qaCronJobs.map((job, jobIndex) => jobIndex === index ? updated : job);
    return updated;
  };

  const invokeQaCron = <T,>(channel: string, args: unknown[]): T => {
    if (channel === "cron:list-jobs") {
      if (qaCronScenario === "error") throw new Error("定时任务预览数据加载失败");
      return (qaCronScenario === "empty" ? [] : qaCronJobs) as T;
    }
    if (channel === "cron:list-jobs-by-conversation") {
      if (qaCronScenario === "error") throw new Error("定时任务预览数据加载失败");
      const { conversationId } = getQaCronPayload<{ conversationId?: string }>(args);
      return (qaCronScenario === "empty"
        ? []
        : qaCronJobs.filter((job) => job.metadata.conversationId === conversationId)) as T;
    }
    if (channel === "cron:get-job") {
      const { jobId } = getQaCronPayload<{ jobId?: string }>(args);
      return (qaCronJobs.find((job) => job.id === jobId) ?? null) as T;
    }
    if (channel === "cron:add-job") {
      const params = getQaCronPayload<CreateCronJobParams>(args);
      const created: CronJob = {
        id: `qa-cron-created-${qaCronJobs.length + 1}`,
        name: params.name,
        description: params.description,
        enabled: true,
        schedule: params.schedule,
        target: {
          payload: { kind: "message", text: params.prompt ?? params.message ?? "" },
          executionMode: params.executionMode,
        },
        metadata: {
          conversationId: params.conversationId,
          conversationTitle: params.conversationTitle,
          agentType: params.agentType,
          createdBy: params.createdBy,
          createdAt: qaCronTimestamp,
          updatedAt: qaCronTimestamp,
          agentConfig: params.agentConfig,
        },
        state: { runCount: 0, retryCount: 0, maxRetries: 0 },
      };
      qaCronJobs = [created, ...qaCronJobs];
      return created as T;
    }
    if (channel === "cron:update-job") {
      const { jobId, updates } = getQaCronPayload<{ jobId: string; updates: Partial<CronJob> }>(args);
      return updateQaCronJob(jobId, updates) as T;
    }
    if (channel === "cron:pause-job" || channel === "cron:resume-job") {
      const { jobId } = getQaCronPayload<{ jobId: string }>(args);
      const paused = channel === "cron:pause-job";
      return updateQaCronJob(jobId, {
        enabled: !paused,
        state: { ...qaCronJobs.find((job) => job.id === jobId)!.state, paused },
      }) as T;
    }
    if (channel === "cron:remove-job") {
      const { jobId } = getQaCronPayload<{ jobId: string }>(args);
      qaCronJobs = qaCronJobs.filter((job) => job.id !== jobId);
      return undefined as T;
    }
    if (channel === "cron:run-now") {
      const { jobId } = getQaCronPayload<{ jobId: string }>(args);
      const job = qaCronJobs.find((candidate) => candidate.id === jobId);
      if (!job) throw new Error(`定时任务不存在: ${jobId}`);
      updateQaCronJob(jobId, {
        state: {
          ...job.state,
          lastRunAtMs: qaCronTimestamp,
          lastStatus: "ok",
          lastError: undefined,
          runCount: job.state.runCount + 1,
          retryCount: 0,
        },
      });
      return { conversationId: job.metadata.conversationId } as T;
    }
    throw new Error(`定时任务预览未实现 IPC: ${channel}`);
  };
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

  type QaCollapsedSessionRailFixture = {
    id: string;
    title: string;
    status: "idle" | "running" | "completed";
    updatedAt: number;
    assistantText: string;
    historyDelayMs?: number;
    cwd: string;
    model: string;
    runSurface: "development";
    slashCommands: string[];
    createdAt: number;
  };
  type QaCollapsedSessionRailFixtureDefinition = Omit<
    QaCollapsedSessionRailFixture,
    "cwd" | "model" | "runSurface" | "slashCommands" | "createdAt"
  >;

  const buildQaSessionFixtures = (): QaCollapsedSessionRailFixture[] => {
    const fixtures: QaCollapsedSessionRailFixtureDefinition[] = [
      {
        id: "qa-rail-active",
        title: "收起会话栏验收",
        status: "idle",
        updatedAt: qaSessionTimestamp + 8_000,
        assistantText: "验收环境已经准备好，可以开始检查收起后的会话栏。",
      },
      {
        id: "qa-rail-github",
        title: "github提交下版本吧",
        status: "completed",
        updatedAt: qaSessionTimestamp + 7_000,
        assistantText: "GitHub 最新已经是 v0.1.55，所以这次需要发 v0.1.56。但当前工作区还有约 60 个其他未提交修改，而刚才安装包也包含它们。请确认：v0.1.56 是否要包含这些修改。",
      },
      {
        id: qaBackgroundSessionId,
        title: "后台构建发布包",
        status: qaBackgroundStatus,
        updatedAt: qaSessionTimestamp + 6_000,
        assistantText: "Windows 安装包已经构建完成，校验结果正常。",
      },
      {
        id: "qa-rail-release-notes",
        title: "梳理更新说明",
        status: "completed",
        updatedAt: qaSessionTimestamp + 5_000,
        assistantText: "更新说明已按功能、修复和验证结果重新整理。",
      },
      {
        id: "qa-rail-installer",
        title: "检查安装包清单",
        status: "completed",
        updatedAt: qaSessionTimestamp + 4_000,
        assistantText: "安装包、blockmap 和 latest.yml 已经全部列入核对清单。",
      },
      {
        id: "qa-rail-metadata",
        title: "同步升级元数据",
        status: "completed",
        updatedAt: qaSessionTimestamp + 3_000,
        assistantText: "升级元数据已经同步，公开下载路径保持一致。",
      },
      {
        id: "qa-rail-windows-build",
        title: "复核 Windows 构建",
        status: "completed",
        updatedAt: qaSessionTimestamp + 2_000,
        assistantText: "Windows 构建产物已复核，文件名和版本号匹配。",
      },
      {
        id: "qa-rail-bottom",
        title: "核对长回复的底部会话",
        status: "completed",
        updatedAt: qaSessionTimestamp + 1_000,
        assistantText: [
          "这是一段专门用于验证底部会话预览动态重排的长回复，第一行说明历史记录会在悬停后延迟返回。",
          "第二行补充足够多的自然语言内容，让摘要稳定占满三行并触发 ResizeObserver 重新测量卡片高度。",
          "第三行确认无论初始窗口还是缩短后的窗口，预览卡片底边都必须保留至少十二像素的安全距离。",
        ].join("\n"),
        historyDelayMs: 250,
      },
    ];
    return fixtures.map((session, index) => ({
      ...session,
      cwd: qaSessionCwd,
      model: "claude-sonnet-4-5",
      runSurface: "development",
      slashCommands: browserPreviewSlashCommandNames,
      createdAt: qaSessionTimestamp - ((index + 1) * 60_000),
    }));
  };

  const buildQaSessions = () => buildQaSessionFixtures().map((fixture) => ({
    id: fixture.id,
    title: fixture.title,
    status: fixture.status,
    updatedAt: fixture.updatedAt,
    cwd: fixture.cwd,
    model: fixture.model,
    runSurface: fixture.runSurface,
    slashCommands: fixture.slashCommands,
    createdAt: fixture.createdAt,
  }));

  const buildQaAssistantMessage = (sessionId: string, text: string) => ({
    type: "assistant",
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
    },
    parent_tool_use_id: null,
    uuid: `${sessionId}-assistant`,
    session_id: sessionId,
  } as unknown as StreamMessage);

  if (qaConversationTurnTimelineEnabled) {
    sessionCreatedAt = qaSessionTimestamp;
    sessionUpdatedAt = qaSessionTimestamp + 8_000;
    sessionStatus = "completed";
    sessionTitle = "聊天轮次时间轴验收";
    sessionModel = "claude-sonnet-4-5";
    const assistantParagraph = [
      "这一轮用于验证聊天内容列表左侧的会话时间轴。时间轴必须跟随聊天内容卡，而不是出现在工作区 Sidebar 里面。",
      "滚动聊天时，视口中心之前最近的一条用户消息会成为当前轮次；当前轮使用黑色长刻度，其他轮使用灰色短刻度。",
      "点击刻度后应平滑跳转到对应用户消息，同时保留现有消息卡、工具过程和输入框布局。",
    ].join("\n\n");
    const timelineVirtualWindowPadding = Array.from({ length: 170 }, (_, index) => ({
      type: "system",
      subtype: "init",
      uuid: `${browserPreviewSessionId}-timeline-padding-${index}`,
      session_id: browserPreviewSessionId,
    } as unknown as StreamMessage));
    sessionMessages = [
      { type: "user_prompt", prompt: "虚拟窗口外的最早一轮：时间轴仍需完整显示。", capturedAt: qaSessionTimestamp - 2_000 } as StreamMessage,
      buildQaAssistantMessage(browserPreviewSessionId, "这条回复位于初始虚拟窗口之外。"),
      { type: "user_prompt", prompt: "第一轮：确认时间轴应该位于聊天列表左侧。", capturedAt: qaSessionTimestamp } as StreamMessage,
      ...timelineVirtualWindowPadding,
      buildQaAssistantMessage(browserPreviewSessionId, `${assistantParagraph}\n\n${assistantParagraph}`),
      { type: "user_prompt", prompt: "第二轮：滚动后高亮当前视口对应的轮次。", capturedAt: qaSessionTimestamp + 2_000 } as StreamMessage,
      buildQaAssistantMessage(browserPreviewSessionId, `${assistantParagraph}\n\n${assistantParagraph}`),
      { type: "user_prompt", prompt: "第三轮：点击灰色刻度跳转到历史提问。", capturedAt: qaSessionTimestamp + 4_000 } as StreamMessage,
      buildQaAssistantMessage(browserPreviewSessionId, `${assistantParagraph}\n\n${assistantParagraph}`),
      { type: "user_prompt", prompt: "第四轮：完成视觉与键盘可访问性验收。", capturedAt: qaSessionTimestamp + 6_000 } as StreamMessage,
      buildQaAssistantMessage(browserPreviewSessionId, assistantParagraph),
    ];
    const timelineThirdPromptIndex = timelineVirtualWindowPadding.length + 6;
    sessionMessages[timelineThirdPromptIndex] = {
      ...sessionMessages[timelineThirdPromptIndex],
      attachments: [{
        id: "qa-timeline-attachment",
        kind: "image",
        name: "side-conversation.png",
        mimeType: "image/png",
        data: "qa-timeline-image",
      }],
    } as StreamMessage;
    sessionMessages[timelineThirdPromptIndex + 1] = {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: `${assistantParagraph}\n\n${assistantParagraph}` },
          {
            type: "tool_use",
            id: "qa-timeline-tool",
            name: "Edit",
            input: { file_path: "D:/tool/tech-cc-hub/src/ui/App.tsx" },
          },
        ],
      },
      parent_tool_use_id: null,
      uuid: `${browserPreviewSessionId}-timeline-assistant`,
      session_id: browserPreviewSessionId,
    } as unknown as StreamMessage;
  }

  const qaSideConversationMessagesBySessionId: Record<string, StreamMessage[]> = {
    "qa-side-primary": [
      { type: "user_prompt", prompt: "主对话验收", capturedAt: qaSessionTimestamp } as StreamMessage,
      buildQaAssistantMessage("qa-side-primary", "主对话初始回复"),
    ],
  };
  type QaBtwThread = {
    id: string;
    parentSessionId: string;
    title: string;
    turnCount: number;
  };
  const qaBtwThreads = new Map<string, QaBtwThread>();
  let qaBtwSequence = 0;

  const buildQaSideConversationSessions = () => [
    {
      id: "qa-side-primary",
      title: "主对话",
      status: "completed" as const,
      cwd: qaSessionCwd,
      model: "claude-sonnet-4-5",
      runSurface: "development" as const,
      slashCommands: browserPreviewSlashCommandNames,
      createdAt: qaSessionTimestamp,
      updatedAt: qaSessionTimestamp + 2_000,
    },
  ];

  const buildSessionListEvent = (): ServerEvent => ({
    type: "session.list",
    payload: {
      sessions: qaSideConversationEnabled ? buildQaSideConversationSessions() : qaCollapsedSessionRailEnabled ? buildQaSessions() : [
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

  const buildSessionHistoryEvent = (requestedSessionId = browserPreviewSessionId): ServerEvent => {
    if (qaSideConversationEnabled) {
      return {
        type: "session.history",
        payload: {
          sessionId: requestedSessionId,
          status: "completed",
          mode: "replace",
          hasMore: false,
          slashCommands: browserPreviewSlashCommandNames,
          messages: [...(qaSideConversationMessagesBySessionId[requestedSessionId] ?? [])],
        },
      };
    }
    if (!qaCollapsedSessionRailEnabled) {
      return {
        type: "session.history",
        payload: {
          sessionId: browserPreviewSessionId,
          status: sessionStatus,
          mode: "replace",
          hasMore: false,
          slashCommands: browserPreviewSlashCommandNames,
          messages: sessionMessages,
        },
      };
    }

    const fixture = buildQaSessionFixtures().find((candidate) => candidate.id === requestedSessionId);
    if (!fixture) {
      return {
        type: "session.history",
        payload: {
          sessionId: requestedSessionId,
          status: "idle",
          mode: "replace",
          hasMore: false,
          slashCommands: browserPreviewSlashCommandNames,
          messages: [],
        },
      };
    }

    const messages: StreamMessage[] = [
      {
        type: "user_prompt",
        prompt: `请处理会话：${fixture.title}`,
        capturedAt: fixture.createdAt,
      },
      buildQaAssistantMessage(fixture.id, fixture.assistantText),
    ];
    return {
      type: "session.history",
      payload: {
        sessionId: fixture.id,
        status: fixture.status,
        mode: "replace",
        hasMore: false,
        slashCommands: browserPreviewSlashCommandNames,
        messages,
      },
    };
  };

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

  const scheduleQaBackgroundCompletion = () => {
    if (!qaCollapsedSessionRailEnabled || qaBackgroundCompletionScheduled) return;
    qaBackgroundCompletionScheduled = true;
    window.setTimeout(() => {
      qaBackgroundStatus = "completed";
      emit(buildSessionListEvent());
    }, 700);
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
      if (qaSideConversationEnabled && event.type === "btw.thread.create") {
        const threadId = `qa-btw-${++qaBtwSequence}`;
        const timestamp = Date.now();
        const thread: QaBtwThread = {
          id: threadId,
          parentSessionId: event.payload.parentSessionId,
          title: `侧聊 ${qaBtwSequence}`,
          turnCount: 0,
        };
        qaBtwThreads.set(threadId, thread);
        emit({
          type: "btw.thread.created",
          payload: {
            threadId,
            parentSessionId: thread.parentSessionId,
            title: thread.title,
            status: "idle",
            cwd: qaSessionCwd,
            model: "claude-sonnet-4-5",
            reasoningMode: "high",
            permissionMode: "default",
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });
        return;
      }
      if (qaSideConversationEnabled && event.type === "btw.thread.send") {
        const thread = qaBtwThreads.get(event.payload.threadId);
        if (!thread) return;
        thread.turnCount += 1;
        const capturedAt = Date.now();
        emit({
          type: "btw.thread.status",
          payload: { threadId: thread.id, status: "running", title: thread.title, updatedAt: capturedAt },
        });
        emit({
          type: "btw.stream.user_prompt",
          payload: { threadId: thread.id, prompt: event.payload.prompt, attachments: event.payload.attachments, capturedAt },
        });
        const assistantMessage = {
          ...buildQaAssistantMessage(thread.id, `SIDE_OK ${thread.turnCount}: ${event.payload.prompt}`),
          uuid: `${thread.id}-assistant-${thread.turnCount}`,
        } as StreamMessage;
        emit({ type: "btw.stream.message", payload: { threadId: thread.id, message: assistantMessage } });
        emit({
          type: "btw.thread.status",
          payload: {
            threadId: thread.id,
            status: "completed",
            title: thread.title,
            model: event.payload.runtime?.model,
            updatedAt: capturedAt + 1,
          },
        });
        return;
      }
      if (qaSideConversationEnabled && event.type === "btw.thread.stop") {
        const thread = qaBtwThreads.get(event.payload.threadId);
        if (thread) {
          emit({
            type: "btw.thread.status",
            payload: { threadId: thread.id, status: "idle", title: thread.title, updatedAt: Date.now() },
          });
        }
        return;
      }
      if (qaSideConversationEnabled && event.type === "btw.thread.close") {
        const thread = qaBtwThreads.get(event.payload.threadId);
        if (thread) {
          qaBtwThreads.delete(thread.id);
          emit({ type: "btw.thread.closed", payload: { threadId: thread.id, parentSessionId: thread.parentSessionId } });
        }
        return;
      }
      if (qaSideConversationEnabled && event.type === "btw.parent.close_all") {
        const threadIds = Array.from(qaBtwThreads.values())
          .filter((thread) => thread.parentSessionId === event.payload.parentSessionId)
          .map((thread) => thread.id);
        for (const threadId of threadIds) qaBtwThreads.delete(threadId);
        emit({ type: "btw.parent.closed", payload: { parentSessionId: event.payload.parentSessionId, threadIds } });
        return;
      }
      if (qaSideConversationEnabled && event.type === "btw.thread.permission.response") return;
      if (event.type === "session.list") {
        emit(buildSessionListEvent());
        scheduleQaBackgroundCompletion();
      }
      if (event.type === "session.history") {
        const requestedSessionId = event.payload.sessionId;
        const qaFixture = qaCollapsedSessionRailEnabled
          ? buildQaSessionFixtures().find((candidate) => candidate.id === requestedSessionId)
          : undefined;
        const historyDelayMs = qaFixture?.historyDelayMs ?? 0;
        if (historyDelayMs > 0) {
          if (qaHistoryEmittedSessionIds.has(requestedSessionId)) {
            emit(buildSessionHistoryEvent(requestedSessionId));
          } else if (!qaHistoryScheduledSessionIds.has(requestedSessionId)) {
            qaHistoryScheduledSessionIds.add(requestedSessionId);
            window.setTimeout(() => {
              qaHistoryEmittedSessionIds.add(requestedSessionId);
              emit(buildSessionHistoryEvent(requestedSessionId));
            }, historyDelayMs);
          }
        } else {
          emit(buildSessionHistoryEvent(requestedSessionId));
        }
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
      if (event.type === "session.fork") {
        const sourceMessages = qaSideConversationMessagesBySessionId[event.payload.sessionId] ?? sessionMessages;
        const forkPointIndex = sourceMessages.findIndex((message) => (
          message.type === "assistant"
          && "uuid" in message
          && message.uuid === event.payload.upToMessageId
        ));
        if (forkPointIndex < 0) {
          emit({
            type: "runner.error",
            payload: { sessionId: event.payload.sessionId, message: "找不到要 Fork 的助手消息。" },
          });
          return;
        }

        const forkedSessionId = `browser-preview-fork-${crypto.randomUUID()}`;
        const forkedMessages = sourceMessages.slice(0, forkPointIndex + 1).map((message) => {
          const cloned = structuredClone(message);
          const historyId = crypto.randomUUID();
          if ("uuid" in cloned) cloned.uuid = historyId;
          if ("session_id" in cloned) cloned.session_id = forkedSessionId;
          cloned.historyId = historyId;
          return cloned;
        });
        emit({
          type: "session.status",
          payload: {
            sessionId: forkedSessionId,
            status: "idle",
            title: event.payload.title?.trim() || `${sessionTitle}（分支）`,
            cwd: browserPreviewCwd,
            model: sessionModel,
            slashCommands: browserPreviewSlashCommandNames,
          },
        });
        emit({
          type: "session.history",
          payload: {
            sessionId: forkedSessionId,
            status: "idle",
            mode: "replace",
            hasMore: false,
            slashCommands: browserPreviewSlashCommandNames,
            messages: forkedMessages,
          },
        });
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
      scheduleQaBackgroundCompletion();
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
    startCodexOAuthRuntime: async () => ({ success: false, error: "Codex 账号连接仅支持 Electron 桌面端。" }),
    cancelCodexOAuthRuntime: async () => ({ success: true }),
    onCodexOAuthRuntimeEvent: () => () => {},
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
      if (qaCronScenario && channel.startsWith("cron:")) {
        return invokeQaCron<T>(channel, args);
      }
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
        if (browserPreviewEnabled) {
          return { commands: browserPreviewSlashCommands } as T;
        }
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
    searchLarkContacts: async (query) => query.trim() ? [
      { openId: "ou_preview_wangning", name: "王宁", department: "事业二处-技术二组-业务开发组" },
      { openId: "ou_preview_qinningning", name: "秦宁宁", department: "事业二处-业务测试部-测试九组" },
      { openId: "ou_preview_wangning_admin", name: "王宁", department: "职能中台-行政部" },
    ] : [],
    searchLarkShareChats: async (query) => query.trim() ? [
      { kind: "chat" as const, id: "oc_preview_support", name: "海外客服-测试小分队", detail: "群聊" },
      { kind: "chat" as const, id: "oc_preview_ai", name: "支撑AI 生态构建", detail: "群聊" },
      { kind: "chat" as const, id: "oc_preview_food", name: "技术干饭人", detail: "群聊" },
      { kind: "chat" as const, id: "oc_preview_online", name: "客服系统线上问题跟踪处理群", detail: "群聊" },
    ] : [],
    searchLarkShareRecipients: async () => [],
    sendLarkShareMessage: async () => ({ messageId: "preview-message" }),
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
      startCodexOAuthRuntime: async () => ({ success: false, error: "Codex 账号连接仅支持 Electron 桌面端。" }),
      cancelCodexOAuthRuntime: async () => ({ success: true }),
      onCodexOAuthRuntimeEvent: () => () => {},
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
      searchLarkContacts: async (query) => query.trim() ? [
        { openId: "ou_preview_wangning", name: "王宁", department: "事业二处-技术二组-业务开发组" },
        { openId: "ou_preview_qinningning", name: "秦宁宁", department: "事业二处-业务测试部-测试九组" },
        { openId: "ou_preview_wangning_admin", name: "王宁", department: "职能中台-行政部" },
      ] : [],
      searchLarkShareChats: async (query) => query.trim() ? [
        { kind: "chat" as const, id: "oc_preview_support", name: "海外客服-测试小分队", detail: "群聊" },
        { kind: "chat" as const, id: "oc_preview_ai", name: "支撑AI 生态构建", detail: "群聊" },
        { kind: "chat" as const, id: "oc_preview_food", name: "技术干饭人", detail: "群聊" },
        { kind: "chat" as const, id: "oc_preview_online", name: "客服系统线上问题跟踪处理群", detail: "群聊" },
      ] : [],
      searchLarkShareRecipients: async () => [],
      sendLarkShareMessage: async () => ({ messageId: "preview-message" }),
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
