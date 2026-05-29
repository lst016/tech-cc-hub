import http, { type IncomingMessage, type ServerResponse } from "http";

import {
  loadApiConfigSettings,
  type ApiConfig,
} from "../config-store.js";
import {
  sanitizeAnthropicMessagesPayload,
} from "./anthropic-compat.js";

const ANTHROPIC_COMPAT_PROXY_HOST = "127.0.0.1";
const DEFAULT_ANTHROPIC_COMPAT_PROXY_PORT = 14561;
const MAX_REQUEST_BYTES = 16 * 1024 * 1024;

let proxyServer: http.Server | null = null;

export function resolveAnthropicCompatProxyPort(): number {
  const rawPort = process.env.TECH_CC_HUB_ANTHROPIC_COMPAT_PROXY_PORT?.trim();
  if (!rawPort) {
    return DEFAULT_ANTHROPIC_COMPAT_PROXY_PORT;
  }
  const parsed = Number.parseInt(rawPort, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65_536
    ? parsed
    : DEFAULT_ANTHROPIC_COMPAT_PROXY_PORT;
}

export function getAnthropicCompatProxyBaseURL(profileId: string): string {
  ensureAnthropicCompatProxy();
  return `http://${ANTHROPIC_COMPAT_PROXY_HOST}:${resolveAnthropicCompatProxyPort()}/anthropic/${encodeURIComponent(profileId)}`;
}

export function ensureAnthropicCompatProxy(): void {
  if (proxyServer) {
    return;
  }

  const server = http.createServer((request, response) => {
    void handleProxyRequest(request, response);
  });
  proxyServer = server;

  const resetServerState = () => {
    if (proxyServer === server) {
      proxyServer = null;
    }
  };

  server.on("error", (error) => {
    console.error("[anthropic-compat-proxy] failed:", error);
    resetServerState();
  });
  server.on("close", resetServerState);

  const port = resolveAnthropicCompatProxyPort();
  server.listen(port, ANTHROPIC_COMPAT_PROXY_HOST, () => {
    console.info(`[anthropic-compat-proxy] listening on http://${ANTHROPIC_COMPAT_PROXY_HOST}:${port}`);
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

    const parsedUrl = new URL(request.url ?? "/", `http://${ANTHROPIC_COMPAT_PROXY_HOST}:${resolveAnthropicCompatProxyPort()}`);
    const match = /^\/anthropic\/([^/]+)\/v1\/messages$/.exec(parsedUrl.pathname);
    if (!match) {
      writeJson(response, 404, { error: { message: "route not found" } });
      return;
    }

    const profileId = decodeURIComponent(match[1] ?? "");
    const profile = loadApiConfigSettings().profiles.find((item) => item.id === profileId);
    if (!profile || profile.provider === "codex") {
      writeJson(response, 404, { error: { message: "Anthropic-compatible profile not found" } });
      return;
    }

    const body = await readRequestBody(request);
    const upstreamPayload = sanitizeAnthropicMessagesPayload(JSON.parse(body));
    const upstreamUrl = buildUpstreamMessagesUrl(profile);
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: buildUpstreamHeaders(request, profile),
      body: JSON.stringify(upstreamPayload),
    });

    const responseBody = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, buildResponseHeaders(upstream));
    response.end(responseBody);
  } catch (error) {
    writeJson(response, 500, {
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

function buildUpstreamMessagesUrl(profile: ApiConfig): string {
  const baseURL = normalizeAnthropicBaseUrl(profile.baseURL);
  const url = new URL(baseURL);
  const pathname = url.pathname.replace(/\/+$/, "");
  url.pathname = pathname.endsWith("/v1") ? `${pathname}/messages` : `${pathname}/v1/messages`;
  return url.toString();
}

function normalizeAnthropicBaseUrl(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/v1$/i, "");
}

function buildUpstreamHeaders(request: IncomingMessage, profile: ApiConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": headerValue(request.headers["anthropic-version"]) || "2023-06-01",
    authorization: `Bearer ${profile.apiKey}`,
    "x-api-key": profile.apiKey,
  };

  const beta = headerValue(request.headers["anthropic-beta"]);
  if (beta) {
    headers["anthropic-beta"] = beta;
  }

  return headers;
}

function buildResponseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of response.headers.entries()) {
    if (/^(content-encoding|content-length|transfer-encoding)$/i.test(key)) {
      continue;
    }
    headers[key] = value;
  }
  if (!headers["content-type"]) {
    headers["content-type"] = "application/json; charset=utf-8";
  }
  return headers;
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

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }
  return value?.trim() ?? "";
}
