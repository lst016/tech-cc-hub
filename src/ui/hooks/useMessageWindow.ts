import { useCallback, useMemo, useState } from "react";
import type { StreamMessage } from "../types";
import { getUserPromptAnchoredWindowStart } from "../utils/render-history-window";

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
  const targetWindowStart = Math.max(0, messages.length - visibleLimit);
  const windowStart = getUserPromptAnchoredWindowStart(messages, targetWindowStart);
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
      const anchoredVisibleCount = messages.length - windowStart;
      setVisibleLimit((current) => (
        Math.min(messages.length, Math.max(current, anchoredVisibleCount) + LOAD_MORE_MESSAGE_STEP)
      ));
      return;
    }
    if (!hasPersistedHistory || isLoadingHistory) {
      return;
    }

    onLoadMore();
  }, [hasMoreLocalHistory, hasPersistedHistory, isLoadingHistory, messages.length, onLoadMore, windowStart]);

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
