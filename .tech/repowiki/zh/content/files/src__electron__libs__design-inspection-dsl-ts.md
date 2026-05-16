# src/electron/libs/design-inspection-dsl.ts

> 模块：`electron` · 语言：`typescript` · 行数：195

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildDesignInspectionPrompt@33`
- `parseDesignInspectionDsl@56`
- `normalizeDsl@85`
- `normalizeRegion@112`
- `normalizeElement@124`
- `isDesignRegion@139`
- `isDesignElement@143`
- `isNonEmptyString@147`
- `extractJsonObject@151`
- `compactSummary@165`
- `inferScreenKind@169`
- `inferLanguage@176`
- `stringOr@183`
- `optionalString@187`
- `isRecord@191`
- `normalizedPrompt@35`
- `jsonText@58`
- `parsed@61`
- `id@115`
- `fenced@153`
- `first@157`
- `last@159`
- `DesignInspectionDsl@1`

## 对外暴露

- `DesignInspectionDsl`
- `buildDesignInspectionPrompt`
- `parseDesignInspectionDsl`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
    style: isRecord(value.style) ? value.
... (truncated)
```
