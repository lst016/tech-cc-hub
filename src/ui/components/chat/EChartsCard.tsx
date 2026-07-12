import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { EChartsType } from "echarts/core";
import type { EChartsOption } from "echarts";
import { AlertTriangle, BarChart3, RotateCcw } from "lucide-react";
import {
  convertChartOptionType,
  getPrimaryChartType,
  getSwitchableChartTypes,
  parseChartOption,
  type ChartOptionRecord,
  type SwitchableChartType,
} from "../../utils/chart-options";

type EChartsCardProps = {
  json: string;
};

const THEME_COLORS = [
  "#D26A3D",
  "#2563EB",
  "#16A34A",
  "#D97706",
  "#DC2626",
  "#7C3AED",
  "#0891B2",
  "#DB2777",
];

const CHART_TYPE_LABELS: Record<SwitchableChartType, string> = {
  line: "折线图",
  bar: "柱状图",
  pie: "饼图",
};

function isRecord(value: unknown): value is ChartOptionRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getChartTitle(option: ChartOptionRecord): string {
  const title = Array.isArray(option.title) ? option.title[0] : option.title;
  return isRecord(title) && typeof title.text === "string" && title.text.trim()
    ? title.text.trim()
    : "数据图表";
}

function withDefaultTheme(option: ChartOptionRecord): ChartOptionRecord {
  return {
    ...option,
    color: option.color ?? THEME_COLORS,
    backgroundColor: option.backgroundColor ?? "transparent",
    textStyle: {
      ...(isRecord(option.textStyle) ? option.textStyle : {}),
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
    },
  };
}

export const EChartsCard = memo(function EChartsCard({ json }: EChartsCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const parsed = useMemo(() => parseChartOption(json), [json]);
  const originalOption = parsed.ok ? parsed.option : null;
  const hasOriginalOption = originalOption !== null;
  const switchableTypes = useMemo(
    () => originalOption ? getSwitchableChartTypes(originalOption) : [],
    [originalOption],
  );
  const originalType = originalOption ? getPrimaryChartType(originalOption) : null;
  const originalSwitchableType = switchableTypes.includes(originalType as SwitchableChartType)
    ? originalType as SwitchableChartType
    : null;
  const [selectedType, setSelectedType] = useState<SwitchableChartType | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setSelectedType(null);
  }, [json]);

  const renderedOption = useMemo(() => {
    if (!originalOption) return null;
    const selectedOption = selectedType
      ? (switchableTypes.includes(selectedType) ? convertChartOptionType(originalOption, selectedType) : originalOption)
      : originalOption;
    return withDefaultTheme(selectedOption);
  }, [originalOption, selectedType, switchableTypes]);

  useEffect(() => {
    if (!renderedOption || !containerRef.current) return;
    let active = true;
    setIsReady(false);
    setRenderError(null);

    void import("echarts")
      .then((echarts) => {
        const container = containerRef.current;
        if (!active || !container) return;
        if (chartRef.current && !chartRef.current.isDisposed() && chartRef.current.getDom() !== container) {
          chartRef.current.dispose();
          chartRef.current = null;
        }
        const chart = chartRef.current && !chartRef.current.isDisposed()
          ? chartRef.current
          : echarts.init(container, undefined, { renderer: "canvas" });
        chartRef.current = chart;
        chart.setOption(renderedOption as EChartsOption, { notMerge: true });
        chart.resize();
        if (active) setIsReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRenderError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      active = false;
    };
  }, [renderedOption]);

  useEffect(() => {
    if (!originalOption) {
      chartRef.current?.dispose();
      chartRef.current = null;
      setIsReady(false);
    }
  }, [originalOption]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => chartRef.current?.resize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [hasOriginalOption]);

  useEffect(() => () => {
    chartRef.current?.dispose();
    chartRef.current = null;
  }, []);

  if (!parsed.ok) {
    return (
      <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50" aria-label="ECharts 图表错误">
        <div className="flex items-center gap-2 border-b border-amber-200 px-4 py-3 text-amber-800">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm font-semibold">图表配置无法渲染</span>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-amber-800">{parsed.error}</p>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white/70 p-3 text-xs text-amber-900">{json}</pre>
        </div>
      </section>
    );
  }

  const displayType = selectedType ?? originalType ?? "custom";

  return (
    <section
      className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.07)]"
      aria-label={`ECharts 图表：${getChartTitle(parsed.option)}`}
      data-echarts-chart-type={displayType}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-black/6 px-4 py-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
          <BarChart3 className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-800">
          {getChartTitle(parsed.option)}
        </span>
        {switchableTypes.length > 1 && originalSwitchableType && (
          <select
            aria-label="切换图表类型"
            value={selectedType ?? originalSwitchableType}
            onChange={(event) => {
              const nextType = event.target.value as SwitchableChartType;
              setSelectedType(nextType === originalSwitchableType ? null : nextType);
            }}
            className="h-8 rounded-lg border border-black/10 bg-surface-secondary px-2 text-xs font-semibold text-ink-700 outline-none transition focus:border-accent/40 focus:ring-2 focus:ring-accent/15"
          >
            {switchableTypes.map((type) => (
              <option key={type} value={type}>{CHART_TYPE_LABELS[type]}</option>
            ))}
          </select>
        )}
        {selectedType && (
          <button
            type="button"
            aria-label="恢复原始图表类型"
            title="恢复原始图表类型"
            onClick={() => setSelectedType(null)}
            className="grid h-8 w-8 place-items-center rounded-full border border-black/8 text-muted transition hover:border-accent/25 hover:text-accent"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="relative min-h-[22rem] p-3 sm:p-4">
        {!isReady && !renderError && (
          <div className="absolute inset-0 grid place-items-center text-sm font-medium text-muted">正在渲染图表…</div>
        )}
        {renderError && (
          <div className="absolute inset-3 z-10 grid place-items-center rounded-xl bg-red-50 px-4 text-center text-sm text-red-600 sm:inset-4">
            图表渲染失败：{renderError}
          </div>
        )}
        <div ref={containerRef} className="h-[22rem] w-full" aria-hidden={!isReady} />
      </div>
    </section>
  );
});
