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
  "tech-cc-hub-image",
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
  "tech-cc-hub-image",
];

const MAINTENANCE_SERVERS: readonly BuiltinMcpServerName[] = ALL_SERVERS;

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
// 生图意图识别：覆盖显式触发词和中英文生图/编辑意图。详见 §8.3。
const IMAGE_GENERATION_TASK_PATTERN = /\$imagegen|\bimagegen\b|画图|画(?:一)?(?:张|个|只|幅)|(?:生成|创建)(?:一|几|两|三|四|多)?(?:张|个|只|幅)?[^，。！？\n]{0,32}(?:图片?|图像|海报|插画|图标|logo|banner)|生成图片|生成一张|生图|做一张海报|生成插画|画报|插画|banner|海报|sprite|编辑这张图|修改图片|替换背景|改背景|基于参考图|参考图.*改|参考图.*编辑|generate\s+image|draw\s+(?:a\s+)?(?:image|picture|logo|icon|poster|illustration)|create\s+(?:an?\s+)?(?:image|picture|poster|banner|illustration)|edit\s+(?:the\s+)?(?:image|picture)|image\s+generation|text[- ]to[- ]image/i;

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
    return buildProfile("maintenance", MAINTENANCE_SERVERS, {
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
  const isImageGenerationTask = IMAGE_GENERATION_TASK_PATTERN.test(prompt);
  const visualServers = isFigmaTask ? FIGMA_VISUAL_SERVERS : VISUAL_SERVERS;
  const wantsAgentTeams = input.runtime?.workflowMode === "force" ||
    AGENT_TEAM_TASK_PATTERN.test(prompt) ||
    isExplicitDynamicWorkflowPrompt(prompt);
  if (wantsAgentTeams) {
    const teamServers = mergeImageGenerationIntoServers(isVisualTask ? visualServers : BASE_SERVERS, isImageGenerationTask);
    return buildProfile("team", teamServers, {
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

  // 生图意图：在现有 profile 基础上追加 tech-cc-hub-image。
  // 仅有截图附件但没有生成/编辑意图时，保持现有 visual profile，不追加生图工具。
  if (isImageGenerationTask) {
    const baseServers = isVisualTask ? visualServers : BASE_SERVERS;
    return buildProfile("standard", mergeImageGenerationIntoServers(baseServers, true), {
      includeBrowserPrompt: isVisualTask,
      includeDesignPrompt: isVisualTask,
      includeClaudeCompatPrompt: true,
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
  const ordered = STICKY_SERVER_ORDER.filter((serverName) => names.has(serverName));
  const remaining = [...names].filter((serverName) => !STICKY_SERVER_ORDER.includes(serverName));
  return [...ordered, ...remaining];
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

export function isImageGenerationPrompt(prompt: string): boolean {
  return IMAGE_GENERATION_TASK_PATTERN.test(prompt);
}

/**
 * 把 tech-cc-hub-image 合并进现有 server 列表（保持去重和 STICKY_SERVER_ORDER 顺序）。
 * 仅当 includeImage=true 时追加；否则原样返回。
 */
function mergeImageGenerationIntoServers(
  servers: readonly BuiltinMcpServerName[],
  includeImage: boolean,
): BuiltinMcpServerName[] {
  if (!includeImage) {
    return [...servers];
  }
  const set = new Set(servers);
  set.add("tech-cc-hub-image");
  // 按 STICKY_SERVER_ORDER 排序，未在其中的追加到末尾
  const ordered = STICKY_SERVER_ORDER.filter((name) => set.has(name));
  const remaining = [...set].filter((name) => !STICKY_SERVER_ORDER.includes(name));
  return [...ordered, ...remaining];
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
    value === "tech-cc-hub-idea" ||
    value === "tech-cc-hub-image"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
