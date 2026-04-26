import { useMemo, useState } from "react";
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
};

const PROVENANCE_LABELS: Record<ActivityToolProvenance, string> = {
  local: "本地",
  mcp: "MCP",
  sub_agent: "子 Agent",
  a2a: "A2A",
  transfer_agent: "交接 Agent",
  unknown: "未归类",
};

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
        <details className="mt-3 rounded-2xl border border-black/5 bg-black/[0.02] p-3">
          <summary className="cursor-pointer text-[11px] font-medium text-ink-500">
            {section.rawLabel ?? "展开原文"}
          </summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-ink-900/10 bg-ink-900 px-3 py-3 text-[11px] leading-5 text-white shadow-[0_12px_24px_rgba(15,18,24,0.26)]">
            {section.raw}
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
  width = 420,
}: {
  session: SessionView | undefined;
  partialMessage: string;
  globalError: string | null;
  onOpenSessionAnalysis?: () => void;
  width?: number;
}) {
  const sidebarHeaderOffsetClass = typeof window !== "undefined" && window.electron?.platform === "darwin" ? "top-14" : "top-10";
  const model = useMemo(
    () => buildActivityRailModel(session, session?.permissionRequests ?? [], ""),
    [session],
  );
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(null);
  const [showContextModal, setShowContextModal] = useState(false);

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
            setShowContextModal(false);
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
        className={`fixed bottom-0 right-0 ${sidebarHeaderOffsetClass} hidden min-w-[400px] overflow-y-auto border-l border-black/5 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(240,244,248,0.96)_36%,rgba(234,239,245,0.98))] px-4 pb-6 pt-4 shadow-[inset_1px_0_0_rgba(255,255,255,0.72)] backdrop-blur-xl lg:flex lg:flex-col`}
        style={{ width }}
      >

        <div className="space-y-4">
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

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">最新结果</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.latestResultLabel}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">总耗时</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.durationLabel}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">输入</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.inputLabel}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">输出</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.outputLabel}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">成功</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.successCount}</div>
              </div>
              <div className="rounded-2xl border border-black/5 bg-black/[0.03] px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">失败</div>
                <div className="mt-1 text-sm font-semibold text-ink-900">{model.summary.failureCount}</div>
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
        </div>
      </aside>
    </>
  );
}

export default ActivityRail;
