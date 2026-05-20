export type DesignDiagramStructure = {
  kind: string;
  title?: string;
  nodes?: Array<{
    id: string;
    label: string;
    value?: string;
    role?: string;
    position?: string;
    style?: Record<string, unknown>;
  }>;
  links?: Array<{
    from: string;
    to: string;
    label?: string;
    value?: string;
    style?: Record<string, unknown>;
  }>;
  invariants?: string[];
};

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
  diagram?: DesignDiagramStructure;
  visualTokens?: {
    colors?: string[];
    spacing?: string[];
    typography?: string[];
  };
  implementationHints?: string[];
  rawSummary?: string;
};

export type DesignSemanticDiffDsl = {
  schemaVersion: 1;
  score: number;
  verdict: "pass" | "fail" | "unknown";
  summary: string;
  reference?: {
    kind?: string;
    texts?: string[];
    diagram?: DesignDiagramStructure;
  };
  candidate?: {
    kind?: string;
    texts?: string[];
    diagram?: DesignDiagramStructure;
  };
  issues: Array<{
    severity: "critical" | "high" | "medium" | "low";
    type: string;
    region?: string;
    target?: string;
    expected: string;
    actual: string;
    fix: string;
    cssHints?: string[];
    confidence?: number;
  }>;
  rawSummary?: string;
};

export function buildDesignInspectionPrompt(userPrompt?: string): string {
  const normalizedPrompt = userPrompt?.trim() || "Analyze this UI/product screenshot and extract implementation-grade visual structure.";
  return [
    normalizedPrompt,
    "",
    "Return only one JSON object. Do not return Markdown, code fences, or prose.",
    "JSON schema:",
    "{",
    '  "summary": "short Chinese summary within 100 chars",',
    '  "screen": { "kind": "modal|page|component|chart|diagram|unknown", "language": "zh-CN|en|mixed|unknown" },',
    '  "regions": [',
    '    { "id": "header", "role": "header|body|footer|sidebar|toolbar|content|chart-area|unknown", "description": "region description", "alignment": "position/alignment", "style": { "background": "", "radius": "", "padding": "" } }',
    "  ],",
    '  "elements": [',
    '    { "id": "primaryButton", "type": "button|input|text|icon|table|card|image|chart-node|chart-link|unknown", "text": "visible text", "region": "footer", "priority": "high|medium|low", "style": { "color": "", "size": "", "state": "" }, "implementationHints": ["implementation constraints"] }',
    "  ],",
    '  "diagram": {',
    '    "kind": "sankey|flowchart|bar|line|pie|table|unknown",',
    '    "title": "visible title if any",',
    '    "nodes": [{ "id": "n1", "label": "visible label", "value": "visible numeric value", "role": "source|stage|branch|sink|label", "position": "left|center|right|top|bottom", "style": { "color": "", "width": "", "height": "" } }],',
    '    "links": [{ "from": "n1", "to": "n2", "label": "visible link label", "value": "visible numeric value", "style": { "color": "", "thickness": "" } }],',
    '    "invariants": ["facts that must not change when implementing, especially node order, link topology, labels, and values"]',
    "  },",
    '  "visualTokens": { "colors": ["color/use"], "spacing": ["spacing pattern"], "typography": ["font size/weight pattern"] },',
    '  "implementationHints": ["front-end restoration advice"]',
    "}",
    "Requirements: if a field is unreadable, write unknown or omit it. Do not invent exact pixels. If this is a chart or diagram, diagram.nodes, diagram.links, visible labels, numeric values, and topology invariants are mandatory.",
  ].join("\n");
}

export function buildDesignSemanticDiffPrompt(userPrompt?: string): string {
  const normalizedPrompt = userPrompt?.trim() || "Compare reference image A with candidate image B for UI/design implementation parity.";
  return [
    normalizedPrompt,
    "",
    "You will receive two images: A is the reference design, B is the candidate implementation.",
    "Return only one JSON object. Do not return Markdown, code fences, or prose.",
    "Do not describe the page generally. Act as a visual evaluator: find mismatches and produce actionable patch constraints.",
    "For charts/diagrams, topology is more important than decoration. Extract nodes, links, labels, values, and ordering from both images.",
    "JSON schema:",
    "{",
    '  "score": 0,',
    '  "verdict": "pass|fail|unknown",',
    '  "summary": "one sentence Chinese verdict",',
    '  "reference": { "kind": "ui|sankey|flowchart|chart|unknown", "texts": ["visible text"], "diagram": { "kind": "sankey|flowchart|chart|unknown", "nodes": [], "links": [], "invariants": [] } },',
    '  "candidate": { "kind": "ui|sankey|flowchart|chart|unknown", "texts": ["visible text"], "diagram": { "kind": "sankey|flowchart|chart|unknown", "nodes": [], "links": [], "invariants": [] } },',
    '  "issues": [',
    '    { "severity": "critical|high|medium|low", "type": "topology|text|value|layout|spacing|color|font|component|missing|extra", "region": "left|center|right|top|bottom|whole", "target": "element/node/link name", "expected": "what A shows", "actual": "what B shows", "fix": "specific implementation change", "cssHints": ["CSS/property hints if applicable"], "confidence": 0.0 }',
    "  ]",
    "}",
    "Scoring: 100 means visually and semantically equivalent; 0 means unrelated. If chart nodes/links/labels/values differ, mark severity critical and verdict fail even if colors are similar.",
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
      "Vision model did not return parseable JSON DSL; extract structure manually before editing code.",
    ],
    rawSummary: summary,
  };
}

export function parseDesignSemanticDiffDsl(summary: string): DesignSemanticDiffDsl {
  const jsonText = extractJsonObject(summary);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as Partial<DesignSemanticDiffDsl>;
      return normalizeSemanticDiff(parsed, summary);
    } catch {
      // Fall through to a safe fallback DSL.
    }
  }

  return {
    schemaVersion: 1,
    score: 0,
    verdict: "unknown",
    summary: compactSummary(summary),
    issues: [{
      severity: "high",
      type: "unparsed",
      region: "whole",
      target: "semantic diff",
      expected: "structured JSON semantic diff",
      actual: "vision model returned unparseable text",
      fix: "rerun with a vision model that follows JSON output, or inspect rawSummary manually",
      confidence: 1,
    }],
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
    diagram: normalizeDiagram(parsed.diagram),
    visualTokens: isRecord(parsed.visualTokens) ? parsed.visualTokens : {},
    implementationHints: Array.isArray(parsed.implementationHints)
      ? parsed.implementationHints.filter(isNonEmptyString).map((item) => item.trim())
      : [],
    rawSummary,
  };
}

function normalizeSemanticDiff(parsed: Partial<DesignSemanticDiffDsl>, rawSummary: string): DesignSemanticDiffDsl {
  return {
    schemaVersion: 1,
    score: clampNumber(parsed.score, 0, 100, 0),
    verdict: parsed.verdict === "pass" || parsed.verdict === "fail" || parsed.verdict === "unknown"
      ? parsed.verdict
      : "unknown",
    summary: typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : compactSummary(rawSummary),
    reference: normalizeSemanticSide(parsed.reference),
    candidate: normalizeSemanticSide(parsed.candidate),
    issues: Array.isArray(parsed.issues)
      ? parsed.issues.map(normalizeSemanticIssue).filter(isSemanticIssue)
      : [],
    rawSummary,
  };
}

function normalizeSemanticSide(value: unknown): DesignSemanticDiffDsl["reference"] | undefined {
  if (!isRecord(value)) return undefined;
  return {
    kind: optionalString(value.kind),
    texts: Array.isArray(value.texts) ? value.texts.filter(isNonEmptyString).map((item) => item.trim()) : undefined,
    diagram: normalizeDiagram(value.diagram),
  };
}

function normalizeSemanticIssue(value: unknown): DesignSemanticDiffDsl["issues"][number] | null {
  if (!isRecord(value)) return null;
  return {
    severity: value.severity === "critical" || value.severity === "high" || value.severity === "medium" || value.severity === "low"
      ? value.severity
      : "medium",
    type: stringOr(value.type, "unknown"),
    region: optionalString(value.region),
    target: optionalString(value.target),
    expected: stringOr(value.expected, "unknown"),
    actual: stringOr(value.actual, "unknown"),
    fix: stringOr(value.fix, "inspect and patch this mismatch"),
    cssHints: Array.isArray(value.cssHints) ? value.cssHints.filter(isNonEmptyString).map((item) => item.trim()) : undefined,
    confidence: typeof value.confidence === "number" ? clampNumber(value.confidence, 0, 1, value.confidence) : undefined,
  };
}

function isSemanticIssue(value: DesignSemanticDiffDsl["issues"][number] | null): value is DesignSemanticDiffDsl["issues"][number] {
  return value !== null;
}

function normalizeDiagram(value: unknown): DesignDiagramStructure | undefined {
  if (!isRecord(value)) return undefined;
  return {
    kind: stringOr(value.kind, "unknown"),
    title: optionalString(value.title),
    nodes: Array.isArray(value.nodes) ? value.nodes.map(normalizeDiagramNode).filter(isDiagramNode) : undefined,
    links: Array.isArray(value.links) ? value.links.map(normalizeDiagramLink).filter(isDiagramLink) : undefined,
    invariants: Array.isArray(value.invariants) ? value.invariants.filter(isNonEmptyString).map((item) => item.trim()) : undefined,
  };
}

function normalizeDiagramNode(value: unknown): NonNullable<DesignDiagramStructure["nodes"]>[number] | null {
  if (!isRecord(value)) return null;
  return {
    id: stringOr(value.id, stringOr(value.label, "node")),
    label: stringOr(value.label, stringOr(value.id, "unknown")),
    value: optionalString(value.value),
    role: optionalString(value.role),
    position: optionalString(value.position),
    style: isRecord(value.style) ? value.style : undefined,
  };
}

function normalizeDiagramLink(value: unknown): NonNullable<DesignDiagramStructure["links"]>[number] | null {
  if (!isRecord(value)) return null;
  return {
    from: stringOr(value.from, "unknown"),
    to: stringOr(value.to, "unknown"),
    label: optionalString(value.label),
    value: optionalString(value.value),
    style: isRecord(value.style) ? value.style : undefined,
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

function isDiagramNode(value: NonNullable<DesignDiagramStructure["nodes"]>[number] | null): value is NonNullable<DesignDiagramStructure["nodes"]>[number] {
  return value !== null;
}

function isDiagramLink(value: NonNullable<DesignDiagramStructure["links"]>[number] | null): value is NonNullable<DesignDiagramStructure["links"]>[number] {
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
  if (/modal|dialog|弹窗/i.test(value)) return "modal";
  if (/sankey|chart|diagram|图表|桑基/i.test(value)) return "chart";
  if (/table|list|表格|列表/i.test(value)) return "page";
  if (/button|input|component|按钮|输入框|组件/i.test(value)) return "component";
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

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
