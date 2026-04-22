import { useEffect, useMemo, useState } from "react";
import {
  buildActivityRailModel,
  type ActivityDetailRow,
  type ActivityDetailSection,
  type ActivityExecutionMetrics,
  type ActivityExecutionStep,
  type ActivityPlanStep,
  type ActivityRailTone,
  type ActivityTimelineItem,
} from "../../shared/activity-rail-model";
import type { SessionView } from "../store/useAppStore";

type InspectorTabKey = "node" | "raw" | "analytics";

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
    () => buildActivityRailModel(session, session?.permissionRequests ?? [], partialMessage),
    [partialMessage, session],
  );

  const baseGroups = useMemo<TraceGroup[]>(() => {
    if (model.planSteps.length > 0) {
      return model.planSteps
        .map((step: ActivityPlanStep) => ({
          id: step.id,
          indexLabel: step.indexLabel,
          title: step.title,
          detail: step.detail,
          status: step.status,
          metrics: step.metrics,
          sourceTimelineId: step.sourceTimelineId,
          items: model.timeline.filter((item) => step.timelineIds.includes(item.id)),
          isInferred: false,
        }))
        .filter((group) => group.items.length > 0);
    }

    return model.executionSteps
      .map((step: ActivityExecutionStep, index) => ({
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
  }, [model.executionSteps, model.planSteps, model.timeline]);

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
          className="flex min-h-0 w-[40%] min-w-[360px] max-w-[540px] flex-col gap-3"
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
                              Step {group.indexLabel}
                            </span>
                            <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-bold", getStatusBadgeClass(group.status))}>
                              {STATUS_LABELS[group.status]}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                              {group.items.length} 节点
                            </span>
                            {group.isInferred ? (
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                                推断步骤
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
              {selectedItem === null ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                  当前没有可查看的节点。
                </div>
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
                  <div className="grid gap-2 md:grid-cols-3">
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
