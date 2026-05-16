# src/electron/libs/codex-anthropic-proxy.ts

> 模块：`electron` · 语言：`typescript` · 行数：203

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getCodexAnthropicProxyBaseURL@29`
- `ensureCodexAnthropicProxy@34`
- `handleProxyRequest@63`
- `getUsableCredential@137`
- `saveRefreshedCredential@151`
- `readRequestBody@159`
- `writeJson@173`
- `extractResponseErrorText@178`
- `isRecord@199`
- `CODEX_PROXY_HOST@23`
- `CODEX_PROXY_PORT@25`
- `MAX_REQUEST_BYTES@26`
- `server@39`
- `resetServerState@44`
- `parsedUrl@75`
- `match@77`
- `profileId@82`
- `profile@84`
- `body@89`
- `anthropicRequest@91`
- `codexRequest@92`
- `credential@93`
- `wantsStream@94`
- `upstreamPayload@95`
- `upstreamUrl@99`
- `upstream@100`
- `upstreamText@105`
- `upstreamJson@115`
- `message@117`
- `credential@139`
- `refreshed@143`
- `settings@153`
- `nextProfiles@154`
- `size@162`
- `buffer@164`
- `trimmed@180`
- `payload@185`
- `AnthropicMessagesRequest@15`
- `CodexOAuthCredential@16`
- `ApiConfig@21`

## 依赖输入

- `http`
- `./codex-oauth.js`
- `./config-store.js`

## 对外暴露

- `getCodexAnthropicProxyBaseURL`
- `ensureCodexAnthropicProxy`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import http, { type IncomingMessage, type ServerResponse } from "http";
import {
  CODEX_OAUTH_BASE_URL,
  buildCodexRequestHeaders,
  buildCodexResponsesRequest,
  buildSyntheticAnthropicStream,
  encodeCodexOAuthCredential,
  getCodexResponsesPath,
  parseCodexResponsesStream,
  parseCodexOAuthCredential,
  refreshCodexOAuthToken,
  shouldRefreshCodexCredential,
  toAnthropicMessageResponse,
  tokenResultToCredential,
  type AnthropicMessagesRequest,
  type CodexOAuthCredential,
} from "./codex-oauth.js";
import {
  loadApiConfigSettings,
  saveApiConfigSettings,
  type ApiConfig,
} from "./config-store.js";

const CODEX_PROXY_HOST = "127.0.0.1";
const CODEX_PROXY_PORT = 14559;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;

let proxyServer: http.Server | null = null;

export function getCodexAnthropicProxyBaseURL(profileId: string): string {
  ensureCodexAnthropicProxy();
  return `http://${CODEX_PROXY_HOST}:${CODEX_PROXY_PORT}/codex/${encodeURIComponent(profileId)}`;
}

export function ensureCodexAnthropicProxy(): void {
  if (proxyServer) {
    return;
  }
  const server = http.createServer((request, response) => {
    void handleProxyRequest(request, response);
  });

  proxyServer = server;

  const resetServerState = () => {
    if (proxyServer !== server) {
      return;
    }
    proxyServer = null;
  };

  server.on("error", (error) => {
    console.error("[codex-proxy] failed:", error);
    resetServerState();
  });
  server.on("close", () => {
    resetServerState();
  });
  server.listen(CODEX_PROXY_PORT, CODEX_PROXY_HOST, () => {
    console.info(`[codex-proxy] listening on http://${CODEX_PROXY_HOST}:${CODEX_PROXY_PORT}`);
  });
}

async function handleProxyRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    if (request.method === "GET" && request.url === "/health") {
      writeJson(response, 200, { ok: true });
      return;
    }

    if (request.method !== "POST") {
      writeJson(response, 405, { error: { message: "method not allowed" } });
      return;
    }

    const parsedUrl = new URL(request.url ?? "/", `http://${CODEX_PROXY_HOST}:${CODEX_PROXY_PORT}`);
    const match = /^\/codex\/([^/]+)\/v1\/messages$/.exec(parsedUrl.pathname);
    if (!match) {
      writeJson(response, 404, { error: { message: "route not found" } });
      return;
    }

    const profileId = decodeURIComponent(match[1] ?? "");
    const profile = loadApiConfigSettings().profiles.find((item) => item.id === profileId);
    if (!profile || profile.provider !== "codex") {
      writeJson(response, 404, { error: { message: "Codex OAuth profile not found" } });
      return;
    }

    const body = await readRequestBody(request);
    const anthropicRequest = JSON.parse(body) as AnthropicMessagesRequest;
    const codexRequest = buildCodexResponsesRequest(anthropicRequest);
    const credential = await getUsableCredential(profile);
    const wantsStream = anthropicRequest.stream === true;
    const upstreamPayload = {
      ...codexRequest,
      stream: true,
    };
    const upstreamUrl = new URL(getCodexResponsesPath(String(anthropicRequest.model ?? "")), profile.baseURL || CODEX_OAUTH_BASE_URL);
    const upstream = await fetch(upstreamUrl.toString(), {
      method: "POST",
      headers: buildCodexRequestHeaders(credential, true),
      body: JSON.stringify(upstreamPayload),
    });
    const upstreamText = await upstream.text();

    if (!upstream.ok) {
      writeJson(response, upstream.status, {
        error: {
          message: extractResponseErrorText(upstreamText) || upstream.statusText,
        },
      });
      return;
    }

    const upstreamJson = parseCodexResponsesStream(upstreamText);
    const message = toAnthropicMessageResponse(upstreamJson, codexRequest.model);
    if (wantsStream) {
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      response.end(buildSyntheticAnthropicStream(message));
      return;
    }

    writeJson(response, 200, message);
  } catch (error) {
    writeJson(response, 500, {
      error: {
        message: error instanceof E
... (truncated)
```
