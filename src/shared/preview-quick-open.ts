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

export function scorePreviewQuickOpenEntry(entry: PreviewQuickOpenEntry, query: string): number | null {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  const relativePath = normalizePathForQuickOpen(entry.relativePath);
  const name = entry.name.toLowerCase();
  let score = relativePath.length / 100;

  for (const token of tokens) {
    const pathIndex = relativePath.indexOf(token);
    const nameIndex = name.indexOf(token);
    if (pathIndex < 0 && nameIndex < 0) return null;

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
