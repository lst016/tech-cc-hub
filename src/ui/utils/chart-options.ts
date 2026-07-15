export type ChartOptionRecord = Record<string, unknown>;
export type SwitchableChartType = "line" | "bar" | "pie";

export type ChartOptionParseResult =
  | { ok: true; option: ChartOptionRecord }
  | { ok: false; error: string };

export const MAX_ECHARTS_CONFIG_CHARS = 100_000;

const SWITCHABLE_TYPES: SwitchableChartType[] = ["line", "bar", "pie"];
const UNSAFE_OPTION_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i;
const UNSAFE_URI_PATTERN = /^\s*(?:javascript:|data:text\/html)/i;

function isRecord(value: unknown): value is ChartOptionRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsUnsafeKey(value: unknown, depth = 0): boolean {
  if (depth > 64) return true;
  if (Array.isArray(value)) return value.some((item) => containsUnsafeKey(item, depth + 1));
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, item]) => (
    UNSAFE_OPTION_KEYS.has(key) || containsUnsafeKey(item, depth + 1)
  ));
}

function sanitizeOptionValue(value: unknown, parentKey = "", depth = 0): unknown {
  if (depth > 64) throw new Error("图表配置嵌套过深");
  if (typeof value === "string") {
    if (UNSAFE_URI_PATTERN.test(value)) throw new Error("图表配置包含不安全链接");
    if (HTML_TAG_PATTERN.test(value)) throw new Error("图表配置不允许包含 HTML");
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeOptionValue(item, parentKey, depth + 1));
  }
  if (!isRecord(value)) return value;

  const sanitized: ChartOptionRecord = {};
  for (const [key, item] of Object.entries(value)) {
    if (UNSAFE_OPTION_KEYS.has(key)) throw new Error("图表配置包含不安全字段");
    if (key === "extraCssText") throw new Error("图表 tooltip 不允许注入 CSS");
    sanitized[key] = sanitizeOptionValue(item, key, depth + 1);
  }
  if (parentKey === "tooltip") sanitized.renderMode = "richText";
  return sanitized;
}

function cloneOption(option: ChartOptionRecord): ChartOptionRecord {
  return JSON.parse(JSON.stringify(option)) as ChartOptionRecord;
}

function normalizeSeries(option: ChartOptionRecord): ChartOptionRecord[] {
  const series = option.series;
  if (Array.isArray(series)) return series.filter(isRecord);
  return isRecord(series) ? [series] : [];
}

function firstAxis(option: ChartOptionRecord, key: "xAxis" | "yAxis"): ChartOptionRecord | null {
  const axis = option[key];
  if (Array.isArray(axis)) return axis.find(isRecord) ?? null;
  return isRecord(axis) ? axis : null;
}

function dataValue(value: unknown): unknown {
  if (isRecord(value) && "value" in value) return value.value;
  return value;
}

function isFiniteChartValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
}

type CanonicalSingleSeries = {
  categories: unknown[];
  values: unknown[];
  name?: string;
};

function extractCartesianSingleSeries(option: ChartOptionRecord): CanonicalSingleSeries | null {
  const series = normalizeSeries(option);
  if (series.length !== 1) return null;
  const categories = firstAxis(option, "xAxis")?.data;
  const data = series[0]?.data;
  if (!Array.isArray(categories) || !Array.isArray(data) || categories.length !== data.length || data.length === 0) {
    return null;
  }
  const values = data.map(dataValue);
  if (!values.every(isFiniteChartValue)) return null;
  return {
    categories: [...categories],
    values,
    name: typeof series[0]?.name === "string" ? series[0].name : undefined,
  };
}

function extractPieSingleSeries(option: ChartOptionRecord): CanonicalSingleSeries | null {
  const series = normalizeSeries(option);
  if (series.length !== 1 || series[0]?.type !== "pie" || !Array.isArray(series[0].data)) return null;

  const items = series[0].data;
  if (items.length === 0 || !items.every((item) => (
    isRecord(item) && "name" in item && "value" in item && isFiniteChartValue(item.value)
  ))) {
    return null;
  }

  return {
    categories: items.map((item) => (item as ChartOptionRecord).name),
    values: items.map((item) => (item as ChartOptionRecord).value),
    name: typeof series[0].name === "string" ? series[0].name : undefined,
  };
}

function extractCanonicalSingleSeries(option: ChartOptionRecord): CanonicalSingleSeries | null {
  return getPrimaryChartType(option) === "pie"
    ? extractPieSingleSeries(option)
    : extractCartesianSingleSeries(option);
}

export function parseChartOption(json: string): ChartOptionParseResult {
  if (json.length > MAX_ECHARTS_CONFIG_CHARS) {
    return { ok: false, error: `图表 JSON 超过 ${MAX_ECHARTS_CONFIG_CHARS} 字符限制` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "图表配置不是有效的严格 JSON" };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: "图表配置必须是 JSON 对象" };
  }
  if (containsUnsafeKey(parsed)) {
    return { ok: false, error: "图表配置包含不安全字段" };
  }

  try {
    return { ok: true, option: sanitizeOptionValue(parsed) as ChartOptionRecord };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "图表配置包含不安全内容" };
  }
}

export function getPrimaryChartType(option: ChartOptionRecord): string | null {
  const type = normalizeSeries(option)[0]?.type;
  return typeof type === "string" && type.trim() ? type : null;
}

export function getSwitchableChartTypes(option: ChartOptionRecord): SwitchableChartType[] {
  const series = normalizeSeries(option);
  const primaryType = getPrimaryChartType(option);

  if (primaryType === "pie" && extractPieSingleSeries(option)) {
    return [...SWITCHABLE_TYPES];
  }

  if (
    !series.length
    || !series.every((item) => item.type === "line" || item.type === "bar")
    || !firstAxis(option, "xAxis")
    || !firstAxis(option, "yAxis")
  ) {
    return [];
  }
  if (!series.every((item) => item.type === primaryType)) return [];

  if (series.length === 1 && extractCartesianSingleSeries(option)) {
    return [...SWITCHABLE_TYPES];
  }
  return ["line", "bar"];
}

export function convertChartOptionType(
  originalOption: ChartOptionRecord,
  targetType: SwitchableChartType,
): ChartOptionRecord {
  const allowedTypes = getSwitchableChartTypes(originalOption);
  if (!allowedTypes.includes(targetType)) {
    throw new Error(`当前数据不支持切换为 ${targetType} 图`);
  }

  const sourceType = getPrimaryChartType(originalOption);
  const canonical = extractCanonicalSingleSeries(originalOption);
  const cloned = cloneOption(originalOption);

  if (targetType === "pie") {
    if (!canonical) throw new Error("当前数据无法转换为饼图");
    delete cloned.xAxis;
    delete cloned.yAxis;
    delete cloned.grid;
    delete cloned.dataZoom;
    return {
      ...cloned,
      tooltip: { ...(isRecord(cloned.tooltip) ? cloned.tooltip : {}), trigger: "item" },
      series: [{
        name: canonical.name,
        type: "pie",
        radius: ["38%", "68%"],
        data: canonical.categories.map((name, index) => ({ name, value: canonical.values[index] })),
      }],
    };
  }

  if (sourceType === "pie") {
    if (!canonical) throw new Error("当前饼图数据无法转换为坐标图");
    return {
      ...cloned,
      tooltip: { ...(isRecord(cloned.tooltip) ? cloned.tooltip : {}), trigger: "axis" },
      xAxis: { type: "category", data: canonical.categories },
      yAxis: { type: "value" },
      series: [{ name: canonical.name, type: targetType, data: canonical.values }],
    };
  }

  return {
    ...cloned,
    series: normalizeSeries(cloned).map((seriesItem) => {
      const nextSeries: ChartOptionRecord = { ...seriesItem, type: targetType };
      if (targetType === "bar") {
        delete nextSeries.smooth;
        delete nextSeries.step;
        delete nextSeries.areaStyle;
        delete nextSeries.connectNulls;
      } else {
        delete nextSeries.barWidth;
        delete nextSeries.barMaxWidth;
        delete nextSeries.barMinWidth;
        delete nextSeries.barGap;
        delete nextSeries.barCategoryGap;
      }
      return nextSeries;
    }),
  };
}
