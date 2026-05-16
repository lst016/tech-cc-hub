# src/electron/libs/mcp-tools/figma-node-index.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：256

## 文件职责

Figma 节点索引构建和搜索：为设计文档建立可检索的节点索引，支持按名称/路径/text 搜索

## 关键符号

- `FigmaNodeIndexEntry@0 - 索引条目类型（id/name/type/bounds/text/path/childCount/matchScore）`
- `buildFigmaNodeIndex@0 - 递归遍历 Figma 节点树，构建扁平化索引（限制最大条目数）`
- `filterFigmaNodeIndex@0 - 按查询词过滤和评分索引条目`
- `pickRecommendedNodeIds@0 - 从索引中选取推荐的节点 ID，优先选择带查询分数或符合关键词的分支节点`

## 对外暴露

- `FigmaNodeIndexEntry`
- `buildFigmaNodeIndex`
- `pickRecommendedNodeIds`
- `filterFigmaNodeIndex`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type FigmaNodeIndexEntry = {
  id?: string;
  name?: string;
  type?: string;
  visible?: boolean;
  bounds?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  text?: string;
  matchScore?: number;
  matchTerms?: string[];
  childCount: number;
  path: string;
};

export function buildFigmaNodeIndex(roots: Record<string, unknown>[], maxEntries: number): FigmaNodeIndexEntry[] {
  const entries: FigmaNodeIndexEntry[] = [];

  const visit = (node: Record<string, unknown>, pathParts: string[]) => {
    if (entries.length >= maxEntries) {
      return;
    }

    const name = readString(node, "name") || "(unnamed)";
    const children = getNodeChildren(node);
    const entry: FigmaNodeIndexEntry = {
      id: readString(node, "id"),
      name,
      type: readString(node, "type"),
      visible: readBoolean(node, "visible"),
      bounds: readNodeIndexBounds(node),
      childCount: children.length,
      path: [...pathParts, name].join(" / "),
    };
    const text = collectFigmaNodeText(node);
    if (text) {
      entry.text = text;
    }

    entries.push(entry);
    for (const child of children) {
      visit(child, [...pathParts, name]);
      if (entries.length >= maxEntries) {
        break;
      }
    }
  };

  for (const root of roots) {
    visit(root, []);
    if (entries.length >= maxEntries) {
      break;
    }
  }

  return entries;
}

export function pickRecommendedNodeIds(index: FigmaNodeIndexEntry[], currentNodeIds: string[]): string[] {
  const branchCandidates = index
    .filter((entry) => entry.id && entry.childCount > 0)
    .filter((entry) => !currentNodeIds.includes(entry.id ?? ""));

  const rankedCandidates = [...branchCandidates].sort(compareFigmaRecommendationEntries);
  const hasQueryScores = rankedCandidates.some((entry) => (entry.matchScore ?? 0) > 0);
  if (hasQueryScores) {
    const preferredMatch = rankedCandidates.find((entry) => (entry.matchScore ?? 0) > 0);
    return preferredMatch?.id ? [preferredMatch.id] : [];
  }

  const preferred = branchCandidates.find((entry) => {
    const text = `${entry.name ?? ""} ${entry.path}`.toLowerCase();
    return /form|frame|content|section|container|page|screen|body|button|preview|template/.test(text);
  }) ?? branchCandidates[0] ?? index.find((entry) => entry.id);

  return preferred?.id ? [preferred.id] : [];
}

export function filterFigmaNodeIndex(index: FigmaNodeIndexEntry[], query?: string): FigmaNodeIndexEntry[] {
  const terms = parseFigmaNodeIndexQuery(query);
  if (terms.length === 0) {
    return index;
  }

  return index
    .map((entry) => scoreFigmaNodeIndexEntry(entry, terms))
    .filter((entry): entry is FigmaNodeIndexEntry => Boolean(entry))
    .sort(compareFigmaRecommendationEntries);
}

function collectFigmaNodeText(node: Record<string, unknown>, maxChars = 240): string | undefined {
  const chunks: string[] = [];
  let length = 0;

  const append = (value: string) => {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized || length >= maxChars) {
      return;
    }
    const remaining = maxChars - length;
    const piece = normalized.slice(0, remaining);
    chunks.push(piece);
    length += piece.length + 1;
  };

  const visit = (current: Record<string, unknown>) => {
    if (length >= maxChars) {
      return;
    }
    const characters = readString(current, "characters");
    if (characters) {
      append(characters);
    }
    for (const child of getNodeChildren(current)) {
      visit(child);
      if (length >= maxChars) {
        break;
      }
    }
  };

  visit(node);
  const text = chunks.join(" ").trim();
  return text ? text : undefined;
}

function parseFigmaNodeIndexQuery(query?: string): string[] {
  const normalizedQuery = query?.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }
  const parts = normalizedQuery
    .split(/[\s|/,;，、；]+/u)
    .map((term) => term.replace(/^["'`]+|["'`]+$/g, "").trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function scoreFigmaNodeIndexEntry(entry: FigmaNodeIndexEntry, terms: string[]): FigmaNodeIndexEntry | null {
  const searchableText = getFigmaNodeIndexSearchText(entry);
... (truncated)
```
