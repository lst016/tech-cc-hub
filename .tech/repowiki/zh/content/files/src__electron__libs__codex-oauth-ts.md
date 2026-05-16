# src/electron/libs/codex-oauth.ts

> 模块：`electron` · 语言：`typescript` · 行数：779

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `parseCodexOAuthCredential@118`
- `encodeCodexOAuthCredential@155`
- `createCodexOAuthAuthorizationFlow@169`
- `parseCodexAuthorizationInput@194`
- `exchangeCodexAuthorizationCode@224`
- `refreshCodexOAuthToken@238`
- `shouldRefreshCodexCredential@247`
- `tokenResultToCredential@258`
- `buildCodexResponsesRequest@270`
- `getCodexResponsesPath@297`
- `toAnthropicMessageResponse@303`
- `parseCodexResponsesStream@324`
- `buildSyntheticAnthropicStream@368`
- `buildCodexRequestHeaders@434`
- `requestCodexOAuthToken@445`
- `convertAnthropicMessages@481`
- `convertAnthropicTools@547`
- `convertToolChoice@564`
- `normalizeSystemPrompt@584`
- `extractAnthropicContentBlocks@601`
- `normalizeToolResultContent@649`
- `extractCodexAccountIdFromJWT@663`
- `extractEmailFromJWT@669`
- `decodeJwtPayload@674`
- `extractErrorMessage@688`
- `pushSse@702`
- `parseJsonObject@707`
- `parseSseEvents@719`
- `safeJsonStringify@748`
- `base64Url@759`
- `stringValue@767`
- `numberValue@771`
- `isRecord@775`
- `CODEX_OAUTH_CLIENT_ID@111`
- `CODEX_OAUTH_AUTHORIZE_URL@113`
- `CODEX_OAUTH_TOKEN_URL@114`
- `CODEX_OAUTH_REDIRECT_URI@115`
- `CODEX_OAUTH_SCOPE@116`
- `CODEX_JWT_AUTH_CLAIM@117`
- `trimmed@120`

## 依赖输入

- `crypto`
- `../../shared/codex-oauth.js`

## 对外暴露

- `CodexOAuthCredential`
- `CodexStoredOAuthCredential`
- `CodexOAuthFlow`
- `CodexTokenResult`
- `CodexResponsesStreamEvent`
- `AnthropicMessagesRequest`
- `CodexResponsesRequest`
- `AnthropicContentBlock`
- `AnthropicMessageResponse`
- `parseCodexOAuthCredential`
- `encodeCodexOAuthCredential`
- `createCodexOAuthAuthorizationFlow`
- `parseCodexAuthorizationInput`
- `exchangeCodexAuthorizationCode`
- `refreshCodexOAuthToken`
- `shouldRefreshCodexCredential`
- `tokenResultToCredential`
- `buildCodexResponsesRequest`
- `getCodexResponsesPath`
- `toAnthropicMessageResponse`
- `parseCodexResponsesStream`
- `buildSyntheticAnthropicStream`
- `buildCodexRequestHeaders`
- `CODEX_OAUTH_BASE_URL`
- `CODEX_OAUTH_COMPACT_MODEL_SUFFIX`
- `CODEX_OAUTH_DEFAULT_MODEL`
- `CODEX_OAUTH_MODELS`
- `CODEX_OAUTH_SMALL_MODEL`
- `extractCodexModelIdsFromCache`
- `mergeCodexModelIds`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

  r
... (truncated)
```
