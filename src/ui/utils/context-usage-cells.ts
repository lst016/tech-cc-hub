export type ContextUsageCellSegment = {
  id: string;
  label: string;
  tokens: number;
  className: string;
};

export type ContextUsageCell = {
  id: number;
  segmentId: string;
  label: string;
  className: string;
};

const DEFAULT_CELL_CLASS = "border-black/6 bg-black/[0.05]";

function clampCellCount(value: number, totalCells: number): number {
  return Math.max(0, Math.min(totalCells, value));
}

function allocateSegmentCells(
  segments: ContextUsageCellSegment[],
  windowTokens: number,
  totalCells: number,
): Array<{ segment: ContextUsageCellSegment; count: number; remainder: number }> {
  const positiveSegments = segments.filter((segment) => segment.tokens > 0);
  if (positiveSegments.length === 0) return [];

  const usedTokens = positiveSegments.reduce((sum, segment) => sum + segment.tokens, 0);
  const targetUsedCells = clampCellCount(
    Math.max(positiveSegments.length, Math.round((usedTokens / Math.max(1, windowTokens)) * totalCells)),
    totalCells,
  );
  if (targetUsedCells === 0) return [];

  const allocations = positiveSegments.map((segment) => {
    const exact = (segment.tokens / Math.max(1, windowTokens)) * totalCells;
    const minimumVisibleCount = targetUsedCells >= positiveSegments.length ? 1 : 0;
    return {
      segment,
      count: Math.max(minimumVisibleCount, Math.floor(exact)),
      remainder: exact - Math.floor(exact),
    };
  });

  let allocatedCount = allocations.reduce((sum, allocation) => sum + allocation.count, 0);
  for (const allocation of [...allocations].sort((left, right) => right.remainder - left.remainder)) {
    if (allocatedCount >= targetUsedCells) break;
    allocation.count += 1;
    allocatedCount += 1;
  }

  for (const allocation of [...allocations].sort((left, right) => {
    if (left.count !== right.count) return right.count - left.count;
    return left.segment.tokens - right.segment.tokens;
  })) {
    if (allocatedCount <= targetUsedCells) break;
    if (allocation.count <= 1) continue;
    allocation.count -= 1;
    allocatedCount -= 1;
  }

  return allocations.filter((allocation) => allocation.count > 0);
}

export function buildSegmentedContextUsageCells(
  segments: ContextUsageCellSegment[],
  windowTokens: number,
  totalCells = 40,
): ContextUsageCell[] {
  const allocations = allocateSegmentCells(segments, windowTokens, totalCells);
  const cells: ContextUsageCell[] = [];

  for (const allocation of allocations) {
    for (let index = 0; index < allocation.count && cells.length < totalCells; index += 1) {
      cells.push({
        id: cells.length,
        segmentId: allocation.segment.id,
        label: allocation.segment.label,
        className: allocation.segment.className,
      });
    }
  }

  while (cells.length < totalCells) {
    cells.push({
      id: cells.length,
      segmentId: "free",
      label: "Free space",
      className: DEFAULT_CELL_CLASS,
    });
  }

  return cells;
}
