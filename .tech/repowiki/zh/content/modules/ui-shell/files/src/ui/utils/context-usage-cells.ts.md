# src/ui/utils/context-usage-cells.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：96

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `clampCellCount@16`
- `allocateSegmentCells@20`
- `buildSegmentedContextUsageCells@65`
- `DEFAULT_CELL_CLASS@14`
- `positiveSegments@26`
- `usedTokens@28`
- `targetUsedCells@30`
- `allocations@35`
- `exact@37`
- `minimumVisibleCount@38`
- `allocatedCount@45`
- `allocations@71`
- `ContextUsageCellSegment@1`
- `ContextUsageCell@7`

## 对外暴露

- `ContextUsageCellSegment`
- `ContextUsageCell`
- `buildSegmentedContextUsageCells`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

```
