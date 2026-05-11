import { randomBytes, createHash } from "crypto";
import {
  CODEX_OAUTH_BASE_URL,
  CODEX_OAUTH_COMPACT_MODEL_SUFFIX,
  CODEX_OAUTH_DEFAULT_MODEL,
  CODEX_OAUTH_MODELS,
  CODEX_OAUTH_SMALL_MODEL,
  extractCodexModelIdsFromCache,
  mergeCodexModelIds,
} from "../../shared/codex-oauth.js";

export {
  CODEX_OAUTH_BASE_URL,
  CODEX_OAUTH_COMPACT_MODEL_SUFFIX,
  CODEX_OAUTH_DEFAULT_MODEL,
  CODEX_OAUTH_MODELS,
  CODEX_OAUTH_SMALL_MODEL,
  extractCodexModelIdsFromCache,
  mergeCodexModelIds,
};

export type CodexOAuthCredential = {
  accessToken: string;
  refreshToken?: string;
  accountId: string;
  email?: string;
  type?: string;
  expired?: string;
  lastRefresh?: string;
};

export type CodexStoredOAuthCredential = {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  account_id?: string;
  last_refresh?: string;
  email?: string;
  type?: string;
  expired?: string;
};

export type CodexOAuthFlow = {
  state: string;
  verifier: string;
  challenge: string;
  authorizeUrl: string;
  createdAt: number;
};

export type CodexTokenResult = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  accountId: string;
  email?: string;
};

export type CodexResponsesStreamEvent = {
  type?: string;
  response?: Record<string, unknown>;
  item?: Record<string, unknown>;
  delta?: string;
  text?: string;
};

export type AnthropicMessagesRequest = {
  model?: string;
  max_tokens?: number;
  system?: unknown;
  messages?: Array<{
    role?: string;
    content?: unknown;
  }>;
  tools?: Array<{
    name?: string;
    description?: string;
    input_schema?: Record<string, unknown>;
  }>;
  tool_choice?: unknown;
  stream?: boolean;
};

export type CodexResponsesRequest = {
  model: string;
  instructions: string;
  input: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  tool_choice?: unknown;
  store: false;
  stream?: boolean;
};

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

export type AnthropicMessageResponse = {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: AnthropicContentBlock[];
  stop_reason: "end_turn" | "tool_use";
  stop_sequence: null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CODEX_OAUTH_AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
const CODEX_OAUTH_TOKEN_URL = "https://auth.openai.com/oauth/token";
const CODEX_OAUTH_REDIRECT_URI = "http://localhost:1455/auth/callback";
const CODEX_OAUTH_SCOPE = "openid profile email offline_access";
const CODEX_JWT_AUTH_CLAIM = "https://api.openai.com/auth";

export function parseCodexOAuthCredential(raw: string): CodexOAuthCredential {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    throw new Error("Codex OAuth 凭据必须是 JSON 对象。");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Codex OAuth 凭据必须是合法 JSON。");
  }

  if (!isRecord(parsed) || Array.isArray(parsed)) {
    throw new Error("Codex OAuth 凭据必须是 JSON 对象。");
  }

  const accessToken = stringValue(parsed.access_token);
  const accountId = stringValue(parsed.account_id);
  if (!accessToken) {
    throw new Error("Codex OAuth 凭据缺少 access_token。");
  }
  if (!accountId) {
    throw new Error("Codex OAuth 凭据缺少 account_id。");
  }

  return removeUndefined({
    accessToken,
    accountId,
    refreshToken: stringValue(parsed.refresh_token) || undefined,
    email: stringValue(parsed.email) || undefined,
    type: stringValue(parsed.type) || undefined,
    expired: stringValue(parsed.expired) || undefined,
    lastRefresh: stringValue(parsed.last_refresh) || undefined,
  }) as CodexOAuthCredential;
}

export function encodeCodexOAuthCredential(input: CodexOAuthCredential): string {
  const stored: CodexStoredOAuthCredential = {
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    account_id: input.accountId,
    last_refresh: input.lastRefresh,
    email: input.email,
    type: input.type || "codex",
    expired: input.expired,
  };

  return JSON.stringify(removeUndefined(stored), null, 2);
}

export function createCodexOAuthAuthorizationFlow(): CodexOAuthFlow {
  const state = randomBytes(16).toString("hex");
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const url = new URL(CODEX_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CODEX_OAUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", CODEX_OAUTH_REDIRECT_URI);
  url.searchParams.set("scope", CODEX_OAUTH_SCOPE);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  url.searchParams.set("originator", "codex_cli_rs");

  return {
    state,
    verifier,
    challenge,
    authorizeUrl: url.toString(),
    createdAt: Date.now(),
  };
}

export function parseCodexAuthorizationInput(input: string): { code: string; state: string } {
  const value = input.trim();
  if (!value) {
    throw new Error("授权回调为空。");
  }

  if (value.includes("#")) {
    const [code, state] = value.split("#", 2).map((item) => item.trim());
    return { code, state };
  }

  if (value.includes("code=")) {
    try {
      const url = new URL(value);
      return {
        code: url.searchParams.get("code")?.trim() ?? "",
        state: url.searchParams.get("state")?.trim() ?? "",
      };
    } catch {
      const query = new URLSearchParams(value);
      return {
        code: query.get("code")?.trim() ?? "",
        state: query.get("state")?.trim() ?? "",
      };
    }
  }

  return { code: value, state: "" };
}

export async function exchangeCodexAuthorizationCode(
  code: string,
  verifier: string,
): Promise<CodexTokenResult> {
  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("client_id", CODEX_OAUTH_CLIENT_ID);
  form.set("code", code.trim());
  form.set("code_verifier", verifier.trim());
  form.set("redirect_uri", CODEX_OAUTH_REDIRECT_URI);

  return requestCodexOAuthToken(form, "授权码交换失败");
}

export async function refreshCodexOAuthToken(refreshToken: string): Promise<CodexTokenResult> {
  const form = new URLSearchParams();
  form.set("grant_type", "refresh_token");
  form.set("client_id", CODEX_OAUTH_CLIENT_ID);
  form.set("refresh_token", refreshToken.trim());

  return requestCodexOAuthToken(form, "刷新授权失败");
}

export function shouldRefreshCodexCredential(credential: CodexOAuthCredential, now = Date.now()): boolean {
  if (!credential.refreshToken || !credential.expired) {
    return false;
  }
  const expiresAt = Date.parse(credential.expired);
  if (!Number.isFinite(expiresAt)) {
    return false;
  }
  return expiresAt - now < 60_000;
}

export function tokenResultToCredential(result: CodexTokenResult, previous?: CodexOAuthCredential): CodexOAuthCredential {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    accountId: result.accountId || previous?.accountId || "",
    email: result.email || previous?.email,
    type: "codex",
    expired: result.expiresAt.toISOString(),
    lastRefresh: new Date().toISOString(),
  };
}

export function buildCodexResponsesRequest(request: AnthropicMessagesRequest): CodexResponsesRequest {
  const model = stringValue(request.model);
  if (!model) {
    throw new Error("请求缺少模型。");
  }

  const codexModel = model.endsWith(CODEX_OAUTH_COMPACT_MODEL_SUFFIX)
    ? model.slice(0, -CODEX_OAUTH_COMPACT_MODEL_SUFFIX.length)
    : model;

  const tools = convertAnthropicTools(request.tools);
  const output: CodexResponsesRequest = {
    model: codexModel,
    instructions: normalizeSystemPrompt(request.system),
    input: convertAnthropicMessages(request.messages),
    store: false,
    ...(tools.length > 0 ? { tools } : {}),
  };

  const toolChoice = convertToolChoice(request.tool_choice);
  if (toolChoice !== undefined) {
    output.tool_choice = toolChoice;
  }

  return output;
}

export function getCodexResponsesPath(model: string): string {
  return model.endsWith(CODEX_OAUTH_COMPACT_MODEL_SUFFIX)
    ? "/backend-api/codex/responses/compact"
    : "/backend-api/codex/responses";
}

export function toAnthropicMessageResponse(payload: unknown, fallbackModel: string): AnthropicMessageResponse {
  const record = isRecord(payload) ? payload : {};
  const content = extractAnthropicContentBlocks(record);
  const hasToolUse = content.some((block) => block.type === "tool_use");
  const usage = isRecord(record.usage) ? record.usage : {};

  return {
    id: stringValue(record.id) || `msg_${randomBytes(8).toString("hex")}`,
    type: "message",
    role: "assistant",
    model: stringValue(record.model) || fallbackModel,
    content: content.length > 0 ? content : [{ type: "text", text: "" }],
    stop_reason: hasToolUse ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: numberValue(usage.input_tokens) ?? numberValue(usage.inputTokens) ?? 0,
      output_tokens: numberValue(usage.output_tokens) ?? numberValue(usage.outputTokens) ?? 0,
    },
  };
}

export function parseCodexResponsesStream(text: string): Record<string, unknown> {
  const outputItems: Record<string, unknown>[] = [];
  let completedResponse: Record<string, unknown> | null = null;
  let responseId = "";
  let model = "";
  let textFallback = "";

  for (const event of parseSseEvents(text)) {
    if (isRecord(event.response)) {
      const response = event.response;
      responseId = stringValue(response.id) || responseId;
      model = stringValue(response.model) || model;
      if (response.status === "completed") {
        completedResponse = response;
      }
    }

    if (event.type === "response.output_text.done") {
      textFallback = stringValue(event.text) || textFallback;
    }

    if (event.type === "response.output_item.done" && isRecord(event.item)) {
      outputItems.push(event.item);
    }
  }

  const response = completedResponse ?? {};
  const responseOutput = Array.isArray(response.output) ? response.output.filter(isRecord) : [];
  const output = outputItems.length > 0
    ? outputItems
    : responseOutput.length > 0
      ? responseOutput
      : textFallback
        ? [{ type: "message", content: [{ type: "output_text", text: textFallback }] }]
        : [];

  return {
    ...response,
    id: stringValue(response.id) || responseId || `resp_${randomBytes(8).toString("hex")}`,
    model: stringValue(response.model) || model,
    output,
  };
}

export function buildSyntheticAnthropicStream(message: AnthropicMessageResponse): string {
  const lines: string[] = [];
  pushSse(lines, "message_start", {
    type: "message_start",
    message: {
      ...message,
      content: [],
      stop_reason: null,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: 0,
      },
    },
  });

  message.content.forEach((block, index) => {
    if (block.type === "text") {
      pushSse(lines, "content_block_start", {
        type: "content_block_start",
        index,
        content_block: { type: "text", text: "" },
      });
      if (block.text) {
        pushSse(lines, "content_block_delta", {
          type: "content_block_delta",
          index,
          delta: { type: "text_delta", text: block.text },
        });
      }
    } else {
      pushSse(lines, "content_block_start", {
        type: "content_block_start",
        index,
        content_block: { type: "tool_use", id: block.id, name: block.name, input: {} },
      });
      pushSse(lines, "content_block_delta", {
        type: "content_block_delta",
        index,
        delta: {
          type: "input_json_delta",
          partial_json: JSON.stringify(block.input ?? {}),
        },
      });
    }

    pushSse(lines, "content_block_stop", {
      type: "content_block_stop",
      index,
    });
  });

  pushSse(lines, "message_delta", {
    type: "message_delta",
    delta: {
      stop_reason: message.stop_reason,
      stop_sequence: null,
    },
    usage: {
      output_tokens: message.usage.output_tokens,
    },
  });
  pushSse(lines, "message_stop", { type: "message_stop" });

  return lines.join("");
}

export function buildCodexRequestHeaders(credential: CodexOAuthCredential, stream: boolean): Record<string, string> {
  return {
    "Authorization": `Bearer ${credential.accessToken}`,
    "chatgpt-account-id": credential.accountId,
    "OpenAI-Beta": "responses=experimental",
    "originator": "codex_cli_rs",
    "Content-Type": "application/json",
    "Accept": stream ? "text/event-stream" : "application/json",
  };
}

async function requestCodexOAuthToken(form: URLSearchParams, errorPrefix: string): Promise<CodexTokenResult> {
  const response = await fetch(CODEX_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: form.toString(),
  });
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(`${errorPrefix}：${extractErrorMessage(payload) || response.statusText}`);
  }

  const record = isRecord(payload) ? payload : {};
  const accessToken = stringValue(record.access_token);
  const refreshToken = stringValue(record.refresh_token);
  const expiresIn = numberValue(record.expires_in);
  if (!accessToken || !refreshToken || !expiresIn || expiresIn <= 0) {
    throw new Error(`${errorPrefix}：响应缺少 access_token / refresh_token / expires_in。`);
  }

  const accountId = extractCodexAccountIdFromJWT(accessToken);
  if (!accountId) {
    throw new Error(`${errorPrefix}：无法从 access_token 解析 account_id。`);
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    accountId,
    email: extractEmailFromJWT(accessToken) || undefined,
  };
}

function convertAnthropicMessages(messages: AnthropicMessagesRequest["messages"]): Array<Record<string, unknown>> {
  const output: Array<Record<string, unknown>> = [];
  for (const message of messages ?? []) {
    const role = message.role === "assistant" ? "assistant" : "user";
    const content = message.content;

    if (typeof content === "string") {
      output.push({ role, content });
      continue;
    }

    if (!Array.isArray(content)) {
      continue;
    }

    const textParts: string[] = [];
    for (const block of content) {
      if (!isRecord(block)) {
        continue;
      }
      if (block.type === "text") {
        const text = stringValue(block.text);
        if (text) textParts.push(text);
        continue;
      }
      if (block.type === "tool_use") {
        if (textParts.length > 0) {
          output.push({ role: "assistant", content: textParts.join("\n") });
          textParts.length = 0;
        }
        const name = stringValue(block.name);
        const id = stringValue(block.id);
        if (name && id) {
          output.push({
            type: "function_call",
            call_id: id,
            name,
            arguments: safeJsonStringify(block.input ?? {}),
          });
        }
        continue;
      }
      if (block.type === "tool_result") {
        if (textParts.length > 0) {
          output.push({ role: "user", content: textParts.join("\n") });
          textParts.length = 0;
        }
        const callId = stringValue(block.tool_use_id);
        if (callId) {
          output.push({
            type: "function_call_output",
            call_id: callId,
            output: normalizeToolResultContent(block.content),
          });
        }
      }
    }

    if (textParts.length > 0) {
      output.push({ role, content: textParts.join("\n") });
    }
  }

  return output.length > 0 ? output : [{ role: "user", content: "" }];
}

function convertAnthropicTools(tools: AnthropicMessagesRequest["tools"]): Array<Record<string, unknown>> {
  const converted: Array<Record<string, unknown>> = [];
  for (const tool of tools ?? []) {
    const name = stringValue(tool.name);
    if (!name) {
      continue;
    }
    converted.push({
      type: "function",
      name,
      description: stringValue(tool.description) || undefined,
      parameters: tool.input_schema ?? { type: "object", properties: {} },
    });
  }
  return converted;
}

function convertToolChoice(toolChoice: unknown): unknown {
  if (!isRecord(toolChoice)) {
    return undefined;
  }
  if (toolChoice.type === "auto") {
    return "auto";
  }
  if (toolChoice.type === "none") {
    return "none";
  }
  if (toolChoice.type === "any") {
    return "required";
  }
  if (toolChoice.type === "tool") {
    const name = stringValue(toolChoice.name);
    return name ? { type: "function", name } : undefined;
  }
  return undefined;
}

function normalizeSystemPrompt(system: unknown): string {
  if (typeof system === "string") {
    return system;
  }
  if (!Array.isArray(system)) {
    return "";
  }
  return system
    .map((item) => {
      if (typeof item === "string") return item;
      if (isRecord(item) && item.type === "text") return stringValue(item.text);
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractAnthropicContentBlocks(record: Record<string, unknown>): AnthropicContentBlock[] {
  const output = Array.isArray(record.output) ? record.output : [];
  const blocks: AnthropicContentBlock[] = [];

  for (const item of output) {
    if (!isRecord(item)) {
      continue;
    }
    if (item.type === "message") {
      const content = Array.isArray(item.content) ? item.content : [];
      for (const part of content) {
        if (!isRecord(part)) {
          continue;
        }
        const text = stringValue(part.text);
        if ((part.type === "output_text" || part.type === "text") && text) {
          blocks.push({ type: "text", text });
        }
      }
      continue;
    }
    if (item.type === "function_call") {
      const callId = stringValue(item.call_id) || stringValue(item.id);
      const name = stringValue(item.name);
      if (callId && name) {
        blocks.push({
          type: "tool_use",
          id: callId,
          name,
          input: parseJsonObject(stringValue(item.arguments)),
        });
      }
      continue;
    }
    const text = stringValue(item.output_text) || stringValue(item.text);
    if (text) {
      blocks.push({ type: "text", text });
    }
  }

  const directText = stringValue(record.output_text);
  if (blocks.length === 0 && directText) {
    blocks.push({ type: "text", text: directText });
  }

  return blocks;
}

function normalizeToolResultContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === "string") return item;
      if (isRecord(item) && item.type === "text") return stringValue(item.text);
      return safeJsonStringify(item);
    }).join("\n");
  }
  return safeJsonStringify(content ?? "");
}

function extractCodexAccountIdFromJWT(token: string): string {
  const claims = decodeJwtPayload(token);
  const auth = isRecord(claims?.[CODEX_JWT_AUTH_CLAIM]) ? claims[CODEX_JWT_AUTH_CLAIM] : null;
  return auth ? stringValue(auth.chatgpt_account_id) : "";
}

function extractEmailFromJWT(token: string): string {
  const claims = decodeJwtPayload(token);
  return claims ? stringValue(claims.email) : "";
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }
  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: unknown): string {
  if (!isRecord(payload)) {
    return "";
  }
  const error = payload.error;
  if (typeof error === "string") {
    return error;
  }
  if (isRecord(error)) {
    return stringValue(error.message) || stringValue(error.error_description);
  }
  return stringValue(payload.error_description) || stringValue(payload.message);
}

function pushSse(lines: string[], event: string, data: unknown): void {
  lines.push(`event: ${event}\n`);
  lines.push(`data: ${JSON.stringify(data)}\n\n`);
}

function parseJsonObject(value: string): unknown {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseSseEvents(text: string): CodexResponsesStreamEvent[] {
  const events: CodexResponsesStreamEvent[] = [];
  const chunks = text.split(/\r?\n\r?\n/);
  for (const chunk of chunks) {
    const dataLines = chunk
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart());
    if (dataLines.length === 0) {
      continue;
    }

    const data = dataLines.join("\n").trim();
    if (!data || data === "[DONE]") {
      continue;
    }

    try {
      const parsed = JSON.parse(data) as unknown;
      if (isRecord(parsed)) {
        events.push(parsed as CodexResponsesStreamEvent);
      }
    } catch {
      // Ignore malformed SSE fragments and let callers surface upstream errors.
    }
  }
  return events;
}

function safeJsonStringify(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function base64Url(value: Buffer): string {
  return value.toString("base64url");
}

function removeUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
