# src/ui/hooks/useMessageWindow.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：81

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `useMessageWindow@23`
- `INITIAL_VISIBLE_MESSAGE_LIMIT@3`
- `LOAD_MORE_MESSAGE_STEP@5`
- `windowStart@34`
- `hasMoreLocalHistory@35`
- `hasMoreHistory@36`
- `visibleMessages@37`
- `totalUserInputs@43`
- `visibleUserInputs@48`
- `loadMoreMessages@52`
- `resetToLatest@64`
- `IndexedMessage@6`
- `MessageWindowState@11`
- `loadMoreMessages@17`
- `resetToLatest@18`
- `onLoadMore@29`

## 依赖输入

- `react`
- `../types`

## 对外暴露

- `IndexedMessage`
- `MessageWindowState`
- `useMessageWindow`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { useCallback, useMemo, useState } from "react";
import type { StreamMessage } from "../types";

const INITIAL_VISIBLE_MESSAGE_LIMIT = 160;
const LOAD_MORE_MESSAGE_STEP = 120;

export interface IndexedMessage {
  originalIndex: number;
  message: StreamMessage;
}

export interface MessageWindowState {
  visibleMessages: IndexedMessage[];
  hasMoreHistory: boolean;
  isLoadingHistory: boolean;
  isAtBeginning: boolean;
  loadMoreMessages: () => void;
  resetToLatest: () => void;
  totalMessages: number;
  totalUserInputs: number;
  visibleUserInputs: number;
}

export function useMessageWindow(
  messages: StreamMessage[],
  options: {
    hasMoreHistory: boolean;
    isLoadingHistory: boolean;
    onLoadMore: () => void;
  }
): MessageWindowState {
  const { hasMoreHistory: hasPersistedHistory, isLoadingHistory, onLoadMore } = options;
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_MESSAGE_LIMIT);
  const windowStart = Math.max(0, messages.length - visibleLimit);
  const hasMoreLocalHistory = windowStart > 0;
  const hasMoreHistory = hasMoreLocalHistory || hasPersistedHistory;
  const visibleMessages = useMemo(() => {
    return messages.slice(windowStart).map((message, offset) => ({
      originalIndex: windowStart + offset,
      message,
    }));
  }, [messages, windowStart]);

  const totalUserInputs = useMemo(
    () => messages.filter((message) => message.type === "user_prompt").length,
    [messages],
  );
  const visibleUserInputs = useMemo(
    () => visibleMessages.filter((item) => item.message.type === "user_prompt").length,
    [visibleMessages],
  );

  const loadMoreMessages = useCallback(() => {
    if (hasMoreLocalHistory) {
      setVisibleLimit((current) => Math.min(messages.length, current + LOAD_MORE_MESSAGE_STEP));
      return;
    }
    if (!hasPersistedHistory || isLoadingHistory) {
      return;
    }

    onLoadMore();
  }, [hasMoreLocalHistory, hasPersistedHistory, isLoadingHistory, messages.length, onLoadMore]);

  const resetToLatest = useCallback(() => {
    setVisibleLimit(INITIAL_VISIBLE_MESSAGE_LIMIT);
  }, []);

  return {
    visibleMessages,
    hasMoreHistory,
    isLoadingHistory,
    isAtBeginning: !hasMoreHistory && messages.length > 0,
    loadMoreMessages,
    resetToLatest,
    totalMessages: messages.length,
    totalUserInputs,
    visibleUserInputs,
  };
}

```
