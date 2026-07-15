import http, { type IncomingMessage, type ServerResponse } from "http";
import {
  CODEX_OAUTH_BASE_URL,
  buildCodexRequestHeaders,
  buildCodexResponsesRequest,
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
} from "../config-store.js";
import { listenWithWindowsPortOwnerKill } from "../local-port-guard.js";

const CODEX_PROXY_HOST = "127.0.0.1";
const DEFAULT_CODEX_PROXY_PORT = 14559;
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const CODEX_UPSTREAM_IDLE_TIMEOUT_MS = 120_000;

let proxyServer: http.Server | null = null;
const credentialRefreshes = new Map<string, Promise<CodexOAuthCredential>>();

export function resolveCodexProxyPort(): number {
  const rawPort = process.env.TECH_CC_HUB_CODEX_PROXY_PORT?.trim();
  if (!rawPort) {
    return DEFAULT_CODEX_PROXY_PORT;
  }
  const parsed = Number.parseInt(rawPort, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65_536
    ? parsed
    : DEFAULT_CODEX_PROXY_PORT;
}

export function getCodexAnthropicProxyBaseURL(profileId: string): string {
  ensureCodexAnthropicProxy();
  return `http://${CODEX_PROXY_HOST}:${resolveCodexProxyPort()}/codex/${encodeURIComponent(profileId)}`;
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

  const handleListenError = (error: NodeJS.ErrnoException) => {
    console.error("[codex-proxy] failed:", error);
    resetServerState();
  };
  server.on("close", () => {
    resetServerState();
  });
  const port = resolveCodexProxyPort();
  server.on("listening", () => {
    console.info(`[codex-proxy] listening on http://${CODEX_PROXY_HOST}:${port}`);
  });
  listenWithWindowsPortOwnerKill(server, {
    host: CODEX_PROXY_HOST,
    label: "codex-proxy",
    onError: handleListenError,
    port,
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

    const parsedUrl = new URL(request.url ?? "/", `http://${CODEX_PROXY_HOST}:${resolveCodexProxyPort()}`);
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
    let credential = await getUsableCredential(profile);
    const wantsStream = anthropicRequest.stream === true;
    const upstreamPayload = {
      ...codexRequest,
      stream: true,
    };
    const upstreamUrl = new URL(getCodexResponsesPath(String(anthropicRequest.model ?? "")), profile.baseURL || CODEX_OAUTH_BASE_URL);
    const upstreamWatchdog = createUpstreamIdleWatchdog();
    try {
      const fetchUpstream = async () => await fetch(upstreamUrl.toString(), {
          method: "POST",
          headers: buildCodexRequestHeaders(credential, true),
          body: JSON.stringify(upstreamPayload),
          signal: upstreamWatchdog.signal,
        });
      let upstream = await fetchUpstream();
      upstreamWatchdog.touch();

      if (upstream.status === 401) {
        await readUpstreamText(upstream, upstreamWatchdog.touch);
        credential = await getUsableCredential(profile, true);
        upstream = await fetchUpstream();
        upstreamWatchdog.touch();
      }

      if (!upstream.ok) {
        const upstreamText = await readUpstreamText(upstream, upstreamWatchdog.touch);
        writeJson(response, upstream.status, {
          error: {
            message: extractResponseErrorText(upstreamText) || upstream.statusText,
          },
        });
        return;
      }

      if (wantsStream) {
        await streamCodexResponse(upstream, response, codexRequest.model, upstreamWatchdog.touch);
        return;
      }

      const upstreamText = await readUpstreamText(upstream, upstreamWatchdog.touch);
      const upstreamJson = parseCodexResponsesStream(upstreamText);
      writeJson(response, 200, toAnthropicMessageResponse(upstreamJson, codexRequest.model));
    } finally {
      upstreamWatchdog.dispose();
    }
  } catch (error) {
    if (response.headersSent) {
      writeSse(response, "error", {
        type: "error",
        error: {
          type: "api_error",
          message: error instanceof Error ? error.message : String(error),
        },
      });
      response.end();
      return;
    }
    writeJson(response, 500, {
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

function createUpstreamIdleWatchdog(timeoutMs = CODEX_UPSTREAM_IDLE_TIMEOUT_MS): {
  signal: AbortSignal;
  touch: () => void;
  dispose: () => void;
} {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const dispose = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = undefined;
  };

  const touch = () => {
    if (controller.signal.aborted) return;
    dispose();
    timer = setTimeout(() => {
      controller.abort(new Error("Codex upstream did not send data for 2 minutes."));
    }, timeoutMs);
    timer.unref?.();
  };

  touch();
  return { signal: controller.signal, touch, dispose };
}

async function readUpstreamText(upstream: Response, onActivity: () => void): Promise<string> {
  const reader = upstream.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onActivity();
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function streamCodexResponse(
  upstream: Response,
  response: ServerResponse,
  fallbackModel: string,
  onActivity: () => void,
): Promise<void> {
  const reader = upstream.body?.getReader();
  if (!reader) {
    throw new Error("Codex upstream returned no response body.");
  }

  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });

  const decoder = new TextDecoder();
  let buffer = "";
  let messageStarted = false;
  let nextBlockIndex = 0;
  let activeTextBlockIndex: number | null = null;
  let emittedText = false;
  let emittedAnyBlock = false;
  let emittedToolUse = false;
  let completed = false;
  const completedOutputItems: Record<string, unknown>[] = [];

  const startMessage = (model = fallbackModel) => {
    if (messageStarted) return;
    messageStarted = true;
    writeSse(response, "message_start", {
      type: "message_start",
      message: {
        id: `msg_${Date.now().toString(36)}`,
        type: "message",
        role: "assistant",
        model,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    });
  };

  const closeTextBlock = () => {
    if (activeTextBlockIndex === null) return;
    writeSse(response, "content_block_stop", {
      type: "content_block_stop",
      index: activeTextBlockIndex,
    });
    activeTextBlockIndex = null;
  };

  const emitText = (text: string) => {
    if (!text) return;
    emittedText = true;
    startMessage();
    if (activeTextBlockIndex === null) {
      activeTextBlockIndex = nextBlockIndex;
      nextBlockIndex += 1;
      writeSse(response, "content_block_start", {
        type: "content_block_start",
        index: activeTextBlockIndex,
        content_block: { type: "text", text: "" },
      });
    }
    writeSse(response, "content_block_delta", {
      type: "content_block_delta",
      index: activeTextBlockIndex,
      delta: { type: "text_delta", text },
    });
    emittedAnyBlock = true;
  };

  const emitToolUse = (id: string, name: string, input: unknown) => {
    closeTextBlock();
    startMessage();
    const index = nextBlockIndex;
    nextBlockIndex += 1;
    writeSse(response, "content_block_start", {
      type: "content_block_start",
      index,
      content_block: { type: "tool_use", id, name, input: {} },
    });
    writeSse(response, "content_block_delta", {
      type: "content_block_delta",
      index,
      delta: { type: "input_json_delta", partial_json: JSON.stringify(input ?? {}) },
    });
    writeSse(response, "content_block_stop", { type: "content_block_stop", index });
    emittedAnyBlock = true;
    emittedToolUse = true;
  };

  const emitResponseBlocks = (payload: Record<string, unknown>) => {
    const output = Array.isArray(payload.output) ? payload.output : completedOutputItems;
    const message = toAnthropicMessageResponse({ ...payload, output }, fallbackModel);
    for (const block of message.content) {
      if (block.type === "text") {
        if (!emittedText) emitText(block.text);
        continue;
      }
      emitToolUse(block.id, block.name, block.input);
    }
  };

  const completeResponse = (payload: Record<string, unknown>) => {
    if (completed) return;
    if (!emittedAnyBlock) emitResponseBlocks(payload);
    closeTextBlock();
    startMessage(readString(payload.model) || fallbackModel);
    const usage = isRecord(payload.usage) ? payload.usage : {};
    writeSse(response, "message_delta", {
      type: "message_delta",
      delta: {
        stop_reason: emittedToolUse ? "tool_use" : "end_turn",
        stop_sequence: null,
      },
      usage: { output_tokens: readNumber(usage.output_tokens) ?? 0 },
    });
    writeSse(response, "message_stop", { type: "message_stop" });
    response.end();
    completed = true;
  };

  const processEvent = (payload: Record<string, unknown>) => {
    const type = readString(payload.type);
    if (type === "response.created" && isRecord(payload.response)) {
      startMessage(readString(payload.response.model) || fallbackModel);
      return;
    }
    if (type === "response.output_text.delta") {
      const delta = readString(payload.delta);
      if (delta) {
        emitText(delta);
      }
      return;
    }
    if (type === "response.output_text.done") {
      if (!emittedText) emitText(readString(payload.text));
      closeTextBlock();
      return;
    }
    if (type === "response.output_item.done" && isRecord(payload.item)) {
      completedOutputItems.push(payload.item);
      emitResponseBlocks({ output: [payload.item] });
      return;
    }
    if (type === "response.completed" && isRecord(payload.response)) {
      completeResponse(payload.response);
      return;
    }
    if (type === "response.failed" || type === "error") {
      throw new Error(readString(payload.error) || readString(payload.message) || "Codex upstream response failed.");
    }
  };

  const processBufferedEvents = () => {
    const normalized = buffer.replace(/\r\n/g, "\n");
    const frames = normalized.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data || data === "[DONE]") continue;
      const payload = JSON.parse(data) as unknown;
      if (isRecord(payload)) processEvent(payload);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onActivity();
      buffer += decoder.decode(value, { stream: true });
      processBufferedEvents();
    }
    buffer += decoder.decode();
    processBufferedEvents();
    if (!completed) {
      throw new Error("Codex upstream stream ended without a completed response.");
    }
  } finally {
    reader.releaseLock();
  }
}

async function getUsableCredential(profile: ApiConfig, forceRefresh = false): Promise<CodexOAuthCredential> {
  const credential = parseCodexOAuthCredential(profile.apiKey);
  if (!forceRefresh && !needsCredentialRefresh(credential)) {
    return credential;
  }

  const inFlightRefresh = credentialRefreshes.get(profile.id);
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const refresh = refreshCredentialForProfile(profile.id, credential, forceRefresh)
    .finally(() => {
      credentialRefreshes.delete(profile.id);
    });
  credentialRefreshes.set(profile.id, refresh);
  return refresh;
}

async function refreshCredentialForProfile(
  profileId: string,
  staleCredential: CodexOAuthCredential,
  forceRefresh = false,
): Promise<CodexOAuthCredential> {
  const latestCredential = readProfileCredential(profileId);
  if (
    latestCredential
    && !needsCredentialRefresh(latestCredential)
    && (!forceRefresh || latestCredential.accessToken !== staleCredential.accessToken)
  ) {
    return latestCredential;
  }

  const credential = latestCredential ?? staleCredential;
  try {
    const refreshed = tokenResultToCredential(
      await refreshCodexOAuthToken(credential.refreshToken ?? ""),
      credential,
    );
    saveRefreshedCredential(profileId, refreshed);
    return refreshed;
  } catch (error) {
    const recoveredCredential = readProfileCredential(profileId);
    if (
      recoveredCredential
      && !needsCredentialRefresh(recoveredCredential)
      && (!forceRefresh || recoveredCredential.accessToken !== staleCredential.accessToken)
    ) {
      return recoveredCredential;
    }

    throw new Error(buildRefreshFailureMessage(error));
  }
}

function readProfileCredential(profileId: string): CodexOAuthCredential | null {
  const profile = loadApiConfigSettings().profiles.find((item) => item.id === profileId);
  if (!profile?.apiKey) {
    return null;
  }

  try {
    return parseCodexOAuthCredential(profile.apiKey);
  } catch {
    return null;
  }
}

function needsCredentialRefresh(credential: CodexOAuthCredential): boolean {
  if (!isCredentialLikelyUsable(credential)) {
    return true;
  }
  return shouldRefreshCodexCredential(credential);
}

function isCredentialLikelyUsable(credential: CodexOAuthCredential): boolean {
  if (!credential.accessToken || !credential.accountId) {
    return false;
  }

  const expiresAt = Date.parse(credential.expired ?? "");
  return !Number.isFinite(expiresAt) || expiresAt - Date.now() > 60_000;
}

function buildRefreshFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/refresh token.*already been used|already been used.*refresh token|invalid_grant/i.test(message)) {
    return `${message} 请在 tech-cc-hub 设置中重新连接 ChatGPT 账号。`;
  }
  return message;
}

function saveRefreshedCredential(profileId: string, credential: CodexOAuthCredential): void {
  const settings = loadApiConfigSettings();
  const nextProfiles = settings.profiles.map((profile) => profile.id === profileId
    ? { ...profile, apiKey: encodeCodexOAuthCredential(credential) }
    : profile);
  saveApiConfigSettings({ profiles: nextProfiles });
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES) {
      throw new Error("request body too large");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function writeSse(response: ServerResponse, event: string, payload: unknown): void {
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function extractResponseErrorText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const payload = JSON.parse(trimmed) as unknown;
    if (!isRecord(payload)) {
      return trimmed;
    }
    if (isRecord(payload.error)) {
      return typeof payload.error.message === "string" ? payload.error.message : trimmed;
    }
    return typeof payload.message === "string"
      ? payload.message
      : trimmed;
  } catch {
    return trimmed;
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
