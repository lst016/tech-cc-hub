export type DesignInspectionDsl = {
  schemaVersion: 1;
  summary: string;
  screen: {
    kind: string;
    language?: string;
    canvas?: { width?: number; height?: number };
  };
  regions: Array<{
    id: string;
    role: string;
    description?: string;
    alignment?: string;
    style?: Record<string, unknown>;
  }>;
  elements: Array<{
    id: string;
    type: string;
    text?: string;
    region?: string;
    priority?: "high" | "medium" | "low";
    style?: Record<string, unknown>;
    implementationHints?: string[];
  }>;
  visualTokens?: {
    colors?: string[];
    spacing?: string[];
    typography?: string[];
  };
  implementationHints?: string[];
  rawSummary?: string;
};

export function buildDesignInspectionPrompt(userPrompt?: string): string {
  const normalizedPrompt = userPrompt?.trim() || "请分析这张 UI/产品截图，提取可用于编码还原的信息。";
  return [
    normalizedPrompt,
    "",
    "请只输出一个 JSON 对象，不要 Markdown，不要代码块，不要额外解释。",
    "JSON schema:",
    "{",
    '  "summary": "100 字以内中文摘要",',
    '  "screen": { "kind": "modal|page|component|unknown", "language": "zh-CN|en|mixed|unknown" },',
    '  "regions": [',
    '    { "id": "header", "role": "header|body|footer|sidebar|toolbar|content|unknown", "description": "区域说明", "alignment": "对齐/位置", "style": { "background": "", "radius": "", "padding": "" } }',
    "  ],",
    '  "elements": [',
    '    { "id": "primaryButton", "type": "button|input|text|icon|table|card|image|unknown", "text": "可读文字", "region": "footer", "priority": "high|medium|low", "style": { "color": "", "size": "", "state": "" }, "implementationHints": ["编码还原要点"] }',
    "  ],",
    '  "visualTokens": { "colors": ["颜色/用途"], "spacing": ["间距规律"], "typography": ["字号/字重规律"] },',
    '  "implementationHints": ["给前端 agent 的还原建议"]',
    "}",
    "要求：看不清的字段写 unknown 或省略；不要编造具体像素；优先表达结构、控件、对齐、视觉 token 和可执行实现提示。",
  ].join("\n");
}

export function parseDesignInspectionDsl(summary: string, imageSize?: { width: number; height: number }): DesignInspectionDsl {
  const jsonText = extractJsonObject(summary);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as Partial<DesignInspectionDsl>;
      return normalizeDsl(parsed, summary, imageSize);
    } catch {
      // Fall through to a safe fallback DSL.
    }
  }

  return {
    schemaVersion: 1,
    summary: compactSummary(summary),
    screen: {
      kind: inferScreenKind(summary),
      language: inferLanguage(summary),
      canvas: imageSize,
    },
    regions: [],
    elements: [],
    visualTokens: {},
    implementationHints: [
      "视觉模型没有返回可解析 JSON DSL；请结合 rawSummary 人工提取结构后再改代码。",
    ],
    rawSummary: summary,
  };
}

function normalizeDsl(
  parsed: Partial<DesignInspectionDsl>,
  rawSummary: string,
  imageSize?: { width: number; height: number },
): DesignInspectionDsl {
  return {
    schemaVersion: 1,
    summary: typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : compactSummary(rawSummary),
    screen: {
      kind: typeof parsed.screen?.kind === "string" && parsed.screen.kind.trim()
        ? parsed.screen.kind.trim()
        : inferScreenKind(rawSummary),
      language: typeof parsed.screen?.language === "string" ? parsed.screen.language.trim() : inferLanguage(rawSummary),
      canvas: parsed.screen?.canvas ?? imageSize,
    },
    regions: Array.isArray(parsed.regions) ? parsed.regions.map(normalizeRegion).filter(isDesignRegion) : [],
    elements: Array.isArray(parsed.elements) ? parsed.elements.map(normalizeElement).filter(isDesignElement) : [],
    visualTokens: isRecord(parsed.visualTokens) ? parsed.visualTokens : {},
    implementationHints: Array.isArray(parsed.implementationHints)
      ? parsed.implementationHints.filter(isNonEmptyString).map((item) => item.trim())
      : [],
    rawSummary,
  };
}

function normalizeRegion(value: unknown): DesignInspectionDsl["regions"][number] | null {
  if (!isRecord(value)) return null;
  const id = stringOr(value.id, "region");
  return {
    id,
    role: stringOr(value.role, "unknown"),
    description: optionalString(value.description),
    alignment: optionalString(value.alignment),
    style: isRecord(value.style) ? value.style : undefined,
  };
}

function normalizeElement(value: unknown): DesignInspectionDsl["elements"][number] | null {
  if (!isRecord(value)) return null;
  return {
    id: stringOr(value.id, "element"),
    type: stringOr(value.type, "unknown"),
    text: optionalString(value.text),
    region: optionalString(value.region),
    priority: value.priority === "high" || value.priority === "medium" || value.priority === "low" ? value.priority : undefined,
    style: isRecord(value.style) ? value.style : undefined,
    implementationHints: Array.isArray(value.implementationHints)
      ? value.implementationHints.filter(isNonEmptyString).map((item) => item.trim())
      : undefined,
  };
}

function isDesignRegion(value: DesignInspectionDsl["regions"][number] | null): value is DesignInspectionDsl["regions"][number] {
  return value !== null;
}

function isDesignElement(value: DesignInspectionDsl["elements"][number] | null): value is DesignInspectionDsl["elements"][number] {
  return value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function extractJsonObject(value: string): string | null {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced?.startsWith("{") && fenced.endsWith("}")) {
    return fenced;
  }

  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  if (first < 0 || last <= first) {
    return null;
  }
  return value.slice(first, last + 1);
}

function compactSummary(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function inferScreenKind(value: string): string {
  if (/弹窗|模态|modal|dialog/i.test(value)) return "modal";
  if (/表格|列表|table|list/i.test(value)) return "page";
  if (/按钮|输入框|组件|component/i.test(value)) return "component";
  return "unknown";
}

function inferLanguage(value: string): string {
  if (/[\u4e00-\u9fff]/.test(value) && /[a-zA-Z]/.test(value)) return "mixed";
  if (/[\u4e00-\u9fff]/.test(value)) return "zh-CN";
  if (/[a-zA-Z]/.test(value)) return "en";
  return "unknown";
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
