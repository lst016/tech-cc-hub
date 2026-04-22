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
          start: number;
          end: number;
        }[]
      >((accumulator, item, index) => {
        const key = getKey(item, index);
        const itemHeight = measuredHeights[key] ?? estimatedItemHeight;
        const previousEnd = accumulator.length > 0 ? accumulator[accumulator.length - 1].end : 0;
        const start = previousEnd;
        const end = start + itemHeight + rowGapPx;

        accumulator.push({
          item,
          index,
          key,
          start,
          end,
        });

        return accumulator;
      }, []);
  }, [estimatedItemHeight, getKey, items, measuredHeights, rowGapPx]);

  const totalHeight = entries.length > 0 ? entries[entries.length - 1].end : 0;
  const visibleStart = Math.max(0, scrollTop - overscanPx);
  const visibleEnd = scrollTop + viewportHeight + overscanPx;
  const startIndex = findFirstVisibleIndex(entries, visibleStart);
  const endIndex = findFirstAfterIndex(entries, visibleEnd);
  const visibleEntries = entries.slice(startIndex, Math.max(startIndex, endIndex));
  const entriesRef = useRef(entries);
  const totalHeightRef = useRef(totalHeight);
  const viewportHeightRef = useRef(viewportHeight);

  useEffect(() => {
    entriesRef.current = entries;
    totalHeightRef.current = totalHeight;
    viewportHeightRef.current = viewportHeight;
  }, [entries, totalHeight, viewportHeight]);

  useEffect(() => {
    if (!scrollToKey || items.length === 0) {
      return;
    }

    const entry = entriesRef.current.find((item) => item.key === scrollToKey);
    if (!entry) {
      return;
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    const targetTop = Math.max(0, entry.start - viewportHeightRef.current * 0.25);
    const maxTop = Math.max(0, totalHeightRef.current - viewportHeightRef.current);
    node.scrollTo({
      top: Math.min(targetTop, maxTop),
      behavior: "smooth",
    });
  }, [items, scrollToKey]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height,
      }}
    >
      {items.length === 0 ? (
        emptyState ?? null
      ) : (
        <div className="relative" style={{ height: totalHeight || "100%" }}>
          {visibleEntries.map((entry) => (
            <VirtualizedRow
              key={entry.key}
              top={entry.start}
              rowGapPx={rowGapPx}
              onMeasure={(nextHeight) => setMeasuredHeight(entry.key, nextHeight)}
            >
              {renderItem(entry.item, entry.index)}
            </VirtualizedRow>
          ))}
        </div>
      )}
    </div>
  );
}

export default VirtualizedRailList;
