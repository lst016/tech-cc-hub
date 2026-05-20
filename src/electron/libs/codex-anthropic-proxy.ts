import http, { type IncomingMessage, type ServerResponse } from "http";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import {
  CODEX_OAUTH_BASE_URL,
  buildCodexRequestHeaders,
  buildCodexResponsesRequest,
  buildSyntheticAnthropicStream,
  encodeCodexOAuthCredential,
  getCodexResponsesPath,
  parseCodexResponsesStream,
  parseCodexCliAuthCredential,
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
const credentialRefreshes = new Map<string, Promise<CodexOAuthCredential>>();

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
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

async function getUsableCredential(profile: ApiConfig): Promise<CodexOAuthCredential> {
  const credential = parseCodexOAuthCredential(profile.apiKey);
  if (!needsCredentialRefresh(credential)) {
    return credential;
  }

  const inFlightRefresh = credentialRefreshes.get(profile.id);
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const refresh = refreshCredentialForProfile(profile.id, credential)
    .finally(() => {
      credentialRefreshes.delete(profile.id);
    });
  credentialRefreshes.set(profile.id, refresh);
  return refresh;
}

async function refreshCredentialForProfile(
  profileId: string,
  staleCredential: CodexOAuthCredential,
): Promise<CodexOAuthCredential> {
  const latestCredential = readProfileCredential(profileId);
  if (latestCredential && !needsCredentialRefresh(latestCredential)) {
    return latestCredential;
  }

  const importedCredential = readCodexCliCredential();
  if (importedCredential && !needsCredentialRefresh(importedCredential)) {
    saveRefreshedCredential(profileId, importedCredential);
    return importedCredential;
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
    if (recoveredCredential && !needsCredentialRefresh(recoveredCredential)) {
      return recoveredCredential;
    }

    const recoveredCliCredential = readCodexCliCredential();
    if (recoveredCliCredential && !needsCredentialRefresh(recoveredCliCredential)) {
      saveRefreshedCredential(profileId, recoveredCliCredential);
      return recoveredCliCredential;
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

function readCodexCliCredential(): CodexOAuthCredential | null {
  const authPath = join(process.env.CODEX_HOME || join(homedir(), ".codex"), "auth.json");
  if (!existsSync(authPath)) {
    return null;
  }

  try {
    return parseCodexCliAuthCredential(readFileSync(authPath, "utf8"));
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
    return `${message} Re-run npm run codex:oauth:setup or codex login so tech-cc-hub can import the latest Codex credentials.`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
