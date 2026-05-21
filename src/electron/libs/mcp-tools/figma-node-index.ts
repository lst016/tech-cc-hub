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
  exportable?: boolean;
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
    const bounds = readNodeIndexBounds(node);
    const entry: FigmaNodeIndexEntry = {
      id: readString(node, "id"),
      name,
      type: readString(node, "type"),
      visible: readBoolean(node, "visible"),
      bounds,
      exportable: hasExportableFigmaBounds(bounds),
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
    .filter(hasExportableFigmaNodeBounds)
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
  }) ?? branchCandidates[0] ?? index.find((entry) => entry.id && hasExportableFigmaNodeBounds(entry)) ?? index.find((entry) => entry.id);

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
  const matchedTerms = terms.filter((term) => searchableText.includes(term));
  if (matchedTerms.length === 0) {
    return null;
  }

  const name = (entry.name ?? "").toLowerCase();
  const path = entry.path.toLowerCase();
  const text = (entry.text ?? "").toLowerCase();
  let score = matchedTerms.length * 100;
  for (const term of matchedTerms) {
    if (entry.id?.toLowerCase() === term) score += 120;
    if (name.includes(term)) score += 45;
    if (text.includes(term)) score += 40;
    if (path.includes(term)) score += 20;
    score += Math.min(term.length, 20);
  }
  if (entry.childCount > 0) {
    score += 15;
  }
  if (!hasExportableFigmaNodeBounds(entry)) {
    score -= 80;
  }
  score += getFigmaNodeIndexPathDepth(entry) * 4;
  score += getFigmaNodeIndexCompactnessScore(entry);

  return {
    ...entry,
    matchScore: Math.round(score * 100) / 100,
    matchTerms: matchedTerms,
  };
}

function getFigmaNodeIndexSearchText(entry: FigmaNodeIndexEntry): string {
  return [
    entry.id,
    entry.name,
    entry.type,
    entry.path,
    entry.text,
  ].filter(Boolean).join(" ").toLowerCase();
}

function compareFigmaRecommendationEntries(a: FigmaNodeIndexEntry, b: FigmaNodeIndexEntry): number {
  const exportableDelta = Number(hasExportableFigmaNodeBounds(b)) - Number(hasExportableFigmaNodeBounds(a));
  if (exportableDelta !== 0) {
    return exportableDelta;
  }

  const scoreDelta = (b.matchScore ?? 0) - (a.matchScore ?? 0);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const areaA = getFigmaNodeIndexArea(a);
  const areaB = getFigmaNodeIndexArea(b);
  if (areaA !== areaB) {
    return areaA - areaB;
  }

  return getFigmaNodeIndexPathDepth(b) - getFigmaNodeIndexPathDepth(a);
}

function getFigmaNodeIndexPathDepth(entry: FigmaNodeIndexEntry): number {
  return entry.path.split(" / ").filter(Boolean).length;
}

function getFigmaNodeIndexArea(entry: FigmaNodeIndexEntry): number {
  const width = entry.bounds?.width;
  const height = entry.bounds?.height;
  return width && height ? width * height : Number.POSITIVE_INFINITY;
}

function hasExportableFigmaNodeBounds(entry: FigmaNodeIndexEntry): boolean {
  return hasExportableFigmaBounds(entry.bounds);
}

function hasExportableFigmaBounds(bounds: FigmaNodeIndexEntry["bounds"]): boolean {
  return Boolean(
    bounds &&
    typeof bounds.width === "number" &&
    Number.isFinite(bounds.width) &&
    bounds.width > 0 &&
    typeof bounds.height === "number" &&
    Number.isFinite(bounds.height) &&
    bounds.height > 0
  );
}

function getFigmaNodeIndexCompactnessScore(entry: FigmaNodeIndexEntry): number {
  const area = getFigmaNodeIndexArea(entry);
  if (!Number.isFinite(area) || area <= 0) {
    return 0;
  }
  return Math.max(0, 40 - Math.log10(area + 1) * 4);
}

function readNodeIndexBounds(node: Record<string, unknown>): FigmaNodeIndexEntry["bounds"] | undefined {
  const box = isRecord(node.absoluteBoundingBox)
    ? node.absoluteBoundingBox
    : isRecord(node.absoluteRenderBounds)
      ? node.absoluteRenderBounds
      : null;
  if (!box) {
    return undefined;
  }

  return {
    x: readNumber(box, "x"),
    y: readNumber(box, "y"),
    width: readNumber(box, "width"),
    height: readNumber(box, "height"),
  };
}

function getNodeChildren(node: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(node.children) ? node.children.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}
