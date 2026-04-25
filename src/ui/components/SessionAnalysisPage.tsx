import { useEffect, useMemo, useState } from "react";
import {
  buildActivityRailModel,
  type ActivityDetailRow,
  type ActivityDetailSection,
  type ActivityExecutionMetrics,
  type ActivityRailModel,
  type ActivityRailTone,
  type ActivityTimelineItem,
  type PromptAnalysisModel,
} from "../../shared/activity-rail-model";
import type { PromptLedgerRiskKind, PromptLedgerSegment, PromptLedgerSourceKind } from "../../shared/prompt-ledger";
import type { SessionView } from "../store/useAppStore";

type InspectorTabKey = "node" | "prompt" | "raw" | "analytics";

type PromptSourceAggregate = {
  id: PromptLedgerSourceKind;
  label: string;
  shortLabel: string;
  chars: number;
  tokenEstimate: number;
  itemCount: number;
  ratio: number;
  sample: string;
  barClass: string;
  dotClass: string;
};

type TraceGroup = {
  id: string;
  indexLabel: string;
  title: string;
  detail: string;
  status: "pending" | "running" | "completed" | "drifted";
  metrics: ActivityExecutionMetrics;
  sourceTimelineId: string;
  items: ActivityTimelineItem[];
  isInferred: boolean;
};

type PromptOptimizationAction = {
  id: string;
  segmentId: string;
  label: string;
  source: string;
  score: number;
  actionLabel: string;
  round: number | null;
  tokenEstimate: number;
  nodeId: string | null;
  recommendation: string;
  summary: string;
};

type SegmentDiagnosis = {
  qualityScore: number;
  relevanceLabel: string;
  compressionLabel: string;
  actionLabel: string;
  actionTone: ActivityRailTone;
  reasons: string[];
};

type SegmentTraceLink = {
  label: string;
  detail: string;
  tone: ActivityRailTone;
};

type PromptHealthSummary = {
  score: number;
  tone: ActivityRailTone;
  label: string;
  headline: string;
  details: string[];
  nextActions: string[];
};

const NODE_KIND_META: Record<
  ActivityTimelineItem["nodeKind"],
  { label: string; short: string }
> = {
  context: { label: "上下文", short: "CTX" },
  plan: { label: "AI 计划", short: "PLAN" },
  assistant_output: { label: "AI 输出", short: "AI" },
  tool_input: { label: "工具调用", short: "TOOL" },
  retrieval: { label: "检索", short: "RAG" },
  file_read: { label: "读文件", short: "READ" },
  file_write: { label: "写文件", short: "WRITE" },
  terminal: { label: "终端", short: "TERM" },
  browser: { label: "浏览器", short: "WEB" },
  memory: { label: "Memory", short: "MEM" },
  mcp: { label: "MCP", short: "MCP" },
  handoff: { label: "子 Agent", short: "AG" },
  evaluation: { label: "校验", short: "EVAL" },
  error: { label: "错误", short: "ERR" },
  lifecycle: { label: "流程", short: "FLOW" },
  permission: { label: "人工确认", short: "HUM" },
  hook: { label: "Hook", short: "HOOK" },
  omitted: { label: "省略", short: "..." },
};

const STATUS_LABELS = {
  pending: "未开始",
  running: "执行中",
  completed: "已完成",
  drifted: "计划偏移",
} as const;

const PROMPT_SOURCE_ORDER: PromptLedgerSourceKind[] = [
  "system",
  "project",
  "skill",
  "workflow",
  "memory",
  "current",
  "attachment",
  "tool",
  "history",
  "other",
];

const PROMPT_SOURCE_META: Record<
  PromptLedgerSourceKind,
  { label: string; shortLabel: string; barClass: string; dotClass: string }
> = {
  system: { label: "系统", shortLabel: "System", barClass: "bg-blue-600", dotClass: "bg-blue-600" },
  project: { label: "项目", shortLabel: "Project", barClass: "bg-indigo-500", dotClass: "bg-indigo-500" },
  skill: { label: "Skills", shortLabel: "Skills", barClass: "bg-sky-400", dotClass: "bg-sky-400" },
  workflow: { label: "工作流", shortLabel: "Flow", barClass: "bg-emerald-400", dotClass: "bg-emerald-400" },
  memory: { label: "记忆", shortLabel: "Memory", barClass: "bg-amber-400", dotClass: "bg-amber-400" },
  current: { label: "当前输入", shortLabel: "Input", barClass: "bg-slate-500", dotClass: "bg-slate-500" },
  attachment: { label: "附件", shortLabel: "Attach.", barClass: "bg-fuchsia-400", dotClass: "bg-fuchsia-400" },
  tool: { label: "工具输出", shortLabel: "T-Output", barClass: "bg-rose-400", dotClass: "bg-rose-400" },
  history: { label: "历史", shortLabel: "History", barClass: "bg-slate-700", dotClass: "bg-slate-700" },
  other: { label: "其他", shortLabel: "Other", barClass: "bg-zinc-400", dotClass: "bg-zinc-400" },
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function truncate(text: string, max = 120) {
  if (!text) return "-";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}...`;
}

function formatDurationMs(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(2)}s`;
}

function formatMetricAmount(chars: number, tokens?: number) {
  if (typeof tokens === "number") {
    return `${tokens.toLocaleString("zh-CN")} tok`;
  }
  return `${chars.toLocaleString("zh-CN")} 字符`;
}

function isTraceSnapshotDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("traceSnapshotDebug") === "1") {
    return true;
  }

  try {
    return window.localStorage.getItem("tech-cc-hub:trace-snapshot-debug") === "1";
  } catch {
    return false;
  }
}

function tonePillClass(tone: ActivityRailTone) {
  switch (tone) {
    case "info":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function tonePanelClass(tone: ActivityRailTone) {
  switch (tone) {
    case "info":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function toneDotClass(tone: ActivityRailTone) {
  switch (tone) {
    case "info":
      return "bg-blue-500";
    case "success":
      return "bg-emerald-500";
    case "warning":
      return "bg-amber-500";
    case "error":
      return "bg-rose-500";
    default:
      return "bg-slate-400";
  }
}

function toneBarClass(tone: ActivityRailTone) {
  switch (tone) {
    case "info":
      return "bg-blue-500/85";
    case "success":
      return "bg-emerald-500/85";
    case "warning":
      return "bg-amber-500/85";
    case "error":
      return "bg-rose-500/85";
    default:
      return "bg-slate-400/85";
  }
}

function getStatusBadgeClass(status: TraceGroup["status"]) {
  switch (status) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "running":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "drifted":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

function getNodeKindMeta(item: ActivityTimelineItem) {
  if (item.nodeKind === "terminal" && item.nodeSubtype === "validation") {
    return { label: "终端校验", short: "CHK" };
  }
  return NODE_KIND_META[item.nodeKind];
}

function normalizeSearchText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesSearch(item: ActivityTimelineItem, query: string) {
  if (!query) return true;
  const haystack = normalizeSearchText(
    [
      item.title,
      item.preview,
      item.detail,
      item.toolName,
      item.provenance,
      item.statusLabel,
      ...item.chips,
      ...item.detailSections.flatMap((section) => [
        section.id,
        section.title,
        section.summary ?? "",
        section.raw ?? "",
        ...section.rows.flatMap((row) => [row.label, row.value]),
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  );
  return haystack.includes(query);
}

function isInputSection(section: ActivityDetailSection) {
  const text = `${section.id} ${section.title} ${section.summary ?? ""}`.toLowerCase();
  return text.includes("input") || text.includes("输入");
}

function isOutputSection(section: ActivityDetailSection) {
  const text = `${section.id} ${section.title} ${section.summary ?? ""}`.toLowerCase();
  return (
    text.includes("output") ||
    text.includes("输出") ||
    text.includes("结果") ||
    text.includes("返回")
  );
}

function rawSectionText(section: ActivityDetailSection) {
  if (section.raw && section.raw.trim()) return section.raw.trim();
  const block = section.rows
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n")
    .trim();
  return block || section.summary || section.title;
}

function sectionPrimaryText(section: ActivityDetailSection) {
  if (section.summary && section.summary.trim()) return section.summary.trim();
  if (section.raw && section.raw.trim()) return truncate(section.raw.trim(), 1000);
  if (section.rows.length > 0) {
    return section.rows
      .slice(0, 5)
      .map((row) => `${row.label}: ${row.value}`)
      .join("\n");
  }
  return section.title;
}

function fallbackMetadataRows(item: ActivityTimelineItem): ActivityDetailRow[] {
  const rows: ActivityDetailRow[] = [
    { label: "节点类型", value: getNodeKindMeta(item).label },
    { label: "所在轮次", value: `第 ${item.round} 轮 / #${item.sequence}` },
    { label: "过滤分组", value: item.filterKey },
    { label: "阶段", value: item.stageKind },
  ];

  if (item.toolName) rows.push({ label: "工具名", value: item.toolName });
  if (item.provenance) rows.push({ label: "来源", value: item.provenance });
  if (item.statusLabel) rows.push({ label: "状态", value: item.statusLabel });
  if (item.chips.length > 0) rows.push({ label: "标签", value: item.chips.join(" / ") });

  rows.push({ label: "耗时", value: formatDurationMs(item.metrics.durationMs) });
  rows.push({ label: "输入", value: formatMetricAmount(item.metrics.inputChars, item.metrics.inputTokens) });
  rows.push({ label: "上下文", value: formatMetricAmount(item.metrics.contextChars) });
  rows.push({ label: "输出", value: formatMetricAmount(item.metrics.outputChars, item.metrics.outputTokens) });

  return rows;
}

function collectMetadataRows(item: ActivityTimelineItem) {
  const seen = new Set<string>();
  const rows: ActivityDetailRow[] = [];

  for (const row of fallbackMetadataRows(item)) {
    const key = `${row.label}:${row.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  for (const section of item.detailSections) {
    for (const row of section.rows) {
      const key = `${row.label}:${row.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }

  return rows;
}

function buildMetadataPreview(item: ActivityTimelineItem, rows: ActivityDetailRow[]) {
  const payload = {
    id: item.id,
    title: item.title,
    nodeKind: item.nodeKind,
    nodeSubtype: item.nodeSubtype ?? null,
    toolName: item.toolName ?? null,
    provenance: item.provenance ?? null,
    round: item.round,
    sequence: item.sequence,
    statusLabel: item.statusLabel ?? null,
    stageKind: item.stageKind,
    chips: item.chips,
    metrics: item.metrics,
    metadata: Object.fromEntries(rows.slice(0, 16).map((row) => [row.label, row.value])),
  };

  return JSON.stringify(payload, null, 2);
}

function CopyButton({
  label,
  value,
  secondary = false,
}: {
  label: string;
  value: string;
  secondary?: boolean;
}) {
  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error("Failed to copy trace content:", error);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className={cx(
        "rounded-md px-3 py-1.5 text-[10px] font-bold transition",
        secondary
          ? "text-slate-600 hover:bg-slate-200/70"
          : "text-primary hover:bg-blue-50",
      )}
    >
      {label}
    </button>
  );
}

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-bold uppercase tracking-tight text-slate-400">{label}</span>
      <span className="text-sm font-bold text-slate-700">{value}</span>
      <span className="text-[10px] text-slate-400">{detail}</span>
    </div>
  );
}

function TreeItem({
  item,
  active,
  onSelect,
}: {
  item: ActivityTimelineItem;
  active: boolean;
  onSelect: () => void;
}) {
  const meta = getNodeKindMeta(item);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        "flex w-full items-start justify-between gap-3 rounded-md border px-2 py-1.5 text-left transition",
        active
          ? "border-blue-200 bg-blue-50/70"
          : "border-transparent hover:border-slate-200 hover:bg-slate-50",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{meta.short}</span>
          <span className="min-w-0 truncate text-[11px] font-semibold text-slate-700">{item.title}</span>
        </div>
        <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{item.preview}</div>
      </div>
      <div className="shrink-0 text-[9px] font-mono text-slate-400">{formatDurationMs(item.metrics.durationMs)}</div>
    </button>
  );
}

function CodeBlock({
  text,
  maxHeight = 240,
}: {
  text: string;
  maxHeight?: number;
}) {
  const lines = (text || "").split(/\r?\n/);

  return (
    <div
      className="rounded-lg border border-slate-800 bg-[#0f172a] p-3 font-mono text-[11px] leading-5 text-slate-300 shadow-inner"
      style={{ maxHeight }}
    >
      <div className="overflow-auto" style={{ maxHeight: maxHeight - 24 }}>
        {lines.map((line, index) => (
          <div key={`${index}-${line.slice(0, 12)}`} className="flex gap-3">
            <span className="w-6 shrink-0 text-right text-slate-600">{String(index + 1).padStart(2, "0")}</span>
            <span className="whitespace-pre-wrap break-all">{line || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionBlock({
  title,
  textModeLabel,
  altModeLabel,
  body,
}: {
  title: string;
  textModeLabel: string;
  altModeLabel: string;
  body: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</span>
        <div className="flex gap-2">
          <button type="button" className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
            {textModeLabel}
          </button>
          <button type="button" className="px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
            {altModeLabel}
          </button>
        </div>
      </div>
      <div className="max-h-52 overflow-y-auto whitespace-pre-wrap break-words bg-white p-3 text-[12px] leading-6 text-slate-700">
        {body}
      </div>
    </div>
  );
}

function aggregatePromptBuckets(analysis: PromptAnalysisModel): PromptSourceAggregate[] {
  const drafts = new Map<PromptLedgerSourceKind, Omit<PromptSourceAggregate, "ratio">>();

  for (const kind of PROMPT_SOURCE_ORDER) {
    const meta = PROMPT_SOURCE_META[kind];
    drafts.set(kind, {
      id: kind,
      label: meta.label,
      shortLabel: meta.shortLabel,
      chars: 0,
      tokenEstimate: 0,
      itemCount: 0,
      sample: "",
      barClass: meta.barClass,
      dotClass: meta.dotClass,
    });
  }

  for (const bucket of analysis.buckets) {
    const meta = PROMPT_SOURCE_META[bucket.sourceKind] ?? PROMPT_SOURCE_META.other;
    const existing = drafts.get(bucket.sourceKind) ?? {
      id: bucket.sourceKind,
      label: meta.label,
      shortLabel: meta.shortLabel,
      chars: 0,
      tokenEstimate: 0,
      itemCount: 0,
      sample: "",
      barClass: meta.barClass,
      dotClass: meta.dotClass,
    };

    existing.chars += bucket.chars;
    existing.tokenEstimate += bucket.tokenEstimate;
    existing.itemCount += bucket.itemCount;
    if (!existing.sample && bucket.sample) {
      existing.sample = bucket.sample;
    }
    drafts.set(bucket.sourceKind, existing);
  }

  const totalChars = Math.max(analysis.totalChars, 0);
  return PROMPT_SOURCE_ORDER.map((kind) => {
    const item = drafts.get(kind)!;
    return {
      ...item,
      ratio: totalChars > 0 ? item.chars / totalChars : 0,
    };
  });
}

function buildPromptPayloadPreview(analysis: PromptAnalysisModel) {
  if (analysis.buckets.length === 0) {
    return "暂无 Prompt Ledger 数据。新的请求会自动记录系统、项目、Skills、记忆、当前输入和历史上下文来源。";
  }

  return analysis.buckets
    .map((bucket) => {
      const meta = PROMPT_SOURCE_META[bucket.sourceKind] ?? PROMPT_SOURCE_META.other;
      return [
        `[${meta.label}] ${bucket.label}`,
        `chars=${bucket.chars}; estimated_tokens=${bucket.tokenEstimate}; items=${bucket.itemCount}; ratio=${(bucket.ratio * 100).toFixed(1)}%`,
        bucket.sourcePath ? `source=${bucket.sourcePath}` : null,
        bucket.sample ? `sample=${bucket.sample}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function riskLabel(risk: PromptLedgerRiskKind): string {
  switch (risk) {
    case "long_content":
      return "内容过长";
    case "repeated_content":
      return "疑似重复";
    case "ambiguous_reference":
      return "指代不明";
    case "missing_acceptance":
      return "缺少验收";
    case "tool_payload":
      return "工具载荷";
    default:
      return risk;
  }
}

function segmentKindLabel(segment: PromptLedgerSegment): string {
  switch (segment.segmentKind) {
    case "current_prompt":
      return "当前输入";
    case "attachment":
      return "附件";
    case "history_user_prompt":
      return "历史用户输入";
    case "history_assistant_output":
      return "历史 AI 输出";
    case "history_tool_input":
      return "历史工具输入";
    case "history_tool_output":
      return "历史工具输出";
    default:
      return PROMPT_SOURCE_META[segment.sourceKind]?.label ?? "来源";
  }
}

function inferReadableOptimization(segment: PromptLedgerSegment | null): string {
  if (!segment) return "选择片段后，这里会显示保留、压缩、移出或改写建议。";
  if (segment.risks.includes("missing_acceptance")) {
    return "补上可验证的完成标准，例如构建命令、视觉验收点或失败判定。";
  }
  if (segment.risks.includes("ambiguous_reference")) {
    return "把“这个/刚才/上面”替换成明确对象、文件名、节点或截图区域。";
  }
  if (segment.sourceKind === "project" || segment.sourceKind === "skill") {
    return "这类上下文通常保留；如果过长，优先拆成更小的项目规则或 skill 摘要。";
  }
  return "当前片段没有强风险，建议保留为证据，必要时只做摘要展示。";
}

function scorePromptSegment(segment: PromptLedgerSegment): number {
  let score = 42;
  if (segment.risks.includes("long_content")) score += 24;
  if (segment.risks.includes("tool_payload")) score += 18;
  if (segment.risks.includes("missing_acceptance")) score += 16;
  if (segment.risks.includes("ambiguous_reference")) score += 14;
  if (segment.risks.includes("repeated_content")) score += 12;
  if (segment.sourceKind === "tool" || segment.sourceKind === "history") score += 10;
  if (segment.tokenEstimate > 800) score += 12;
  if (segment.tokenEstimate < 40 && segment.risks.length === 0) score -= 20;
  return Math.max(0, Math.min(100, score));
}

function buildSegmentSummary(segment: PromptLedgerSegment): string {
  const risks = segment.risks.length > 0 ? segment.risks.map(riskLabel).join("、") : "低风险";
  const recommendation = segment.optimizationHint || inferReadableOptimization(segment);
  const sample = truncate(segment.sample || segment.text || segment.label, 240);
  return [
    `片段：${segment.label}`,
    `来源：${segmentKindLabel(segment)} · 第 ${segment.round ?? "-"} 轮 · 约 ${segment.tokenEstimate.toLocaleString("zh-CN")} tokens`,
    `风险：${risks}`,
    `建议：${recommendation}`,
    `摘要：${sample}`,
  ].join("\n");
}

function buildOptimizationAction(
  segment: PromptLedgerSegment,
  diagnosis: SegmentDiagnosis,
): PromptOptimizationAction {
  return {
    id: `${segment.id}-${Date.now()}`,
    segmentId: segment.id,
    label: segment.label,
    source: segmentKindLabel(segment),
    score: scorePromptSegment(segment),
    actionLabel: diagnosis.actionLabel,
    round: typeof segment.round === "number" ? segment.round : null,
    tokenEstimate: segment.tokenEstimate,
    nodeId: segment.nodeId ?? segment.messageId ?? null,
    recommendation: segment.optimizationHint || inferReadableOptimization(segment),
    summary: truncate(segment.sample || segment.text || segment.label, 180),
  };
}

function buildOptimizationPlan(actions: PromptOptimizationAction[]): string {
  if (actions.length === 0) return "";
  return [
    "Prompt 优化方案",
    "",
    ...actions.map((action, index) => [
      `${index + 1}. ${action.actionLabel}：${action.source} · ${action.label}`,
      `   优先级：${action.score} 分；轮次：${action.round ?? "-"}；体量：${action.tokenEstimate.toLocaleString("zh-CN")} tokens`,
      `   建议：${action.recommendation}`,
      `   证据：${action.summary}`,
    ].join("\n")),
  ].join("\n");
}

function traceLinkPillClass(tone: ActivityRailTone): string {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "info":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

function buildSegmentTraceLink(
  segment: PromptLedgerSegment,
  selectedTimelineItem: ActivityTimelineItem | null,
  exactIds: Set<string>,
  roundIds: Set<string>,
): SegmentTraceLink {
  if (selectedTimelineItem && exactIds.has(segment.id)) {
    return {
      label: "精确链接",
      detail: "片段 nodeId/messageId/toolName 直接命中当前 Trace 节点。",
      tone: "success",
    };
  }

  if (selectedTimelineItem && roundIds.has(segment.id)) {
    return {
      label: "同轮回退",
      detail: "没有直接节点命中，按当前 Trace 节点所在轮次关联。",
      tone: "info",
    };
  }

  if (segment.nodeId) {
    return {
      label: "有节点",
      detail: `片段记录了 Trace 节点 ${truncate(segment.nodeId, 48)}，可用于跳转复盘。`,
      tone: "success",
    };
  }

  if (typeof segment.round === "number") {
    return {
      label: "仅轮次",
      detail: `片段只记录第 ${segment.round} 轮，缺少稳定节点 id。`,
      tone: "warning",
    };
  }

  return {
    label: "无链接",
    detail: "片段缺少轮次和节点 id，只能作为全局上下文分析。",
    tone: "neutral",
  };
}

function diagnosePromptSegment(
  segment: PromptLedgerSegment | null,
  selectedTimelineItem: ActivityTimelineItem | null,
  totalTokenEstimate: number,
): SegmentDiagnosis {
  if (!segment) {
    return {
      qualityScore: 0,
      relevanceLabel: "未选择",
      compressionLabel: "未判断",
      actionLabel: "先选择片段",
      actionTone: "neutral",
      reasons: ["选择 Prompt 分布表格中的片段后，这里会解释它是否有用、是否可压缩、应该怎么处理。"],
    };
  }

  const tokenRatio = totalTokenEstimate > 0 ? segment.tokenEstimate / totalTokenEstimate : 0;
  const sameRound = Boolean(selectedTimelineItem?.round && segment.round === selectedTimelineItem.round);
  const directNode = Boolean(
    selectedTimelineItem &&
      (segment.nodeId === selectedTimelineItem.id ||
        segment.messageId === selectedTimelineItem.id ||
        (segment.toolName && selectedTimelineItem.toolName && segment.toolName === selectedTimelineItem.toolName)),
  );
  const noisySource = segment.sourceKind === "tool" || segment.sourceKind === "history";
  const compressionScore = Math.min(
    100,
    (segment.risks.includes("long_content") ? 34 : 0) +
      (segment.risks.includes("tool_payload") ? 28 : 0) +
      (noisySource ? 20 : 0) +
      (tokenRatio > 0.2 ? 18 : tokenRatio > 0.08 ? 10 : 0),
  );
  const relevanceScore = directNode ? 92 : sameRound ? 72 : segment.sourceKind === "current" ? 78 : noisySource ? 38 : 58;
  const riskPenalty = segment.risks.length * 9 + (tokenRatio > 0.25 ? 12 : 0);
  const qualityScore = Math.max(0, Math.min(100, Math.round((relevanceScore * 0.55) + ((100 - compressionScore) * 0.3) + ((100 - riskPenalty) * 0.15))));

  const reasons = [
    directNode
      ? "和当前选中的执行节点直接关联，可作为分析证据。"
      : sameRound
        ? "没有直接节点命中，但属于当前选中节点所在轮次。"
        : "不属于当前选中节点所在轮次，复盘时要确认它是否仍然相关。",
    tokenRatio > 0.2
      ? `占本次 prompt 约 ${(tokenRatio * 100).toFixed(0)}%，属于主要上下文成本。`
      : `占本次 prompt 约 ${(tokenRatio * 100).toFixed(0)}%，体量可控。`,
    segment.risks.length > 0
      ? `命中风险：${segment.risks.map(riskLabel).join("、")}。`
      : "没有命中明显风险规则。",
  ];

  let actionLabel = "保留为证据";
  let actionTone: ActivityRailTone = "success";
  if (compressionScore >= 70) {
    actionLabel = "优先压缩";
    actionTone = "warning";
  } else if (segment.risks.includes("missing_acceptance") || segment.risks.includes("ambiguous_reference")) {
    actionLabel = "改写当前输入";
    actionTone = "warning";
  } else if (!sameRound && noisySource) {
    actionLabel = "摘要后保留";
    actionTone = "info";
  }

  return {
    qualityScore,
    relevanceLabel: directNode ? "直接相关" : sameRound ? "同轮相关" : "弱相关",
    compressionLabel: compressionScore >= 70 ? "高" : compressionScore >= 40 ? "中" : "低",
    actionLabel,
    actionTone,
    reasons,
  };
}

function buildPromptHealthSummary(
  analysis: PromptAnalysisModel,
  aggregates: PromptSourceAggregate[],
  compressionCandidate: number,
  riskCount: number,
): PromptHealthSummary {
  if (analysis.totalTokenEstimate <= 0 || analysis.segments.length === 0) {
    return {
      score: 0,
      tone: "neutral",
      label: "暂无数据",
      headline: "还没有可分析的真实发送上下文。",
      details: ["新的请求会自动记录 Prompt Ledger，再生成上下文健康度。"],
      nextActions: ["先发起一轮真实会话，再回到 Prompt Ledger 查看诊断。"],
    };
  }

  const noisyTokens = aggregates
    .filter((bucket) => bucket.id === "history" || bucket.id === "tool" || bucket.id === "memory")
    .reduce((sum, bucket) => sum + bucket.tokenEstimate, 0);
  const currentTokens = aggregates
    .filter((bucket) => bucket.id === "current" || bucket.id === "attachment")
    .reduce((sum, bucket) => sum + bucket.tokenEstimate, 0);
  const noisyRatio = noisyTokens / analysis.totalTokenEstimate;
  const currentRatio = currentTokens / analysis.totalTokenEstimate;
  const compressionRatio = compressionCandidate / analysis.totalTokenEstimate;
  const largest = aggregates
    .filter((bucket) => bucket.tokenEstimate > 0)
    .sort((left, right) => right.tokenEstimate - left.tokenEstimate)[0];
  const riskDensity = riskCount / Math.max(analysis.segments.length, 1);

  let score = 100;
  score -= Math.min(noisyRatio * 42, 42);
  score -= Math.min(compressionRatio * 28, 28);
  score -= Math.min(riskDensity * 28, 22);
  if (currentRatio < 0.08) score -= 10;
  if (analysis.totalTokenEstimate > 8000) score -= 8;
  score = Math.max(0, Math.round(score));

  const tone: ActivityRailTone = score >= 78 ? "success" : score >= 58 ? "info" : score >= 38 ? "warning" : "error";
  const label = score >= 78 ? "健康" : score >= 58 ? "可用" : score >= 38 ? "偏臃肿" : "高风险";
  const headline =
    tone === "success"
      ? "本轮上下文结构比较清爽，可以直接按片段复盘。"
      : tone === "info"
        ? "本轮上下文可用，但仍有几段值得压缩或改写。"
        : tone === "warning"
          ? "本轮上下文偏臃肿，建议先处理历史或工具输出。"
          : "本轮上下文噪音较重，直接续聊容易把优化空间藏起来。";

  const details = [
    `历史/工具/记忆约占 ${(noisyRatio * 100).toFixed(0)}%，当前输入/附件约占 ${(currentRatio * 100).toFixed(0)}%。`,
    largest ? `最大来源是“${largest.label}”，约 ${largest.tokenEstimate.toLocaleString("zh-CN")} tok。` : "暂未识别最大来源。",
    `命中 ${riskCount} 个风险信号，${compressionCandidate.toLocaleString("zh-CN")} tok 可作为压缩候选。`,
  ];

  const nextActions = [
    noisyRatio > 0.55 ? "优先查看工具输出和历史片段，压缩为 3-5 条事实摘要。" : "保留当前上下文主干，只处理高风险片段。",
    currentRatio < 0.08 ? "当前输入占比偏低，补上本轮目标、约束和验收标准。" : "当前输入占比可接受，检查是否存在指代不明。",
    riskCount > 0 ? "按风险列排序或筛选，先处理“内容过长/工具载荷/缺少验收”。" : "风险较少，可从最大来源开始做轻量摘要。",
  ];

  return {
    score,
    tone,
    label,
    headline,
    details,
    nextActions,
  };
}

function PromptMetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: ActivityRailTone;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className={cx("h-2 w-2 rounded-full", toneDotClass(tone))} />
      </div>
      <div className="mt-1 text-lg font-black text-slate-800">{value}</div>
      <div className="mt-1 truncate text-[11px] text-slate-500">{detail}</div>
    </div>
  );
}

function mergeLocalMetrics(metricsList: ActivityExecutionMetrics[]): ActivityExecutionMetrics {
  const durationValues = metricsList
    .map((metrics) => metrics.durationMs)
    .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
  const successCount = metricsList.reduce((sum, metrics) => sum + metrics.successCount, 0);
  const failureCount = metricsList.reduce((sum, metrics) => sum + metrics.failureCount, 0);
  const totalCount = metricsList.reduce((sum, metrics) => sum + metrics.totalCount, 0);

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
    status: failureCount > 0 ? "failure" : successCount > 0 && successCount === totalCount && totalCount > 0 ? "success" : totalCount > 0 ? "running" : "neutral",
  };
}

function buildRoundTraceGroups(
  timeline: ActivityTimelineItem[],
  sessionStatus: SessionView["status"] | undefined,
): TraceGroup[] {
  const byRound = new Map<number, ActivityTimelineItem[]>();
  for (const item of timeline) {
    const round = item.round > 0 ? item.round : 1;
    byRound.set(round, [...(byRound.get(round) ?? []), item]);
  }

  const rounds = Array.from(byRound.keys()).sort((left, right) => left - right);
  const latestRound = rounds.at(-1);

  return rounds
    .map((round) => {
      const items = [...(byRound.get(round) ?? [])].sort((left, right) => left.sequence - right.sequence);
      const promptItem = items.find((item) => item.title === "发送用户输入");
      const firstUsefulItem = promptItem ?? items.find((item) => item.filterKey !== "context") ?? items[0];
      if (!firstUsefulItem) return null;

      const promptDetail = (promptItem?.detail || firstUsefulItem.detail || firstUsefulItem.title).trim();
      const hasAttention = items.some((item) => item.attention);
      const status: TraceGroup["status"] =
        sessionStatus === "running" && round === latestRound
          ? "running"
          : hasAttention
            ? "drifted"
            : "completed";

      return {
        id: `round-${round}`,
        indexLabel: String(round),
        title: `第 ${round} 轮 · ${truncate(promptDetail || firstUsefulItem.title, 38)}`,
        detail: promptDetail || firstUsefulItem.detail || firstUsefulItem.title,
        status,
        metrics: mergeLocalMetrics(items.map((item) => item.metrics)),
        sourceTimelineId: firstUsefulItem.id,
        items,
        isInferred: false,
      };
    })
    .filter((group): group is TraceGroup => Boolean(group));
}

function buildTraceDiagnosticReport(
  model: ActivityRailModel,
  groups: TraceGroup[],
  liveDraftChars: number,
): string {
  const aggregates = aggregatePromptBuckets(model.promptAnalysis).filter((bucket) => bucket.tokenEstimate > 0);
  const riskCount = model.promptAnalysis.segments.reduce((sum, segment) => sum + segment.risks.length, 0);
  const compressionTokens = aggregates
    .filter((bucket) => bucket.id === "history" || bucket.id === "tool" || bucket.id === "memory")
    .reduce((sum, bucket) => sum + bucket.tokenEstimate, 0);
  const health = buildPromptHealthSummary(model.promptAnalysis, aggregates, compressionTokens, riskCount);
  const topSources = aggregates
    .slice()
    .sort((left, right) => right.tokenEstimate - left.tokenEstimate)
    .slice(0, 5);
  const topSegments = model.promptAnalysis.segments
    .slice()
    .sort((left, right) => scorePromptSegment(right) - scorePromptSegment(left))
    .slice(0, 5);
  const evidenceCounts = model.promptAnalysis.segments.reduce(
    (counts, segment) => {
      if (segment.nodeId) {
        counts.linked += 1;
      } else if (typeof segment.round === "number") {
        counts.roundOnly += 1;
      } else {
        counts.unlinked += 1;
      }
      return counts;
    },
    { linked: 0, roundOnly: 0, unlinked: 0 },
  );

  return [
    "Trace / Prompt 诊断报告",
    "",
    "执行概览",
    `- 状态：${model.summary.statusLabel}`,
    `- 轮次：${groups.length}`,
    `- 节点：${model.timeline.length}，工具：${model.filterCounts.tool}，关注：${model.filterCounts.attention}`,
    `- 耗时：${model.summary.durationLabel}，输入：${model.summary.inputLabel}，输出：${model.summary.outputLabel}`,
    liveDraftChars > 0 ? `- 当前流式草稿：${liveDraftChars.toLocaleString("zh-CN")} 字符` : "- 当前流式草稿：无",
    "",
    "上下文健康度",
    `- 评分：${health.score} / 100（${health.label}）`,
    `- 结论：${health.headline}`,
    `- Prompt：${model.promptAnalysis.totalTokenEstimate.toLocaleString("zh-CN")} tok，${model.promptAnalysis.totalChars.toLocaleString("zh-CN")} 字符`,
    `- 可压缩候选：${compressionTokens.toLocaleString("zh-CN")} tok，风险信号：${riskCount}`,
    `- 证据链接：有节点 ${evidenceCounts.linked}，仅轮次 ${evidenceCounts.roundOnly}，无链接 ${evidenceCounts.unlinked}`,
    "",
    "最大来源",
    ...(topSources.length > 0
      ? topSources.map((source, index) => (
        `${index + 1}. ${source.label}：${source.tokenEstimate.toLocaleString("zh-CN")} tok，${(source.ratio * 100).toFixed(1)}%`
      ))
      : ["- 暂无 Prompt Ledger 来源"]),
    "",
    "优先优化片段",
    ...(topSegments.length > 0
      ? topSegments.map((segment, index) => (
        `${index + 1}. ${scorePromptSegment(segment)} 分 · ${segmentKindLabel(segment)} · 第 ${segment.round ?? "-"} 轮：${segment.optimizationHint || inferReadableOptimization(segment)}`
      ))
      : ["- 暂无可诊断片段"]),
    "",
    "下一步建议",
    ...health.nextActions.map((action) => `- ${action}`),
  ].join("\n");
}

function PromptSegmentRow({
  segment,
  active,
  linked,
  traceLink,
  onSelect,
}: {
  segment: PromptLedgerSegment;
  active: boolean;
  linked?: boolean;
  traceLink: SegmentTraceLink;
  onSelect: () => void;
}) {
  const meta = PROMPT_SOURCE_META[segment.sourceKind] ?? PROMPT_SOURCE_META.other;
  const risk = segment.risks[0];

  return (
    <tr
      className={cx(
        "cursor-pointer transition",
        active ? "bg-blue-50/70" : "hover:bg-slate-50",
      )}
      onClick={onSelect}
    >
      <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
        {segment.round ? `#${segment.round}` : "-"}
      </td>
      <td className="px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cx("h-2 w-2 shrink-0 rounded-full", meta.dotClass)} />
          <span className="truncate text-[11px] font-bold text-slate-700">{segmentKindLabel(segment)}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="truncate text-[12px] font-medium text-slate-800">{segment.sample || segment.label}</div>
        <div className="mt-0.5 flex gap-2 text-[10px] text-slate-400">
          {segment.toolName ? <span>{segment.toolName}</span> : null}
          {segment.nodeId ? <span>{truncate(segment.nodeId, 28)}</span> : null}
          {linked ? <span className="font-bold text-blue-600">当前节点</span> : null}
        </div>
      </td>
      <td className="px-3 py-2 text-right font-mono text-[11px] text-slate-500">
        {segment.tokenEstimate.toLocaleString("zh-CN")}
      </td>
      <td className="px-3 py-2">
        {risk ? (
          <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
            {riskLabel(risk)}
          </span>
        ) : (
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
            正常
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <span
          className={cx(
            "inline-flex max-w-full rounded border px-1.5 py-0.5 text-[10px] font-bold",
            traceLinkPillClass(traceLink.tone),
          )}
          title={traceLink.detail}
        >
          {traceLink.label}
        </span>
      </td>
      <td className="px-3 py-2">
        <span className="line-clamp-2 text-[10px] leading-4 text-slate-500">
          {segment.optimizationHint ? "可优化" : "保留"}
        </span>
      </td>
    </tr>
  );
}

function PromptLedgerPanel({
  analysis,
  selectedTimelineItem,
  onJumpToNode,
}: {
  analysis: PromptAnalysisModel;
  selectedTimelineItem: ActivityTimelineItem | null;
  onJumpToNode: (timelineId: string) => void;
}) {
  const segments = useMemo(() => analysis.segments ?? [], [analysis.segments]);
  const aggregates = useMemo(() => aggregatePromptBuckets(analysis), [analysis]);
  const nonEmptyAggregates = useMemo(
    () => aggregates.filter((bucket) => bucket.chars > 0),
    [aggregates],
  );
  const largest = useMemo(
    () => nonEmptyAggregates.reduce<PromptSourceAggregate | null>(
      (current, bucket) => (current === null || bucket.chars > current.chars ? bucket : current),
      null,
    ),
    [nonEmptyAggregates],
  );
  const compressionCandidate = useMemo(
    () => nonEmptyAggregates
      .filter((bucket) => bucket.id === "history" || bucket.id === "tool" || bucket.id === "memory")
      .reduce((sum, bucket) => sum + bucket.tokenEstimate, 0),
    [nonEmptyAggregates],
  );
  const compressionCandidateRatio =
    analysis.totalTokenEstimate > 0 ? compressionCandidate / analysis.totalTokenEstimate : 0;
  const [selectedKind, setSelectedKind] = useState<PromptLedgerSourceKind | "all">("all");
  const [scopeModeState, setScopeModeState] = useState<"node" | "all">("node");
  const [scopeAnchorId, setScopeAnchorId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [optimizationActions, setOptimizationActions] = useState<PromptOptimizationAction[]>([]);
  const selectedTimelineItemId = selectedTimelineItem?.id ?? null;
  const hasFreshScopeState = scopeAnchorId === selectedTimelineItemId;
  const scopeMode = hasFreshScopeState ? scopeModeState : "node";
  const effectiveSelectedKind = hasFreshScopeState ? selectedKind : "all";
  const effectiveSelectedSegmentId = hasFreshScopeState ? selectedSegmentId : null;

  const nodeRelation = useMemo(() => {
    if (!selectedTimelineItem) {
      return {
        exactIds: new Set<string>(),
        roundIds: new Set<string>(),
        matchedIds: new Set<string>(),
        mode: "none" as const,
        label: "未选择节点",
        detail: "从左侧 Trace Flow 选择节点后，这里会自动显示关联片段。",
        tokenEstimate: 0,
        sourceLabels: [] as string[],
      };
    }

    const exact = analysis.segments.filter((segment) => {
      if (segment.nodeId === selectedTimelineItem.id || segment.messageId === selectedTimelineItem.id) return true;
      if (
        selectedTimelineItem.toolName &&
        segment.toolName === selectedTimelineItem.toolName &&
        segment.round === selectedTimelineItem.round
      ) {
        return true;
      }
      if (
        selectedTimelineItem.nodeKind === "context" &&
        selectedTimelineItem.title === "发送用户输入" &&
        (segment.segmentKind === "current_prompt" || segment.segmentKind === "attachment")
      ) {
        return true;
      }
      return false;
    });

    const round = exact.length > 0
      ? []
      : analysis.segments.filter((segment) => (
        typeof selectedTimelineItem.round === "number" &&
        selectedTimelineItem.round > 0 &&
        segment.round === selectedTimelineItem.round
      ));

    const exactIds = new Set(exact.map((segment) => segment.id));
    const roundIds = new Set(round.map((segment) => segment.id));
    const matchedIds = exactIds.size > 0 ? exactIds : roundIds;
    const mode = exactIds.size > 0 ? "exact" : roundIds.size > 0 ? "round" : "empty";
    const matchedSegments = exactIds.size > 0 ? exact : round;
    const tokenEstimate = matchedSegments.reduce((sum, segment) => sum + segment.tokenEstimate, 0);
    const sourceLabels = Array.from(new Set(matchedSegments.map(segmentKindLabel))).slice(0, 4);

    return {
      exactIds,
      roundIds,
      matchedIds,
      mode,
      label: selectedTimelineItem.toolName || selectedTimelineItem.title,
      tokenEstimate,
      sourceLabels,
      detail:
        mode === "exact"
          ? `已匹配 ${exactIds.size} 个直接关联片段。`
          : mode === "round"
            ? `没有直接节点片段，显示第 ${selectedTimelineItem.round} 轮上下文。`
            : "这个节点暂时没有可追踪到 Prompt Ledger 的片段。",
    };
  }, [analysis.segments, selectedTimelineItem]);

  const visibleSegments = useMemo(() => {
    const scoped = scopeMode === "node"
      ? segments.filter((segment) => nodeRelation.matchedIds.has(segment.id))
      : segments;
    return effectiveSelectedKind === "all"
      ? scoped
      : scoped.filter((segment) => segment.sourceKind === effectiveSelectedKind);
  }, [segments, nodeRelation.matchedIds, scopeMode, effectiveSelectedKind]);

  const segmentById = useMemo(
    () => new Map(segments.map((segment) => [segment.id, segment])),
    [segments],
  );
  const visibleSegmentRows = useMemo(
    () => visibleSegments.map((segment) => ({
      segment,
      linked: nodeRelation.matchedIds.has(segment.id),
      traceLink: buildSegmentTraceLink(segment, selectedTimelineItem, nodeRelation.exactIds, nodeRelation.roundIds),
    })),
    [nodeRelation.exactIds, nodeRelation.matchedIds, nodeRelation.roundIds, selectedTimelineItem, visibleSegments],
  );
  const visibleSegmentDiagnosisById = useMemo(
    () => new Map(visibleSegments.map((segment) => [
      segment.id,
      diagnosePromptSegment(segment, selectedTimelineItem, analysis.totalTokenEstimate),
    ])),
    [analysis.totalTokenEstimate, selectedTimelineItem, visibleSegments],
  );

  const hasEmptyNodeScope = scopeMode === "node" && Boolean(selectedTimelineItem) && nodeRelation.matchedIds.size === 0;
  const selectedSegment =
    (effectiveSelectedSegmentId
      ? visibleSegments.find((segment) => segment.id === effectiveSelectedSegmentId) ??
        segmentById.get(effectiveSelectedSegmentId)
      : null) ??
    visibleSegments[0] ??
    (hasEmptyNodeScope ? null : segments[0]) ??
    null;
  const selectedDiagnosis = selectedSegment
    ? visibleSegmentDiagnosisById.get(selectedSegment.id) ??
      diagnosePromptSegment(selectedSegment, selectedTimelineItem, analysis.totalTokenEstimate)
    : diagnosePromptSegment(null, selectedTimelineItem, analysis.totalTokenEstimate);
  const selectedTraceLink = selectedSegment
    ? buildSegmentTraceLink(selectedSegment, selectedTimelineItem, nodeRelation.exactIds, nodeRelation.roundIds)
    : null;
  const nodeJumpTarget = selectedSegment?.nodeId ?? selectedSegment?.messageId ?? null;

  const riskCount = useMemo(
    () => segments.reduce((sum, segment) => sum + segment.risks.length, 0),
    [segments],
  );
  const compressionTargetCount = useMemo(
    () => segments.reduce((sum, segment) => (
      segment.optimizationHint ||
      segment.risks.includes("long_content") ||
      segment.risks.includes("tool_payload")
        ? sum + 1
        : sum
    ), 0),
    [segments],
  );
  const payloadPreview = useMemo(() => buildPromptPayloadPreview(analysis), [analysis]);

  const sourceRows = useMemo(
    () => nonEmptyAggregates.length > 0
      ? nonEmptyAggregates
      : aggregates.filter((bucket) => bucket.id === "current" || bucket.id === "tool" || bucket.id === "history"),
    [aggregates, nonEmptyAggregates],
  );
  const healthSummary = useMemo(
    () => buildPromptHealthSummary(analysis, aggregates, compressionCandidate, riskCount),
    [aggregates, analysis, compressionCandidate, riskCount],
  );
  const sortedOptimizationActions = useMemo(
    () => [...optimizationActions].sort((left, right) => right.score - left.score),
    [optimizationActions],
  );
  const optimizationPlan = useMemo(
    () => buildOptimizationPlan(sortedOptimizationActions),
    [sortedOptimizationActions],
  );
  const handleSelectSegment = (segmentId: string) => {
    setScopeAnchorId(selectedTimelineItemId);
    setSelectedSegmentId(segmentId);
  };
  const handleGenerateSummary = async (segment: PromptLedgerSegment) => {
    const summary = buildSegmentSummary(segment);
    setGeneratedSummary(summary);
    try {
      await navigator.clipboard.writeText(summary);
    } catch (error) {
      console.error("Failed to copy generated prompt summary:", error);
    }
  };
  const handleAddOptimization = (segment: PromptLedgerSegment) => {
    const nextAction = buildOptimizationAction(
      segment,
      visibleSegmentDiagnosisById.get(segment.id) ??
        diagnosePromptSegment(segment, selectedTimelineItem, analysis.totalTokenEstimate),
    );
    setOptimizationActions((current) => {
      const existingIndex = current.findIndex((item) => item.segmentId === segment.id);
      if (existingIndex >= 0) {
        return current.map((item, index) => (index === existingIndex ? nextAction : item));
      }
      return [nextAction, ...current].slice(0, 8);
    });
  };
  const handleAddTopOptimizationTargets = () => {
    const nextActions = visibleSegments
      .map((segment) => buildOptimizationAction(
        segment,
        visibleSegmentDiagnosisById.get(segment.id) ??
          diagnosePromptSegment(segment, selectedTimelineItem, analysis.totalTokenEstimate),
      ))
      .filter((action) => action.score >= 58)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);
    if (nextActions.length === 0) return;
    setOptimizationActions((current) => {
      const bySegment = new Map<string, PromptOptimizationAction>();
      [...nextActions, ...current].forEach((action) => {
        if (!bySegment.has(action.segmentId)) {
          bySegment.set(action.segmentId, action);
        }
      });
      return [...bySegment.values()].sort((left, right) => right.score - left.score).slice(0, 8);
    });
  };

  return (
    <div className="flex h-full min-h-[680px] flex-col gap-3">
      <div className="grid shrink-0 gap-2 md:grid-cols-4">
        <PromptMetricCard label="真实发送上下文" value={`${analysis.totalTokenEstimate.toLocaleString("zh-CN")} tok`} detail={`${analysis.totalChars.toLocaleString("zh-CN")} 字符`} />
        <PromptMetricCard label="可压缩候选" value={`${compressionCandidate.toLocaleString("zh-CN")} tok`} detail={`历史 / 工具 / 记忆 ${(compressionCandidateRatio * 100).toFixed(1)}%`} tone="warning" />
        <PromptMetricCard label="风险信号" value={`${riskCount}`} detail="按片段规则粗筛" tone={riskCount > 0 ? "warning" : "success"} />
        <PromptMetricCard label="记录轮次" value={`${analysis.ledgers.length}`} detail={largest ? `最大来源：${largest.label}` : "暂无来源"} />
      </div>

      <section className={cx("shrink-0 rounded-lg border p-3", tonePanelClass(healthSummary.tone))}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-[11px] font-black uppercase tracking-widest opacity-70">上下文健康度</div>
              <span className="rounded bg-white/60 px-2 py-0.5 text-[10px] font-bold">{healthSummary.label}</span>
            </div>
            <div className="mt-1 text-[13px] font-bold">{healthSummary.headline}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-2xl font-black leading-none">{healthSummary.score}</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-widest opacity-70">score</div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <div className="space-y-1.5">
            {healthSummary.details.map((detail) => (
              <div key={detail} className="rounded border border-white/50 bg-white/50 px-2 py-1.5 text-[11px] leading-5">
                {detail}
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {healthSummary.nextActions.map((action, index) => (
              <div key={action} className="flex gap-2 rounded border border-white/50 bg-white/50 px-2 py-1.5 text-[11px] leading-5">
                <span className="font-mono font-bold opacity-70">{index + 1}</span>
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <main className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="shrink-0 border-b border-slate-100 bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-600">Prompt 分布</div>
                <div className="mt-1 text-[10px] text-slate-400">
                  {scopeMode === "node" && selectedTimelineItem
                    ? `${nodeRelation.label} · ${nodeRelation.detail}`
                    : "先按来源过滤，再看片段原文和建议。"}
                </div>
              </div>
              <CopyButton label="复制账本摘要" value={payloadPreview} secondary />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setScopeModeState("node");
                  setScopeAnchorId(selectedTimelineItemId);
                  setSelectedKind("all");
                  setSelectedSegmentId(null);
                }}
                disabled={!selectedTimelineItem || nodeRelation.matchedIds.size === 0}
                className={cx(
                  "flex h-8 items-center gap-2 rounded-full border px-3 text-left text-[11px] font-bold transition",
                  scopeMode === "node" && nodeRelation.matchedIds.size > 0
                    ? "border-blue-200 bg-blue-50 text-slate-700"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                  (!selectedTimelineItem || nodeRelation.matchedIds.size === 0) && "cursor-not-allowed opacity-60",
                )}
              >
                <span>当前节点</span>
                <span className="font-mono text-slate-500">{nodeRelation.matchedIds.size}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScopeModeState("all");
                  setScopeAnchorId(selectedTimelineItemId);
                  setSelectedKind("all");
                  setSelectedSegmentId(null);
                }}
                className={cx(
                  "flex h-8 items-center gap-2 rounded-full border px-3 text-left text-[11px] font-bold transition",
                  scopeMode === "all" && effectiveSelectedKind === "all" ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50",
                )}
              >
                <span className="text-slate-700">全部片段</span>
                <span className="font-mono text-slate-500">{analysis.segments.length}</span>
                <span className="font-mono text-slate-400">{analysis.totalTokenEstimate.toLocaleString("zh-CN")} tok</span>
              </button>
              {sourceRows.map((bucket) => (
                <button
                  key={bucket.id}
                  type="button"
                  onClick={() => {
                    setScopeModeState("all");
                    setScopeAnchorId(selectedTimelineItemId);
                    setSelectedKind(bucket.id);
                    setSelectedSegmentId(null);
                  }}
                  className={cx(
                    "flex h-8 min-w-0 items-center gap-2 rounded-full border px-3 text-left transition",
                    scopeMode === "all" && effectiveSelectedKind === bucket.id ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50",
                  )}
                >
                  <span className={cx("h-2 w-2 shrink-0 rounded-full", bucket.dotClass)} />
                  <span className="max-w-[96px] truncate text-[11px] font-bold text-slate-700">{bucket.label}</span>
                  <span className="font-mono text-[10px] text-slate-500">{(bucket.ratio * 100).toFixed(0)}%</span>
                  <span className="font-mono text-[10px] text-slate-400">{bucket.tokenEstimate.toLocaleString("zh-CN")} tok</span>
                </button>
              ))}
            </div>

            {selectedTimelineItem ? (
              <div className="mt-3 rounded-lg border border-blue-100 bg-white px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-black text-slate-700">当前 Trace 节点</span>
                      <span className={cx(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold",
                        nodeRelation.mode === "exact"
                          ? "bg-emerald-50 text-emerald-700"
                          : nodeRelation.mode === "round"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-500",
                      )}>
                        {nodeRelation.mode === "exact" ? "直接匹配" : nodeRelation.mode === "round" ? "同轮回退" : "未命中"}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">Round {selectedTimelineItem.round || "-"}</span>
                    </div>
                    <div className="mt-1 truncate text-[11px] font-bold text-slate-800">
                      {selectedTimelineItem.toolName || selectedTimelineItem.title}
                    </div>
                    <div className="mt-1 text-[10px] leading-4 text-slate-500">
                      {nodeRelation.detail}
                    </div>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2 text-right">
                    <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                      <div className="font-mono text-[12px] font-black text-slate-800">{nodeRelation.matchedIds.size}</div>
                      <div className="text-[9px] font-bold text-slate-400">片段</div>
                    </div>
                    <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                      <div className="font-mono text-[12px] font-black text-slate-800">{nodeRelation.tokenEstimate.toLocaleString("zh-CN")}</div>
                      <div className="text-[9px] font-bold text-slate-400">tokens</div>
                    </div>
                  </div>
                </div>
                {nodeRelation.sourceLabels.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {nodeRelation.sourceLabels.map((label) => (
                      <span key={label} className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(226,232,240,1)]">
                <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="w-14 px-3 py-2 font-bold">轮次</th>
                  <th className="w-24 px-3 py-2 font-bold">来源</th>
                  <th className="px-3 py-2 font-bold">摘要</th>
                  <th className="w-20 px-3 py-2 text-right font-bold">tokens</th>
                  <th className="w-24 px-3 py-2 font-bold">风险</th>
                  <th className="w-24 px-3 py-2 font-bold">证据</th>
                  <th className="w-20 px-3 py-2 font-bold">建议</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleSegmentRows.map(({ segment, linked, traceLink }) => (
                  <PromptSegmentRow
                    key={segment.id}
                    segment={segment}
                    linked={linked}
                    active={selectedSegment?.id === segment.id}
                    traceLink={traceLink}
                    onSelect={() => handleSelectSegment(segment.id)}
                  />
                ))}
                {visibleSegments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[12px] text-slate-500">
                      暂无 Prompt Ledger 片段。新的请求会自动记录真实发送上下文。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </main>

        <aside className="flex h-[340px] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-600">上下文诊断</div>
                <div className="mt-1 text-[10px] text-slate-400">质量 / 相关性 / 压缩价值 / 证据原文</div>
              </div>
              {selectedSegment ? (
                <div className="flex shrink-0 items-center gap-2">
                  <CopyButton label="复制原文" value={selectedSegment.text || selectedSegment.sample} />
                  <CopyButton label="复制账本摘要" value={payloadPreview} secondary />
                </div>
              ) : null}
            </div>
          </div>

          {selectedSegment ? (
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px]">
              <div className="flex min-h-0 flex-col overflow-hidden border-r border-slate-100">
                <div className="shrink-0 border-b border-slate-100 p-3">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">质量分</div>
                      <div className="mt-1 font-mono text-lg font-black text-slate-800">{selectedDiagnosis.qualityScore}</div>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">相关性</div>
                      <div className="mt-2 text-[11px] font-bold text-slate-800">{selectedDiagnosis.relevanceLabel}</div>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 px-2 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">压缩性</div>
                      <div className="mt-2 text-[11px] font-bold text-slate-800">{selectedDiagnosis.compressionLabel}</div>
                    </div>
                    <div className={cx("rounded border px-2 py-2", tonePanelClass(selectedDiagnosis.actionTone))}>
                      <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">动作</div>
                      <div className="mt-2 text-[11px] font-bold">{selectedDiagnosis.actionLabel}</div>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-[12px] font-bold text-slate-800">{selectedSegment.label}</div>
                        {selectedTraceLink ? (
                          <span
                            className={cx(
                              "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold",
                              traceLinkPillClass(selectedTraceLink.tone),
                            )}
                            title={selectedTraceLink.detail}
                          >
                            {selectedTraceLink.label}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">{segmentKindLabel(selectedSegment)} · {selectedSegment.tokenEstimate.toLocaleString("zh-CN")} tokens</div>
                    </div>
                  </div>
                  {selectedTraceLink ? (
                    <div className="mb-3 rounded border border-slate-100 bg-white px-2 py-1.5 text-[11px] leading-5 text-slate-600">
                      {selectedTraceLink.detail}
                    </div>
                  ) : null}
                  <div className="mb-3 space-y-1.5">
                    {selectedDiagnosis.reasons.map((reason) => (
                      <div key={reason} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-[11px] leading-5 text-slate-700">
                        {reason}
                      </div>
                    ))}
                  </div>
                  <CodeBlock text={selectedSegment.text || selectedSegment.sample} maxHeight={110} />
                </div>
              </div>

              <div className="min-h-0 space-y-2 overflow-y-auto bg-slate-50 p-3">
                <div className="rounded border border-emerald-200 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-black uppercase tracking-widest text-emerald-700">优化建议</div>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      {compressionTargetCount > 0 ? `可处理 ${compressionTargetCount} 段` : "保留"} · {scorePromptSegment(selectedSegment)} 分
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-700">
                    {selectedSegment.optimizationHint || inferReadableOptimization(selectedSegment)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => nodeJumpTarget && onJumpToNode(nodeJumpTarget)}
                    disabled={!nodeJumpTarget}
                    className="rounded border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    跳到节点
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleGenerateSummary(selectedSegment)}
                    className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                  >
                    生成摘要
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddOptimization(selectedSegment)}
                    className="col-span-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                  >
                    加入优化建议
                  </button>
                </div>
                {generatedSummary ? (
                  <div className="rounded border border-slate-200 bg-white p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">已生成摘要</div>
                      <CopyButton label="复制摘要" value={generatedSummary} secondary />
                    </div>
                    <pre className="mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap text-[10px] leading-4 text-slate-600">{generatedSummary}</pre>
                  </div>
                ) : null}
                {optimizationActions.length > 0 ? (
                  <div className="rounded border border-blue-200 bg-white p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">优化方案</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">按优先级排序，可直接复制给下一轮输入</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={handleAddTopOptimizationTargets}
                          className="rounded px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50"
                        >
                          自动补全
                        </button>
                        <CopyButton label="复制方案" value={optimizationPlan} secondary />
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{optimizationActions.length} 条</span>
                      </div>
                    </div>
                    <div className="mt-2 space-y-2">
                      {sortedOptimizationActions.map((action) => (
                        <div key={action.id} className="rounded border border-slate-100 bg-slate-50 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-[11px] font-bold text-slate-800">{action.actionLabel} · {action.source} · {action.label}</div>
                              <div className="mt-0.5 text-[10px] text-slate-400">
                                第 {action.round ?? "-"} 轮 · {action.tokenEstimate.toLocaleString("zh-CN")} tokens{action.nodeId ? " · 可跳节点" : ""}
                              </div>
                            </div>
                            <span className="shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-blue-700">{action.score} 分</span>
                          </div>
                          <div className="mt-1 text-[10px] leading-4 text-slate-600">{action.recommendation}</div>
                          <div className="mt-1 truncate text-[10px] text-slate-400">{action.summary}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded border border-dashed border-blue-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">优化方案</div>
                        <div className="mt-1 text-[11px] leading-5 text-slate-500">
                          先把高风险片段加入清单，再复制成下一轮可执行的 prompt 优化计划。
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddTopOptimizationTargets}
                        disabled={visibleSegments.length === 0}
                        className="shrink-0 rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        自动生成
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 text-[12px] text-slate-500">选择一段 Prompt 片段查看原文。</div>
          )}
        </aside>
      </div>
    </div>
  );
}

export function SessionAnalysisPage({
  session,
  partialMessage,
  onBack,
}: {
  session: SessionView | undefined;
  partialMessage: string;
  onBack: () => void;
}) {
  const model = useMemo(
    () => buildActivityRailModel(session, session?.permissionRequests ?? [], ""),
    [session],
  );
  const liveDraftPreview = useMemo(() => truncate(partialMessage.trim(), 120), [partialMessage]);
  const liveDraftChars = partialMessage.length;

  const baseGroups = useMemo<TraceGroup[]>(() => {
    const roundGroups = buildRoundTraceGroups(model.timeline, session?.status);
    if (roundGroups.length > 0) return roundGroups;

    return model.executionSteps
      .map((step, index) => ({
        id: step.id,
        indexLabel: String(index + 1),
        title: step.title,
        detail: step.detail,
        status: step.status,
        metrics: step.metrics,
        sourceTimelineId: step.sourceTimelineId,
        items: model.timeline.filter((item) => step.timelineIds.includes(item.id)),
        isInferred: true,
      }))
      .filter((group) => group.items.length > 0);
  }, [model.executionSteps, model.timeline, session?.status]);
  const diagnosticReport = useMemo(
    () => buildTraceDiagnosticReport(model, baseGroups, liveDraftChars),
    [baseGroups, liveDraftChars, model],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTabKey>("node");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[] | null>(null);

  const normalizedQuery = useMemo(() => normalizeSearchText(searchQuery), [searchQuery]);

  const visibleGroups = useMemo(() => {
    if (!normalizedQuery) return baseGroups;

    return baseGroups
      .map((group) => {
        const groupMatches = normalizeSearchText(`${group.title} ${group.detail}`).includes(normalizedQuery);
        const visibleItems = groupMatches
          ? group.items
          : group.items.filter((item) => matchesSearch(item, normalizedQuery));

        if (groupMatches || visibleItems.length > 0) {
          return {
            ...group,
            items: visibleItems,
          };
        }

        return null;
      })
      .filter((group): group is TraceGroup => Boolean(group));
  }, [baseGroups, normalizedQuery]);

  const allVisibleTimeline = useMemo(
    () => visibleGroups.flatMap((group) => group.items),
    [visibleGroups],
  );

  const effectiveSelectedGroupId =
    selectedGroupId === "all" || visibleGroups.some((group) => group.id === selectedGroupId)
      ? selectedGroupId
      : visibleGroups[0]?.id ?? "all";

  const selectedGroup =
    effectiveSelectedGroupId === "all"
      ? null
      : visibleGroups.find((group) => group.id === effectiveSelectedGroupId) ?? null;

  const candidateTimeline = selectedGroup?.items.length
    ? selectedGroup.items
    : allVisibleTimeline.length > 0
      ? allVisibleTimeline
      : model.timeline;

  const effectiveSelectedTimelineId =
    selectedTimelineId && candidateTimeline.some((item) => item.id === selectedTimelineId)
      ? selectedTimelineId
      : candidateTimeline[0]?.id ?? model.timeline[0]?.id ?? null;

  const selectedItem =
    (effectiveSelectedTimelineId
      ? candidateTimeline.find((item) => item.id === effectiveSelectedTimelineId) ??
        model.timeline.find((item) => item.id === effectiveSelectedTimelineId)
      : null) ??
    candidateTimeline[0] ??
    model.timeline[0] ??
    null;

  const effectiveCollapsedGroupIds =
    collapsedGroupIds === null
      ? baseGroups.slice(1).map((group) => group.id)
      : collapsedGroupIds.filter((id) => baseGroups.some((group) => group.id === id));
  const collapsedGroupKey = effectiveCollapsedGroupIds.join("|");

  useEffect(() => {
    const root = document.querySelector("[data-trace-workbench-root]") as HTMLElement | null;
    if (!root) return;

    const resetViewport = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      (document.scrollingElement as HTMLElement | null)?.scrollTo({ top: 0, left: 0, behavior: "auto" });

      let ancestor = root.parentElement;
      while (ancestor) {
        if (ancestor.scrollHeight > ancestor.clientHeight + 8) {
          ancestor.scrollTop = 0;
        }
        ancestor = ancestor.parentElement;
      }
    };

    resetViewport();
    const frame = window.requestAnimationFrame(resetViewport);
    const timer = window.setTimeout(resetViewport, 180);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.electron?.debugSaveTraceSnapshot !== "function" ||
      !isTraceSnapshotDebugEnabled()
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const root = document.querySelector("[data-trace-workbench-root]") as HTMLElement | null;
      if (!root) return;

      const pick = (selector: string) => document.querySelector(selector) as HTMLElement | null;
      const rectOf = (element: HTMLElement | null) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          top: Math.round(rect.top),
        };
      };

      const ancestorChain = (() => {
        const results: Array<{
          tag: string;
          className: string | null;
          scrollTop: number;
          scrollHeight: number;
          clientHeight: number;
          overflowY: string;
        }> = [];

        let current = root.parentElement;
        while (current && results.length < 10) {
          const style = window.getComputedStyle(current);
          results.push({
            tag: current.tagName.toLowerCase(),
            className: current.className || null,
            scrollTop: Math.round(current.scrollTop),
            scrollHeight: Math.round(current.scrollHeight),
            clientHeight: Math.round(current.clientHeight),
            overflowY: style.overflowY,
          });
          current = current.parentElement;
        }

        return results;
      })();

      void window.electron.debugSaveTraceSnapshot({
        capturedAt: Date.now(),
        location: window.location.href,
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        },
        scroll: {
          windowScrollX: Math.round(window.scrollX),
          windowScrollY: Math.round(window.scrollY),
          documentScrollTop: Math.round(document.documentElement.scrollTop),
          bodyScrollTop: Math.round(document.body.scrollTop),
          scrollingElementScrollTop: Math.round(document.scrollingElement?.scrollTop ?? 0),
        },
        classes: {
          root: root.className,
          body: pick("[data-trace-workbench-body]")?.className ?? null,
          nav: pick("[data-trace-workbench-nav]")?.className ?? null,
          main: pick("[data-trace-workbench-main]")?.className ?? null,
          inspector: pick("[data-trace-workbench-inspector]")?.className ?? null,
          table: pick("[data-trace-workbench-table]")?.className ?? null,
        },
        rects: {
          root: rectOf(root),
          body: rectOf(pick("[data-trace-workbench-body]")),
          nav: rectOf(pick("[data-trace-workbench-nav]")),
          main: rectOf(pick("[data-trace-workbench-main]")),
          inspector: rectOf(pick("[data-trace-workbench-inspector]")),
          table: rectOf(pick("[data-trace-workbench-table]")),
        },
        ancestors: ancestorChain,
        html: {
          rootOuterHTML: root.outerHTML.slice(0, 18000),
        },
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [candidateTimeline.length, collapsedGroupKey, effectiveSelectedGroupId, selectedItem?.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onBack();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  const inputSections = selectedItem?.detailSections.filter(isInputSection) ?? [];
  const outputSections = selectedItem?.detailSections.filter(isOutputSection) ?? [];
  const rawSections = selectedItem?.detailSections.filter((section) => Boolean(section.raw) || section.rows.length > 0) ?? [];
  const metadataRows = selectedItem ? collectMetadataRows(selectedItem) : [];
  const metadataPreview = selectedItem ? buildMetadataPreview(selectedItem, metadataRows) : "";

  const topMetrics = [
    { label: "总耗时", value: model.summary.durationLabel, detail: "Trace 端到端耗时" },
    { label: "模型", value: model.summary.modelLabel, detail: "本轮主模型" },
    { label: "输入规模", value: model.summary.inputLabel, detail: "输入 token / 字符" },
    { label: "输出规模", value: model.summary.outputLabel, detail: "输出 token / 字符" },
  ];

  const statusChips = [
    { label: `工具 ${model.filterCounts.tool}`, tone: "info" as const },
    { label: `结果 ${model.filterCounts.result}`, tone: "success" as const },
    { label: `关注 ${model.filterCounts.attention}`, tone: model.filterCounts.attention > 0 ? ("warning" as const) : ("neutral" as const) },
  ];

  const relatedSteps = selectedItem
    ? baseGroups.filter((group) => group.items.some((item) => item.id === selectedItem.id))
    : [];

  const selectedNodeMeta = selectedItem ? getNodeKindMeta(selectedItem) : null;
  const selectedRawText =
    rawSections[0] !== undefined ? rawSectionText(rawSections[0]) : metadataPreview;

  const currentScopeLabel =
    selectedGroup === null
      ? normalizedQuery
        ? `搜索命中 ${candidateTimeline.length} 个节点`
        : `当前查看完整 Trace`
      : `${selectedGroup.title} · ${selectedGroup.items.length} 个节点`;

  const currentScopeDetail =
    selectedGroup === null
      ? "按节点顺序浏览整条链路，适合先确定问题发生在哪一段。"
      : truncate(selectedGroup.detail, 140);

  return (
    <div
      data-trace-workbench-root
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f1f5f9] text-slate-800"
    >
      <header
        data-trace-workbench-topbar
        className="shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-md"
      >
        <div className="flex h-12 items-center justify-between px-6 text-[11px] font-semibold uppercase tracking-wider">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              title="返回会话 (Esc)"
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold normal-case tracking-normal text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-primary"
            >
              <span aria-hidden="true">←</span>
              <span>返回会话</span>
            </button>
            <nav className="flex min-w-0 items-center gap-1.5 text-slate-400">
              <span>Traces</span>
              <span className="text-slate-300">{">"}</span>
              <span className="truncate text-primary font-bold">{session?.id.slice(0, 10) ?? "empty"}</span>
            </nav>
            <div className="h-4 w-px bg-slate-200" />
            <span className={cx("rounded px-2 py-0.5 text-[9px] font-bold", tonePillClass(model.summary.statusTone))}>
              {model.summary.statusLabel}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索节点 / 工具 / 原文"
                className="w-56 rounded-md border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <CopyButton label="复制 Session ID" value={session?.id ?? ""} secondary />
            <button
              type="button"
              onClick={onBack}
              className="rounded bg-primary px-3 py-1 text-[10px] font-bold text-white transition hover:opacity-90"
            >
              返回会话
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-2 shadow-sm">
          <div className="flex flex-wrap gap-6">
            {topMetrics.map((metric) => (
              <SummaryMetric
                key={metric.label}
                label={metric.label}
                value={metric.value}
                detail={metric.detail}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {statusChips.map((chip) => (
              <div
                key={chip.label}
                className="flex items-center gap-1.5 rounded border border-slate-100 bg-slate-50 px-2 py-1"
              >
                <div className={cx("h-2 w-2 rounded-full", toneDotClass(chip.tone))} />
                <span className="text-[10px] font-bold text-slate-600">{chip.label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div
        data-trace-workbench-body
        className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3"
      >
        <section
          data-trace-workbench-nav
          className="flex min-h-0 w-[32%] min-w-[300px] max-w-[420px] flex-col gap-3"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Trace Flow</h2>
                <p className="mt-1 text-[11px] text-slate-500">{currentScopeLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCollapsedGroupIds(baseGroups.map((group) => group.id))}
                  className="text-[10px] font-bold text-slate-500 transition hover:text-primary"
                >
                  Collapse All
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsedGroupIds([])}
                  className="text-[10px] font-bold text-primary transition hover:underline"
                >
                  Expand All
                </button>
              </div>
            </div>

            <div
              data-trace-workbench-table
              className="min-h-0 flex-1 overflow-y-auto p-4"
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupId("all");
                  setSelectedTimelineId(allVisibleTimeline[0]?.id ?? model.timeline[0]?.id ?? null);
                }}
                className={cx(
                  "mb-4 w-full rounded-lg border px-3 py-3 text-left transition",
                  selectedGroup === null
                    ? "border-blue-200 bg-blue-50/70"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100/80",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-bold text-slate-800">查看整条 Trace</div>
                    <div className="mt-1 text-[11px] leading-5 text-slate-500">{currentScopeDetail}</div>
                  </div>
                  <div className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-500">
                    {allVisibleTimeline.length} 节点
                  </div>
                </div>
              </button>

              <div className="space-y-0">
                {visibleGroups.map((group, index) => {
                  const collapsed = effectiveCollapsedGroupIds.includes(group.id);
                  const groupActive = effectiveSelectedGroupId === group.id;
                  const leadItem = group.items[0];
                  const leadTone = leadItem?.tone ?? "neutral";

                  return (
                    <div key={group.id} className="relative pb-4">
                      {index < visibleGroups.length - 1 ? (
                        <div className="absolute bottom-0 left-[9px] top-5 w-px bg-slate-300" />
                      ) : null}

                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setCollapsedGroupIds((previous) =>
                              (() => {
                                const previousList = previous ?? [];
                                return previousList.includes(group.id)
                                  ? previousList.filter((value) => value !== group.id)
                                  : [...previousList, group.id];
                              })(),
                            );
                          }}
                          className={cx(
                            "z-10 flex h-5 w-5 items-center justify-center rounded text-[10px] font-black text-white shadow-sm",
                            toneBarClass(leadTone),
                          )}
                        >
                          {collapsed ? "+" : "-"}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedGroupId(group.id);
                                setSelectedTimelineId(group.items[0]?.id ?? group.sourceTimelineId);
                                setCollapsedGroupIds((previous) =>
                                  (() => {
                                    const previousList = previous ?? [];
                                    return previousList.includes(group.id)
                                      ? previousList.filter((value) => value !== group.id)
                                      : previousList;
                                  })(),
                                );
                              }}
                              className="min-w-0 text-left"
                            >
                              <div className={cx("text-[12px] font-bold transition", groupActive ? "text-primary" : "text-slate-700 hover:text-primary")}>
                                {group.title}
                              </div>
                            </button>

                            <div className="flex shrink-0 gap-2 text-[10px] font-mono text-slate-500">
                              <span>{formatDurationMs(group.metrics.durationMs)}</span>
                              <span>{formatMetricAmount(group.metrics.outputChars, group.metrics.outputTokens)}</span>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                              Round {group.indexLabel}
                            </span>
                            <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-bold", getStatusBadgeClass(group.status))}>
                              {STATUS_LABELS[group.status]}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                              {group.items.length} 节点
                            </span>
                            {group.isInferred ? (
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                                阶段推断
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-2 text-[11px] leading-5 text-slate-500">{truncate(group.detail, 120)}</div>

                          {!collapsed ? (
                            <div className="mt-2 space-y-1.5 border-l border-slate-200 pl-3">
                              {group.items.map((item) => (
                                <TreeItem
                                  key={item.id}
                                  item={item}
                                  active={selectedItem?.id === item.id}
                                  onSelect={() => {
                                    setSelectedGroupId(group.id);
                                    setSelectedTimelineId(item.id);
                                  }}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {visibleGroups.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[12px] text-slate-500">
                    当前搜索没有命中节点，换个关键词再试。
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section
          data-trace-workbench-main
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setInspectorTab("node")}
                  className={cx(
                    "border-b-2 pb-1 text-[11px] font-bold transition",
                    inspectorTab === "node"
                      ? "border-primary text-slate-800"
                      : "border-transparent text-slate-400 hover:text-slate-600",
                  )}
                >
                  Node Inspector
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("prompt")}
                  className={cx(
                    "border-b-2 pb-1 text-[11px] font-bold transition",
                    inspectorTab === "prompt"
                      ? "border-primary text-slate-800"
                      : "border-transparent text-slate-400 hover:text-slate-600",
                  )}
                >
                  Prompt Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("raw")}
                  className={cx(
                    "border-b-2 pb-1 text-[11px] font-bold transition",
                    inspectorTab === "raw"
                      ? "border-primary text-slate-800"
                      : "border-transparent text-slate-400 hover:text-slate-600",
                  )}
                >
                  Raw Log
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("analytics")}
                  className={cx(
                    "border-b-2 pb-1 text-[11px] font-bold transition",
                    inspectorTab === "analytics"
                      ? "border-primary text-slate-800"
                      : "border-transparent text-slate-400 hover:text-slate-600",
                  )}
                >
                  Analytics
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase text-slate-400">Status:</span>
                <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(selectedItem?.tone ?? model.summary.statusTone))} />
                <span className="text-[10px] font-bold text-slate-700">
                  {selectedItem?.statusLabel || model.summary.statusLabel}
                </span>
              </div>
            </div>

            <div data-trace-workbench-inspector className="min-h-0 flex-1 overflow-y-auto p-4">
              {selectedItem === null && inspectorTab !== "prompt" ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                  当前没有可查看的节点。
                </div>
              ) : inspectorTab === "prompt" ? (
                <PromptLedgerPanel
                  analysis={model.promptAnalysis}
                  selectedTimelineItem={selectedItem}
                  onJumpToNode={(timelineId) => {
                    setSelectedTimelineId(timelineId);
                    const matchedGroup = baseGroups.find((group) =>
                      group.items.some((item) => item.id === timelineId),
                    );
                    setSelectedGroupId(matchedGroup?.id ?? "all");
                    setInspectorTab("node");
                  }}
                />
              ) : inspectorTab === "node" ? (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="truncate text-sm font-black text-slate-800">
                          {selectedItem.toolName || selectedItem.title}
                        </h3>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                          {selectedNodeMeta?.label}
                        </span>
                        {selectedItem.provenance ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 uppercase">
                            {selectedItem.provenance}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-slate-400">{truncate(selectedItem.detail, 160)}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-mono font-bold text-slate-700">
                        {formatDurationMs(selectedItem.metrics.durationMs)}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400">
                        {formatMetricAmount(selectedItem.metrics.outputChars, selectedItem.metrics.outputTokens)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {inputSections.length > 0 ? (
                      <SectionBlock
                        title="Input Payload"
                        textModeLabel="Text"
                        altModeLabel="JSON"
                        body={sectionPrimaryText(inputSections[0]!)}
                      />
                    ) : null}

                    {outputSections.length > 0 ? (
                      <SectionBlock
                        title="Output Result"
                        textModeLabel="Preview"
                        altModeLabel="JSON"
                        body={sectionPrimaryText(outputSections[0]!)}
                      />
                    ) : null}

                    {inputSections.length === 0 && outputSections.length === 0 ? (
                      <SectionBlock
                        title="Node Summary"
                        textModeLabel="Preview"
                        altModeLabel="JSON"
                        body={selectedItem.preview || selectedItem.detail}
                      />
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Technical Context</span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {metadataRows.slice(0, 8).map((row) => (
                        <div
                          key={`${row.label}-${row.value}`}
                          className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-2"
                        >
                          <span className="pr-3 text-[10px] text-slate-400">{row.label}</span>
                          <span className="truncate text-right text-[10px] font-bold font-mono text-slate-700">
                            {truncate(row.value, 42)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Metadata Object</span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                    <CodeBlock text={selectedRawText} maxHeight={280} />
                  </div>
                </div>
              ) : inspectorTab === "raw" ? (
                <div className="space-y-4">
                  {rawSections.length > 0 ? (
                    rawSections.map((section) => (
                      <div key={section.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[12px] font-semibold text-slate-800">{section.title}</div>
                            {section.summary ? (
                              <div className="mt-1 text-[11px] text-slate-500">{section.summary}</div>
                            ) : null}
                          </div>
                          <CopyButton label="复制原文" value={rawSectionText(section)} />
                        </div>
                        <CodeBlock text={rawSectionText(section)} maxHeight={320} />
                      </div>
                    ))
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[12px] font-semibold text-slate-800">Raw Metadata</div>
                      <CodeBlock text={metadataPreview} maxHeight={360} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <section className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-widest text-blue-700">诊断摘要</div>
                        <div className="mt-1 text-[12px] font-bold text-slate-800">
                          {model.summary.statusLabel} · {baseGroups.length} 轮 · {model.timeline.length} 节点 · {model.promptAnalysis.totalTokenEstimate.toLocaleString("zh-CN")} tok
                        </div>
                        <div className="mt-1 text-[11px] leading-5 text-slate-600">
                          把执行过程、Prompt 构成、证据链接和优化建议汇总成可复制报告，方便睡醒后直接复盘。
                        </div>
                      </div>
                      <CopyButton label="复制诊断报告" value={diagnosticReport} />
                    </div>
                  </section>

                  <div className="grid gap-2 md:grid-cols-4">
                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">Current Scope</div>
                      <div className="mt-1 text-[13px] font-bold text-slate-800">{currentScopeLabel}</div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-500">{currentScopeDetail}</div>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">Node Metrics</div>
                      <div className="mt-1 text-[13px] font-bold text-slate-800">
                        {formatDurationMs(selectedItem.metrics.durationMs)}
                      </div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-500">
                        输入 {formatMetricAmount(selectedItem.metrics.inputChars, selectedItem.metrics.inputTokens)} / 输出 {formatMetricAmount(selectedItem.metrics.outputChars, selectedItem.metrics.outputTokens)}
                      </div>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">Latest Prompt</div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-700">
                        {truncate(model.contextSnapshot.latestPrompt || "当前会话没有显式主问题。", 120)}
                      </div>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">Live Draft</div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-700">
                        {liveDraftPreview || "当前没有流式草稿。"}
                      </div>
                      {liveDraftChars > 0 ? (
                        <div className="mt-1 font-mono text-[10px] text-slate-400">{liveDraftChars.toLocaleString("zh-CN")} 字符</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Context Distribution</span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {model.contextDistribution.buckets.slice(0, 6).map((bucket) => (
                        <button
                          key={bucket.id}
                          type="button"
                          onClick={() => {
                            if (bucket.sourceNodeIds[0]) {
                              setSelectedTimelineId(bucket.sourceNodeIds[0]);
                              const matchedGroup = baseGroups.find((group) =>
                                group.items.some((item) => item.id === bucket.sourceNodeIds[0]),
                              );
                              setSelectedGroupId(matchedGroup?.id ?? "all");
                              setInspectorTab("node");
                            }
                          }}
                          className="rounded border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[12px] font-semibold text-slate-800">{bucket.label}</div>
                            <span className={cx("h-2 w-2 rounded-full", toneDotClass(bucket.tone))} />
                          </div>
                          <div className="mt-2 text-[11px] text-slate-500">
                            {(bucket.ratio * 100).toFixed(1)}% · {bucket.chars.toLocaleString("zh-CN")} 字符 · {bucket.messageCount} 条
                          </div>
                          <div className="mt-2 text-[11px] leading-5 text-slate-600">{truncate(bucket.sample, 90)}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Analysis Cards</span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                    <div className="space-y-2">
                      {model.analysisCards.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => {
                            if (card.supportingTimelineId) {
                              setSelectedTimelineId(card.supportingTimelineId);
                              const matchedGroup = baseGroups.find((group) =>
                                group.items.some((item) => item.id === card.supportingTimelineId),
                              );
                              setSelectedGroupId(matchedGroup?.id ?? "all");
                              setInspectorTab("node");
                            }
                          }}
                          className="w-full rounded border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className={cx("h-2 w-2 rounded-full", toneDotClass(card.tone))} />
                            <span className="text-[12px] font-semibold text-slate-800">{card.title}</span>
                          </div>
                          <div className="mt-2 text-[11px] leading-5 text-slate-600">{card.detail}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Related Steps</span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                    <div className="space-y-2">
                      {relatedSteps.length > 0 ? (
                        relatedSteps.map((step) => (
                          <button
                            key={step.id}
                            type="button"
                            onClick={() => {
                              setSelectedGroupId(step.id);
                              setSelectedTimelineId(step.items[0]?.id ?? step.sourceTimelineId);
                              setInspectorTab("node");
                            }}
                            className="flex w-full items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50/30"
                          >
                            <div>
                              <div className="text-[12px] font-semibold text-slate-800">{step.title}</div>
                              <div className="mt-1 text-[11px] text-slate-500">{truncate(step.detail, 90)}</div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{formatDurationMs(step.metrics.durationMs)}</span>
                          </button>
                        ))
                      ) : (
                        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-500">
                          当前节点没有映射到额外步骤，可以继续从左侧 Trace Flow 回看上下游节点。
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-2.5">
              <div className="flex gap-1">
                <CopyButton label="Raw JSON" value={metadataPreview} secondary />
                <CopyButton label="Debug Text" value={selectedRawText} secondary />
              </div>
              <CopyButton label="复制 Metadata" value={metadataPreview} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
