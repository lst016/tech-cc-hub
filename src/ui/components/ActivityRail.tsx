import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  buildActivityRailModel,
  type ActivityAnalysisCard,
  type ActivityDetailSection,
  type ActivityExecutionMetrics,
  type ActivityRailTone,
  type ActivityTaskStep,
  type ActivityTimelineItem,
  type ActivityToolProvenance,
  type ContextDistributionBucket,
} from "../../shared/activity-rail-model";
import { useAppStore } from "../store/useAppStore";
import { estimatePromptLedgerTokens, type PromptLedgerSourceKind } from "../../shared/prompt-ledger";
import { buildContextUsageBreakdown, type ContextUsageBreakdownCategory } from "../utils/context-usage-breakdown";
import { buildSegmentedContextUsageCells, type ContextUsageCellSegment } from "../utils/context-usage-cells";
import { AionWorkspacePreviewPane } from "./AionWorkspacePreviewPane";
import type { SessionView } from "../store/useAppStore";

const NODE_KIND_LABELS: Record<ActivityTimelineItem["nodeKind"], string> = {
  context: "上下文",
  plan: "AI 计划",
  assistant_output: "AI 输出",
  tool_input: "工具调用",
  retrieval: "检索",
  file_read: "读文件",
  file_write: "写文件",
  terminal: "终端",
  browser: "浏览器",
  memory: "Memory",
  mcp: "MCP",
  handoff: "子 Agent",
  evaluation: "校验",
  error: "错误",
  lifecycle: "生命周期",
  permission: "人工确认",
  hook: "Hook",
  omitted: "已省略",
  agent_progress: "Agent 进度",
};

const STAGE_ORDER = ["inspect", "implement", "verify", "deliver"] as const;
const STAGE_LABELS: Record<string, string> = {
  inspect: "检查与理解",
  implement: "实施与修改",
  verify: "验证与确认",
  deliver: "整理与输出",
  plan: "计划",
  other: "其他",
};

const PROMPT_SOURCE_KIND_LABELS: Record<string, string> = {
  system: "系统",
  project: "项目",
  skill: "Skill",
  workflow: "Workflow",
  current: "当前输入",
  attachment: "附件",
  memory: "Memory",
  history: "历史消息",
  tool: "工具",
  other: "其他",
};

const PROVENANCE_LABELS: Record<ActivityToolProvenance, string> = {
  local: "本地",
  mcp: "MCP",
  sub_agent: "子 Agent",
  a2a: "A2A",
  transfer_agent: "交接 Agent",
  unknown: "未归类",
};

type ActivityRailTab = "trace" | "usage" | "preview";

function toneClasses(tone: ActivityRailTone) {
  switch (tone) {
    case "info":
      return "border-info/20 bg-info-light/50 text-info";
    case "success":
      return "border-success/20 bg-success-light/50 text-success";
    case "warning":
      return "border-accent/20 bg-accent-subtle text-accent";
    case "error":
      return "border-error/20 bg-error-light text-error";
    default:
      return "border-ink-900/10 bg-white/70 text-ink-700";
  }
}

function toneAccentClasses(tone: ActivityRailTone) {
  switch (tone) {
    case "info":
      return "bg-info";
    case "success":
      return "bg-success";
    case "warning":
      return "bg-accent";
    case "error":
      return "bg-error";
    default:
      return "bg-ink-300";
  }
}

function getNodeKindLabel(item: ActivityTimelineItem) {
  if (item.nodeKind === "terminal" && item.nodeSubtype === "validation") {
    return "终端校验";
  }
  return NODE_KIND_LABELS[item.nodeKind];
}

function TimelineItemRow({
  item,
  isSelected,
  onSelect,
}: {
  item: ActivityTimelineItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const kindLabel = getNodeKindLabel(item);
  return (
    <button
      type="button"
      data-timeline-id={item.id}
      className={`w-full text-left rounded-2xl border p-3 transition ${
        isSelected
          ? "border-info/30 bg-info-light/40"
          : "border-black/5 bg-white/70 hover:border-black/10"
      }`}
      onClick={() => onSelect(item.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${toneAccentClasses(item.tone)}`} />
            <span className="text-[13px] font-semibold text-ink-900 truncate">{item.title}</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-ink-500 line-clamp-2">{item.preview}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {item.statusLabel && (
            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${toneClasses(item.tone)}`}>
              {item.statusLabel}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-ink-400">
        <span>{kindLabel}</span>
        {item.toolName && <span>· {item.toolName}</span>}
        <span>· 第 {item.round} 轮</span>
        {item.parentTaskId && (
          <span className="truncate">· 子任务 {item.parentTaskId.slice(0, 8)}</span>
        )}
      </div>
    </button>
  );
}

function renderTimelineWithStages(
  timeline: ActivityTimelineItem[],
  selectedId: string | null,
  onSelect: (id: string) => void,
) {
  const stageGroups: Array<{ stage: string; items: ActivityTimelineItem[] }> = [];
  let currentStage = "";
  let currentGroup: ActivityTimelineItem[] = [];

  for (const item of timeline) {
    const stage = item.stageKind;
    if (stage !== currentStage && currentGroup.length > 0) {
      stageGroups.push({ stage: currentStage, items: currentGroup });
      currentGroup = [];
    }
    currentStage = stage;
    currentGroup.push(item);
  }
  if (currentGroup.length > 0) {
    stageGroups.push({ stage: currentStage, items: currentGroup });
  }

  return stageGroups.map((group) => {
    const label = STAGE_LABELS[group.stage] ?? group.stage;
    const isMainStage = STAGE_ORDER.includes(group.stage as typeof STAGE_ORDER[number]);
    return (
      <div key={`stage-${group.stage}-${group.items[0]?.id}`}>
        <div className={`flex items-center gap-2 mb-2 ${isMainStage ? "" : "opacity-60"}`}>
          <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isMainStage ? "text-ink-600" : "text-ink-400"}`}>
            {label}
          </span>
          <span className="h-px flex-1 bg-black/5" />
          <span className="text-[10px] text-ink-400">{group.items.length}</span>
        </div>
        <div className="space-y-1.5">
          {group.items.map((item) => (
            <TimelineItemRow
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    );
  });
}
function summarizeAttachments(itemNames: string[]) {
  if (itemNames.length === 0) return "无附件";
  if (itemNames.length === 1) return itemNames[0];
  return `${itemNames.length} 个附件 · ${itemNames.slice(0, 2).join("、")}`;
}

function formatMetricAmount(chars: number, tokens?: number) {
  if (typeof tokens === "number") {
    return `${tokens.toLocaleString("zh-CN")} tok`;
  }
  return `${chars.toLocaleString("zh-CN")} 字符`;
}

function formatMetricStatus(metrics: ActivityExecutionMetrics) {
  if (metrics.failureCount > 0) return "失败";
  if (metrics.successCount > 0 && metrics.totalCount > 0) return "成功";
  if (metrics.totalCount > 0) return "进行中";
  return "无执行";
}

function formatTokenAmount(tokens: number) {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(tokens >= 10000 ? 1 : 2)}k`;
  return String(Math.max(0, Math.round(tokens)));
}

function formatUsagePercent(value: number) {
  return `${Math.max(0, Math.min(100, value * 100)).toFixed(1)}%`;
}

function bucketTokensByKind(model: ReturnType<typeof buildActivityRailModel>, kinds: string[]) {
  return model.promptAnalysis.buckets
    .filter((bucket) => kinds.includes(bucket.sourceKind))
    .reduce((sum, bucket) => sum + bucket.tokenEstimate, 0);
}

function buildUsageCells(segments: ContextUsageCellSegment[], windowTokens: number) {
  return buildSegmentedContextUsageCells(segments, windowTokens);
}

function promptSourceKinds(...kinds: PromptLedgerSourceKind[]): PromptLedgerSourceKind[] {
  return kinds;
}

function ContextUsagePanel({
  model,
  selectedModel,
  contextWindow,
  compressionThresholdPercent,
  partialMessage,
}: {
  model: ReturnType<typeof buildActivityRailModel>;
  selectedModel?: string;
  contextWindow?: number;
  compressionThresholdPercent?: number;
  partialMessage?: string;
}) {
  const [selectedBreakdownId, setSelectedBreakdownId] = useState<string | null>(null);
  const currentPrompt = useAppStore((state) => state.prompt);
  const deferredPrompt = useDeferredValue(currentPrompt);
  const deferredPartialMessage = useDeferredValue(partialMessage ?? "");
  const windowTokens = Math.max(1, contextWindow ?? 200_000);
  const thresholdPercent = typeof compressionThresholdPercent === "number"
    ? Math.max(1, Math.min(99, compressionThresholdPercent))
    : 85;
  const autoCompactTokens = Math.round(windowTokens * (1 - thresholdPercent / 100));
  const draftTokens = deferredPrompt.trim() ? estimatePromptLedgerTokens(deferredPrompt) : 0;
  const streamingTokens = deferredPartialMessage.trim() ? estimatePromptLedgerTokens(deferredPartialMessage) : 0;
  const toolPayloadTokens = bucketTokensByKind(model, ["tool"]);
  const uniqueToolNames = new Set(model.timeline.map((item) => item.toolName).filter(Boolean));
  const toolDefinitionTokens = uniqueToolNames.size > 0 ? Math.round(uniqueToolNames.size * 260) : 0;
  const categoryRows: Array<ContextUsageBreakdownCategory & {
    markerClass: string;
    cellClass: string;
    note?: string;
  }> = [
    {
      id: "system",
      label: "系统提示",
      tokens: bucketTokensByKind(model, ["system", "project", "workflow"]),
      sourceKinds: promptSourceKinds("system", "project", "workflow"),
      markerClass: "bg-slate-500",
      cellClass: "border-slate-400/30 bg-slate-500/70",
    },
    {
      id: "tool-definitions",
      label: "工具定义估算",
      tokens: toolDefinitionTokens,
      markerClass: "bg-cyan-500",
      cellClass: "border-cyan-400/30 bg-cyan-500/75",
      note: "按已出现工具种类估算",
      fallbackDetail: `按已出现的 ${uniqueToolNames.size} 种工具估算，每种约 260 tokens。`,
    },
    {
      id: "agent",
      label: "当前 Agent",
      tokens: 0,
      markerClass: "bg-indigo-500",
      cellClass: "border-indigo-400/30 bg-indigo-500/70",
    },
    {
      id: "memory",
      label: "Memory 文件",
      tokens: bucketTokensByKind(model, ["memory"]),
      sourceKinds: promptSourceKinds("memory"),
      markerClass: "bg-amber-500",
      cellClass: "border-amber-400/30 bg-amber-500/75",
    },
    {
      id: "skills",
      label: "Skills",
      tokens: bucketTokensByKind(model, ["skill"]),
      sourceKinds: promptSourceKinds("skill"),
      markerClass: "bg-emerald-500",
      cellClass: "border-emerald-400/30 bg-emerald-500/75",
    },
    {
      id: "tool-payload",
      label: "工具输入/输出",
      tokens: toolPayloadTokens,
      sourceKinds: promptSourceKinds("tool"),
      markerClass: "bg-orange-500",
      cellClass: "border-orange-400/30 bg-orange-500/75",
    },
    {
      id: "messages",
      label: "消息内容",
      tokens: bucketTokensByKind(model, ["history", "current", "attachment"]) + draftTokens + streamingTokens,
      sourceKinds: promptSourceKinds("history", "current", "attachment"),
      markerClass: "bg-blue-600",
      cellClass: "border-blue-500/30 bg-blue-600/75",
      fallbackDetail: "包含历史消息、当前输入、附件，以及当前输入框草稿/流式输出估算。",
    },
  ].filter((row) => row.tokens > 0 || row.label === "当前 Agent");
  const usedTokens = categoryRows.reduce((sum, row) => sum + (row.tokens ?? 0), 0);
  const usedRatio = Math.min(1, usedTokens / windowTokens);
  const freeTokens = Math.max(0, windowTokens - usedTokens - autoCompactTokens);
  const displayModel = selectedModel || model.contextSnapshot.model || model.promptAnalysis.ledgers.at(-1)?.model || "未选择模型";
  const selectedBreakdownCategory = categoryRows.find((row) => row.id === selectedBreakdownId) ?? null;
  const breakdownItems = selectedBreakdownCategory
    ? buildContextUsageBreakdown(model.promptAnalysis.segments, selectedBreakdownCategory)
    : [];
  const cells = buildUsageCells(categoryRows.map((row) => ({
    id: row.id,
    label: row.label,
    tokens: row.tokens ?? 0,
    className: row.cellClass,
  })), windowTokens);

  return (
    <section className="rounded-[28px] border border-black/5 bg-white/72 p-4 font-mono text-ink-700 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">Context Usage</div>
          <div className="mt-2 text-[13px] font-semibold text-ink-900">{displayModel}</div>
          <div className="mt-1 text-[12px] text-ink-500">
            {formatTokenAmount(usedTokens)}/{formatTokenAmount(windowTokens)} tokens ({formatUsagePercent(usedRatio)})
          </div>
        </div>
        <div className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${toneClasses(model.summary.statusTone)}`}>
          {model.summary.statusLabel}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-10 gap-1">
        {cells.map((cell) => (
          <span key={cell.id} className={`h-2 rounded-[2px] border ${cell.className}`} title={cell.label} />
        ))}
      </div>

      <div className="mt-4 text-[11px] italic text-ink-400">基于下一轮 prompt ledger 的上下文估算</div>
      <div className="mt-2 space-y-1.5 text-[12px] leading-5">
        {categoryRows.map((row) => {
          const ratio = (row.tokens ?? 0) / windowTokens;
          const selected = selectedBreakdownId === row.id;
          return (
            <button
              key={row.label}
              type="button"
              onClick={() => setSelectedBreakdownId(selected ? null : row.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-1.5 py-1 text-left transition ${
                selected ? "bg-ink-900/7 text-ink-900" : "hover:bg-ink-900/5"
              }`}
              title={`查看${row.label}构成`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-3 shrink-0 rounded-[2px] ${row.markerClass}`} />
                <span className="truncate text-ink-700">{row.label}</span>
              </span>
              <span className="shrink-0 text-ink-500">
                {`${formatTokenAmount(row.tokens)} tokens (${formatUsagePercent(ratio)})`}
              </span>
            </button>
          );
        })}
        {selectedBreakdownCategory && (
          <div className="mt-3 rounded-2xl border border-black/6 bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">Prompt 构成</div>
                <div className="mt-1 text-[13px] font-semibold text-ink-900">{selectedBreakdownCategory.label}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBreakdownId(null)}
                className="rounded-full px-2 py-1 text-[11px] text-ink-400 hover:bg-ink-900/5 hover:text-ink-700"
              >
                关闭
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {breakdownItems.length > 0 ? breakdownItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-black/5 bg-black/[0.025] px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-ink-800">{item.label}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-ink-400">
                        {item.sourceKind && (
                          <span className="rounded-full bg-white px-2 py-0.5">{PROMPT_SOURCE_KIND_LABELS[item.sourceKind] ?? item.sourceKind}</span>
                        )}
                        {item.sourcePath && (
                          <span className="max-w-full truncate rounded-full bg-white px-2 py-0.5">{item.sourcePath}</span>
                        )}
                        {item.chars > 0 && (
                          <span className="rounded-full bg-white px-2 py-0.5">{item.chars.toLocaleString("zh-CN")} 字符</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] font-semibold text-ink-500">
                      {formatTokenAmount(item.tokenEstimate)}
                    </div>
                  </div>
                  {item.sample && (
                    <p className="mt-2 max-h-16 overflow-hidden text-[11px] leading-5 text-ink-500">
                      {item.sample.length > 180 ? `${item.sample.slice(0, 180)}...` : item.sample}
                    </p>
                  )}
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-black/10 px-3 py-4 text-center text-[11px] text-ink-400">
                  这一类当前没有可展开的 prompt segment。
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 text-ink-600">
          <span className="flex items-center gap-2">
            <span className="h-2 w-3 rounded-[2px] border border-dashed border-ink-400" />
            Free space
          </span>
          <span>{formatTokenAmount(freeTokens)} ({formatUsagePercent(freeTokens / windowTokens)})</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-ink-600">
          <span className="flex items-center gap-2">
            <span className="grid h-3 w-3 place-items-center border border-ink-400 text-[8px] leading-none">×</span>
            压缩预留缓冲
          </span>
          <span>{formatTokenAmount(autoCompactTokens)} tokens ({formatUsagePercent(autoCompactTokens / windowTokens)})</span>
        </div>
        <div className="text-[10px] leading-4 text-ink-400">压缩预留缓冲不是已用 token，只是自动压缩阈值前保留的安全空间。</div>
        {toolPayloadTokens > 0 && (
          <div className="mt-3 rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2 text-[11px] leading-5 text-ink-500">
            工具输入/输出约 {formatTokenAmount(toolPayloadTokens)} tokens，已计入当前估算；这是历史工具 payload 在下一轮 prompt ledger 里的占用。
          </div>
        )}
      </div>
    </section>
  );
}

function MetricsStrip({
  metrics,
  compact = false,
}: {
  metrics: ActivityExecutionMetrics;
  compact?: boolean;
}) {
  const values = [
    { label: "输入", value: formatMetricAmount(metrics.inputChars, metrics.inputTokens) },
    { label: "上下文", value: formatMetricAmount(metrics.contextChars) },
    { label: "输出", value: formatMetricAmount(metrics.outputChars, metrics.outputTokens) },
    {
      label: "耗时",
      value: metrics.durationMs ? (metrics.durationMs < 1000 ? `${metrics.durationMs} ms` : `${(metrics.durationMs / 1000).toFixed(1)} s`) : "-",
    },
    { label: "成败", value: formatMetricStatus(metrics) },
  ];
  const headerCellClass = compact
    ? "border-r border-black/5 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-ink-400 last:border-r-0"
    : "border-r border-black/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-ink-400 last:border-r-0";
  const valueCellClass = compact
    ? "border-r border-t border-black/5 px-2 py-2 text-[11px] font-semibold text-ink-900 last:border-r-0"
    : "border-r border-t border-black/5 px-3 py-2.5 text-[12px] font-semibold text-ink-900 last:border-r-0";

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-black/5 bg-black/[0.03]">
      <table className="w-full table-fixed border-collapse">
        <thead className="bg-white/65">
          <tr>
            {values.map((entry) => (
              <th key={entry.label} className={headerCellClass}>
                {entry.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {values.map((entry) => (
              <td key={entry.label} className={valueCellClass}>
                {entry.value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function AnalysisCard({
  card,
  onJump,
}: {
  card: ActivityAnalysisCard;
  onJump: (timelineId: string) => void;
}) {
  const body = (
    <div className={`rounded-2xl border p-4 ${toneClasses(card.tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{card.title}</div>
          <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-current/90">{card.detail}</p>
        </div>
        {card.supportingTimelineId && (
          <span className="rounded-full border border-current/15 px-2 py-0.5 text-[10px] font-medium text-current/80">
            证据
          </span>
        )}
      </div>
    </div>
  );

  return card.supportingTimelineId ? (
    <button type="button" className="w-full text-left" onClick={() => onJump(card.supportingTimelineId!)}>
      {body}
    </button>
  ) : (
    body
  );
}

function ContextBucketRow({
  bucket,
  onJump,
}: {
  bucket: ContextDistributionBucket;
  onJump: (timelineId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink-900">{bucket.label}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClasses(bucket.tone)}`}>
          {(bucket.ratio * 100).toFixed(1)}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5">
        <div className={`h-full rounded-full ${toneAccentClasses(bucket.tone)}`} style={{ width: `${bucket.ratio * 100}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
        <span>约 {bucket.chars.toLocaleString("zh-CN")} 字符</span>
        <span>{bucket.messageCount} 条</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
        <span>关联节点 {bucket.sourceNodeIds.length}</span>
        {bucket.sourceNodeIds[0] && (
          <button
            type="button"
            onClick={() => onJump(bucket.sourceNodeIds[0]!)}
            className="rounded-full border border-black/5 bg-black/[0.03] px-2.5 py-1 text-[10px] font-medium text-ink-600 hover:bg-black/[0.05] hover:text-ink-900"
          >
            跳到节点
          </button>
        )}
      </div>
      <p className="mt-2 text-[12px] leading-5 text-ink-600">{bucket.sample || "暂无样本"}</p>
    </div>
  );
}

function ContextDistributionModal({
  title,
  totalChars,
  buckets,
  onJumpToNode,
  onClose,
}: {
  title: string;
  totalChars: number;
  buckets: ContextDistributionBucket[];
  onJumpToNode: (timelineId: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/30 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-3xl rounded-[28px] border border-black/5 bg-surface p-6 shadow-elevated"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-ink-900">{title}</div>
            <p className="mt-1 text-[12px] leading-5 text-ink-500">
              这是近似上下文构成，用来帮助你做 prompt 和执行流优化，不是模型的真实 token 账单拆分。
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-full p-2 text-ink-500 hover:bg-black/5"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }}
            aria-label="关闭"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4 rounded-2xl border border-black/5 bg-black/[0.03] px-4 py-3 text-sm text-ink-700">
          近似总量：{totalChars.toLocaleString("zh-CN")} 字符
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {buckets.map((bucket) => (
            <ContextBucketRow key={bucket.id} bucket={bucket} onJump={onJumpToNode} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailSectionCard({ section }: { section: ActivityDetailSection }) {
  const isToolOutput = section.id === "tool-output";
  const isBashOutput = isToolOutput && section.rawLabel === "展开原始返回";
  const rawLen = section.raw?.length ?? 0;
  const rawLines = section.raw?.split(/\r?\n/).length ?? 0;

  const needsFold = isToolOutput && rawLen > 500;
  const needsLineFold = isBashOutput && rawLines > 20;
  const shouldFold = needsFold || needsLineFold;

  const foldLabel = needsLineFold
    ? `展开完整输出（共 ${rawLines} 行，${rawLen.toLocaleString("zh-CN")} 字符）`
    : needsFold
      ? `展开完整输出（${rawLen.toLocaleString("zh-CN")} 字符）`
      : undefined;

  const previewRaw = shouldFold && section.raw
    ? needsLineFold
      ? section.raw.split(/\r?\n/).slice(0, 20).join("\n") + `\n... 还有 ${rawLines - 20} 行`
      : section.raw.slice(0, 500) + `...`
    : section.raw;

  return (
    <section className="rounded-[24px] border border-black/5 bg-white/78 p-4">
      <div className="text-sm font-semibold text-ink-900">{section.title}</div>
      {section.summary && (
        <p className="mt-2 text-[12px] leading-5 text-ink-600">{section.summary}</p>
      )}
      {section.rows.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-black/5 bg-black/[0.03]">
          <table className="w-full table-fixed border-collapse">
            <tbody>
              {section.rows.map((row) => (
                <tr key={`${section.id}-${row.label}`} className="border-t border-black/5 first:border-t-0">
                  <th className="w-[32%] bg-white/60 px-3 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-ink-400">
                    {row.label}
                  </th>
                  <td className="px-3 py-2 text-[12px] font-medium text-ink-800">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.raw && section.raw !== section.summary && (
        <details className="mt-3 rounded-2xl border border-black/5 bg-black/[0.02] p-3" open={!shouldFold}>
          <summary className="cursor-pointer text-[11px] font-medium text-ink-500">
            {shouldFold ? foldLabel : (section.rawLabel ?? "展开原文")}
          </summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-ink-900/10 bg-ink-900 px-3 py-3 text-[11px] leading-5 text-white shadow-[0_12px_24px_rgba(15,18,24,0.26)]">
            {previewRaw}
          </pre>
        </details>
      )}
    </section>
  );
}

function DetailDrawer({
  title,
  item,
  relatedSteps,
  latestPrompt,
  attachmentSummary,
  partialMessage,
  onClose,
}: {
  title: string;
  item: ActivityTimelineItem;
  relatedSteps: ActivityTaskStep[];
  latestPrompt: string | null;
  attachmentSummary: string;
  partialMessage: string;
  onClose: () => void;
}) {
  const metadataRows = [
    { label: "节点类型", value: getNodeKindLabel(item) },
    item.toolName ? { label: "工具名", value: item.toolName } : null,
    item.provenance ? { label: "调用来源", value: PROVENANCE_LABELS[item.provenance] } : null,
    item.nodeSubtype ? { label: "节点子类", value: item.nodeSubtype } : null,
    item.agentDescription ? { label: "子 Agent 描述", value: item.agentDescription } : null,
    item.parentTaskId ? { label: "父任务 ID", value: item.parentTaskId.slice(0, 12) } : null,
    { label: "执行轮次", value: `第 ${item.round} 轮` },
    { label: "关联步骤数", value: String(relatedSteps.length) },
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  return (
    <aside className="fixed inset-y-0 right-[360px] z-40 hidden w-[340px] overflow-y-auto border-l border-r border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(242,246,250,0.97))] px-4 pb-6 pt-12 shadow-[0_20px_40px_rgba(15,23,42,0.12)] xl:block">
      <div className="space-y-4">
        <section className="rounded-[28px] border border-black/5 bg-white/78 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-ink-400">{title}</div>
              <h3 className="mt-1 text-lg font-semibold text-ink-900">{item.title}</h3>
            </div>
            <button className="rounded-full p-2 text-ink-500 hover:bg-black/5" onClick={onClose} aria-label="关闭详情">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClasses(item.tone)}`}>
              {item.layer}
            </span>
            {item.statusLabel && (
              <span className="rounded-full border border-black/5 bg-black/5 px-2 py-0.5 text-[10px] text-ink-500">
                {item.statusLabel}
              </span>
            )}
            <span className="rounded-full border border-black/5 bg-black/5 px-2 py-0.5 text-[10px] text-ink-500">
              第 {item.round} 轮
            </span>
          </div>
          <MetricsStrip metrics={item.metrics} />
        </section>

        <section className="rounded-[24px] border border-black/5 bg-white/78 p-4">
          <div className="text-sm font-semibold text-ink-900">节点元信息</div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-black/5 bg-black/[0.03]">
            <table className="w-full table-fixed border-collapse">
              <tbody>
                {metadataRows.map((row) => (
                  <tr key={`${item.id}-${row.label}`} className="border-t border-black/5 first:border-t-0">
                    <th className="w-[36%] bg-white/60 px-3 py-2 text-left text-[10px] uppercase tracking-[0.14em] text-ink-400">
                      {row.label}
                    </th>
                    <td className="px-3 py-2 text-[12px] font-medium text-ink-800">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {item.detailSections.length > 0 ? (
          item.detailSections.map((section) => <DetailSectionCard key={`${item.id}-${section.id}`} section={section} />)
        ) : (
          <section className="rounded-[24px] border border-black/5 bg-white/78 p-4">
            <div className="text-sm font-semibold text-ink-900">节点说明</div>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-ink-700">{item.detail}</p>
          </section>
        )}

        {relatedSteps.length > 0 && (
          <section className="rounded-[28px] border border-black/5 bg-white/78 p-4">
            <div className="text-sm font-semibold text-ink-900">关联任务步骤</div>
            <div className="mt-3 space-y-2">
              {relatedSteps.map((step) => (
                <div key={step.id} className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2 text-sm text-ink-700">
                  {step.title}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[28px] border border-black/5 bg-white/78 p-4">
          <div className="text-sm font-semibold text-ink-900">关联上下文</div>
          <div className="mt-3 grid gap-2">
            <div className="rounded-2xl border border-black/5 bg-black/[0.03] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">最新提示</div>
              <p className="mt-1 text-[12px] leading-5 text-ink-700">{latestPrompt || "当前会话还没有用户提示。"}</p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-black/[0.03] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">本轮附件</div>
              <p className="mt-1 text-[12px] leading-5 text-ink-700">{attachmentSummary}</p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-black/[0.03] p-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">当前响应草稿</div>
              <p className="mt-1 text-[12px] leading-5 text-ink-700">{partialMessage || "当前没有流式中的响应片段。"}</p>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}

export function ActivityRail({
  session,
  partialMessage,
  globalError,
  onOpenSessionAnalysis,
  onOpenBrowserWorkbench,
  activeTab,
  onActiveTabChange,
  selectedModel,
  contextWindow,
  compressionThresholdPercent,
  hasBrowserTab = false,
  width = 420,
}: {
  session: SessionView | undefined;
  partialMessage: string;
  globalError: string | null;
  onOpenSessionAnalysis?: () => void;
  onOpenBrowserWorkbench?: () => void;
  activeTab?: ActivityRailTab;
  onActiveTabChange?: (tab: ActivityRailTab) => void;
  selectedModel?: string;
  contextWindow?: number;
  compressionThresholdPercent?: number;
  hasBrowserTab?: boolean;
  width?: number;
}) {
  const sidebarHeaderOffsetClass = typeof window !== "undefined" && window.electron?.platform === "darwin" ? "top-14" : "top-10";
  const model = useMemo(
    () => buildActivityRailModel(session, session?.permissionRequests ?? [], partialMessage),
    [partialMessage, session],
  );
  const [internalActiveTab, setInternalActiveTab] = useState<ActivityRailTab>("trace");
  const selectedTab = activeTab ?? internalActiveTab;
  const handleSelectTab = (tab: ActivityRailTab) => {
    if (!activeTab) setInternalActiveTab(tab);
    onActiveTabChange?.(tab);
  };
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null);
  const [showContextModal, setShowContextModal] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedTimelineId) return;
    const el = timelineRef.current?.querySelector(`[data-timeline-id="${selectedTimelineId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedTimelineId]);

  const selectedItem =
    (selectedTimelineId ? model.timeline.find((item) => item.id === selectedTimelineId) : null) ??
    null;
  const relatedSteps = selectedItem
    ? model.executionSteps.filter((step) => step.timelineIds.includes(selectedItem.id))
    : [];

  const analysisCards = useMemo(() => {
    if (!globalError) return model.analysisCards;
    return [
      {
        id: "global-error",
        title: "界面异常",
        tone: "error" as const,
        detail: globalError,
      },
      ...model.analysisCards,
    ];
  }, [globalError, model.analysisCards]);

  const activeAgentNodes = useMemo(() => {
    if (session?.status !== "running") return [];
    const seen = new Set<string>();
    return model.timeline.filter((item) => {
      if (item.nodeKind !== "agent_progress" || item.metrics.status !== "running") {
        return false;
      }
      const key = item.parentTaskId || item.agentDescription || item.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [model.timeline, session?.status]);

  const attachmentSummary = summarizeAttachments(
    model.contextSnapshot.latestAttachments.map((attachment) => attachment.name),
  );

  return (
    <>
      {showContextModal && (
        <ContextDistributionModal
          title={model.contextModalTitle}
          totalChars={model.contextDistribution.totalChars}
          buckets={model.contextDistribution.buckets}
          onJumpToNode={(timelineId) => {
            setSelectedTimelineId(timelineId);
          }}
          onClose={() => setShowContextModal(false)}
        />
      )}
      {selectedItem && (
        <DetailDrawer
          title={model.detailDrawerTitle}
          item={selectedItem}
          relatedSteps={relatedSteps}
          latestPrompt={model.contextSnapshot.latestPrompt}
          attachmentSummary={attachmentSummary}
          partialMessage={partialMessage}
          onClose={() => setSelectedTimelineId(null)}
        />
      )}

      <aside
        className={`fixed bottom-0 right-0 ${sidebarHeaderOffsetClass} hidden min-w-[400px] overflow-y-auto border-l border-black/5 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(240,244,248,0.96)_36%,rgba(234,239,245,0.98))] pb-6 shadow-[inset_1px_0_0_rgba(255,255,255,0.72)] backdrop-blur-xl lg:flex lg:flex-col`}
        style={{ width }}
      >

        <div className="flex h-10 shrink-0 items-center justify-between border-b border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,251,253,0.92))] px-4 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-1.5">
          {hasBrowserTab && (
            <button
              type="button"
              onClick={onOpenBrowserWorkbench}
              className="inline-flex h-8 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-muted transition hover:bg-ink-900/5 hover:text-ink-700"
              title="浏览器"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M3.5 12h17M12 3.5c2.2 2.3 3.2 5.1 3.2 8.5s-1 6.2-3.2 8.5M12 3.5C9.8 5.8 8.8 8.6 8.8 12s1 6.2 3.2 8.5" />
              </svg>
              <span>浏览器</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSelectTab("trace")}
            className={`inline-flex h-8 items-center gap-2 rounded-xl px-3 text-[13px] font-medium transition ${
              selectedTab === "trace"
                ? "bg-ink-900/7 text-ink-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]"
                : "text-muted hover:bg-ink-900/5 hover:text-ink-700"
            }`}
            title="执行轨迹"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M5 5h14M5 12h10M5 19h7" />
            </svg>
            <span>执行轨迹</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab("usage")}
            className={`inline-flex h-8 items-center gap-2 rounded-xl px-3 text-[13px] font-medium transition ${
              selectedTab === "usage"
                ? "bg-ink-900/7 text-ink-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]"
                : "text-muted hover:bg-ink-900/5 hover:text-ink-700"
            }`}
            title="Usage"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 18V6M9 18v-7M14 18V9M19 18V4" />
            </svg>
            <span>Usage</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab("preview")}
            className={`inline-flex h-8 items-center gap-2 rounded-xl px-3 text-[13px] font-medium transition ${
              selectedTab === "preview"
                ? "bg-ink-900/7 text-ink-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]"
                : "text-muted hover:bg-ink-900/5 hover:text-ink-700"
            }`}
            title="文件预览"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M7 3.5h7l3 3V20.5H7z" />
              <path d="M14 3.5V7h3M9.5 12h5M9.5 15.5h5" />
            </svg>
            <span>预览</span>
          </button>
          {!hasBrowserTab && (
            <button
              type="button"
              onClick={onOpenBrowserWorkbench}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-ink-900/5 hover:text-ink-700"
              title="新建浏览器标签"
              aria-label="新建浏览器标签"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          )}
          </div>
        </div>

        {selectedTab === "usage" ? (
          <div className="space-y-4 px-4 pt-4">
            <ContextUsagePanel
              model={model}
              selectedModel={selectedModel}
              contextWindow={contextWindow}
              compressionThresholdPercent={compressionThresholdPercent}
              partialMessage={partialMessage}
            />
          </div>
        ) : selectedTab === "preview" ? (
          <div className="min-h-0 flex-1">
            <div className="h-full overflow-hidden border-t border-[#d0d7de] bg-white shadow-none">
              <AionWorkspacePreviewPane
                workspace={session?.cwd}
                conversationId={session?.id}
                onClose={() => handleSelectTab("trace")}
              />
            </div>
          </div>
        ) : (
        <div className="space-y-4 px-4 pt-4">
          <section className="rounded-[28px] border border-black/5 bg-white/70 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-ink-400">Right Context Rail</p>
                <h2 className="mt-1 text-lg font-semibold text-ink-900">{model.primarySectionTitle}</h2>
                <p className="mt-1 text-[12px] leading-5 text-ink-500">
                  聊天页只保留执行概览和分析入口，完整链路请进入 Trace Viewer 查看。
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${toneClasses(model.summary.statusTone)}`}>
                {model.summary.statusLabel}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">最新结果</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.latestResultLabel}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">总耗时</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.durationLabel}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">模型</div>
                <div className="mt-1 truncate text-sm font-semibold text-ink-900" title={model.summary.modelLabel}>{model.summary.modelLabel}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">输入</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.inputLabel}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">输出</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.outputLabel}</div>
              </div>
              <div className="rounded-2xl border border-accent/15 bg-accent-subtle/40 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">费用</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-ink-900">{model.summary.costLabel}</span>
                  {model.summary.costLabel !== "-" && (
                    <span className="text-[9px] text-ink-400/70">非真实扣费</span>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">成功 / 失败</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.successCount} / {model.summary.failureCount}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">上下文</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.contextLabel}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">告警</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.alertCount}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {session && onOpenSessionAnalysis && (
                <button
                  type="button"
                  onClick={onOpenSessionAnalysis}
                  className="rounded-full border border-black/5 bg-white px-3 py-2 text-[11px] font-medium text-ink-700 hover:border-black/10 hover:bg-white/90"
                >
                  打开 Trace Viewer
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowContextModal(true)}
                className="rounded-full border border-accent/20 bg-accent-subtle px-3 py-2 text-[11px] font-medium text-accent hover:bg-accent-subtle/80"
              >
                查看{model.contextModalTitle}
              </button>
              {selectedTimelineId && (
                <button
                  type="button"
                  onClick={() => setSelectedTimelineId(null)}
                  className="rounded-full border border-black/5 bg-white px-3 py-2 text-[11px] text-ink-600 hover:border-black/10 hover:bg-white/90"
                >
                  收起详情抽屉
                </button>
              )}
            </div>
          </section>

          {activeAgentNodes.length > 0 && (
            <section className="rounded-[28px] border border-info/15 bg-info-light/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">运行中任务</h3>
                  <p className="mt-1 text-[12px] text-ink-500">子 Agent 正在执行，下方为实时进度。</p>
                </div>
                <span className="rounded-full border border-info/20 bg-info-light/50 px-2.5 py-1 text-[10px] font-medium text-info">
                  {activeAgentNodes.length} 个
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {activeAgentNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className="w-full text-left rounded-2xl border border-info/10 bg-white/85 p-3 hover:border-info/25 transition"
                    onClick={() => setSelectedTimelineId(node.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-info" />
                      </span>
                      <span className="text-[13px] font-semibold text-ink-900 truncate">
                        {node.agentDescription || node.title}
                      </span>
                    </div>
                    <p className="mt-1 ml-5 text-[11px] text-ink-500">{node.statusLabel}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-[28px] border border-black/5 bg-white/68 p-4 shadow-[0_16px_32px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">{model.analysisSectionTitle}</h3>
                <p className="mt-1 text-[12px] text-ink-500">结论和证据入口并排放，方便你直接做优化判断。</p>
              </div>
              <span className="rounded-full border border-black/5 bg-black/[0.03] px-2.5 py-1 text-[10px] text-ink-500">
                {analysisCards.length} 条
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {analysisCards.map((card) => (
                <AnalysisCard
                  key={card.id}
                  card={card}
                  onJump={(timelineId) => {
                    setSelectedTimelineId(timelineId);
                  }}
                />
              ))}
            </div>
          </section>

          {model.timeline.length > 0 && (
            <section ref={timelineRef} className="rounded-[28px] border border-black/5 bg-white/68 p-4 shadow-[0_16px_32px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">时间线</h3>
                  <p className="mt-1 text-[12px] text-ink-500">按执行阶段分组，点击节点查看详情。</p>
                </div>
                <span className="rounded-full border border-black/5 bg-black/[0.03] px-2.5 py-1 text-[10px] text-ink-500">
                  {model.timeline.length} 条
                </span>
              </div>
              <div className="space-y-4">
                {renderTimelineWithStages(model.timeline, selectedTimelineId, (id) => setSelectedTimelineId(id))}
              </div>
            </section>
          )}
        </div>
        )}
      </aside>
    </>
  );
}

export default ActivityRail;
