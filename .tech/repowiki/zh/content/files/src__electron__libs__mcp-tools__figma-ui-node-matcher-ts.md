# src/electron/libs/mcp-tools/figma-ui-node-matcher.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：391

## 文件职责

源码文件。依赖：./figma-node-index.js

## 关键符号

- `matchUiNodesToFigmaNodes@66 - `
- `scoreUiToFigmaCandidate@119 - `
- `compactUiNode@185 - `
- `getUiSearchText@197 - `
- `getFigmaSearchText@220 - `
- `getPrimaryUiText@230 - `
- `buildSearchTerms@234 - `
- `scoreRoleHints@259 - `
- `roleHintsForUiNode@268 - `
- `scoreComponentHints@282 - `
- `scoreGeometry@288 - `
- `normalizedCenterDistance@320 - `
- `getUiBounds@336 - `
- `buildMappingAdvice@340 - `
- `normalizeText@357 - `
- `readString@361 - `

## 依赖输入

- `./figma-node-index.js`

## 对外暴露

- `FigmaUiMatchNode`
- `FigmaUiNodeMatchOptions`
- `FigmaUiNodeMapping`
- `FigmaUiNodeMatchCandidate`
- `matchUiNodesToFigmaNodes`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
... (truncated)
```
