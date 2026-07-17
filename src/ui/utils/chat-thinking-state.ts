export type ThinkingPlaceholderContext = {
  isRunning: boolean;
  partialMessage: string;
  showPartialMessage: boolean;
  lastRenderableEntryType: string | null;
  isWaitingForUserInput?: boolean;
};

export function shouldShowChatThinkingPlaceholder(input: ThinkingPlaceholderContext): boolean {
  if (!input.isRunning) return false;
  if (input.isWaitingForUserInput) return false;
  if (input.showPartialMessage) return false;
  if (input.partialMessage.trim()) return false;
  return input.lastRenderableEntryType !== null;
}
