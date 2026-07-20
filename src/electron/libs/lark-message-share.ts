import { randomUUID } from "node:crypto";

import { searchLarkContacts, type LarkContactOption } from "./lark-contact-search.js";

export type LarkShareRecipient = {
  kind: "user" | "chat";
  id: string;
  name: string;
  detail?: string;
  avatarUrl?: string;
};

export type LarkShareSendInput = {
  recipient: LarkShareRecipient;
  text: string;
};

export type LarkShareSendResult = {
  messageId?: string;
  chatId?: string;
};

export type LarkShareCliConfig = {
  command: string;
  runtimeEnv: NodeJS.ProcessEnv;
};

export type LarkShareCliInvoker = (
  command: string,
  args: string[],
  runtimeEnv: NodeJS.ProcessEnv,
) => Promise<{ stdout: string; stderr: string }>;

type LarkContactSearcher = (query: unknown) => Promise<LarkContactOption[]>;

type UnknownRecord = Record<string, unknown>;

const LARK_SHARE_TIMEOUT_MS = 15_000;
const LARK_SHARE_SEARCH_LIMIT = 10;
const LARK_SHARE_QUERY_LIMIT = 64;
const LARK_SHARE_TEXT_LIMIT = 24_000;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseJsonRecord(raw: string, fallbackMessage: string): UnknownRecord {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed)) return parsed;
  } catch {
    // Fall through to the stable user-facing error below.
  }
  throw new Error(fallbackMessage);
}

function getPayloadError(payload: UnknownRecord): string | undefined {
  const error = isRecord(payload.error) ? payload.error : undefined;
  return asText(error?.message) ?? asText(payload.message);
}

function getCliErrorOutput(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  for (const output of [error.stderr, error.stdout]) {
    if (typeof output === "string" && output.trim()) return output.trim();
    if (Buffer.isBuffer(output) && output.length > 0) return output.toString("utf8").trim() || undefined;
  }
  return undefined;
}

function formatCliFailure(error: unknown, fallbackMessage: string): Error {
  const raw = getCliErrorOutput(error);
  if (raw) {
    try {
      const payload = JSON.parse(raw) as unknown;
      if (isRecord(payload)) {
        const message = getPayloadError(payload);
        const hint = isRecord(payload.error) ? asText(payload.error.hint) : undefined;
        if (message || hint) {
          return new Error([message, hint].filter(Boolean).join(" "));
        }
      }
    } catch {
      // Non-JSON stderr is intentionally not surfaced because it can contain local metadata.
    }
  }
  return new Error(fallbackMessage);
}

async function resolveLarkShareCliConfig(): Promise<LarkShareCliConfig> {
  const { getGlobalRuntimeEnvConfig } = await import("./claude/claude-settings.js");
  return {
    command: "lark-cli",
    runtimeEnv: getGlobalRuntimeEnvConfig(),
  };
}

async function invokeLarkShareCli(
  command: string,
  args: string[],
  runtimeEnv: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string }> {
  const { runExternalCli } = await import("./external-cli.js");
  return runExternalCli(command, args, {
    timeout: LARK_SHARE_TIMEOUT_MS,
    env: {
      ...process.env,
      ...runtimeEnv,
      LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
      LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1",
    },
  });
}

export function normalizeLarkShareQuery(query: unknown): string {
  const normalized = typeof query === "string" ? query.trim() : "";
  return Array.from(normalized).slice(0, LARK_SHARE_QUERY_LIMIT).join("");
}

export function parseLarkChatSearchResponse(raw: string): LarkShareRecipient[] {
  const payload = parseJsonRecord(raw, "飞书群聊搜索返回了无法解析的数据。");
  if (payload.ok !== true) {
    throw new Error(getPayloadError(payload) ?? "飞书群聊搜索失败。");
  }

  const data = isRecord(payload.data) ? payload.data : {};
  const chats = Array.isArray(data.chats) ? data.chats : [];
  const recipients: LarkShareRecipient[] = [];
  const seen = new Set<string>();
  for (const value of chats) {
    if (!isRecord(value)) continue;
    const id = asText(value.chat_id);
    const name = asText(value.name);
    const status = asText(value.chat_status);
    if (!id || !name || status !== "normal" || seen.has(id)) continue;
    seen.add(id);
    const recipient: LarkShareRecipient = {
      kind: "chat",
      id,
      name,
      detail: value.external === true ? "外部群聊" : "群聊",
    };
    const avatarUrl = asText(value.avatar);
    if (avatarUrl) recipient.avatarUrl = avatarUrl;
    recipients.push(recipient);
    if (recipients.length >= LARK_SHARE_SEARCH_LIMIT) break;
  }
  return recipients;
}

export async function searchLarkShareChatsWithCli(
  query: string,
  config: LarkShareCliConfig,
  invoke: LarkShareCliInvoker,
): Promise<LarkShareRecipient[]> {
  try {
    const { stdout } = await invoke(config.command, [
      "im",
      "+chat-search",
      "--query",
      query,
      "--page-size",
      String(LARK_SHARE_SEARCH_LIMIT),
      "--as",
      "user",
      "--format",
      "json",
    ], config.runtimeEnv);
    return parseLarkChatSearchResponse(stdout);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("飞书群聊搜索")) throw error;
    throw formatCliFailure(error, "飞书群聊搜索失败，请检查 lark-cli 用户登录及 im:chat:read 权限。");
  }
}

export async function searchLarkShareRecipientsWithCli(
  query: unknown,
  config: LarkShareCliConfig,
  invoke: LarkShareCliInvoker,
  searchContacts: LarkContactSearcher = searchLarkContacts,
): Promise<LarkShareRecipient[]> {
  const normalizedQuery = normalizeLarkShareQuery(query);
  if (!normalizedQuery) return [];

  const [peopleResult, chatsResult] = await Promise.allSettled([
    searchContacts(normalizedQuery),
    searchLarkShareChatsWithCli(normalizedQuery, config, invoke),
  ]);
  const recipients: LarkShareRecipient[] = [];
  if (peopleResult.status === "fulfilled") {
    recipients.push(...peopleResult.value.map((contact) => ({
      kind: "user" as const,
      id: contact.openId,
      name: contact.name,
      detail: contact.department,
    })));
  }
  if (chatsResult.status === "fulfilled") {
    recipients.push(...chatsResult.value);
  }
  if (peopleResult.status === "rejected" && chatsResult.status === "rejected") {
    const reasons = [peopleResult.reason, chatsResult.reason]
      .map((reason) => reason instanceof Error ? reason.message : String(reason))
      .filter(Boolean);
    throw new Error(reasons[0] ?? "飞书收件人搜索失败，请检查 lark-cli 配置和权限。");
  }
  return recipients;
}

export async function searchLarkShareRecipients(query: unknown): Promise<LarkShareRecipient[]> {
  const config = await resolveLarkShareCliConfig();
  return searchLarkShareRecipientsWithCli(query, config, invokeLarkShareCli);
}

export async function searchLarkShareChats(query: unknown): Promise<LarkShareRecipient[]> {
  const normalizedQuery = normalizeLarkShareQuery(query);
  if (!normalizedQuery) return [];
  const config = await resolveLarkShareCliConfig();
  return searchLarkShareChatsWithCli(normalizedQuery, config, invokeLarkShareCli);
}

function normalizeLarkShareSendInput(input: unknown): LarkShareSendInput {
  if (!isRecord(input) || !isRecord(input.recipient)) {
    throw new Error("请选择要发送的飞书人员或群聊。");
  }
  const kind = input.recipient.kind;
  const id = asText(input.recipient.id);
  const name = asText(input.recipient.name) ?? "飞书收件人";
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if ((kind !== "user" && kind !== "chat") || !id) {
    throw new Error("飞书收件人无效，请重新选择。");
  }
  if ((kind === "user" && !id.startsWith("ou_")) || (kind === "chat" && !id.startsWith("oc_"))) {
    throw new Error("飞书收件人标识无效，请重新选择。");
  }
  if (!text) throw new Error("没有可发送的消息内容。");
  if (Array.from(text).length > LARK_SHARE_TEXT_LIMIT) {
    throw new Error(`消息超过 ${LARK_SHARE_TEXT_LIMIT.toLocaleString()} 字，暂时无法作为单条飞书消息发送。`);
  }
  return {
    recipient: {
      kind,
      id,
      name,
      detail: asText(input.recipient.detail),
      avatarUrl: asText(input.recipient.avatarUrl),
    },
    text,
  };
}

export function buildLarkShareSendArgs(input: LarkShareSendInput, idempotencyKey: string): string[] {
  const content = JSON.stringify({
    zh_cn: { content: [[{ tag: "md", text: input.text }]] },
  });
  return [
    "im",
    "+messages-send",
    input.recipient.kind === "user" ? "--user-id" : "--chat-id",
    input.recipient.id,
    "--msg-type",
    "post",
    "--content",
    content,
    "--as",
    "user",
    "--idempotency-key",
    idempotencyKey,
  ];
}

export function parseLarkShareSendResponse(raw: string): LarkShareSendResult {
  const payload = parseJsonRecord(raw, "飞书消息发送返回了无法解析的数据。");
  if (payload.ok === false) {
    throw new Error(getPayloadError(payload) ?? "飞书消息发送失败。");
  }
  const data = isRecord(payload.data) ? payload.data : payload;
  return {
    messageId: asText(data.message_id),
    chatId: asText(data.chat_id),
  };
}

export async function sendLarkShareMessageWithCli(
  input: unknown,
  config: LarkShareCliConfig,
  invoke: LarkShareCliInvoker,
  idempotencyKey = `techcc-share-${randomUUID()}`,
): Promise<LarkShareSendResult> {
  const normalized = normalizeLarkShareSendInput(input);
  try {
    const { stdout } = await invoke(
      config.command,
      buildLarkShareSendArgs(normalized, idempotencyKey),
      config.runtimeEnv,
    );
    return parseLarkShareSendResponse(stdout);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("飞书消息发送")) throw error;
    throw formatCliFailure(
      error,
      "飞书消息发送失败，请确认当前登录用户可以访问目标会话，并检查 im:message.send_as_user 和 im:message 权限。",
    );
  }
}

export async function sendLarkShareMessage(input: unknown): Promise<LarkShareSendResult> {
  const config = await resolveLarkShareCliConfig();
  return sendLarkShareMessageWithCli(input, config, invokeLarkShareCli);
}
