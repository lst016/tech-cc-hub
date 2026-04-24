import { useCallback, useMemo } from "react";
import type { StreamMessage } from "../types";

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
  const { hasMoreHistory, isLoadingHistory, onLoadMore } = options;
  const visibleMessages = useMemo(
    () =>
      messages.map((message, index) => ({
        originalIndex: index,
        message,
      })),
    [messages],
  );

  const totalUserInputs = useMemo(
    () => messages.filter((message) => message.type === "user_prompt").length,
    [messages],
  );

  const loadMoreMessages = useCallback(() => {
    if (!hasMoreHistory || isLoadingHistory) {
      return;
    }

    onLoadMore();
  }, [hasMoreHistory, isLoadingHistory, onLoadMore]);

  const resetToLatest = useCallback(() => {}, []);

  return {
    visibleMessages,
    hasMoreHistory,
    isLoadingHistory,
    isAtBeginning: !hasMoreHistory && messages.length > 0,
    loadMoreMessages,
    resetToLatest,
    totalMessages: messages.length,
    totalUserInputs,
    visibleUserInputs: totalUserInputs,
  };
}
