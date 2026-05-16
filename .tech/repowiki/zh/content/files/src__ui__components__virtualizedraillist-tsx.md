# src/ui/components/VirtualizedRailList.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：282

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `VirtualizedRow@22`
- `findFirstVisibleIndex@77`
- `findFirstAfterIndex@93`
- `rowRef@24`
- `onMeasureRef@25`
- `node@32`
- `animationFrameId@36`
- `measure@38`
- `observer@52`
- `low@79`
- `high@80`
- `mid@83`
- `low@95`
- `high@96`
- `mid@99`
- `containerRef@122`
- `setMeasuredHeight@126`
- `node@141`
- `updateViewport@145`
- `observer@158`
- `node@168`
- `updateScrollTop@172`
- `entries@184`
- `key@196`
- `itemHeight@197`
- `previousEnd@198`
- `start@199`
- `end@200`
- `totalHeight@213`
- `visibleStart@215`
- `visibleEnd@216`
- `startIndex@217`
- `endIndex@218`
- `visibleEntries@219`
- `entriesRef@220`
- `totalHeightRef@221`
- `viewportHeightRef@222`
- `entry@234`
- `node@239`
- `targetTop@244`

## 依赖输入

- `react`

## 对外暴露

- `VirtualizedRailList`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

type VirtualizedRailListProps<T> = {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  height: string;
  className?: string;
  emptyState?: ReactNode;
  estimatedItemHeight: number;
  overscanPx?: number;
  rowGapPx?: number;
  scrollToKey?: string | null;
};

type VirtualizedRowProps = {
  top: number;
  rowGapPx: number;
  onMeasure: (height: number) => void;
  children: ReactNode;
};

function VirtualizedRow({ top, rowGapPx, onMeasure, children }: VirtualizedRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const onMeasureRef = useRef(onMeasure);

  useEffect(() => {
    onMeasureRef.current = onMeasure;
  }, [onMeasure]);

  useLayoutEffect(() => {
    const node = rowRef.current;
    if (!node) {
      return;
    }

    let animationFrameId = 0;

    const measure = () => {
      animationFrameId = window.requestAnimationFrame(() => {
        onMeasureRef.current(node.getBoundingClientRect().height);
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.cancelAnimationFrame(animationFrameId);
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={rowRef}
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        paddingBottom: rowGapPx,
      }}
    >
      {children}
    </div>
  );
}

function findFirstVisibleIndex(entries: Array<{ start: number; end: number }>, offset: number) {
  let low = 0;
  let high = entries.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (entries[mid].end > offset) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return low;
}

function findFirstAfterIndex(entries: Array<{ start: number }>, offset: number) {
  let low = 0;
  let high = entries.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (entries[mid].start >= offset) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return low;
}

export function VirtualizedRailList<T>({
  items,
  getKey,
  renderItem,
  height,
  className,
  emptyState,
  estimatedItemHeight,
  overscanPx = 280,
  rowGapPx = 8,
  scrollToKey,
}: VirtualizedRailListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});

  const setMeasuredHeight = useCallback((key: string, nextHeight: number) => {
    setMeasuredHeights((current) => {
      if (current[key] === nextHeight) {
        return current;
      }

      return {
        ...current,
        [key]: nextHeight,
      };
    });
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const updateViewport = () => {
      setViewportHeight(node.clientHeight);
    };

    updateViewport();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewport);
      return () => {
        window.removeEventListener("resize", updateViewport);
      };
    }

    const observer = new ResizeObserver(updateViewport);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const updateScrollTop = () => {
      setScrollTop(node.scrollTop);
    };

    updateScrollTop();
    node.addEventListener("scroll", updateScrollTop, { passive: true });

    return () => {
      node.removeEventListener("scroll", updateScrollTop);
    };
  }, []);

  const entries = useMemo(() => {
    return items
      .reduce<
        {
          item: T;
          index: number;
          key: string;
          star
... (truncated)
```
