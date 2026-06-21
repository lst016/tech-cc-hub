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
  enableAgentTeams: boolean;
};

export type RuntimeEfficiencyProfileState = Omit<RuntimeEfficiencyProfile, "id">;

const STICKY_SERVER_ORDER: readonly BuiltinMcpServerName[] = [
  "tech-cc-hub-admin",
  "tech-cc-hub-plan",
  "tech-cc-hub-knowledge",
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

const BASE_SERVERS: readonly BuiltinMcpServerName[] = [
  "tech-cc-hub-admin",
  "tech-cc-hub-plan",
  "tech-cc-hub-knowledge",
];

const VISUAL_SERVERS: readonly BuiltinMcpServerName[] = [
  ...BASE_SERVERS,
  "tech-cc-hub-browser",
  "tech-cc-hub-design",
];

const FIGMA_VISUAL_SERVERS: readonly BuiltinMcpServerName[] = [
  ...VISUAL_SERVERS,
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

const STATEFUL_STICKY_SERVERS = new Set<BuiltinMcpServerName>([
  "tech-cc-hub-browser",
  "tech-cc-hub-design",
  "tech-cc-hub-figma",
]);

const FIGMA_URL_PATTERN = /https?:\/\/(?:www\.)?figma\.com\/(?:design|file|proto|board|slides|make)\//i;
const FIGMA_TASK_PATTERN = /\bfigma\b/i;
const VISUAL_TASK_PATTERN = /<browser_annotations>|browserview|localhost|127\.0\.0\.1|screenshot|screen\s*shot|ui\b|css\b|figma|design|layout|pixel|视觉|截图|页面|网页|浏览器|样式|布局|设计|还原|对齐|按钮|组件/i;
const AUTOMATION_TASK_PATTERN = /cron|schedule|scheduled|reminder|monitor|watch|automation|定时|计划任务|提醒|监控|自动化|每(天|周|小时|分钟)/i;
const IDE_TASK_PATTERN = /intellij|idea|java|jdk|maven|gradle|spring|tomcat|pom\.xml|\.java\b|编译|启动后端|本地运行/i;
const AGENT_TEAM_TASK_PATTERN = /agent\s*teams?|teammates?|TeamCreate|TeamDelete|SendMessage|CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS|parallel\s+(?:dev|development|work)|team\s+lead|leader|delegate mode|团队协作|队友|跨层并行|并行开发|多人协作/i;
const EXPLICIT_DYNAMIC_WORKFLOW_PATTERN = /dynamic\s+workflows?|动态\s*workflow|动态工作流|ultracode|多\s*agent|多智能体|后台编排|并行编排|大规模.*编排/i;

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
      enableAgentTeams: true,
    });
  }

  const prompt = input.prompt.trim();
  const hasImageAttachment = (input.attachments ?? []).some((attachment) => attachment.kind === "image");
  const isFigmaTask = FIGMA_URL_PATTERN.test(prompt) || FIGMA_TASK_PATTERN.test(prompt);
  const isVisualTask = hasImageAttachment || isFigmaTask || VISUAL_TASK_PATTERN.test(prompt);
  const visualServers = isFigmaTask ? FIGMA_VISUAL_SERVERS : VISUAL_SERVERS;
  const wantsAgentTeams = input.runtime?.workflowMode === "force" ||
    AGENT_TEAM_TASK_PATTERN.test(prompt) ||
    isExplicitDynamicWorkflowPrompt(prompt);
  if (wantsAgentTeams) {
    return buildProfile("team", isVisualTask ? visualServers : BASE_SERVERS, {
      includeBrowserPrompt: isVisualTask,
      includeDesignPrompt: isVisualTask,
      includeClaudeCompatPrompt: true,
      includePartialMessages: true,
      includeHookEvents: true,
      agentProgressSummaries: true,
      forwardSubagentText: true,
      enableAgentTeams: true,
    });
  }

  if (isVisualTask) {
    return buildProfile("visual", visualServers, {
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
  const stickyPromptState = shouldCarryStickyPromptState(stickyState);

  return {
    ...profile,
    builtinMcpServers,
    includeBrowserPrompt: profile.includeBrowserPrompt || (stickyPromptState && stickyState.includeBrowserPrompt),
    includeDesignPrompt: profile.includeDesignPrompt || (stickyPromptState && stickyState.includeDesignPrompt),
    includeProjectMemoryPrompt: profile.includeProjectMemoryPrompt,
    includeClaudeCompatPrompt: profile.includeClaudeCompatPrompt || (stickyPromptState && stickyState.includeClaudeCompatPrompt),
    includePartialMessages: profile.includePartialMessages || (stickyPromptState && stickyState.includePartialMessages),
    includeHookEvents: profile.includeHookEvents || (stickyPromptState && stickyState.includeHookEvents),
    agentProgressSummaries: profile.agentProgressSummaries || (stickyPromptState && stickyState.agentProgressSummaries),
    forwardSubagentText: profile.forwardSubagentText || (stickyPromptState && stickyState.forwardSubagentText),
    enableAgentTeams: profile.enableAgentTeams,
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
    enableAgentTeams: profile.enableAgentTeams,
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

  return {
    builtinMcpServers,
    includeBrowserPrompt: Boolean(value.includeBrowserPrompt),
    includeDesignPrompt: Boolean(value.includeDesignPrompt),
    includeProjectMemoryPrompt: Boolean(value.includeProjectMemoryPrompt),
    includeClaudeCompatPrompt: Boolean(value.includeClaudeCompatPrompt),
    includePartialMessages: Boolean(value.includePartialMessages),
    includeHookEvents: Boolean(value.includeHookEvents),
    agentProgressSummaries: Boolean(value.agentProgressSummaries),
    forwardSubagentText: Boolean(value.forwardSubagentText),
    enableAgentTeams: Boolean(value.enableAgentTeams),
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
  const stickyServers = shouldCarryStickyPromptState(stickyState)
    ? normalizeBuiltinMcpServerNames(stickyState.builtinMcpServers).filter((serverName) =>
      STATEFUL_STICKY_SERVERS.has(serverName)
    )
    : [];
  return normalizeBuiltinMcpServerNames([...profileServers, ...stickyServers]);
}

function shouldCarryStickyPromptState(stickyState: RuntimeEfficiencyProfileState): boolean {
  return stickyState.includeBrowserPrompt || stickyState.includeDesignPrompt || stickyState.includePartialMessages;
}

export function isExplicitDynamicWorkflowPrompt(prompt: string): boolean {
  return EXPLICIT_DYNAMIC_WORKFLOW_PATTERN.test(prompt);
}

function buildProfile(
  id: RuntimeEfficiencyProfileId,
  builtinMcpServers: readonly BuiltinMcpServerName[],
  overrides: Partial<Omit<RuntimeEfficiencyProfile, "id" | "builtinMcpServers">>,
): RuntimeEfficiencyProfile {
  const normalizedBuiltinMcpServers = normalizeBuiltinMcpServerNames(builtinMcpServers);

  return {
    id,
    builtinMcpServers: normalizedBuiltinMcpServers,
    includeBrowserPrompt: false,
    includeDesignPrompt: false,
    includeProjectMemoryPrompt: false,
    includeClaudeCompatPrompt: false,
    includePartialMessages: false,
    includeHookEvents: false,
    agentProgressSummaries: false,
    forwardSubagentText: false,
    enableAgentTeams: false,
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
