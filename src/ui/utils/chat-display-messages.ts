export type ChatDisplayMessageEntry<T extends { type?: unknown; subtype?: unknown }> = {
  originalIndex: number;
  message: T;
};

function isInitSystemMessage(message: { type?: unknown; subtype?: unknown } | undefined): boolean {
  return message?.type === "system" && message.subtype === "init";
}

export function filterDisplayMessages<T extends { type?: unknown; subtype?: unknown }>(
  visibleMessages: Array<ChatDisplayMessageEntry<T>>,
  allMessages: T[],
): Array<ChatDisplayMessageEntry<T>> {
  const firstVisibleIndex = visibleMessages[0]?.originalIndex ?? 0;
  let hasSeenInit = allMessages.slice(0, firstVisibleIndex).some(isInitSystemMessage);
  const displayMessages: Array<ChatDisplayMessageEntry<T>> = [];

  for (const item of visibleMessages) {
    if (isInitSystemMessage(item.message)) {
      if (hasSeenInit) {
        continue;
      }
      hasSeenInit = true;
    }
    displayMessages.push(item);
  }

  return displayMessages;
}
