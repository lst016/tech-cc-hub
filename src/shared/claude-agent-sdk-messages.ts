type MessageLike = {
  type?: unknown;
  subtype?: unknown;
  uuid?: unknown;
  historyId?: unknown;
  supersedes?: unknown;
  retracted_message_uuids?: unknown;
  new_conversation_id?: unknown;
};

function normalizeMessageIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((id): id is string => (
    typeof id === "string" && id.length > 0
  ))));
}

export function getClaudeMessageIdentity(message: MessageLike): string | undefined {
  if (typeof message.historyId === "string" && message.historyId) return message.historyId;
  return typeof message.uuid === "string" && message.uuid ? message.uuid : undefined;
}

export function getClaudeRetractionIds(message: MessageLike): string[] {
  if (message.type === "assistant") {
    return normalizeMessageIds(message.supersedes);
  }
  if (message.type === "system" && message.subtype === "model_refusal_fallback") {
    return normalizeMessageIds(message.retracted_message_uuids);
  }
  return [];
}

export function isClaudeConversationReset(message: MessageLike): boolean {
  return message.type === "conversation_reset";
}

export function getClaudeConversationResetId(message: MessageLike): string | undefined {
  if (!isClaudeConversationReset(message)) return undefined;
  return typeof message.new_conversation_id === "string" && message.new_conversation_id
    ? message.new_conversation_id
    : undefined;
}

export function removeRetractedClaudeMessages<T extends MessageLike>(
  messages: readonly T[],
  retractedIds: readonly string[],
): T[] {
  if (retractedIds.length === 0) return [...messages];
  const ids = new Set(retractedIds);
  return messages.filter((message) => {
    const identity = getClaudeMessageIdentity(message);
    return !identity || !ids.has(identity);
  });
}
