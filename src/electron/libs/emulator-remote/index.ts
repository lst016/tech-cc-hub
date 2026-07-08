// src/electron/libs/emulator-remote/index.ts
// -----------------------------------------------------------------------------
// Phase 8: iOS remote macOS agent bridge.
// Uses Node 21+ built-in WebSocket (no extra dependency). Persists the per-
// plugin ws URL under ~/.claude/plugins/emulator-remote.json so the value
// survives restarts. Phase 4 only ships the probe + persistence surface;
// Phase 5 (Agent SDK MCP injection) will reuse the same URL for actual
// command dispatch.
// -----------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ipcMain } from "electron";

const REMOTE_CONFIG_DIR = join(homedir(), ".claude", "plugins");
const REMOTE_CONFIG_FILE = join(REMOTE_CONFIG_DIR, "emulator-remote.json");

export type ProbeAgentResult = {
  ok: boolean;
  agentVersion?: string;
  platform?: string;
  error?: string;
  url: string;
};

type RemoteConfig = Record<string, string>;

function readRemoteConfig(): RemoteConfig {
  if (!existsSync(REMOTE_CONFIG_FILE)) return {};
  try {
    const raw = readFileSync(REMOTE_CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as RemoteConfig;
    }
    return {};
  } catch {
    return {};
  }
}

function writeRemoteConfig(config: RemoteConfig): void {
  if (!existsSync(REMOTE_CONFIG_DIR)) {
    mkdirSync(REMOTE_CONFIG_DIR, { recursive: true });
  }
  writeFileSync(REMOTE_CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

function isWebSocketUrl(url: string): boolean {
  return /^wss?:\/\/[^\s]+$/i.test(url.trim());
}

export async function getRemoteAgentUrl(pluginId: string): Promise<string | null> {
  const config = readRemoteConfig();
  const value = config[pluginId];
  return typeof value === "string" && value.trim() ? value : null;
}

export async function setRemoteAgentUrl(pluginId: string, url: string): Promise<void> {
  if (!isWebSocketUrl(url)) {
    throw new Error(`Invalid WebSocket URL: ${url}`);
  }
  const config = readRemoteConfig();
  config[pluginId] = url.trim();
  writeRemoteConfig(config);
}

export async function clearRemoteAgentUrl(pluginId: string): Promise<void> {
  const config = readRemoteConfig();
  delete config[pluginId];
  writeRemoteConfig(config);
}

/**
 * Probe a remote agent: opens a WebSocket, sends `{type:"hello"}`, waits for
 * the agent's hello reply (which carries agentVersion + platform). Closes the
 * socket before resolving. Never throws — errors are surfaced via the result.
 */
export function probeAgent(url: string, timeoutMs = 5_000): Promise<ProbeAgentResult> {
  return new Promise((resolve) => {
    if (!isWebSocketUrl(url)) {
      resolve({ ok: false, error: `Invalid WebSocket URL: ${url}`, url });
      return;
    }
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;
    const finish = (result: ProbeAgentResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { ws?.close(); } catch { /* ignore */ }
      resolve(result);
    };
    timer = setTimeout(() => finish({ ok: false, error: "Probe timed out", url }), timeoutMs);
    try {
      ws = new WebSocket(url);
    } catch (error) {
      finish({ ok: false, error: error instanceof Error ? error.message : String(error), url });
      return;
    }
    ws.addEventListener("open", () => {
      try {
        ws?.send(JSON.stringify({ type: "hello" }));
      } catch (error) {
        finish({ ok: false, error: error instanceof Error ? error.message : String(error), url });
      }
    });
    ws.addEventListener("message", (event: MessageEvent) => {
      try {
        const text = typeof event.data === "string" ? event.data : String(event.data);
        const msg = JSON.parse(text) as { type?: string; agentVersion?: string; platform?: string };
        if (msg.type === "hello" && typeof msg.agentVersion === "string") {
          finish({
            ok: true,
            agentVersion: msg.agentVersion,
            platform: typeof msg.platform === "string" ? msg.platform : undefined,
            url,
          });
        }
      } catch {
        // ignore malformed frames during probe
      }
    });
    ws.addEventListener("error", () => {
      finish({ ok: false, error: "WebSocket error (host unreachable or agent not running)", url });
    });
    ws.addEventListener("close", (event: CloseEvent) => {
      if (!settled && !event.wasClean) {
        finish({ ok: false, error: `WebSocket closed unexpectedly (code=${event.code})`, url });
      }
    });
  });
}

type RpcError = { success: false; error: string };
type RpcOk<T> = { success: true; data: T };
export type RpcResponse<T> = RpcOk<T> | RpcError;

export function registerEmulatorRemoteIpc(): void {
  ipcMain.handle(
    "plugins:getRemoteAgentUrl",
    async (_event, pluginId: unknown): Promise<RpcResponse<string | null>> => {
      if (typeof pluginId !== "string" || !pluginId) {
        return { success: false, error: "pluginId must be a non-empty string" };
      }
      try {
        return { success: true, data: await getRemoteAgentUrl(pluginId) };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  );
  ipcMain.handle(
    "plugins:setRemoteAgentUrl",
    async (_event, pluginId: unknown, url: unknown): Promise<RpcResponse<true>> => {
      if (typeof pluginId !== "string" || !pluginId) {
        return { success: false, error: "pluginId must be a non-empty string" };
      }
      if (typeof url !== "string" || !url.trim()) {
        return { success: false, error: "url must be a non-empty string" };
      }
      try {
        await setRemoteAgentUrl(pluginId, url);
        return { success: true, data: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  );
  ipcMain.handle(
    "plugins:probeEmulatorAgent",
    async (_event, url: unknown): Promise<RpcResponse<ProbeAgentResult>> => {
      if (typeof url !== "string" || !url.trim()) {
        return { success: false, error: "url must be a non-empty string" };
      }
      try {
        return { success: true, data: await probeAgent(url) };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  );
}