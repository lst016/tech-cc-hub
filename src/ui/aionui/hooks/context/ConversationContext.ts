export type ConversationContextValue = {
  conversationId?: string;
  workspace?: string;
  [key: string]: unknown;
};

export const useConversationContextSafe = (): ConversationContextValue | null => null;
