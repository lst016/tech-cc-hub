import type { BuiltinMcpServerName } from "../../shared/builtin-mcp-registry.js";
import type { AgentRunSurface, PromptAttachment, RuntimeOverrides } from "../types.js";

export type RuntimeEfficiencyProfileId =
  | "standard"
  | "team"
  | "visual"
  | "automation"
  | "ide"
  | "maintenance";

export type RuntimeEfficiencyProfile = {
  id: RuntimeEfficiencyProfileId;
  builtinMcpServers: readonly BuiltinMcpServerName[];
  includeBrowserPrompt: boolean;
  includeDesignPrompt: boolean;
  includeProjectMemoryPrompt: boolean;
  includeClaudeCompatPrompt: boolean;
  includePartialMessages: boolean;
  includeHookEvents: boolean;
  agentProgressSummaries: boolean;
  forwardSubagentText: boolean;
};

export type RuntimeEfficiencyProfileState = Omit<RuntimeEfficiencyProfile, "id">;

const BASE_SERVERS: readonly BuiltinMcpServerName[] = [
  "tech-cc-hub-admin",
  "tech-cc-hub-plan",
  "tech-cc-hub-knowledge",
];

const VISUAL_SERVERS: readonly BuiltinMcpServerName[] = [
  ...BASE_SERVERS,
  "tech-cc-hub-browser",
  "tech-cc-hub-design",
  "tech-cc-hub-figma",
];

const AUTOMATION_SERVERS: readonly BuiltinMcpServerName[] = [
  ...BASE_SERVERS,
  "tech-cc-hub-cron",
];

const IDE_SERVERS: readonly BuiltinMcpServerName[] = [
  ...BASE_SERVERS,
  "tech-cc-hub-idea",
];

const STICKY_SERVER_ORDER: readonly BuiltinMcpServerName[] = [
  ...BASE_SERVERS,
  "tech-cc-hub-browser",
  "tech-cc-hub-design",
  "tech-cc-hub-figma",
  "tech-cc-hub-cron",
  "tech-cc-hub-idea",
];

const ALL_SERVERS: readonly BuiltinMcpServerName[] = [
  "tech-cc-hub-browser",
  "tech-cc-hub-admin",
  "tech-cc-hub-design",
  "tech-cc-hub-figma",
  "tech-cc-hub-cron",
  "tech-cc-hub-idea",
  "tech-cc-hub-plan",
  "tech-cc-hub-knowledge",
];

const FIGMA_URL_PATTERN = /https?:\/\/(?:www\.)?figma\.com\/(?:design|file|proto|board|slides|make)\//i;
const VISUAL_TASK_PATTERN = /<browser_annotations>|browserview|localhost|127\.0\.0\.1|screenshot|screen\s*shot|ui\b|css\b|figma|design|layout|pixel|视觉|截图|页面|网页|浏览器|样式|布局|设计|还原|对齐|按钮|组件/i;
const AUTOMATION_TASK_PATTERN = /cron|schedule|scheduled|reminder|monitor|watch|automation|定时|计划任务|提醒|监控|自动化|每(天|周|小时|分钟)/i;
const IDE_TASK_PATTERN = /intellij|idea|java|jdk|maven|gradle|spring|tomcat|pom\.xml|\.java\b|编译|启动后端|本地运行/i;
const AGENT_TEAM_TASK_PATTERN = /agent\s*teams?|teammates?|TeamCreate|TeamDelete|SendMessage|CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS|parallel\s+(?:dev|development|work)|team\s+lead|leader|delegate mode|团队协作|队友|跨层并行|并行开发|多人协作/i;

type ResolveRuntimeEfficiencyProfileInput = {
  prompt: string;
  attachments?: readonly PromptAttachment[];
  runtime?: RuntimeOverrides;
  runSurface?: AgentRunSurface;
};

export function resolveRuntimeEfficiencyProfile(
  input: ResolveRuntimeEfficiencyProfileInput,
): RuntimeEfficiencyProfile {
  const runSurface = input.runtime?.runSurface ?? input.runSurface;
  if (runSurface === "maintenance") {
    return buildProfile("maintenance", ALL_SERVERS, {
      includeBrowserPrompt: true,
      includeDesignPrompt: true,
      includeClaudeCompatPrompt: true,
      includePartialMessages: true,
      includeHookEvents: true,
      agentProgressSummaries: true,
      forwardSubagentText: true,
    });
  }

  const prompt = input.prompt.trim();
  const hasImageAttachment = (input.attachments ?? []).some((attachment) => attachment.kind === "image");
  const isVisualTask = hasImageAttachment || FIGMA_URL_PATTERN.test(prompt) || VISUAL_TASK_PATTERN.test(prompt);
  if (AGENT_TEAM_TASK_PATTERN.test(prompt)) {
    return buildProfile("team", isVisualTask ? VISUAL_SERVERS : BASE_SERVERS, {
      includeBrowserPrompt: isVisualTask,
      includeDesignPrompt: isVisualTask,
      includeClaudeCompatPrompt: true,
      includePartialMessages: isVisualTask,
      includeHookEvents: true,
      agentProgressSummaries: true,
      forwardSubagentText: true,
    });
  }

  if (isVisualTask) {
    return buildProfile("visual", VISUAL_SERVERS, {
      includeBrowserPrompt: true,
      includeDesignPrompt: true,
      includeClaudeCompatPrompt: true,
      includePartialMessages: true,
      agentProgressSummaries: true,
    });
  }

  if (AUTOMATION_TASK_PATTERN.test(prompt)) {
    return buildProfile("automation", AUTOMATION_SERVERS, {
      includeClaudeCompatPrompt: true,
    });
  }

  if (IDE_TASK_PATTERN.test(prompt)) {
    return buildProfile("ide", IDE_SERVERS, {
      includeClaudeCompatPrompt: true,
    });
  }

  return buildProfile("standard", BASE_SERVERS, {});
}

export function mergeRuntimeEfficiencyProfile(
  profile: RuntimeEfficiencyProfile,
  previousState?: RuntimeEfficiencyProfileState,
): RuntimeEfficiencyProfile {
  const stickyState = normalizeRuntimeEfficiencyProfileState(previousState);
  if (!stickyState) {
    return {
      ...profile,
      builtinMcpServers: normalizeBuiltinMcpServerNames(profile.builtinMcpServers),
    };
  }

  const builtinMcpServers = resolveStickyBuiltinMcpServers(profile, stickyState);
  const hasBrowserTools = builtinMcpServers.includes("tech-cc-hub-browser");
  const hasDesignTools = builtinMcpServers.includes("tech-cc-hub-design");
  const hasFigmaTools = builtinMcpServers.includes("tech-cc-hub-figma");
  const hasExtendedTools = builtinMcpServers.some((serverName) => !BASE_SERVERS.includes(serverName));

  return {
    ...profile,
    builtinMcpServers,
    includeBrowserPrompt: profile.includeBrowserPrompt || stickyState.includeBrowserPrompt || hasBrowserTools,
    includeDesignPrompt: profile.includeDesignPrompt || stickyState.includeDesignPrompt || hasDesignTools || hasFigmaTools,
    includeProjectMemoryPrompt: profile.includeProjectMemoryPrompt || stickyState.includeProjectMemoryPrompt,
    includeClaudeCompatPrompt: profile.includeClaudeCompatPrompt || stickyState.includeClaudeCompatPrompt || hasExtendedTools,
    includePartialMessages: profile.includePartialMessages || stickyState.includePartialMessages || hasBrowserTools || hasDesignTools,
    includeHookEvents: profile.includeHookEvents || stickyState.includeHookEvents,
    agentProgressSummaries: profile.agentProgressSummaries || stickyState.agentProgressSummaries,
    forwardSubagentText: profile.forwardSubagentText || stickyState.forwardSubagentText,
  };
}

export function runtimeEfficiencyProfileToState(profile: RuntimeEfficiencyProfile): RuntimeEfficiencyProfileState {
  return {
    builtinMcpServers: normalizeBuiltinMcpServerNames(profile.builtinMcpServers),
    includeBrowserPrompt: profile.includeBrowserPrompt,
    includeDesignPrompt: profile.includeDesignPrompt,
    includeProjectMemoryPrompt: profile.includeProjectMemoryPrompt,
    includeClaudeCompatPrompt: profile.includeClaudeCompatPrompt,
    includePartialMessages: profile.includePartialMessages,
    includeHookEvents: profile.includeHookEvents,
    agentProgressSummaries: profile.agentProgressSummaries,
    forwardSubagentText: profile.forwardSubagentText,
  };
}

export function runtimeEfficiencyProfileStateEquals(
  left: RuntimeEfficiencyProfileState | undefined,
  right: RuntimeEfficiencyProfileState | undefined,
): boolean {
  const normalizedLeft = normalizeRuntimeEfficiencyProfileState(left);
  const normalizedRight = normalizeRuntimeEfficiencyProfileState(right);
  if (!normalizedLeft || !normalizedRight) {
    return normalizedLeft === normalizedRight;
  }

  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

export function normalizeRuntimeEfficiencyProfileState(value: unknown): RuntimeEfficiencyProfileState | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const builtinMcpServers = normalizeBuiltinMcpServerNames(value.builtinMcpServers);
  if (builtinMcpServers.length === 0) {
    return undefined;
  }

  const hasBrowserTools = builtinMcpServers.includes("tech-cc-hub-browser");
  const hasDesignTools = builtinMcpServers.includes("tech-cc-hub-design");
  const hasFigmaTools = builtinMcpServers.includes("tech-cc-hub-figma");
  const hasExtendedTools = builtinMcpServers.some((serverName) => !BASE_SERVERS.includes(serverName));

  return {
    builtinMcpServers,
    includeBrowserPrompt: Boolean(value.includeBrowserPrompt) || hasBrowserTools,
    includeDesignPrompt: Boolean(value.includeDesignPrompt) || hasDesignTools || hasFigmaTools,
    includeProjectMemoryPrompt: Boolean(value.includeProjectMemoryPrompt),
    includeClaudeCompatPrompt: Boolean(value.includeClaudeCompatPrompt) || hasExtendedTools,
    includePartialMessages: Boolean(value.includePartialMessages) || hasBrowserTools || hasDesignTools,
    includeHookEvents: Boolean(value.includeHookEvents),
    agentProgressSummaries: Boolean(value.agentProgressSummaries),
    forwardSubagentText: Boolean(value.forwardSubagentText),
  };
}

export function normalizeBuiltinMcpServerNames(value: unknown): BuiltinMcpServerName[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const names = new Set(value.filter(isBuiltinMcpServerName));
  return STICKY_SERVER_ORDER.filter((serverName) => names.has(serverName));
}

function resolveStickyBuiltinMcpServers(
  profile: RuntimeEfficiencyProfile,
  stickyState: RuntimeEfficiencyProfileState,
): BuiltinMcpServerName[] {
  const profileServers = normalizeBuiltinMcpServerNames(profile.builtinMcpServers);
  const stickyVisualServers = stickyState.builtinMcpServers.filter(isVisualServer);
  const profileIsVisualLane = profile.id === "visual" || (profile.id === "team" && profile.includeBrowserPrompt);

  if (profileIsVisualLane) {
    return normalizeBuiltinMcpServerNames(profileServers.filter(isVisualServer));
  }

  if (profile.id === "standard" && stickyVisualServers.length > 0) {
    return normalizeBuiltinMcpServerNames(stickyVisualServers);
  }

  return profileServers;
}

function isVisualServer(serverName: BuiltinMcpServerName): boolean {
  return VISUAL_SERVERS.includes(serverName);
}

function buildProfile(
  id: RuntimeEfficiencyProfileId,
  builtinMcpServers: readonly BuiltinMcpServerName[],
  overrides: Partial<Omit<RuntimeEfficiencyProfile, "id" | "builtinMcpServers">>,
): RuntimeEfficiencyProfile {
  return {
    id,
    builtinMcpServers,
    includeBrowserPrompt: false,
    includeDesignPrompt: false,
    includeProjectMemoryPrompt: false,
    includeClaudeCompatPrompt: false,
    includePartialMessages: false,
    includeHookEvents: false,
    agentProgressSummaries: false,
    forwardSubagentText: false,
    ...overrides,
  };
}

function isBuiltinMcpServerName(value: unknown): value is BuiltinMcpServerName {
  return (
    value === "tech-cc-hub-admin" ||
    value === "tech-cc-hub-plan" ||
    value === "tech-cc-hub-knowledge" ||
    value === "tech-cc-hub-browser" ||
    value === "tech-cc-hub-design" ||
    value === "tech-cc-hub-figma" ||
    value === "tech-cc-hub-cron" ||
    value === "tech-cc-hub-idea"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
