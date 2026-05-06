export type LarkChannelConfig = {
  cliProfile?: string;
  cliSendArgsTemplate?: string;
  allowedSenderIds?: string;
  allowedConversationIds?: string;
};

export type LarkReplyTarget = {
  conversationId: string;
  rawConversationId: string;
  externalMessageId?: string;
  senderId?: string;
};

function splitCommandTemplate(template: string, values: Record<string, string>): string[] {
  const rendered = Object.entries(values).reduce(
    (current, [key, value]) => current.split(`{${key}}`).join(value),
    template,
  );
  return rendered.match(/"[^"]*"|'[^']*'|\S+/g)?.map((part) => {
    if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
      return part.slice(1, -1);
    }
    return part;
  }) ?? [];
}

function hasLarkMessageId(value: string | undefined): value is string {
  return typeof value === "string" && /^om[tx]?_/i.test(value.trim());
}

function parseIdAllowList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(/[\s,;,\uFF0C\uFF1B]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isAllowedId(value: string | undefined, allowList: Set<string>): boolean {
  return typeof value === "string" && allowList.has(value.trim().toLowerCase());
}

export function hasRequiredLarkSenderFilter(config: LarkChannelConfig): boolean {
  return parseIdAllowList(config.allowedSenderIds).size > 0;
}

export function parseLarkAuthUserOpenId(rawOutput: string): string | undefined {
  try {
    const parsed = JSON.parse(rawOutput) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    const value = (parsed as { userOpenId?: unknown }).userOpenId;
    return typeof value === "string" && value.trim().startsWith("ou_") ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

export function shouldAcceptLarkEvent(
  config: LarkChannelConfig,
  event: { senderId?: string; conversationId?: string },
): boolean {
  const senderAllowList = parseIdAllowList(config.allowedSenderIds);
  if (!isAllowedId(event.senderId, senderAllowList)) return false;

  const conversationAllowList = parseIdAllowList(config.allowedConversationIds);
  return conversationAllowList.size === 0 || isAllowedId(event.conversationId, conversationAllowList);
}

export function buildLarkCliSendArgs(config: LarkChannelConfig, target: LarkReplyTarget, text: string): string[] {
  const profile = config.cliProfile?.trim() || "default";
  const rawConversationId = target.rawConversationId || target.conversationId;
  const profileArgs = profile && profile !== "default" ? ["--profile", profile] : [];
  const values = {
    profile,
    conversation: rawConversationId,
    "chat-id": rawConversationId,
    chat_id: rawConversationId,
    "message-id": target.externalMessageId ?? "",
    message_id: target.externalMessageId ?? "",
    "sender-id": target.senderId ?? "",
    sender_id: target.senderId ?? "",
    text,
  };

  if (hasLarkMessageId(target.externalMessageId)) {
    return [
      ...profileArgs,
      "im",
      "+messages-reply",
      "--message-id",
      target.externalMessageId.trim(),
      "--text",
      text,
      "--as",
      "bot",
    ];
  }

  if (config.cliSendArgsTemplate?.trim()) {
    return splitCommandTemplate(config.cliSendArgsTemplate, values);
  }

  return [
    ...profileArgs,
    "im",
    "+messages-send",
    "--chat-id",
    rawConversationId,
    "--text",
    text,
    "--as",
    "bot",
  ];
}
