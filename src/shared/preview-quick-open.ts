export type PreviewQuickOpenEntry = {
  name: string;
  path: string;
  relativePath: string;
  size?: number;
};

export type PreviewQuickOpenFilterOptions = {
  recentPaths?: readonly string[];
  activePath?: string;
};

type RankedPreviewQuickOpenEntry = {
  entry: PreviewQuickOpenEntry;
  score: number;
};

function normalizePathForQuickOpen(value: string): string {
  return value.replace(/\\/g, "/").toLowerCase();
}

function compactQuickOpenToken(value: string): string {
  return normalizePathForQuickOpen(value).replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function buildRecentPathIndex(recentPaths: readonly string[] | undefined): Map<string, number> {
  const indexByPath = new Map<string, number>();
  for (const path of recentPaths ?? []) {
    const normalizedPath = normalizePathForQuickOpen(path.trim());
    if (!normalizedPath || indexByPath.has(normalizedPath)) continue;
    indexByPath.set(normalizedPath, indexByPath.size);
  }
  return indexByPath;
}

function scoreFuzzySubsequence(needle: string, haystack: string): number | null {
  if (needle.length < 2 || haystack.length === 0) return null;

  let score = 0;
  let lastIndex = -1;

  for (const char of needle) {
    const index = haystack.indexOf(char, lastIndex + 1);
    if (index < 0) return null;

    const gap = index - lastIndex - 1;
    score += gap === 0 ? -1 : gap * 1.5;
    score += index * 0.02;
    lastIndex = index;
  }

  return score + (haystack.length - needle.length) / 80;
}

function applyQuickOpenContextScore(
  score: number,
  entryPath: string,
  tokenCount: number,
  recentPathIndex: Map<string, number>,
  normalizedActivePath: string,
): number {
  const recentIndex = recentPathIndex.get(entryPath);

  if (tokenCount === 0) {
    if (entryPath === normalizedActivePath) {
      return score - 3_000;
    }
    if (recentIndex !== undefined) {
      return score - 2_000 + recentIndex;
    }
    // Keep non-recent files below MRU results when query is empty.
    return score + 200;
  }

  let nextScore = score;
  if (recentIndex !== undefined) {
    nextScore -= Math.max(0.5, 2.5 - recentIndex * 0.08);
  }
  if (entryPath === normalizedActivePath) {
    nextScore -= 0.7;
  }
  return nextScore;
}

export function scorePreviewQuickOpenEntry(
  entry: PreviewQuickOpenEntry,
  query: string,
  options: PreviewQuickOpenFilterOptions = {},
): number | null {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const recentPathIndex = buildRecentPathIndex(options.recentPaths);
  const normalizedActivePath = normalizePathForQuickOpen(options.activePath?.trim() || "");
  const normalizedEntryPath = normalizePathForQuickOpen(entry.path);

  if (tokens.length === 0) {
    return applyQuickOpenContextScore(
      0,
      normalizedEntryPath,
      0,
      recentPathIndex,
      normalizedActivePath,
    );
  }

  const relativePath = normalizePathForQuickOpen(entry.relativePath);
  const name = entry.name.toLowerCase();
  const compactPath = compactQuickOpenToken(entry.relativePath);
  const compactName = compactQuickOpenToken(entry.name);
  let score = relativePath.length / 100;

  for (const token of tokens) {
    const pathIndex = relativePath.indexOf(token);
    const nameIndex = name.indexOf(token);
    if (pathIndex >= 0 || nameIndex >= 0) {
      if (name === token) {
        score -= 30;
      } else if (name.startsWith(token)) {
        score -= 18;
      } else if (nameIndex >= 0) {
        score += nameIndex;
      }

      if (relativePath === token) {
        score -= 12;
      } else if (relativePath.startsWith(token)) {
        score -= 8;
      } else {
        score += Math.max(pathIndex, 0);
      }
      continue;
    }

    const compactToken = compactQuickOpenToken(token);
    const nameFuzzyScore = scoreFuzzySubsequence(compactToken, compactName);
    const pathFuzzyScore = scoreFuzzySubsequence(compactToken, compactPath);
    if (nameFuzzyScore === null && pathFuzzyScore === null) return null;

    score += nameFuzzyScore !== null
      ? 12 + nameFuzzyScore
      : 20 + (pathFuzzyScore ?? 0);
  }

  return applyQuickOpenContextScore(
    score,
    normalizedEntryPath,
    tokens.length,
    recentPathIndex,
    normalizedActivePath,
  );
}

export function filterPreviewQuickOpenEntries(
  entries: readonly PreviewQuickOpenEntry[],
  query: string,
  limit = 40,
  options: PreviewQuickOpenFilterOptions = {},
): PreviewQuickOpenEntry[] {
  const ranked: RankedPreviewQuickOpenEntry[] = [];
  for (const entry of entries) {
    const score = scorePreviewQuickOpenEntry(entry, query, options);
    if (score === null) continue;
    ranked.push({ entry, score });
  }

  return ranked
    .sort((left, right) => (
      left.score - right.score
      || left.entry.relativePath.localeCompare(right.entry.relativePath)
    ))
    .slice(0, limit)
    .map((item) => item.entry);
}
