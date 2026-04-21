import type {
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";

export type ActivityRailTone = "neutral" | "info" | "success" | "warning" | "error";
export type ActivityRailLayer = "上下文" | "工具" | "结果" | "流程";
export type ActivityRailFilterKey = "all" | "attention" | "context" | "tool" | "result" | "flow";
export type ActivityStageKind = "inspect" | "implement" | "verify" | "deliver" | "plan" | "other";
export type ActivityTaskStepStatus = "pending" | "running" | "completed";
export type ActivityMetricStatus = "neutral" | "running" | "success" | "failure";

export type ActivityExecutionMetrics = {
  inputChars: number;
  contextChars: number;
  outputChars: number;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  successCount: number;
  failureCount: number;
  totalCount: number;
  status: ActivityMetricStatus;
};

export type ActivityDetailRow = {
  label: string;
  value: string;
};

export type ActivityDetailSection = {
  id: string;
  title: string;
  summary?: string;
  rows: ActivityDetailRow[];
  raw?: string;
  rawLabel?: string;
};

export type PromptAttachmentLike = {
  id: string;
  kind: "image" | "text";
  name: string;
  mimeType: string;
  data: string;
  preview?: string;
  size?: number;
};

export type UserPromptMessageLike = {
  type: "user_prompt";
  prompt: string;
  attachments?: PromptAttachmentLike[];
  capturedAt?: number;
};

export type StreamMessageLike = (SDKMessage & { capturedAt?: number }) | UserPromptMessageLike;

export type SessionLike = {
  id: string;
  title: string;
  status: "idle" | "running" | "completed" | "error";
  cwd?: string;
  slashCommands?: string[];
  messages: StreamMessageLike[];
};

export type PermissionRequestLike = {
  toolUseId: string;
  toolName: string;
  input: unknown;
};

export type ActivityTimelineItem = {
  id: string;
  filterKey: Exclude<ActivityRailFilterKey, "all">;
  layer: ActivityRailLayer;
  tone: ActivityRailTone;
  title: string;
  preview: string;
  detail: string;
  round: number;
  sequence: number;
  statusLabel?: string;
  chips: string[];
  attention: boolean;
  taskStepIds: string[];
  stageKind: ActivityStageKind;
  metrics: ActivityExecutionMetrics;
  detailSections: ActivityDetailSection[];
};

export type ActivityTaskStep = {
  id: string;
  title: string;
  detail: string;
  round: number;
  kind: ActivityStageKind;
  status: ActivityTaskStepStatus;
  timelineIds: string[];
  sourceTimelineId: string;
  metrics: ActivityExecutionMetrics;
};

export type ActivityExecutionStep = {
  id: string;
  title: string;
  detail: string;
  round: number;
  kind: ActivityStageKind;
  status: ActivityTaskStepStatus;
  timelineIds: string[];
  sourceTimelineId: string;
  metrics: ActivityExecutionMetrics;
};

export type ActivityAnalysisCard = {
  id: string;
  title: string;
  tone: ActivityRailTone;
  detail: string;
  supportingTimelineId?: string;
};

export type ContextDistributionBucket = {
  id: string;
  label: string;
  chars: number;
  ratio: number;
  messageCount: number;
  sample: string;
  tone: ActivityRailTone;
};

export type ContextDistributionModel = {
  totalChars: number;
  buckets: ContextDistributionBucket[];
};

export type ActivityRailModel = {
  primarySectionTitle: "实时执行轨迹";
  detailCardTitle: "步骤详情";
  detailDrawerTitle: "节点详情";
  executionSectionTitle: string;
  taskSectionTitle: "任务步骤";
  analysisSectionTitle: "分析洞察";
  contextModalTitle: "上下文分布";
  summary: {
    statusLabel: string;
    statusTone: ActivityRailTone;
    latestResultLabel: string;
    durationLabel: string;
    inputLabel: string;
    contextLabel: string;
    outputLabel: string;
    successCount: number;
    failureCount: number;
    alertCount: number;
    modelLabel: string;
  };
  filterCounts: Record<ActivityRailFilterKey, number>;
  timeline: ActivityTimelineItem[];
  executionSteps: ActivityExecutionStep[];
  taskSteps: ActivityTaskStep[];
  analysisCards: ActivityAnalysisCard[];
  contextSnapshot: {
    latestPrompt: string | null;
    latestAttachments: PromptAttachmentLike[];
    partialMessage: string;
    cwd: string;
    model: string;
    remoteSessionId: string;
    slashCommandCount: number;
    latestResultText: string;
  };
  contextDistribution: ContextDistributionModel;
};

type ToolOutcome = {
  isError: boolean;
  detail: string;
  rawDetail: string;
  outputChars: number;
  capturedAt?: number;
};

type ParsedPlan = {
  round: number;
  sequence: number;
  sourceTimelineId: string;
  steps: Array<{
    id: string;
    index: number;
    indexLabel: string;
    title: string;
    detail: string;
    round: number;
    sourceTimelineId: string;
  }>;
};

type HookQualitySignal = {
  timelineId: string;
  hookEvent: string;
  detail: string;
  tone: ActivityRailTone;
  hasParamFix: boolean;
  needsAttention: boolean;
  permissionDecision?: string;
  outcome: string;
};

type DistributionBucketDraft = {
  id: string;
  label: string;
  chars: number;
  messageCount: number;
  sample: string;
  tone: ActivityRailTone;
};

const DISTRIBUTION_ORDER = [
  "user-prompt",
  "attachment",
  "assistant-plan",
  "thinking",
  "tool-input",
  "tool-output",
  "assistant-output",
  "final-result",
  "hook",
  "permission",
] as const;

function getResultText(result: SDKResultMessage): string {
  return result.subtype === "success" ? result.result : result.errors.join("\n");
}

function truncate(value: string, max = 160): string {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function formatRawDetail(value: unknown): string {
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (parsed !== null) {
      return JSON.stringify(parsed, null, 2);
    }
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toScalarDetailValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number")) {
    return value.join(", ");
  }
  return null;
}

function buildDetailRows(
  input: Record<string, unknown>,
  preferredKeys: string[] = [],
): ActivityDetailRow[] {
  const rows: ActivityDetailRow[] = [];
  const orderedKeys = [
    ...preferredKeys.filter((key) => key in input),
    ...Object.keys(input).filter((key) => !preferredKeys.includes(key)),
  ];

  for (const key of orderedKeys) {
    const value = toScalarDetailValue(input[key]);
    if (value === null || value.length === 0) continue;
    rows.push({ label: key, value });
  }

  return rows;
}

function buildToolInputSection(name: string, input: Record<string, unknown>, detail: string): ActivityDetailSection {
  const normalizedName = name.toLowerCase();
  const preferredKeys =
    normalizedName === "toolsearch"
      ? ["query", "max_results"]
      : normalizedName === "bash"
        ? ["command", "description"]
        : ["file_path", "pattern", "old_string", "new_string", "replace_all"];

  const rows = buildDetailRows(input, preferredKeys);
  const summary =
    normalizedName === "toolsearch"
      ? [input.query ? `query=${String(input.query)}` : "", input.max_results !== undefined ? `max_results=${String(input.max_results)}` : ""]
          .filter(Boolean)
          .join(" · ")
      : detail || undefined;

  return {
    id: "tool-input",
    title: "工具输入",
    summary: summary || undefined,
    rows,
    raw: formatRawDetail(input),
    rawLabel: "展开原始输入",
  };
}

function buildToolOutputSection(name: string, rawDetail: string, isError: boolean): ActivityDetailSection {
  const parsed = tryParseJson(rawDetail);
  let rows: ActivityDetailRow[] = [];
  let summary = rawDetail.trim();

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    rows = buildDetailRows(record, ["type", "tool_name", "title", "url", "count"]);
    if (record.type === "tool_reference" && typeof record.tool_name === "string") {
      summary = `命中工具引用 ${record.tool_name}`;
    } else if (typeof record.title === "string") {
      summary = record.title;
    } else {
      summary = truncate(JSON.stringify(record), 120);
    }
  } else if (!summary) {
    summary = isError ? "工具返回错误" : "工具已返回结果";
  } else if (name.toLowerCase() === "bash") {
    summary = truncate(rawDetail.split(/\r?\n/)[0] ?? rawDetail, 120);
  } else {
    summary = truncate(rawDetail, 120);
  }

  return {
    id: "tool-output",
    title: "工具输出",
    summary,
    rows,
    raw: formatRawDetail(rawDetail),
    rawLabel: "展开原始返回",
  };
}

function parseHookOutput(rawOutput: string): {
  additionalContext?: string;
  reason?: string;
  decision?: string;
  hasUpdatedInput?: boolean;
  permissionDecision?: string;
} {
  const parsed = tryParseJson(rawOutput);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  const record = parsed as Record<string, unknown>;
  const hookSpecificOutput = isRecord(record.hookSpecificOutput) ? record.hookSpecificOutput : {};

  return {
    additionalContext: typeof hookSpecificOutput.additionalContext === "string"
      ? hookSpecificOutput.additionalContext
      : undefined,
    reason: typeof record.reason === "string" ? record.reason : undefined,
    decision: typeof record.decision === "string" ? record.decision : undefined,
    permissionDecision: typeof hookSpecificOutput.permissionDecision === "string"
      ? hookSpecificOutput.permissionDecision
      : undefined,
    hasUpdatedInput: "updatedInput" in hookSpecificOutput,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function buildHookQualitySignal(
  timelineId: string,
  hookEvent: string,
  outcome: string,
  parsed: {
    additionalContext?: string;
    reason?: string;
    decision?: string;
    hasUpdatedInput?: boolean;
    permissionDecision?: string;
  },
  stdout: string,
  stderr: string,
): HookQualitySignal {
  const sourceText = [parsed.additionalContext, parsed.reason, stdout, stderr, outcome]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  const normalized = sourceText.toLowerCase();
  const hasParamFix = Boolean(parsed.hasUpdatedInput) || /参数|updatedinput|清理|规范化|去除空白|参数修复|参数优化|参数校验/i.test(sourceText);
  const needsAttention =
    outcome === "error" ||
    outcome === "cancelled" ||
    /ask|deny|重复|未读|缺少|缺失|高风险|风险|先确认|建议|失败|重试/.test(normalized) ||
    parsed.permissionDecision === "ask" ||
    parsed.permissionDecision === "deny" ||
    parsed.permissionDecision === "defer";

  return {
    timelineId,
    hookEvent,
    detail: sourceText || "Hook 已执行完成",
    tone: needsAttention
      ? "warning"
      : /error|fail/i.test(parsed.decision ?? "")
        ? "error"
        : "info",
    hasParamFix,
    needsAttention,
    permissionDecision: parsed.permissionDecision,
    outcome,
  };
}

function qualityToneFromScore(score: number, success: boolean | null): ActivityRailTone {
  if (success === null) {
    return "warning";
  }

  if (score >= 88) return "success";
  if (score >= 65) return "warning";
  return "error";
}

function buildFinalQualityScore({
  success,
  toolErrorCount,
  duplicateToolCount,
  hookAttentionCount,
  hookParamFixCount,
  hookAskCount,
}: {
  success: boolean | null;
  toolErrorCount: number;
  duplicateToolCount: number;
  hookAttentionCount: number;
  hookParamFixCount: number;
  hookAskCount: number;
}): {
  score: number;
  tone: ActivityRailTone;
  summary: string;
} {
  let score = 100;
  if (success === null) {
    score -= 10;
  } else if (success === false) {
    score -= 40;
  }
  score -= Math.min(toolErrorCount * 18, 45);
  score -= Math.min(duplicateToolCount * 6, 20);
  score -= Math.min(hookAttentionCount * 8, 25);
  score -= hookAskCount > 0 ? 10 : 0;
  score += Math.min(hookParamFixCount * 3, 10);

  const summary =
    success === null
      ? "当前轮次未稳定落到最终结果，需关注后续工具链回路是否打通。"
      : success
        ? "本轮已完成最终结果，建议关注 hook 与参数改造是否能复用到复盘策略。"
        : "最终结果失败，优先核对失败工具与 hook 决策是否产生了偏差。";

  return {
    score: clamp(score, 0, 100),
    tone: qualityToneFromScore(score, success),
    summary,
  };
}

function buildHookDetailSections(systemMessage: Record<string, unknown>): ActivityDetailSection[] {
  const output = typeof systemMessage.output === "string" ? systemMessage.output : "";
  const stdout = typeof systemMessage.stdout === "string" ? systemMessage.stdout : "";
  const stderr = typeof systemMessage.stderr === "string" ? systemMessage.stderr : "";
  const parsed = parseHookOutput(output);
  const rows: ActivityDetailRow[] = [
    { label: "hook_name", value: String(systemMessage.hook_name ?? "-") },
    { label: "hook_event", value: String(systemMessage.hook_event ?? "-") },
  ];

  if (typeof systemMessage.outcome === "string") {
    rows.push({ label: "outcome", value: systemMessage.outcome });
  }
  if (typeof parsed.permissionDecision === "string") {
    rows.push({ label: "permission", value: parsed.permissionDecision });
  }
  if (typeof parsed.decision === "string") {
    rows.push({ label: "decision", value: parsed.decision });
  }
  if (typeof systemMessage.exit_code === "number") {
    rows.push({ label: "exit_code", value: String(systemMessage.exit_code) });
  }

  const sections: ActivityDetailSection[] = [{
    id: "hook-summary",
    title: "Hook 结果",
    summary: parsed.additionalContext || parsed.reason || undefined,
    rows,
    raw: output || undefined,
    rawLabel: "展开 Hook 原始输出",
  }];

  if (stdout.trim()) {
    sections.push({
      id: "hook-stdout",
      title: "Hook 标准输出",
      rows: [],
      raw: stdout,
      rawLabel: "展开 stdout",
    });
  }

  if (stderr.trim()) {
    sections.push({
      id: "hook-stderr",
      title: "Hook 错误输出",
      rows: [],
      raw: stderr,
      rawLabel: "展开 stderr",
    });
  }

  return sections;
}

function formatNumber(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDuration(value?: number): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function formatCompactMetric(chars: number, tokens?: number): string {
  if (typeof tokens === "number" && !Number.isNaN(tokens)) {
    return `${formatNumber(tokens)} tok`;
  }
  return `${formatNumber(chars)} 字符`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createEmptyMetrics(overrides?: Partial<ActivityExecutionMetrics>): ActivityExecutionMetrics {
  return {
    inputChars: 0,
    contextChars: 0,
    outputChars: 0,
    durationMs: undefined,
    inputTokens: undefined,
    outputTokens: undefined,
    successCount: 0,
    failureCount: 0,
    totalCount: 0,
    status: "neutral",
    ...overrides,
  };
}

function mergeMetrics(...metricsList: ActivityExecutionMetrics[]): ActivityExecutionMetrics {
  const durationValues = metricsList
    .map((metrics) => metrics.durationMs)
    .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
  const successCount = metricsList.reduce((sum, metrics) => sum + metrics.successCount, 0);
  const failureCount = metricsList.reduce((sum, metrics) => sum + metrics.failureCount, 0);
  const totalCount = metricsList.reduce((sum, metrics) => sum + metrics.totalCount, 0);

  let status: ActivityMetricStatus = "neutral";
  if (failureCount > 0) {
    status = "failure";
  } else if (successCount > 0 && successCount === totalCount && totalCount > 0) {
    status = "success";
  } else if (totalCount > 0) {
    status = "running";
  }

  return {
    inputChars: metricsList.reduce((sum, metrics) => sum + metrics.inputChars, 0),
    contextChars: metricsList.reduce((max, metrics) => Math.max(max, metrics.contextChars), 0),
    outputChars: metricsList.reduce((sum, metrics) => sum + metrics.outputChars, 0),
    durationMs: durationValues.length > 0 ? durationValues.reduce((sum, value) => sum + value, 0) : undefined,
    inputTokens: metricsList.reduce((sum, metrics) => sum + (metrics.inputTokens ?? 0), 0) || undefined,
    outputTokens: metricsList.reduce((sum, metrics) => sum + (metrics.outputTokens ?? 0), 0) || undefined,
    successCount,
    failureCount,
    totalCount,
    status,
  };
}

function buildStatusSummary(
  status: SessionLike["status"],
  permissionCount: number,
): { label: string; tone: ActivityRailTone } {
  if (permissionCount > 0) {
    return { label: "等待确认", tone: "warning" };
  }

  switch (status) {
    case "running":
      return { label: "执行中", tone: "info" };
    case "completed":
      return { label: "已完成", tone: "success" };
    case "error":
      return { label: "出错", tone: "error" };
    default:
      return { label: "待命", tone: "neutral" };
  }
}

function getToolResultDetail(content: NonNullable<SDKUserMessage["message"]["content"]>[number]): string {
  if (typeof content === "string") return content;
  if ("content" in content) {
    if (Array.isArray(content.content)) {
      return content.content
        .map((item) => {
          if (typeof item === "string") return item;
          if ("text" in item && typeof item.text === "string") return item.text;
          return stringifyUnknown(item);
        })
        .join(" ");
    }
    return stringifyUnknown(content.content);
  }
  return stringifyUnknown(content);
}

function describeToolInput(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "Bash":
      return String(input.command ?? "");
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      return String(input.file_path ?? "");
    case "Glob":
    case "Grep":
      return String(input.pattern ?? "");
    case "Task":
      return String(input.description ?? "");
    case "WebFetch":
      return String(input.url ?? "");
    default:
      return Object.keys(input).length > 0 ? stringifyUnknown(input) : "";
  }
}

function getCapturedAt(message: StreamMessageLike): number | undefined {
  return typeof message.capturedAt === "number" ? message.capturedAt : undefined;
}

function classifyToolUse(name: string, detail: string): "file" | "search" | "validation" | "exec" | "other" {
  const normalizedName = name.toLowerCase();
  const normalizedDetail = detail.toLowerCase();

  if (["read", "write", "edit", "multiedit"].includes(normalizedName)) return "file";
  if (["glob", "grep"].includes(normalizedName)) return "search";
  if (normalizedName === "bash") {
    if (/test|pytest|vitest|jest|lint|build|check|verify|tsc|npm run|pnpm|bun run/.test(normalizedDetail)) {
      return "validation";
    }
    return "exec";
  }
  return "other";
}

function classifyStageKindFromText(text: string): ActivityStageKind {
  const normalized = text.toLowerCase();

  if (
    /检查|查看|分析|理解|定位|阅读|调研|inspect|explore|search|read|review|investigate|scan/.test(normalized)
  ) {
    return "inspect";
  }

  if (
    /修改|实现|修复|编写|调整|重构|patch|update|edit|write|refactor|implement|change/.test(normalized)
  ) {
    return "implement";
  }

  if (/测试|验证|构建|编译|检查结果|test|verify|lint|build|compile|check/.test(normalized)) {
    return "verify";
  }

  if (/总结|回复|输出|汇总|说明|report|reply|summarize|deliver|final/.test(normalized)) {
    return "deliver";
  }

  if (/计划|步骤|step|plan/.test(normalized)) {
    return "plan";
  }

  return "other";
}

function parseChineseNumber(raw: string): number {
  const mapping: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };

  if (raw === "十") return 10;
  if (raw.startsWith("十")) return 10 + (mapping[raw.slice(1)] ?? 0);
  if (raw.endsWith("十")) return (mapping[raw[0]] ?? 1) * 10;
  if (raw.includes("十")) {
    const [left, right] = raw.split("十");
    return (mapping[left] ?? 1) * 10 + (mapping[right] ?? 0);
  }

  return mapping[raw] ?? Number.POSITIVE_INFINITY;
}

const PLAN_HINT_PATTERN =
  /(计划|步骤|step|steps|task|tasks|roadmap|路线|时间表|先做|然后|接下来|接着|最后|执行|实施|方案|清单|按以下|我会先|我会按|我将|分解|先确认|按顺序|逐步|先完成|我先|我先做)/i;

const PLAN_NON_PLAN_PREFIX_PATTERN =
  /(常见选择|常见方案|常见|可选|选项|优化方向|主要改动|主要修改|主要调整|功能改进|当前上下文|上下文情况|我不确定|不确定|看了代码|看完代码|状态|结果)/i;

const PLAN_ITEM_ACTION_PATTERN =
  /(实现|创建|编写|生成|搭建|重构|优化|检查|验证|更新|补齐|修复|确认|读取|写入|安装|执行|配置|迁移|部署|提交|清理|拆解|处理|开发|分析|梳理|排查|调研|设计|构建|运行|重试|inspect|update|edit|build|run|fix|verify|check|search|create|read|write|prepare|implement|execute|decide|return|analyze)/i;

function parseExplicitPlan(text: string): Array<{ index: number; title: string }> {
  const normalized = text.replace(/\r/g, "");
  type PlanCandidate = { index: number; title: string; start: number };

  const buildMatches = (line: RegExp): PlanCandidate[] =>
    Array.from(normalized.matchAll(line), (match) => ({
      index: Number(match[1]),
      title: String(match[2]).trim(),
      start: match.index ?? 0,
    }));

  const acceptListAsPlan = (items: PlanCandidate[]): boolean => {
    if (items.length < 2) return false;
    const hintWindow = normalized.slice(0, Math.max(0, items[0]?.start ?? 0));
    const prefixWindow = normalized.slice(Math.max(0, (items[0]?.start ?? 0) - 220), Math.max(0, items[0]?.start ?? 0));
    const hasPlanHint = PLAN_HINT_PATTERN.test(hintWindow) || PLAN_HINT_PATTERN.test(prefixWindow);
    const hasPlanNegativePrefix = PLAN_NON_PLAN_PREFIX_PATTERN.test(prefixWindow);
    if (!hasPlanHint && hasPlanNegativePrefix) {
      return false;
    }

    const actionHitCount = items.filter((item) => PLAN_ITEM_ACTION_PATTERN.test(item.title)).length;
    const hasActionSignal = actionHitCount >= Math.max(1, Math.ceil(items.length / 2));
    return hasPlanHint || hasActionSignal;
  };

  const numberedMatches = buildMatches(/(?:^|\n)\s*(?:step\s*)?(\d+)[.)）:：、-]\s*(.+)$/gim);
  if (acceptListAsPlan(numberedMatches)) {
    return numberedMatches.map((item) => ({ index: item.index, title: item.title }));
  }

  const bracketedMatches = buildMatches(/(?:^|\n)\s*[(（](\d+)[)）]\s*(.+)$/gim);
  if (acceptListAsPlan(bracketedMatches)) {
    return bracketedMatches.map((item) => ({ index: item.index, title: item.title }));
  }

  const checkboxMatches = buildMatches(/(?:^|\n)\s*[-*]\s*\[[ xX]\]\s*(.+)$/gim).map((item, index) => ({
    index: index + 1,
    title: item.title,
    start: item.start,
  }));
  if (acceptListAsPlan(checkboxMatches)) {
    return checkboxMatches.map((item) => ({ index: item.index, title: item.title }));
  }

  const dashMatches = buildMatches(/(?:^|\n)\s*[-+*]\s*(.+)$/gim).map((item, index) => ({
    index: index + 1,
    title: item.title,
    start: item.start,
  }));
  if (acceptListAsPlan(dashMatches)) {
    return dashMatches.map((item) => ({ index: item.index, title: item.title }));
  }

  const chineseMatches = Array.from(normalized.matchAll(/(?:^|\n)\s*第([一二三四五六七八九十]+)步[:：、-]?\s*(.+)$/gm), (match) => ({
    index: parseChineseNumber(match[1]),
    title: String(match[2]).trim(),
    start: match.index ?? 0,
  }));
  if (acceptListAsPlan(chineseMatches)) {
    return chineseMatches.map((item) => ({ index: item.index, title: item.title }));
  }

  return [];
}

function summarizeAttachments(attachments: PromptAttachmentLike[]): string {
  if (attachments.length === 0) {
    return "没有附件";
  }

  const imageCount = attachments.filter((attachment) => attachment.kind === "image").length;
  const textCount = attachments.filter((attachment) => attachment.kind === "text").length;
  const parts = [`${attachments.length} 个附件`];

  if (imageCount > 0) parts.push(`${imageCount} 张图片`);
  if (textCount > 0) parts.push(`${textCount} 个文本`);

  return parts.join(" · ");
}

function getAttachmentContextChars(attachments: PromptAttachmentLike[]): number {
  return attachments.reduce((sum, attachment) => sum + (attachment.size ?? attachment.data.length), 0);
}

function addDistribution(
  buckets: Map<string, DistributionBucketDraft>,
  id: string,
  label: string,
  tone: ActivityRailTone,
  value: string,
  charsOverride?: number,
): void {
  const text = value.trim();
  const chars = charsOverride ?? text.length;
  if (chars <= 0 && text.length === 0) return;

  const existing = buckets.get(id);
  if (existing) {
    existing.chars += chars;
    existing.messageCount += 1;
    if (text) {
      existing.sample = truncate(text, 120);
    }
    return;
  }

  buckets.set(id, {
    id,
    label,
    chars,
    messageCount: 1,
    sample: truncate(text, 120),
    tone,
  });
}

function buildContextDistribution(
  drafts: Map<string, DistributionBucketDraft>,
): ContextDistributionModel {
  const orderedDrafts = DISTRIBUTION_ORDER.map((id) => drafts.get(id)).filter(
    (bucket): bucket is DistributionBucketDraft => Boolean(bucket),
  );
  const totalChars = orderedDrafts.reduce((sum, bucket) => sum + bucket.chars, 0);

  return {
    totalChars,
    buckets: orderedDrafts.map((bucket) => ({
      ...bucket,
      ratio: totalChars > 0 ? bucket.chars / totalChars : 0,
    })),
  };
}

function extractToolOutcomeMap(
  messages: StreamMessageLike[],
  distributionBuckets: Map<string, DistributionBucketDraft>,
): Map<string, ToolOutcome> {
  const outcomeMap = new Map<string, ToolOutcome>();

  for (const message of messages) {
    if (message.type !== "user") continue;
    const user = message as SDKUserMessage;
    const contents = Array.isArray(user.message.content) ? user.message.content : [user.message.content];

    for (const content of contents) {
      if (typeof content !== "string" && content.type === "tool_result") {
        const rawDetail = getToolResultDetail(content);
        const detail = truncate(rawDetail, 200);
        outcomeMap.set(content.tool_use_id, {
          isError: Boolean(content.is_error),
          detail,
          rawDetail,
          outputChars: rawDetail.length,
          capturedAt: getCapturedAt(message),
        });
        addDistribution(
          distributionBuckets,
          "tool-output",
          "工具输出",
          content.is_error ? "error" : "success",
          detail,
        );
      }
    }
  }

  return outcomeMap;
}

function createTimelineItem(
  item: Omit<ActivityTimelineItem, "preview" | "taskStepIds" | "stageKind" | "metrics" | "detailSections"> & {
    preview?: string;
    stageKind?: ActivityStageKind;
    metrics?: ActivityExecutionMetrics;
    detailSections?: ActivityDetailSection[];
  },
): ActivityTimelineItem {
  const stageKind = item.stageKind ?? classifyStageKindFromText(`${item.title}\n${item.detail}\n${item.chips.join(" ")}`);
  return {
    ...item,
    preview: item.preview ?? truncate(item.detail || item.title, 120),
    taskStepIds: [],
    stageKind,
    metrics: item.metrics ?? createEmptyMetrics(),
    detailSections: item.detailSections ?? [],
  };
}

function buildExecutionStepTitle(kind: ActivityStageKind, firstItem: ActivityTimelineItem): string {
  if (firstItem.filterKey === "tool" || firstItem.filterKey === "result") {
    return firstItem.title;
  }

  switch (kind) {
    case "inspect":
      return "检查与理解";
    case "implement":
      return "实施与修改";
    case "verify":
      return "验证与确认";
    case "deliver":
      return "整理与输出";
    default:
      return firstItem.title;
  }
}

function shouldIncludeInExecutionStep(
  item: ActivityTimelineItem,
  hiddenTimelineId: string | null,
): boolean {
  if (item.filterKey === "context") return false;
  if (hiddenTimelineId && item.id === hiddenTimelineId) return false;
  if (item.stageKind === "plan") return false;

  return (
    item.filterKey === "tool" ||
    item.filterKey === "result" ||
    item.attention ||
    item.stageKind === "inspect" ||
    item.stageKind === "implement" ||
    item.stageKind === "verify" ||
    item.stageKind === "deliver"
  );
}

function buildExecutionStepsFromTimeline(
  timelineChronological: ActivityTimelineItem[],
  hiddenTimelineId: string | null,
  sessionStatus: SessionLike["status"],
): { taskSteps: ActivityTaskStep[]; executionSteps: ActivityExecutionStep[] } {
  const candidateItems = timelineChronological.filter((item) =>
    shouldIncludeInExecutionStep(item, hiddenTimelineId),
  );

  const taskSteps: ActivityTaskStep[] = [];
  let currentStep: ActivityTaskStep | null = null;

  for (const item of candidateItems) {
    const shouldStartNewStep =
      !currentStep ||
      currentStep.round !== item.round ||
      currentStep.kind !== item.stageKind;

    if (shouldStartNewStep) {
      currentStep = {
        id: `execution-step-${taskSteps.length + 1}`,
        title: buildExecutionStepTitle(item.stageKind, item),
        detail: item.detail,
        round: item.round,
        kind: item.stageKind,
        status: "pending",
        timelineIds: [],
        sourceTimelineId: item.id,
        metrics: createEmptyMetrics(),
      };
      taskSteps.push(currentStep);
    }

    if (!currentStep) {
      continue;
    }

    currentStep.timelineIds.push(item.id);
    currentStep.metrics = mergeMetrics(currentStep.metrics, item.metrics);
    if (!currentStep.detail.includes(item.title)) {
      currentStep.detail = truncate(`${currentStep.detail}\n${item.title}`, 240);
    }
    item.taskStepIds.push(currentStep.id);
  }

  taskSteps.forEach((step, index) => {
    if (sessionStatus === "running" && index === taskSteps.length - 1) {
      step.status = "running";
      return;
    }
    step.status = "completed";
  });

  const executionSteps: ActivityExecutionStep[] = taskSteps.map((step) => ({
    ...step,
  }));

  return {
    taskSteps,
    executionSteps,
  };
}

export function buildActivityRailModel(
  session: SessionLike | undefined,
  permissionRequests: PermissionRequestLike[],
  partialMessage: string,
): ActivityRailModel {
  if (!session) {
    return {
      primarySectionTitle: "实时执行轨迹",
      detailCardTitle: "步骤详情",
      detailDrawerTitle: "节点详情",
      executionSectionTitle: "\u5b9e\u9645\u6267\u884c\u6b65\u9aa4",
      taskSectionTitle: "任务步骤",
      analysisSectionTitle: "分析洞察",
      contextModalTitle: "上下文分布",
      summary: {
        statusLabel: "待命",
        statusTone: "neutral",
        latestResultLabel: "待命",
        durationLabel: "-",
        inputLabel: "-",
        contextLabel: "-",
        outputLabel: "-",
        successCount: 0,
        failureCount: 0,
        alertCount: 0,
        modelLabel: "-",
      },
      filterCounts: {
        all: 0,
        attention: 0,
        context: 0,
        tool: 0,
        result: 0,
        flow: 0,
      },
      timeline: [],
      executionSteps: [],
      taskSteps: [],
      analysisCards: [],
      contextSnapshot: {
        latestPrompt: null,
        latestAttachments: [],
        partialMessage,
        cwd: "-",
        model: "-",
        remoteSessionId: "-",
        slashCommandCount: 0,
        latestResultText: "",
      },
      contextDistribution: {
        totalChars: 0,
        buckets: [],
      },
    };
  }

  const distributionBuckets = new Map<string, DistributionBucketDraft>();
  const toolOutcomeMap = extractToolOutcomeMap(session.messages, distributionBuckets);
  const timelineChronological: ActivityTimelineItem[] = [];
  const status = buildStatusSummary(session.status, permissionRequests.length);

  let round = 0;
  let sequence = 0;
  let latestPrompt: string | null = null;
  let latestAttachments: PromptAttachmentLike[] = [];
  let latestResultText = "";
  let latestDurationMs: number | undefined;
  let latestInputTokens: number | undefined;
  let latestOutputTokens: number | undefined;
  let latestModel = "";
  let latestRemoteSessionId = "";
  let toolErrorCount = 0;
  let fileOpCount = 0;
  let validationCount = 0;
  let duplicateToolCount = 0;
  let previousToolKey: string | null = null;
  let finalResultSuccess: boolean | null = null;
  let finalResultTimelineId: string | null = null;
  const hookQualitySignals: HookQualitySignal[] = [];
  let latestParsedPlan: ParsedPlan | null = null;
  let roundContextChars = 0;

  for (const message of session.messages) {
    if (message.type === "assistant") {
      const assistant = message as SDKAssistantMessage;
      const assistantCapturedAt = getCapturedAt(message);
      latestModel = assistant.message.model || latestModel;

      for (const content of assistant.message.content) {
        if (content.type === "thinking") {
          sequence += 1;
          addDistribution(distributionBuckets, "thinking", "思考", "warning", content.thinking);
          roundContextChars += content.thinking.length;
          continue;
        }

        if (content.type === "tool_use") {
          sequence += 1;

          const toolInput = (content.input ?? {}) as Record<string, unknown>;
          const detail = describeToolInput(content.name, toolInput);
          const toolKey = `${content.name}:${detail}`;
          if (previousToolKey === toolKey) {
            duplicateToolCount += 1;
          }
          previousToolKey = toolKey;

          addDistribution(
            distributionBuckets,
            "tool-input",
            "工具输入",
            "info",
            `${content.name} ${detail}`.trim(),
          );

          const toolKind = classifyToolUse(content.name, detail);
          if (toolKind === "file") fileOpCount += 1;
          if (toolKind === "validation") validationCount += 1;

          const outcome = toolOutcomeMap.get(content.id);
          const durationMs =
            typeof assistantCapturedAt === "number" && typeof outcome?.capturedAt === "number"
              ? Math.max(outcome.capturedAt - assistantCapturedAt, 0)
              : undefined;
          const tone: ActivityRailTone = outcome
            ? outcome.isError
              ? "error"
              : "success"
            : toolKind === "validation"
              ? "warning"
              : "info";

          if (outcome?.isError) {
            toolErrorCount += 1;
          }

          const stageKind =
            toolKind === "file"
              ? /edit|write|multiedit/i.test(content.name)
                ? "implement"
                : "inspect"
              : toolKind === "validation"
                ? "verify"
                : toolKind === "search"
                  ? "inspect"
                  : toolKind === "exec"
                    ? "implement"
                    : classifyStageKindFromText(`${content.name} ${detail}`);
          const inputSection = buildToolInputSection(content.name, toolInput, detail);
          const outputSection = outcome
            ? buildToolOutputSection(content.name, outcome.rawDetail, outcome.isError)
            : null;
          const detailSummary = [inputSection.summary, outputSection?.summary]
            .filter((value): value is string => Boolean(value))
            .join("\n");

          timelineChronological.push(
            createTimelineItem({
              id: content.id,
              filterKey: "tool",
              layer: "工具",
              tone,
              title: `调用 ${content.name}`,
              detail: detailSummary || [detail || "无额外参数", outcome ? `结果：${outcome.detail}` : ""].filter(Boolean).join("\n"),
              round: Math.max(round, 1),
              sequence,
              statusLabel: outcome ? (outcome.isError ? "失败" : "成功") : "运行中",
              chips: [content.name],
              attention: Boolean(outcome?.isError),
              stageKind,
              detailSections: outputSection ? [inputSection, outputSection] : [inputSection],
              metrics: createEmptyMetrics({
                inputChars: detail.length,
                contextChars: roundContextChars,
                outputChars: outcome?.outputChars ?? 0,
                durationMs,
                successCount: outcome && !outcome.isError ? 1 : 0,
                failureCount: outcome?.isError ? 1 : 0,
                totalCount: 1,
                status: outcome ? (outcome.isError ? "failure" : "success") : "running",
              }),
            }),
          );
          continue;
        }

        if (content.type === "text") {
          const text = content.text.trim();
          if (!text) continue;
          sequence += 1;
          const explicitPlan = parseExplicitPlan(text);

          if (explicitPlan.length >= 2) {
            const planTimelineId = `${assistant.uuid}-plan-${sequence}`;
            addDistribution(distributionBuckets, "assistant-output", "中间结果", "neutral", text);
            timelineChronological.push(
              createTimelineItem({
                id: planTimelineId,
                filterKey: "flow",
                layer: "流程",
                tone: "info",
                title: "生成任务计划",
                detail: text,
                round: Math.max(round, 1),
                sequence,
                statusLabel: "计划",
                chips: [`${explicitPlan.length} 步`],
                attention: false,
                stageKind: "plan",
                metrics: createEmptyMetrics({
                  contextChars: roundContextChars,
                  outputChars: text.length,
                }),
              }),
            );
            roundContextChars += text.length;

            latestParsedPlan = {
              round: Math.max(round, 1),
              sequence,
              sourceTimelineId: planTimelineId,
              steps: explicitPlan.map((step, index) => ({
                id: `${planTimelineId}-step-${index + 1}`,
                index: step.index,
                indexLabel: `Step ${step.index}`,
                title: step.title,
                detail: step.title,
                round: Math.max(round, 1),
                sourceTimelineId: planTimelineId,
              })),
            };
          } else {
            addDistribution(distributionBuckets, "assistant-output", "中间结果", "neutral", text);
            timelineChronological.push(
              createTimelineItem({
                id: `${assistant.uuid}-text-${sequence}`,
                filterKey: "result",
                layer: "结果",
                tone: "neutral",
                title: "生成中间结论",
                detail: text,
                round: Math.max(round, 1),
                sequence,
                statusLabel: "输出",
                chips: [],
                attention: false,
                stageKind: "deliver",
                metrics: createEmptyMetrics({
                  contextChars: roundContextChars,
                  outputChars: text.length,
                }),
              }),
            );
            roundContextChars += text.length;
          }
        }
      }

      continue;
    }

    if (message.type === "user") {
      const user = message as SDKUserMessage;
      const contents = Array.isArray(user.message.content) ? user.message.content : [user.message.content];
      for (const content of contents) {
        if (typeof content !== "string" && content.type === "tool_result") {
          roundContextChars += getToolResultDetail(content).length;
        }
      }
      continue;
    }

    if (message.type === "result") {
      const result = message as SDKResultMessage;
      sequence += 1;
      latestDurationMs = result.duration_ms ?? latestDurationMs;
      latestInputTokens = result.usage?.input_tokens ?? latestInputTokens;
      latestOutputTokens = result.usage?.output_tokens ?? latestOutputTokens;
      latestResultText = getResultText(result) || latestResultText;
      latestRemoteSessionId = result.session_id ?? latestRemoteSessionId;
      finalResultSuccess = result.subtype === "success";
      finalResultTimelineId = `${result.uuid}-result`;
      addDistribution(
        distributionBuckets,
        "final-result",
        "最终结果",
        result.subtype === "success" ? "success" : "error",
        latestResultText,
      );

      timelineChronological.push(
        createTimelineItem({
          id: `${result.uuid}-result`,
          filterKey: "result",
          layer: "结果",
          tone: result.subtype === "success" ? "success" : "error",
          title: result.subtype === "success" ? "本轮执行完成" : "本轮执行失败",
          detail: getResultText(result) || (result.subtype === "success" ? "任务已完成" : "任务失败"),
          round: Math.max(round, 1),
          sequence,
          statusLabel: result.subtype === "success" ? "完成" : "失败",
          chips: [],
          attention: result.subtype !== "success",
          stageKind: "deliver",
          metrics: createEmptyMetrics({
            contextChars: roundContextChars,
            outputChars: latestResultText.length,
            durationMs: result.duration_ms,
            inputTokens: result.usage?.input_tokens,
            outputTokens: result.usage?.output_tokens,
            successCount: result.subtype === "success" ? 1 : 0,
            failureCount: result.subtype === "success" ? 0 : 1,
            totalCount: 1,
            status: result.subtype === "success" ? "success" : "failure",
          }),
        }),
      );
      roundContextChars += latestResultText.length;
      previousToolKey = null;
      continue;
    }

    if (message.type === "system" && "subtype" in message) {
      const systemMessage = message as Record<string, unknown>;
      latestRemoteSessionId =
        (typeof systemMessage.session_id === "string" ? systemMessage.session_id : undefined) ??
        latestRemoteSessionId;

      if (message.subtype === "init") {
        const modelLabel =
          typeof systemMessage.model === "string" && systemMessage.model.length > 0
            ? systemMessage.model
            : latestModel || "-";
        sequence += 1;
        timelineChronological.push(
          createTimelineItem({
            id: `init-${String(systemMessage.uuid ?? sequence)}`,
            filterKey: "flow",
            layer: "流程",
            tone: "info",
            title: "初始化执行环境",
            detail: `模型：${modelLabel} · 权限：${String(systemMessage.permissionMode ?? systemMessage.permission_mode ?? "bypassPermissions")}`,
            round: Math.max(round, 1),
            sequence,
            statusLabel: "已初始化",
            chips: [],
            attention: false,
            stageKind: "plan",
            metrics: createEmptyMetrics({
              contextChars: roundContextChars,
            }),
          }),
        );
        continue;
      }

      if (message.subtype === "hook_started") {
        sequence += 1;
        timelineChronological.push(
          createTimelineItem({
            id: `hook-${String(systemMessage.uuid ?? sequence)}`,
            filterKey: "flow",
            layer: "流程",
            tone: "warning",
            title: `触发 Hook：${String(systemMessage.hook_name ?? systemMessage.hook_event ?? "未知 Hook")}`,
            detail: "当前执行链路进入外部钩子阶段，可用于后续复盘证据补全。",
            round: Math.max(round, 1),
            sequence,
            statusLabel: "处理中",
            chips: ["Hook"],
            attention: false,
            stageKind: "plan",
            metrics: createEmptyMetrics({
              contextChars: roundContextChars,
            }),
          }),
        );
        continue;
      }

      if (message.subtype === "hook_response") {
        sequence += 1;
        const hookOutput = typeof systemMessage.output === "string" ? systemMessage.output : "";
        const parsed = parseHookOutput(hookOutput);
        const outcome = typeof systemMessage.outcome === "string" ? systemMessage.outcome : "success";
        const hookEvent = String(systemMessage.hook_event ?? systemMessage.hook_name ?? "未知 Hook");
        const timelineId = `hook-response-${String(systemMessage.uuid ?? sequence)}`;
        const hookQualitySignal = buildHookQualitySignal(
          timelineId,
          hookEvent,
          outcome,
          parsed,
          typeof systemMessage.stdout === "string" ? systemMessage.stdout : "",
          typeof systemMessage.stderr === "string" ? systemMessage.stderr : "",
        );
        hookQualitySignals.push(hookQualitySignal);
        const detail =
          parsed.additionalContext ||
          parsed.reason ||
          (typeof systemMessage.stderr === "string" && systemMessage.stderr.trim()) ||
          (typeof systemMessage.stdout === "string" && systemMessage.stdout.trim()) ||
          hookOutput ||
          "Hook 已执行完成";
        const tone = hookQualitySignal.tone;

        addDistribution(
          distributionBuckets,
          "hook",
          "Hook 输出",
          tone,
          detail,
        );

        timelineChronological.push(
          createTimelineItem({
            id: timelineId,
            filterKey: "flow",
            layer: "流程",
            tone: hookQualitySignal.tone,
            title: `Hook 结果：${hookEvent}`,
            detail,
            round: Math.max(round, 1),
            sequence,
            statusLabel: outcome === "error" ? "失败" : outcome === "cancelled" ? "取消" : "完成",
            chips: ["Hook", String(systemMessage.hook_name ?? "Hook")],
            attention: tone !== "info",
            stageKind: "verify",
            detailSections: buildHookDetailSections(systemMessage),
            metrics: createEmptyMetrics({
              contextChars: roundContextChars,
            }),
          }),
        );
      }

      continue;
    }

    if (message.type === "stream_event") {
      const streamMessage = message as Record<string, unknown>;
      const event = streamMessage.event as Record<string, unknown> | undefined;
      if (event?.type === "message_start") {
        sequence += 1;
        timelineChronological.push(
          createTimelineItem({
            id: `stream-${String(streamMessage.uuid ?? sequence)}`,
            filterKey: "flow",
            layer: "流程",
            tone: "info",
            title: "开始生成响应",
            detail:
              typeof streamMessage.ttft_ms === "number"
                ? `首字节时间 ${formatDuration(streamMessage.ttft_ms)}`
                : "模型已开始流式生成。",
            round: Math.max(round, 1),
            sequence,
            statusLabel: "流式中",
            chips: [],
            attention: false,
            stageKind: "deliver",
            metrics: createEmptyMetrics({
              contextChars: roundContextChars,
              durationMs: typeof streamMessage.ttft_ms === "number" ? streamMessage.ttft_ms : undefined,
            }),
          }),
        );
      }
      continue;
    }

    if (message.type === "user_prompt") {
      round += 1;
      sequence += 1;
      latestPrompt = message.prompt;
      latestAttachments = message.attachments ?? [];
      previousToolKey = null;
      roundContextChars = message.prompt.length + getAttachmentContextChars(latestAttachments);

      addDistribution(distributionBuckets, "user-prompt", "用户提示", "neutral", message.prompt);
      for (const attachment of latestAttachments) {
        addDistribution(
          distributionBuckets,
          "attachment",
          "附件",
          attachment.kind === "image" ? "info" : "neutral",
          attachment.name,
          attachment.size ?? attachment.data.length,
        );
      }

      timelineChronological.push(
        createTimelineItem({
          id: `prompt-${round}-${sequence}`,
          filterKey: "context",
          layer: "上下文",
          tone: "neutral",
          title: "发送用户输入",
          detail: message.prompt || summarizeAttachments(latestAttachments),
          round,
          sequence,
          statusLabel: latestAttachments.length > 0 ? "含附件" : "纯文本",
          chips: latestAttachments.map((attachment) => attachment.name),
          attention: false,
          stageKind: "inspect",
          metrics: createEmptyMetrics({
            inputChars: message.prompt.length,
            contextChars: roundContextChars,
          }),
        }),
      );
      continue;
    }
  }

  for (const request of permissionRequests) {
    sequence += 1;
    addDistribution(
      distributionBuckets,
      "permission",
      "人工介入",
      "warning",
      `${request.toolName} ${stringifyUnknown(request.input)}`.trim(),
    );
    timelineChronological.push(
      createTimelineItem({
        id: `permission-${request.toolUseId}`,
        filterKey: "flow",
        layer: "流程",
        tone: "warning",
        title: `等待人工确认 ${request.toolName}`,
        detail: stringifyUnknown(request.input),
        round: Math.max(round, 1),
        sequence,
        statusLabel: "待确认",
        chips: [request.toolName],
        attention: true,
        stageKind: "other",
        metrics: createEmptyMetrics({
          contextChars: roundContextChars,
          totalCount: 1,
          status: "running",
        }),
      }),
    );
  }

  const { taskSteps, executionSteps } = buildExecutionStepsFromTimeline(
    timelineChronological,
    latestParsedPlan?.sourceTimelineId ?? null,
    session.status,
  );
  const timeline = timelineChronological
    .filter((item) => item.id !== latestParsedPlan?.sourceTimelineId)
    .reverse();
  const filterCounts: Record<ActivityRailFilterKey, number> = {
    all: timeline.length,
    attention: timeline.filter((item) => item.attention).length,
    context: timeline.filter((item) => item.filterKey === "context").length,
    tool: timeline.filter((item) => item.filterKey === "tool").length,
    result: timeline.filter((item) => item.filterKey === "result").length,
    flow: timeline.filter((item) => item.filterKey === "flow").length,
  };
  const contextDistribution = buildContextDistribution(distributionBuckets);
  const largestContextBucket = contextDistribution.buckets
    .slice()
    .sort((left, right) => right.chars - left.chars)[0];
  const executionMetrics = timeline.reduce(
    (aggregate, item) => mergeMetrics(aggregate, item.metrics),
    createEmptyMetrics(),
  );

  const analysisCards: ActivityAnalysisCard[] = [];
  const permissionItem = timeline.find((item) => item.title.startsWith("等待人工确认"));
  const toolErrorItem = timeline.find((item) => item.filterKey === "tool" && item.attention);

  if (permissionItem) {
    analysisCards.push({
      id: "blocker",
      title: "当前阻塞",
      tone: "warning",
      detail: `有 ${permissionRequests.length} 个人工确认仍未处理，自动执行链路会在这里停住。`,
      supportingTimelineId: permissionItem.id,
    });
  } else if (toolErrorItem) {
    analysisCards.push({
      id: "blocker",
      title: "当前阻塞",
      tone: "error",
      detail: `最近工具调用已经出现失败，先看失败步骤本身和它前后的上下文，而不是先看总耗时。`,
      supportingTimelineId: toolErrorItem.id,
    });
  } else {
    analysisCards.push({
      id: "blocker",
      title: "当前阻塞",
      tone: session.status === "running" ? "info" : "success",
      detail:
        session.status === "running"
          ? "当前还在执行中，优先关注最新时间线和实时输出。"
          : "当前链路没有明显阻塞，右侧可直接用于复盘而不是排障。",
    });
  }

  analysisCards.push({
    id: "evidence",
    title: "证据入口",
    tone: latestAttachments.length > 0 ? "info" : "neutral",
    detail:
      latestAttachments.length > 0
        ? `本轮输入包含 ${summarizeAttachments(latestAttachments)}，可以从附件和最终结果两端夹住分析。`
        : latestPrompt
          ? `本轮主请求是“${truncate(latestPrompt, 60)}”，建议对照时间线看模型在哪一步偏题。`
          : "当前没有新的用户输入证据，可从时间线最近步骤开始倒查。",
  });

  const hookInterventionCount = hookQualitySignals.length;
  const hookAttentionCount = hookQualitySignals.filter((signal) => signal.needsAttention).length;
  const hookParamFixCount = hookQualitySignals.filter((signal) => signal.hasParamFix).length;
  const hookAskCount = hookQualitySignals.filter((signal) =>
    signal.permissionDecision === "ask" ||
    signal.permissionDecision === "deny" ||
    signal.permissionDecision === "defer"
  ).length;
  const finalQuality = buildFinalQualityScore({
    success: finalResultSuccess,
    toolErrorCount,
    duplicateToolCount,
    hookAttentionCount,
    hookParamFixCount,
    hookAskCount,
  });
  const qualitySummary = [
    `最终评分 ${finalQuality.score} 分。${finalQuality.summary}`,
    `工具：失败 ${toolErrorCount} 次，重复 ${duplicateToolCount} 次。`,
    `Hook：触发 ${hookInterventionCount} 次，参数修复 ${hookParamFixCount} 次，需关注 ${hookAttentionCount} 次。`,
  ].join(" ");
  const attentionSignal = hookQualitySignals.find((signal) => signal.needsAttention);

  analysisCards.push({
    id: "execution-quality",
    title: "本轮执行质量",
    tone: finalQuality.tone,
    detail:
      finalQuality.tone === "success"
        ? `${qualitySummary} 可以把“参数修复 + 复用建议”纳入本轮复盘模板。`
        : qualitySummary,
    supportingTimelineId: finalResultTimelineId ?? attentionSignal?.timelineId,
  });

  if (!finalResultSuccess || hookInterventionCount > 0 || toolErrorCount > 0) {
    const suggestionItems = [];
    if (finalResultSuccess === false) {
      suggestionItems.push("先打开失败的最终结果节点，再逐层回溯到最后一次失败工具。");
    }
    if (toolErrorCount > 0) {
      suggestionItems.push("核对工具输入与输出是否存在参数漂移或重试链条。");
    }
    if (hookAttentionCount > 0) {
      suggestionItems.push("逐条打开 attention 的 Hook 节点，确认参数修复是否被采纳。");
    }
    if (hookParamFixCount > 0) {
      suggestionItems.push("将成功修正参数提炼成执行规范，减少未来重复。");
    }
    if (suggestionItems.length > 0) {
      analysisCards.push({
        id: "next-step",
        title: "建议下一步",
        tone: finalQuality.tone === "error" || hookAttentionCount > 0 ? "warning" : "info",
        detail: suggestionItems.join(" "),
      });
    }
  }

  if (fileOpCount > 0 && validationCount === 0) {
    analysisCards.push({
      id: "suggestion",
      title: "分析建议",
      tone: "warning",
      detail: "当前链路出现了文件读写，但没有明显验证动作。复盘时要重点看“改了什么”与“为什么认为它已正确”。",
    });
  } else if (duplicateToolCount > 0) {
    analysisCards.push({
      id: "suggestion",
      title: "分析建议",
      tone: "warning",
      detail: `检测到 ${duplicateToolCount} 次重复调用，说明模型可能在同一层来回试探，值得检查上下文是否不够明确。`,
    });
  } else if (toolErrorCount > 0) {
    analysisCards.push({
      id: "suggestion",
      title: "分析建议",
      tone: "error",
      detail: "优先看失败工具步骤前后的两到三条事件，不要直接从最终回答倒推。",
    });
  } else {
    analysisCards.push({
      id: "suggestion",
      title: "分析建议",
      tone: "success",
      detail: "这轮轨迹相对顺直，可以从最新结果回跳到关键步骤，快速复盘成功模式。",
    });
  }

  if (largestContextBucket) {
    analysisCards.push({
      id: "context-hotspot",
      title: "上下文热点",
      tone: largestContextBucket.tone,
      detail: `当前近似上下文里占比最高的是“${largestContextBucket.label}”，约 ${formatNumber(largestContextBucket.chars)} 字符。适合优先检查这一类内容是否过长或重复。`,
    });
  }

  return {
    primarySectionTitle: "实时执行轨迹",
    detailCardTitle: "步骤详情",
    detailDrawerTitle: "节点详情",
    executionSectionTitle: "\u5b9e\u9645\u6267\u884c\u6b65\u9aa4",
    taskSectionTitle: "任务步骤",
    analysisSectionTitle: "分析洞察",
    contextModalTitle: "上下文分布",
    summary: {
      statusLabel: status.label,
      statusTone: status.tone,
      latestResultLabel: status.label,
      durationLabel: formatDuration(latestDurationMs),
      inputLabel: formatCompactMetric(executionMetrics.inputChars, latestInputTokens),
      contextLabel: formatCompactMetric(executionMetrics.contextChars),
      outputLabel: formatCompactMetric(executionMetrics.outputChars, latestOutputTokens),
      successCount: executionMetrics.successCount,
      failureCount: executionMetrics.failureCount,
      alertCount: filterCounts.attention,
      modelLabel: latestModel || "-",
    },
    filterCounts,
    timeline,
    executionSteps,
    taskSteps,
    analysisCards,
    contextSnapshot: {
      latestPrompt,
      latestAttachments,
      partialMessage,
      cwd: session.cwd || "-",
      model: latestModel || "-",
      remoteSessionId: latestRemoteSessionId || "-",
      slashCommandCount: session.slashCommands?.length ?? 0,
      latestResultText,
    },
    contextDistribution,
  };
}
