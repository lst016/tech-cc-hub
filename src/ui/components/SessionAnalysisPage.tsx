import { useMemo } from "react";
import {
  buildActivityRailModel,
  type ActivityExecutionStep,
  type ActivityTimelineItem,
} from "../../shared/activity-rail-model";
import type { SessionView } from "../store/useAppStore";

function statusToneClass(status: "idle" | "running" | "completed" | "error") {
  switch (status) {
    case "running":
      return "border-info/20 bg-info-light/55 text-info";
    case "completed":
      return "border-success/20 bg-success-light/55 text-success";
    case "error":
      return "border-error/20 bg-error-light text-error";
    default:
      return "border-black/8 bg-white/72 text-ink-600";
  }
}

function timelineToneClass(tone: ActivityTimelineItem["tone"]) {
  switch (tone) {
    case "info":
      return "border-info/20 bg-info-light/55 text-info";
    case "success":
      return "border-success/20 bg-success-light/55 text-success";
    case "warning":
      return "border-warning/20 bg-warning-light/70 text-warning";
    case "error":
      return "border-error/20 bg-error-light text-error";
    default:
      return "border-black/8 bg-black/[0.03] text-ink-600";
  }
}

function formatMetricAmount(value?: number, suffix = "字符") {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return "-";
  }
  return `${value.toLocaleString("zh-CN")} ${suffix}`;
}

function formatDurationMs(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  if (value < 1000) {
    return `${value} ms`;
  }
  return `${(value / 1000).toFixed(1)} s`;
}

function StepSummaryCard({
  title,
  statusLabel,
  detail,
  countLabel,
}: {
  title: string;
  statusLabel: string;
  detail: string;
  countLabel: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/6 bg-white/80 p-4 shadow-[0_16px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-ink-900">{title}</div>
        <span className="rounded-full border border-black/6 bg-black/[0.03] px-2.5 py-1 text-[10px] text-ink-500">
          {countLabel}
        </span>
      </div>
      <div className="mt-3 text-[11px] text-ink-500">{statusLabel}</div>
      <p className="mt-2 text-[13px] leading-6 text-ink-700">{detail}</p>
    </div>
  );
}

function ExecutionStepRow({ step }: { step: ActivityExecutionStep }) {
  return (
    <div className="grid gap-3 rounded-[22px] border border-black/6 bg-white/80 px-4 py-3 text-[12px] text-ink-700 shadow-[0_14px_28px_rgba(15,23,42,0.04)] md:grid-cols-[minmax(0,1.2fr)_120px_100px_100px_100px]">
      <div>
        <div className="font-semibold text-ink-900">{step.title}</div>
        <div className="mt-1 text-[11px] text-ink-500">状态 {step.status}</div>
      </div>
      <div>节点 {step.timelineIds.length}</div>
      <div>{step.metrics.durationMs ? `${step.metrics.durationMs} ms` : "-"}</div>
      <div>{step.metrics.contextChars.toLocaleString("zh-CN")} 字符</div>
      <div>{step.status}</div>
    </div>
  );
}

function ExecutionLogTable({ items }: { items: ActivityTimelineItem[] }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-black/6 bg-white/84 shadow-[0_16px_32px_rgba(15,23,42,0.04)]">
      <div className="max-h-[440px] overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-[12px] text-ink-700">
          <thead className="sticky top-0 z-10 bg-[#f6f8fb]/96 backdrop-blur">
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-ink-400">
              <th className="px-4 py-3 font-medium">轮次</th>
              <th className="px-4 py-3 font-medium">层级</th>
              <th className="px-4 py-3 font-medium">标题</th>
              <th className="px-4 py-3 font-medium">摘要</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">耗时</th>
              <th className="px-4 py-3 font-medium">输入</th>
              <th className="px-4 py-3 font-medium">上下文</th>
              <th className="px-4 py-3 font-medium">输出</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="align-top odd:bg-white even:bg-[#fbfcfe]">
                <td className="border-t border-black/6 px-4 py-3 text-ink-500">
                  <div>第 {item.round} 轮</div>
                  <div className="mt-1 text-[11px] text-ink-400">#{item.sequence}</div>
                </td>
                <td className="border-t border-black/6 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] ${timelineToneClass(item.tone)}`}>
                      {item.layer}
                    </span>
                    <span className="rounded-full border border-black/6 bg-black/[0.03] px-2.5 py-1 text-[10px] text-ink-500">
                      {item.stageKind}
                    </span>
                  </div>
                </td>
                <td className="border-t border-black/6 px-4 py-3">
                  <div className="font-medium text-ink-900">{item.title}</div>
                  {item.chips.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.chips.slice(0, 3).map((chip) => (
                        <span
                          key={`${item.id}-${chip}`}
                          className="rounded-full bg-black/[0.03] px-2 py-0.5 text-[10px] text-ink-500"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td className="border-t border-black/6 px-4 py-3">
                  <div className="max-w-[360px] whitespace-pre-wrap break-words leading-5 text-ink-600">
                    {item.preview}
                  </div>
                </td>
                <td className="border-t border-black/6 px-4 py-3">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] ${timelineToneClass(item.tone)}`}>
                    {item.statusLabel ?? item.metrics.status}
                  </span>
                </td>
                <td className="border-t border-black/6 px-4 py-3 text-ink-500">
                  {formatDurationMs(item.metrics.durationMs)}
                </td>
                <td className="border-t border-black/6 px-4 py-3 text-ink-500">
                  {formatMetricAmount(item.metrics.inputChars)}
                </td>
                <td className="border-t border-black/6 px-4 py-3 text-ink-500">
                  {formatMetricAmount(item.metrics.contextChars)}
                </td>
                <td className="border-t border-black/6 px-4 py-3 text-ink-500">
                  {formatMetricAmount(item.metrics.outputChars)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EvidenceCard({ item }: { item: ActivityTimelineItem }) {
  return (
    <div className="rounded-[24px] border border-black/6 bg-white/82 p-4 shadow-[0_16px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-ink-900">{item.title}</div>
        <span className="rounded-full border border-black/6 bg-black/[0.03] px-2.5 py-1 text-[10px] text-ink-500">
          {item.layer}
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-6 text-ink-700">{item.preview}</p>
      <div className="mt-3 text-[11px] text-ink-500">
        第 {item.round} 轮 · {item.statusLabel ?? "已记录"}
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

  const highlightedEvidence = useMemo(() => {
    const attentionItems = model.timeline.filter((item) => item.attention).slice(0, 2);
    if (attentionItems.length > 0) return attentionItems;
    return model.timeline.slice(0, 3);
  }, [model.timeline]);

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-8 lg:px-6">
      <section className="rounded-[34px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,249,252,0.9))] px-6 py-6 shadow-[0_28px_70px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-ink-400">Session Analysis</div>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink-900">本会话完整分析</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-600">
              这里把实际执行步骤和关键节点证据拉平展示，用来做单次会话复盘。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${statusToneClass(session?.status ?? "idle")}`}>
              {model.summary.statusLabel}
            </span>
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-black/6 bg-white px-4 py-2 text-sm text-ink-700 transition hover:border-black/10 hover:bg-[#f7f9fc]"
            >
              返回会话
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StepSummaryCard title="模型" statusLabel="本轮模型" detail={model.summary.modelLabel} countLabel="Model" />
          <StepSummaryCard title="总耗时" statusLabel="端到端" detail={model.summary.durationLabel} countLabel="Duration" />
          <StepSummaryCard title="输入" statusLabel="主输入量" detail={model.summary.inputLabel} countLabel="Input" />
          <StepSummaryCard title="上下文" statusLabel="近似上下文" detail={model.summary.contextLabel} countLabel="Context" />
          <StepSummaryCard title="输出" statusLabel="主输出量" detail={model.summary.outputLabel} countLabel="Output" />
          <StepSummaryCard
            title="结果"
            statusLabel={`成功 ${model.summary.successCount} · 失败 ${model.summary.failureCount}`}
            detail={model.summary.latestResultLabel}
            countLabel="Outcome"
          />
        </div>
      </section>

      <section className="rounded-[30px] border border-black/6 bg-white/78 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">执行日志</h2>
            <p className="mt-1 text-[12px] leading-5 text-ink-500">
              按真实时间线展开每条执行记录，直接看发生了什么、耗时多少、上下文吃了多少。
            </p>
          </div>
          <span className="rounded-full border border-black/6 bg-black/[0.03] px-3 py-1 text-[11px] text-ink-500">
            {model.timeline.length} 条日志
          </span>
        </div>
        <div className="mt-4">
          {model.timeline.length > 0 ? (
            <ExecutionLogTable items={model.timeline} />
          ) : (
            <div className="rounded-[24px] border border-dashed border-black/10 bg-black/[0.02] px-4 py-5 text-sm text-ink-500">
              这次会话还没有可展示的执行日志。
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[30px] border border-black/6 bg-white/78 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">执行步骤分析</h2>
            <p className="mt-1 text-[12px] leading-5 text-ink-500">用结构化视角看每一步的节点数、耗时和上下文负担。</p>
          </div>
          <span className="rounded-full border border-black/6 bg-black/[0.03] px-3 py-1 text-[11px] text-ink-500">
            {model.executionSteps.length} 个执行步骤
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {model.executionSteps.length > 0 ? (
            model.executionSteps.map((step) => <ExecutionStepRow key={step.id} step={step} />)
          ) : (
            <div className="rounded-[24px] border border-dashed border-black/10 bg-black/[0.02] px-4 py-5 text-sm text-ink-500">
              这次会话还没有可分析的执行步骤。
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[30px] border border-black/6 bg-white/78 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">关键节点证据</h2>
            <p className="mt-1 text-[12px] leading-5 text-ink-500">优先展示需要关注或最值得复盘的时间线节点。</p>
          </div>
          <span className="rounded-full border border-black/6 bg-black/[0.03] px-3 py-1 text-[11px] text-ink-500">
            {highlightedEvidence.length} 条证据
          </span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {highlightedEvidence.map((item) => (
            <EvidenceCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default SessionAnalysisPage;
