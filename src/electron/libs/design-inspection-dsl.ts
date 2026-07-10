export type DesignSystemPalette = {
  primary?: string;
  secondary?: string;
  accent?: string;
  success?: string;
  warning?: string;
  danger?: string;
  info?: string;
  backgrounds?: Array<{ name: string; value: string; usage: string }>;
  text?: Array<{ name: string; value: string; usage: string }>;
  borders?: Array<{ name: string; value: string; usage: string }>;
  semantic?: Record<string, string>;
};

export type DesignSystemTypography = {
  fontFamilies?: string[];
  textStyles?: Array<{
    name: string;
    fontSize: string;
    fontWeight: string;
    lineHeight?: string;
    letterSpacing?: string;
    usage: string;
  }>;
};

export type DesignSystemSpacing = {
  scale?: string;
  patterns?: Array<{ name: string; value: string; usage: string }>;
};

export type DesignSystemComponents = {
  buttons?: Array<{ variant: string; style: Record<string, unknown>; states?: Record<string, unknown> }>;
  cards?: Array<{ description: string; style: Record<string, unknown> }>;
  inputs?: Array<{ description: string; style: Record<string, unknown> }>;
  icons?: Array<{ description: string; type: string; style: Record<string, unknown> }>;
  tables?: Array<{ description: string; style: Record<string, unknown> }>;
  dialogs?: Array<{ description: string; style: Record<string, unknown> }>;
};

export type DesignSystemAnimation = {
  durations?: string[];
  easing?: string[];
};

export type DesignSystemDarkMode = {
  supported: boolean;
  changes?: Array<{ token: string; light: string; dark: string }>;
};

export type DesignExtractedSystem = {
  colors?: DesignSystemPalette;
  typography?: DesignSystemTypography;
  spacing?: DesignSystemSpacing;
  components?: DesignSystemComponents;
  animation?: DesignSystemAnimation;
  darkMode?: DesignSystemDarkMode;
};

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

export type DesignVisualBounds = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  unit?: "px" | "%" | "unknown";
  confidence?: number;
};

export type DesignVisualConstraint = {
  target?: string;
  category?: "geometry" | "spacing" | "alignment" | "typography" | "color" | "state" | "content" | "asset" | "interaction" | "unknown";
  property?: string;
  expected: string;
  measurement?: string;
  confidence?: number;
};

export type DesignInspectionUiSpec = {
  container?: {
    kind?: string;
    bounds?: DesignVisualBounds;
    position?: string;
  };
  tabs?: Array<{
    text: string;
    active?: boolean;
    bounds?: DesignVisualBounds;
    visualState?: string;
  }>;
  sections?: Array<{
    title: string;
    bounds?: DesignVisualBounds;
    collapsible?: boolean;
    visualState?: string;
  }>;
  fields?: Array<{
    label: string;
    value?: string;
    controlType?: "display" | "input" | "textarea" | "select" | "tag" | "icon" | "unknown";
    editable?: boolean;
    section?: string;
    layout?: string;
    bounds?: DesignVisualBounds;
  }>;
  actions?: Array<{
    text: string;
    role?: "primary" | "secondary" | "danger" | "icon" | "unknown";
    bounds?: DesignVisualBounds;
  }>;
  visualConstraints?: DesignVisualConstraint[];
  invariants?: string[];
};

export type DesignInspectionQualityGate = {
  confidence: number;
  missingDetails: string[];
  needsStrongerVisionModel: boolean;
  nextStep: string;
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
  designSystem?: DesignExtractedSystem;
  uiSpec?: DesignInspectionUiSpec;
  qualityGate: DesignInspectionQualityGate;
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
  const normalizedPrompt = userPrompt?.trim() || "Analyze this UI/product screenshot and extract implementation-grade visual structure and design system.";
  return [
    normalizedPrompt,
    "",
    "You are a design system extraction engine. Given one or more UI screenshots, extract a complete design system that an engineer can use to faithfully re-implement the design.",
    "",
    "Return only one JSON object. Do not return Markdown, code fences, or prose.",
    "",
    "=== EXTRACTION PRIORITIES ===",
    "1. DESIGN SYSTEM (designSystem) — extract the reusable visual design language first",
    "2. UI STRUCTURE (uiSpec) — component layout, containers, tabs, fields, actions",
    "3. LAYOUT (regions/elements) — page regions and key elements",
    "4. DIAGRAMS (diagram) — if this is a chart/diagram, extract topology",
    "",
    "JSON schema:",
    "{",
    '  "summary": "short Chinese summary within 100 chars",',
    '  "screen": { "kind": "modal|page|component|chart|diagram|unknown", "language": "zh-CN|en|mixed|unknown" },',
    "",
    '  "designSystem": {',
    '    "colors": {',
    '      "primary": "#hex primary brand color",',
    '      "secondary": "#hex secondary if visible",',
    '      "accent": "#hex accent/cta color",',
    '      "success": "#hex if visible",',
    '      "warning": "#hex if visible",',
    '      "danger": "#hex if visible",',
    '      "info": "#hex if visible",',
    '      "backgrounds": [{"name": "page|card|sidebar|input|modal|table-row", "value": "#hex", "usage": "where this background is used"}],',
    '      "text": [{"name": "primary|secondary|muted|link|heading|body|caption|placeholder|disabled", "value": "#hex", "usage": "where this text color is used"}],',
    '      "borders": [{"name": "input|card|divider|table|focus", "value": "#hex", "usage": "where this border is used"}],',
    '      "semantic": { "error": "#hex", "success": "#hex", "warning": "#hex", "info": "#hex" }',
    "    },",
    '    "typography": {',
    '      "fontFamilies": ["font name(s) visible in the UI"],',
    '      "textStyles": [',
    '        { "name": "h1|h2|h3|heading|body|body-small|caption|label|button|input|tag|helper|tooltip|badge", "fontSize": "px/rem", "fontWeight": "400|500|600|700|bold|normal", "lineHeight": "optional", "letterSpacing": "optional", "usage": "where this style is applied" }',
    "      ]",
    "    },",
    '    "spacing": {',
    '      "scale": "4px grid | 8px grid | inconsistent",',
    '      "patterns": [{"name": "card-padding|section-gap|input-padding|list-gap|button-padding|page-margin|icon-gap", "value": "px", "usage": "where this spacing appears"}]',
    "    },",
    '    "components": {',
    '      "buttons": [{"variant": "primary|secondary|ghost|danger|icon|link", "style": {"background": "#hex", "color": "#hex", "borderRadius": "px", "padding": "px", "fontSize": "px", "fontWeight": ""}, "states": {"hover": {}, "active": {}, "disabled": {}}}],',
    '      "cards": [{"description": "eg card container", "style": {"background": "#hex", "borderRadius": "px", "padding": "px", "boxShadow": ""}}],',
    '      "inputs": [{"description": "text input / select / textarea", "style": {"background": "#hex", "border": "#hex", "borderRadius": "px", "padding": "px", "fontSize": "px", "height": "px"}}],',
    '      "tables": [{"description": "table/list style", "style": {"headerBackground": "#hex", "rowStripe": "#hex", "border": "#hex", "fontSize": "px"}}],',
    '      "dialogs": [{"description": "modal/drawer/tooltip", "style": {"background": "#hex", "borderRadius": "px", "boxShadow": "", "padding": "px", "overlay": "#hex"}}]',
    "    },",
    '    "animation": { "durations": ["ms values seen"], "easing": ["easing names or cubic-bezier"] },',
    '    "darkMode": { "supported": false, "changes": [{"token": "background-primary", "light": "#hex", "dark": "#hex" if visible}] }',
    "  },",
    "",
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
    '  "uiSpec": {',
    '    "container": { "kind": "drawer|modal|page|card|chart|unknown", "bounds": { "x": 0, "y": 0, "width": 0, "height": 0, "unit": "px|%|unknown", "confidence": 0.0 }, "position": "right|center|full|unknown" },',
    '    "tabs": [{ "text": "visible tab text", "active": true, "bounds": { "x": 0, "y": 0, "width": 0, "height": 0, "unit": "px|%|unknown", "confidence": 0.0 }, "visualState": "active|inactive|disabled|unknown" }],',
    '    "sections": [{ "title": "visible section title", "bounds": { "x": 0, "y": 0, "width": 0, "height": 0, "unit": "px|%|unknown", "confidence": 0.0 }, "collapsible": false, "visualState": "expanded|collapsed|unknown" }],',
    '    "fields": [{ "label": "visible field label", "value": "visible value or unknown", "controlType": "display|input|textarea|select|tag|icon|unknown", "editable": false, "section": "section title", "layout": "label-left/value-right|stacked|grid|unknown", "bounds": { "x": 0, "y": 0, "width": 0, "height": 0, "unit": "px|%|unknown", "confidence": 0.0 } }],',
    '    "actions": [{ "text": "button/icon text", "role": "primary|secondary|danger|icon|unknown", "bounds": { "x": 0, "y": 0, "width": 0, "height": 0, "unit": "px|%|unknown", "confidence": 0.0 } }],',
    '    "visualConstraints": [{ "target": "component or element name", "category": "geometry|spacing|alignment|typography|color|state|content|asset|interaction|unknown", "property": "width|x|gap|fontSize|color|state|emptyRendering", "expected": "measurable visual rule from the image", "measurement": "px/color/token/text/state if visible", "confidence": 0.0 }],',
    '    "invariants": ["visual facts that implementation must preserve before wiring API logic; include any UI that must not be simplified away"]',
    "  },",
    '  "qualityGate": { "confidence": 0.0, "missingDetails": ["missing field list|missing geometry|missing active tab state"], "needsStrongerVisionModel": false, "nextStep": "use this spec|rerun with stronger vision model or crop region" },',
    '  "implementationHints": ["front-end restoration advice"]',
    "}",
    "",
    "=== DESIGN SYSTEM EXTRACTION RULES ===",
    "1. Colors: Extract hex values precisely. Name each background/text/border by its UI role, not just 'color1'/'color2'. Include hover/active/disabled states if visible.",
    "2. Typography: Group font sizes into a type scale hierarchy. Note which sizes are used for headings, body, captions, labels, buttons, inputs.",
    "3. Spacing: Infer the grid system (4px/8px) from element padding and gaps. List patterns like card-padding=24px, section-gap=32px, input-padding=12px.",
    "4. Components: For each component type (button/card/input/table/dialog), document its visible style properties. Include variant differences and state changes if shown.",
    "5. Animation/Dark mode: Only include if visible in the screenshots. Do not invent.",
    "",
    "=== GENERAL RULES ===",
    "If a field is unreadable, write unknown or omit it. Do not invent exact pixels; estimated bounds are allowed only with confidence. If this is a chart or diagram, diagram.nodes, diagram.links, visible labels, numeric values, and topology invariants are mandatory.",
    "UI restoration rule: preserve visual structure before API/data logic. Do not simplify a UI into only the fields implied by an API payload. If the screenshot shows sections, rows, cards, table cells, tags, icons, active tab state, empty state, or other component states, include them in uiSpec, visualConstraints, and invariants.",
    "Generic component rule: do not encode a domain-specific component concept unless it is visible in the image. Extract reusable visual constraints that apply to any child component: geometry, spacing, alignment, typography, color, state/content variants, assets, and interactions.",
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

export function buildDesignSystemExtractionPrompt(userPrompt?: string): string {
  const normalizedPrompt = userPrompt?.trim() || "Extract the complete design system from this UI screenshot.";
  return [
    normalizedPrompt,
    "",
    "You are a design system extraction engine. Given one or more UI screenshots, extract ONLY the reusable design tokens and component patterns — not the page layout.",
    "",
    "Return only one JSON object. Do not return Markdown, code fences, or prose.",
    "",
    "JSON schema:",
    "{",
    '  "summary": "short Chinese summary within 100 chars",',
    '  "colors": {',
    '    "primary": "#hex",',
    '    "secondary": "#hex",',
    '    "accent": "#hex",',
    '    "success": "#hex if visible",',
    '    "warning": "#hex if visible",',
    '    "danger": "#hex if visible",',
    '    "info": "#hex if visible",',
    '    "backgrounds": [{"name": "page|card|sidebar|input|modal|table-row|tag", "value": "#hex", "usage": "where used"}],',
    '    "text": [{"name": "primary|secondary|muted|link|heading|body|caption|placeholder|disabled|on-primary", "value": "#hex", "usage": "where used"}],',
    '    "borders": [{"name": "input|card|divider|table|focus|selected", "value": "#hex", "usage": "where used"}],',
    '    "semantic": { "error": "#hex", "success": "#hex", "warning": "#hex", "info": "#hex" }',
    "  },",
    '  "typography": {',
    '    "fontFamilies": ["family names used"],',
    '    "textStyles": [',
    '      { "name": "h1|h2|h3|heading|body|body-small|caption|label|button|input|tag|helper|tooltip|badge|code", "fontSize": "px/rem", "fontWeight": "400|500|600|700", "lineHeight": "optional", "letterSpacing": "optional", "usage": "where applied" }',
    "    ]",
    "  },",
    '  "spacing": {',
    '    "scale": "4px grid | 8px grid | inconsistent",',
    '    "patterns": [{"name": "card-padding|section-gap|input-padding|list-gap|button-padding|page-margin|icon-gap", "value": "px", "usage": "where used"}]',
    "  },",
    '  "components": {',
    '    "buttons": [{"variant": "primary|secondary|ghost|danger|icon|link", "style": {"background": "#hex", "color": "#hex", "borderRadius": "px", "padding": "px", "fontSize": "px", "fontWeight": ""}, "states": {"hover": {}, "active": {}, "disabled": {}}}],',
    '    "cards": [{"description": "card style", "style": {"background": "#hex", "borderRadius": "px", "padding": "px", "boxShadow": ""}}],',
    '    "inputs": [{"description": "input style", "style": {"background": "#hex", "border": "#hex", "borderRadius": "px", "padding": "px", "fontSize": "px"}}],',
    '    "tables": [{"description": "table style", "style": {"headerBackground": "#hex", "rowStripe": "#hex", "border": "#hex", "fontSize": "px"}}],',
    '    "dialogs": [{"description": "modal/drawer/tooltip", "style": {"background": "#hex", "borderRadius": "px", "padding": "px", "overlay": "#hex"}}],',
    '    "icons": [{"description": "icon type", "style": {"size": "px", "color": "#hex"}}]',
    "  },",
    '  "animation": { "durations": ["ms values seen"], "easing": ["easing names"] },',
    '  "darkMode": { "supported": false, "changes": [{"token": "background-primary", "light": "#hex", "dark": "#hex"}] }',
    "}",
    "",
    "RULES:",
    "- Extract hex values precisely. Name each color by UI role, not 'color1'/'color2'.",
    "- Group font sizes into a type scale hierarchy (h1→body→caption). Note usage context.",
    "- Infer grid system from padding/gaps. 4px grid is the web default; note if 8px or custom.",
    "- For components, include hover/active/disabled states only if visible in the screenshots.",
    "- For dark mode / animation: only include if visible. Do not invent.",
    "- If a field is unreadable, write 'unknown' or omit it. Do not hallucinate values.",
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
    uiSpec: undefined,
    qualityGate: {
      confidence: 0,
      missingDetails: ["parseable JSON DSL", "uiSpec"],
      needsStrongerVisionModel: true,
      nextStep: "Rerun design_inspect_image with a stronger vision model or crop the target UI region before implementing.",
    },
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
  const regions = Array.isArray(parsed.regions) ? parsed.regions.map(normalizeRegion).filter(isDesignRegion) : [];
  const elements = Array.isArray(parsed.elements) ? parsed.elements.map(normalizeElement).filter(isDesignElement) : [];
  const uiSpec = normalizeUiSpec(parsed.uiSpec);
  const qualityGate = normalizeInspectionQualityGate(parsed.qualityGate, rawSummary, regions, elements, uiSpec);

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
    regions,
    elements,
    diagram: normalizeDiagram(parsed.diagram),
    visualTokens: isRecord(parsed.visualTokens) ? parsed.visualTokens : {},
    designSystem: normalizeDesignSystem(parsed.designSystem),
    uiSpec,
    qualityGate,
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

function normalizeDesignSystem(value: unknown): DesignExtractedSystem | undefined {
  if (!isRecord(value)) return undefined;
  const colors = normalizeDesignColors(value.colors);
  const typography = normalizeDesignTypography(value.typography);
  const spacing = normalizeDesignSpacing(value.spacing);
  const components = normalizeDesignComponents(value.components);
  const animation = normalizeDesignAnimation(value.animation);
  const darkMode = normalizeDesignDarkMode(value.darkMode);
  const ds: DesignExtractedSystem = {};
  if (colors) ds.colors = colors;
  if (typography) ds.typography = typography;
  if (spacing) ds.spacing = spacing;
  if (components) ds.components = components;
  if (animation) ds.animation = animation;
  if (darkMode) ds.darkMode = darkMode;
  return Object.keys(ds).length > 0 ? ds : undefined;
}

function normalizeDesignColors(value: unknown): DesignSystemPalette | undefined {
  if (!isRecord(value)) return undefined;
  const palette: DesignSystemPalette = {};
  const hexProps = ["primary", "secondary", "accent", "success", "warning", "danger", "info"] as const;
  for (const prop of hexProps) {
    if (typeof value[prop] === "string" && value[prop].trim()) palette[prop] = value[prop].trim();
  }
  if (Array.isArray(value.backgrounds)) palette.backgrounds = value.backgrounds.filter(isRecord).map((b: Record<string, unknown>) => ({
    name: stringOr(b.name, "bg"),
    value: stringOr(b.value, "#unknown"),
    usage: stringOr(b.usage, "unknown"),
  }));
  if (Array.isArray(value.text)) palette.text = value.text.filter(isRecord).map((t: Record<string, unknown>) => ({
    name: stringOr(t.name, "text"),
    value: stringOr(t.value, "#unknown"),
    usage: stringOr(t.usage, "unknown"),
  }));
  if (Array.isArray(value.borders)) palette.borders = value.borders.filter(isRecord).map((b: Record<string, unknown>) => ({
    name: stringOr(b.name, "border"),
    value: stringOr(b.value, "#unknown"),
    usage: stringOr(b.usage, "unknown"),
  }));
  if (isRecord(value.semantic)) {
    const sem: Record<string, string> = {};
    for (const [k, v] of Object.entries(value.semantic)) {
      if (typeof v === "string" && v.trim()) sem[k] = v.trim();
    }
    if (Object.keys(sem).length > 0) palette.semantic = sem;
  }
  return Object.keys(palette).length > 0 ? palette : undefined;
}

function normalizeDesignTypography(value: unknown): DesignSystemTypography | undefined {
  if (!isRecord(value)) return undefined;
  const typography: DesignSystemTypography = {};
  if (Array.isArray(value.fontFamilies)) {
    typography.fontFamilies = value.fontFamilies.filter(isNonEmptyString).map((f: string) => f.trim());
  }
  if (Array.isArray(value.textStyles)) {
    typography.textStyles = value.textStyles.filter(isRecord).map((s: Record<string, unknown>) => ({
      name: stringOr(s.name, "text-style"),
      fontSize: stringOr(s.fontSize, "unknown"),
      fontWeight: stringOr(s.fontWeight, "400"),
      lineHeight: optionalString(s.lineHeight),
      letterSpacing: optionalString(s.letterSpacing),
      usage: stringOr(s.usage, "unknown"),
    }));
  }
  return typography.fontFamilies?.length || typography.textStyles?.length ? typography : undefined;
}

function normalizeDesignSpacing(value: unknown): DesignSystemSpacing | undefined {
  if (!isRecord(value)) return undefined;
  const spacing: DesignSystemSpacing = {};
  if (typeof value.scale === "string" && value.scale.trim()) spacing.scale = value.scale.trim();
  if (Array.isArray(value.patterns)) {
    spacing.patterns = value.patterns.filter(isRecord).map((p: Record<string, unknown>) => ({
      name: stringOr(p.name, "spacing"),
      value: stringOr(p.value, "unknown"),
      usage: stringOr(p.usage, "unknown"),
    }));
  }
  return spacing.scale || spacing.patterns?.length ? spacing : undefined;
}

function normalizeDesignComponents(value: unknown): DesignSystemComponents | undefined {
  if (!isRecord(value)) return undefined;
  const comps: DesignSystemComponents = {};
  if (Array.isArray(value.buttons)) {
    comps.buttons = value.buttons.filter(isRecord).map((b: Record<string, unknown>) => ({
      variant: stringOr(b.variant, "default"),
      style: isRecord(b.style) ? b.style : {},
      states: isRecord(b.states) ? b.states : undefined,
    }));
  }
  if (Array.isArray(value.cards)) {
    comps.cards = value.cards.filter(isRecord).map((c: Record<string, unknown>) => ({
      description: stringOr(c.description, "card"),
      style: isRecord(c.style) ? c.style : {},
    }));
  }
  if (Array.isArray(value.inputs)) {
    comps.inputs = value.inputs.filter(isRecord).map((i: Record<string, unknown>) => ({
      description: stringOr(i.description, "input"),
      style: isRecord(i.style) ? i.style : {},
    }));
  }
  if (Array.isArray(value.tables)) {
    comps.tables = value.tables.filter(isRecord).map((t: Record<string, unknown>) => ({
      description: stringOr(t.description, "table"),
      style: isRecord(t.style) ? t.style : {},
    }));
  }
  if (Array.isArray(value.dialogs)) {
    comps.dialogs = value.dialogs.filter(isRecord).map((d: Record<string, unknown>) => ({
      description: stringOr(d.description, "dialog"),
      style: isRecord(d.style) ? d.style : {},
    }));
  }
  return comps.buttons?.length || comps.cards?.length || comps.inputs?.length || comps.tables?.length || comps.dialogs?.length
    ? comps
    : undefined;
}

function normalizeDesignAnimation(value: unknown): DesignSystemAnimation | undefined {
  if (!isRecord(value)) return undefined;
  const anim: DesignSystemAnimation = {};
  if (Array.isArray(value.durations)) anim.durations = value.durations.filter(isNonEmptyString).map((d: string) => d.trim());
  if (Array.isArray(value.easing)) anim.easing = value.easing.filter(isNonEmptyString).map((e: string) => e.trim());
  return anim.durations?.length || anim.easing?.length ? anim : undefined;
}

function normalizeDesignDarkMode(value: unknown): DesignSystemDarkMode | undefined {
  if (!isRecord(value)) return undefined;
  const dm: DesignSystemDarkMode = { supported: value.supported === true };
  if (Array.isArray(value.changes)) {
    dm.changes = value.changes.filter(isRecord).map((c: Record<string, unknown>) => ({
      token: stringOr(c.token, "token"),
      light: stringOr(c.light, "unknown"),
      dark: stringOr(c.dark, "unknown"),
    }));
  }
  return dm.supported || dm.changes?.length ? dm : undefined;
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

function normalizeBounds(value: unknown): DesignVisualBounds | undefined {
  if (!isRecord(value)) return undefined;
  const bounds: DesignVisualBounds = {};
  if (typeof value.x === "number" && Number.isFinite(value.x)) bounds.x = value.x;
  if (typeof value.y === "number" && Number.isFinite(value.y)) bounds.y = value.y;
  if (typeof value.width === "number" && Number.isFinite(value.width) && value.width >= 0) bounds.width = value.width;
  if (typeof value.height === "number" && Number.isFinite(value.height) && value.height >= 0) bounds.height = value.height;
  bounds.unit = value.unit === "px" || value.unit === "%" || value.unit === "unknown" ? value.unit : undefined;
  if (typeof value.confidence === "number" && Number.isFinite(value.confidence)) {
    bounds.confidence = clampNumber(value.confidence, 0, 1, value.confidence);
  }
  return Object.keys(bounds).length > 0 ? bounds : undefined;
}

function normalizeUiSpec(value: unknown): DesignInspectionUiSpec | undefined {
  if (!isRecord(value)) return undefined;
  const container = isRecord(value.container)
    ? {
        kind: optionalString(value.container.kind),
        bounds: normalizeBounds(value.container.bounds),
        position: optionalString(value.container.position),
      }
    : undefined;
  const tabs = Array.isArray(value.tabs)
    ? value.tabs.map(normalizeUiTab).filter(isNonNull)
    : undefined;
  const sections = Array.isArray(value.sections)
    ? value.sections.map(normalizeUiSection).filter(isNonNull)
    : undefined;
  const fields = Array.isArray(value.fields)
    ? value.fields.map(normalizeUiField).filter(isNonNull)
    : undefined;
  const actions = Array.isArray(value.actions)
    ? value.actions.map(normalizeUiAction).filter(isNonNull)
    : undefined;
  const visualConstraints = Array.isArray(value.visualConstraints)
    ? value.visualConstraints.map(normalizeVisualConstraint).filter(isNonNull)
    : undefined;
  const invariants = Array.isArray(value.invariants)
    ? value.invariants.filter(isNonEmptyString).map((item) => item.trim())
    : undefined;

  const spec: DesignInspectionUiSpec = {};
  if (container && (container.kind || container.bounds || container.position)) spec.container = container;
  if (tabs?.length) spec.tabs = tabs;
  if (sections?.length) spec.sections = sections;
  if (fields?.length) spec.fields = fields;
  if (actions?.length) spec.actions = actions;
  if (visualConstraints?.length) spec.visualConstraints = visualConstraints;
  if (invariants?.length) spec.invariants = invariants;
  return Object.keys(spec).length > 0 ? spec : undefined;
}

function normalizeUiTab(value: unknown): NonNullable<DesignInspectionUiSpec["tabs"]>[number] | null {
  if (!isRecord(value)) return null;
  const text = optionalString(value.text);
  if (!text) return null;
  return {
    text,
    active: typeof value.active === "boolean" ? value.active : undefined,
    bounds: normalizeBounds(value.bounds),
    visualState: optionalString(value.visualState),
  };
}

function normalizeUiSection(value: unknown): NonNullable<DesignInspectionUiSpec["sections"]>[number] | null {
  if (!isRecord(value)) return null;
  const title = optionalString(value.title);
  if (!title) return null;
  return {
    title,
    bounds: normalizeBounds(value.bounds),
    collapsible: typeof value.collapsible === "boolean" ? value.collapsible : undefined,
    visualState: optionalString(value.visualState),
  };
}

function normalizeUiField(value: unknown): NonNullable<DesignInspectionUiSpec["fields"]>[number] | null {
  if (!isRecord(value)) return null;
  const label = optionalString(value.label);
  if (!label) return null;
  const controlType = value.controlType === "display"
    || value.controlType === "input"
    || value.controlType === "textarea"
    || value.controlType === "select"
    || value.controlType === "tag"
    || value.controlType === "icon"
    || value.controlType === "unknown"
    ? value.controlType
    : undefined;
  return {
    label,
    value: optionalString(value.value),
    controlType,
    editable: typeof value.editable === "boolean" ? value.editable : undefined,
    section: optionalString(value.section),
    layout: optionalString(value.layout),
    bounds: normalizeBounds(value.bounds),
  };
}

function normalizeUiAction(value: unknown): NonNullable<DesignInspectionUiSpec["actions"]>[number] | null {
  if (!isRecord(value)) return null;
  const text = optionalString(value.text);
  if (!text) return null;
  const role = value.role === "primary"
    || value.role === "secondary"
    || value.role === "danger"
    || value.role === "icon"
    || value.role === "unknown"
    ? value.role
    : undefined;
  return {
    text,
    role,
    bounds: normalizeBounds(value.bounds),
  };
}

function normalizeVisualConstraint(value: unknown): DesignVisualConstraint | null {
  if (!isRecord(value)) return null;
  const expected = optionalString(value.expected);
  if (!expected) return null;
  const category = value.category === "geometry"
    || value.category === "spacing"
    || value.category === "alignment"
    || value.category === "typography"
    || value.category === "color"
    || value.category === "state"
    || value.category === "content"
    || value.category === "asset"
    || value.category === "interaction"
    || value.category === "unknown"
    ? value.category
    : undefined;
  return {
    target: optionalString(value.target),
    category,
    property: optionalString(value.property),
    expected,
    measurement: optionalString(value.measurement),
    confidence: typeof value.confidence === "number" ? clampNumber(value.confidence, 0, 1, value.confidence) : undefined,
  };
}

function normalizeInspectionQualityGate(
  value: unknown,
  rawSummary: string,
  regions: DesignInspectionDsl["regions"],
  elements: DesignInspectionDsl["elements"],
  uiSpec?: DesignInspectionUiSpec,
): DesignInspectionQualityGate {
  const source = isRecord(value) ? value : {};
  const missingDetails = new Set<string>();
  if (Array.isArray(source.missingDetails)) {
    for (const item of source.missingDetails) {
      if (isNonEmptyString(item)) missingDetails.add(item.trim());
    }
  }

  if (!uiSpec) missingDetails.add("uiSpec");
  if (!uiSpec?.container?.bounds && !regions.some((region) => region.style && ("bounds" in region.style || "width" in region.style || "height" in region.style))) {
    missingDetails.add("container geometry");
  }
  if (!uiSpec?.fields?.length && !elements.some((element) => /field|input|textarea|select|tag|form/i.test(element.type))) {
    missingDetails.add("field list");
  }
  if (/tab|tabs|标签|Tab/.test(rawSummary) && !uiSpec?.tabs?.length) {
    missingDetails.add("tab states");
  }
  if (!uiSpec?.invariants?.length) {
    missingDetails.add("visual invariants");
  }
  if (!uiSpec?.visualConstraints?.length) {
    missingDetails.add("measurable visual constraints");
  }

  const explicitConfidence = typeof source.confidence === "number"
    ? clampNumber(source.confidence, 0, 1, source.confidence)
    : undefined;
  const inferredConfidence = inferInspectionConfidence(missingDetails.size, regions, elements, uiSpec);
  const confidence = explicitConfidence ?? inferredConfidence;
  const needsStrongerVisionModel = typeof source.needsStrongerVisionModel === "boolean"
    ? source.needsStrongerVisionModel || confidence < 0.65 || missingDetails.size >= 3
    : confidence < 0.65 || missingDetails.size >= 3;

  return {
    confidence,
    missingDetails: Array.from(missingDetails),
    needsStrongerVisionModel,
    nextStep: optionalString(source.nextStep)
      ?? (needsStrongerVisionModel
        ? "Rerun with a stronger vision model, export a higher-resolution PNG, or crop the exact target region before implementing."
        : "Use uiSpec as the implementation contract before wiring API/data logic."),
  };
}

function inferInspectionConfidence(
  missingDetailCount: number,
  regions: DesignInspectionDsl["regions"],
  elements: DesignInspectionDsl["elements"],
  uiSpec?: DesignInspectionUiSpec,
): number {
  let score = 0.35;
  if (regions.length >= 3) score += 0.15;
  if (elements.length >= 5) score += 0.15;
  if (uiSpec?.container) score += 0.1;
  if (uiSpec?.fields?.length) score += 0.15;
  if (uiSpec?.tabs?.length || uiSpec?.sections?.length) score += 0.1;
  if (uiSpec?.visualConstraints?.length) score += 0.1;
  score -= Math.min(0.35, missingDetailCount * 0.07);
  return clampNumber(score, 0, 1, score);
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
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
