export type PreviewQuickOpenEntry = {
  name: string;
  path: string;
  relativePath: string;
  size?: number;
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

export function scorePreviewQuickOpenEntry(entry: PreviewQuickOpenEntry, query: string): number | null {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

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

  return score;
}

export function filterPreviewQuickOpenEntries(
  entries: readonly PreviewQuickOpenEntry[],
  query: string,
  limit = 40,
): PreviewQuickOpenEntry[] {
  const ranked: RankedPreviewQuickOpenEntry[] = [];
  for (const entry of entries) {
    const score = scorePreviewQuickOpenEntry(entry, query);
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
