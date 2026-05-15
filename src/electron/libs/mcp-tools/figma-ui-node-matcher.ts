import type { FigmaNodeIndexEntry } from "./figma-node-index.js";

type Bounds = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type FigmaUiMatchNode = {
  ref?: string;
  index?: number;
  tagName?: string;
  role?: string;
  name?: string;
  text?: string;
  ariaLabel?: string;
  value?: string;
  placeholder?: string;
  title?: string;
  selector?: string;
  path?: string;
  xpath?: string;
  attributes?: Record<string, unknown>;
  boundingBox?: Bounds;
  box?: Bounds;
  componentStack?: string[];
  context?: {
    ancestorChain?: string[];
    nearbyText?: string;
  };
};

export type FigmaUiNodeMatchOptions = {
  maxMatchesPerUiNode?: number;
  minScore?: number;
  uiViewport?: Bounds;
  figmaRootBounds?: Bounds;
};

export type FigmaUiNodeMapping = {
  uiNode: {
    index: number;
    ref?: string;
    selector?: string;
    tagName?: string;
    role?: string;
    text?: string;
    bounds?: Bounds;
  };
  confidence: "high" | "medium" | "low" | "none";
  matches: FigmaUiNodeMatchCandidate[];
};

export type FigmaUiNodeMatchCandidate = {
  nodeId?: string;
  name?: string;
  type?: string;
  path: string;
  text?: string;
  bounds?: Bounds;
  score: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
};

export function matchUiNodesToFigmaNodes(
  uiNodes: FigmaUiMatchNode[],
  figmaNodes: FigmaNodeIndexEntry[],
  options: FigmaUiNodeMatchOptions = {},
): {
  mappings: FigmaUiNodeMapping[];
  stats: {
    uiNodes: number;
    figmaNodes: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    unmatched: number;
  };
  advice: string[];
} {
  const maxMatches = clampInteger(options.maxMatchesPerUiNode, 1, 10, 3);
  const minScore = clampInteger(options.minScore, 1, 500, 45);
  const figmaRootBounds = options.figmaRootBounds ?? figmaNodes.find((node) => node.bounds)?.bounds;

  const mappings: FigmaUiNodeMapping[] = uiNodes.map((uiNode, index) => {
    const matches = figmaNodes
      .map((figmaNode) => scoreUiToFigmaCandidate(uiNode, figmaNode, {
        figmaRootBounds,
        uiViewport: options.uiViewport,
      }))
      .filter((candidate): candidate is FigmaUiNodeMatchCandidate => candidate !== null)
      .filter((candidate) => candidate.score >= minScore)
      .sort((left, right) => right.score - left.score)
      .slice(0, maxMatches);
    return {
      uiNode: compactUiNode(uiNode, index),
      confidence: matches[0]?.confidence ?? "none",
      matches,
    };
  });

  const stats = {
    uiNodes: uiNodes.length,
    figmaNodes: figmaNodes.length,
    highConfidence: mappings.filter((mapping) => mapping.confidence === "high").length,
    mediumConfidence: mappings.filter((mapping) => mapping.confidence === "medium").length,
    lowConfidence: mappings.filter((mapping) => mapping.confidence === "low").length,
    unmatched: mappings.filter((mapping) => mapping.confidence === "none").length,
  };

  return {
    mappings,
    stats,
    advice: buildMappingAdvice(stats, Boolean(options.uiViewport), Boolean(figmaRootBounds)),
  };
}

function scoreUiToFigmaCandidate(
  uiNode: FigmaUiMatchNode,
  figmaNode: FigmaNodeIndexEntry,
  context: { uiViewport?: Bounds; figmaRootBounds?: Bounds },
): FigmaUiNodeMatchCandidate | null {
  const reasons: string[] = [];
  let score = 0;

  const uiSearchText = getUiSearchText(uiNode);
  const figmaSearchText = getFigmaSearchText(figmaNode);
  const uiPrimaryText = getPrimaryUiText(uiNode);
  const figmaPrimaryText = normalizeText([figmaNode.text, figmaNode.name].filter(Boolean).join(" "));
  const uiTerms = buildSearchTerms(uiSearchText);
  const matchedTerms = uiTerms.filter((term) => figmaSearchText.includes(term));

  if (uiPrimaryText && figmaPrimaryText) {
    if (figmaPrimaryText === uiPrimaryText) {
      score += 150;
      reasons.push("exact-text");
    } else if (figmaPrimaryText.includes(uiPrimaryText) || uiPrimaryText.includes(figmaPrimaryText)) {
      score += 105;
      reasons.push("text-substring");
    }
  }

  if (matchedTerms.length > 0) {
    score += Math.min(120, matchedTerms.length * 18);
    reasons.push(`terms:${matchedTerms.slice(0, 8).join(",")}`);
  }

  const roleHintScore = scoreRoleHints(uiNode, figmaSearchText);
  if (roleHintScore > 0) {
    score += roleHintScore;
    reasons.push("role-kind");
  }

  const componentScore = scoreComponentHints(uiNode, figmaSearchText);
  if (componentScore > 0) {
    score += componentScore;
    reasons.push("component-hint");
  }

  const geometryScore = scoreGeometry(uiNode, figmaNode, context);
  if (geometryScore > 0) {
    score += geometryScore;
    reasons.push("geometry");
  }

  if (score <= 0) {
    return null;
  }

  const roundedScore = Math.round(score * 100) / 100;
  return {
    nodeId: figmaNode.id,
    name: figmaNode.name,
    type: figmaNode.type,
    path: figmaNode.path,
    text: figmaNode.text,
    bounds: figmaNode.bounds,
    score: roundedScore,
    confidence: score >= 170 ? "high" : score >= 95 ? "medium" : "low",
    reasons,
  };
}

function compactUiNode(uiNode: FigmaUiMatchNode, index: number): FigmaUiNodeMapping["uiNode"] {
  return {
    index: uiNode.index ?? index,
    ref: uiNode.ref,
    selector: uiNode.selector,
    tagName: uiNode.tagName,
    role: uiNode.role,
    text: getPrimaryUiText(uiNode) || undefined,
    bounds: getUiBounds(uiNode),
  };
}

function getUiSearchText(uiNode: FigmaUiMatchNode): string {
  const attributes = uiNode.attributes ?? {};
  return normalizeText([
    uiNode.text,
    uiNode.name,
    uiNode.ariaLabel,
    uiNode.value,
    uiNode.placeholder,
    uiNode.title,
    readString(attributes["aria-label"]),
    readString(attributes.alt),
    readString(attributes.title),
    readString(attributes.placeholder),
    readString(attributes.name),
    readString(attributes["data-testid"]),
    uiNode.selector,
    uiNode.path,
    uiNode.componentStack?.join(" "),
    uiNode.context?.ancestorChain?.join(" "),
    uiNode.context?.nearbyText,
  ].filter(Boolean).join(" "));
}

function getFigmaSearchText(figmaNode: FigmaNodeIndexEntry): string {
  return normalizeText([
    figmaNode.id,
    figmaNode.name,
    figmaNode.type,
    figmaNode.path,
    figmaNode.text,
  ].filter(Boolean).join(" "));
}

function getPrimaryUiText(uiNode: FigmaUiMatchNode): string {
  return normalizeText(uiNode.text || uiNode.name || uiNode.ariaLabel || uiNode.value || uiNode.placeholder || uiNode.title || "");
}

function buildSearchTerms(text: string): string[] {
  const terms = new Set<string>();
  const compact = text.replace(/\s+/g, "");
  if (compact.length >= 2 && compact.length <= 80) {
    terms.add(compact);
  }

  for (const match of text.matchAll(/[a-z0-9_-]{2,}/gi)) {
    terms.add(match[0].toLowerCase());
  }
  for (const match of text.matchAll(/\p{Script=Han}+/gu)) {
    const value = match[0];
    if (value.length >= 2) {
      terms.add(value);
    }
    for (let size = 2; size <= Math.min(4, value.length); size += 1) {
      for (let index = 0; index <= value.length - size; index += 1) {
        terms.add(value.slice(index, index + size));
      }
    }
  }

  return [...terms].filter((term) => !isWeakTerm(term)).slice(0, 80);
}

function scoreRoleHints(uiNode: FigmaUiMatchNode, figmaSearchText: string): number {
  const hints = roleHintsForUiNode(uiNode);
  if (hints.length === 0) {
    return 0;
  }
  const hits = hints.filter((hint) => figmaSearchText.includes(hint));
  return hits.length > 0 ? Math.min(55, hits.length * 22 + 12) : 0;
}

function roleHintsForUiNode(uiNode: FigmaUiMatchNode): string[] {
  const tag = normalizeText(uiNode.tagName ?? "");
  const role = normalizeText(uiNode.role ?? "");
  const type = normalizeText(readString(uiNode.attributes?.type) ?? "");
  const hints: string[] = [];
  if (tag === "button" || role === "button") hints.push("button", "按钮");
  if (tag === "input" || role === "textbox" || type) hints.push("input", "输入框", "文本框");
  if (tag === "textarea") hints.push("textarea", "多行文本框", "文本框");
  if (tag === "select" || role === "combobox" || role === "option") hints.push("select", "选择器", "下拉");
  if (tag === "a" || role === "link") hints.push("link", "链接");
  if (role === "checkbox" || type === "checkbox") hints.push("checkbox", "复选", "开关", "switch");
  return hints;
}

function scoreComponentHints(uiNode: FigmaUiMatchNode, figmaSearchText: string): number {
  const terms = buildSearchTerms(normalizeText(uiNode.componentStack?.join(" ") ?? ""));
  const hits = terms.filter((term) => figmaSearchText.includes(term));
  return hits.length > 0 ? Math.min(40, hits.length * 12) : 0;
}

function scoreGeometry(
  uiNode: FigmaUiMatchNode,
  figmaNode: FigmaNodeIndexEntry,
  context: { uiViewport?: Bounds; figmaRootBounds?: Bounds },
): number {
  const uiBounds = getUiBounds(uiNode);
  const figmaBounds = figmaNode.bounds;
  if (!hasSize(uiBounds) || !hasSize(figmaBounds)) {
    return 0;
  }

  let score = 0;
  const widthRatio = closenessRatio(uiBounds.width, figmaBounds.width);
  const heightRatio = closenessRatio(uiBounds.height, figmaBounds.height);
  const aspectRatio = closenessRatio(
    (uiBounds.width ?? 0) / Math.max(uiBounds.height ?? 1, 1),
    (figmaBounds.width ?? 0) / Math.max(figmaBounds.height ?? 1, 1),
  );
  score += Math.max(0, widthRatio - 0.55) * 30;
  score += Math.max(0, heightRatio - 0.55) * 30;
  score += Math.max(0, aspectRatio - 0.65) * 35;

  if (hasSize(context.uiViewport) && hasSize(context.figmaRootBounds)) {
    const distance = normalizedCenterDistance(uiBounds, context.uiViewport, figmaBounds, context.figmaRootBounds);
    if (distance !== undefined) {
      score += Math.max(0, 1 - distance / 0.35) * 45;
    }
  }

  return score;
}

function normalizedCenterDistance(
  uiBounds: Bounds,
  uiViewport: Bounds | undefined,
  figmaBounds: Bounds,
  figmaRootBounds: Bounds | undefined,
): number | undefined {
  if (!hasSize(uiBounds) || !hasSize(uiViewport) || !hasSize(figmaBounds) || !hasSize(figmaRootBounds)) {
    return undefined;
  }
  const uiCenterX = ((uiBounds.x ?? 0) + (uiBounds.width ?? 0) / 2 - (uiViewport.x ?? 0)) / (uiViewport.width ?? 1);
  const uiCenterY = ((uiBounds.y ?? 0) + (uiBounds.height ?? 0) / 2 - (uiViewport.y ?? 0)) / (uiViewport.height ?? 1);
  const figmaCenterX = ((figmaBounds.x ?? 0) + (figmaBounds.width ?? 0) / 2 - (figmaRootBounds.x ?? 0)) / (figmaRootBounds.width ?? 1);
  const figmaCenterY = ((figmaBounds.y ?? 0) + (figmaBounds.height ?? 0) / 2 - (figmaRootBounds.y ?? 0)) / (figmaRootBounds.height ?? 1);
  return Math.hypot(uiCenterX - figmaCenterX, uiCenterY - figmaCenterY);
}

function getUiBounds(uiNode: FigmaUiMatchNode): Bounds | undefined {
  return uiNode.boundingBox ?? uiNode.box;
}

function buildMappingAdvice(
  stats: { unmatched: number },
  hasViewport: boolean,
  hasFigmaRootBounds: boolean,
): string[] {
  const advice = [
    "Use high-confidence mappings directly; inspect medium/low mappings with figma_summarize_design before editing.",
  ];
  if (!hasViewport || !hasFigmaRootBounds) {
    advice.push("Pass uiViewport from the BrowserView screenshot when geometry is important; otherwise mapping relies mostly on text and component hints.");
  }
  if (stats.unmatched > 0) {
    advice.push("For unmatched UI nodes, rerun browser_query_nodes with fields like text, selector, box, attributes, componentStack, and context.nearbyText.");
  }
  return advice;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function hasSize(bounds: Bounds | undefined): bounds is Bounds {
  return Boolean(bounds && isPositive(bounds.width) && isPositive(bounds.height));
}

function isPositive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function closenessRatio(a: number | undefined, b: number | undefined): number {
  if (!isPositive(a) || !isPositive(b)) {
    return 0;
  }
  return Math.min(a, b) / Math.max(a, b);
}

function isWeakTerm(term: string): boolean {
  return /^(?:div|span|button|input|label|form|frame|group|title|text|item|true|false|default|primary)$/.test(term);
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(value), min), max);
}
