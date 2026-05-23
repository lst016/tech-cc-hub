import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { setTimeout as delay } from "timers/promises";

import { getGlobalRuntimeEnvConfig } from "../claude/claude-settings.js";
import { loadGlobalRuntimeConfig } from "../config-store.js";
import { runExternalCli } from "../external-cli.js";
import type { ChannelInboundMessage, ChannelProviderId, ChannelReplyTarget } from "./channel-workspace.js";

type ChannelTransportMode = "bot-api" | "webhook" | "lark-cli" | "lark-open-platform" | "weixin-native" | "weixin-openclaw";

type ChannelConnectionConfig = {
  provider?: ChannelProviderId;
  enabled?: boolean;
  chatEnabled?: boolean;
  transport?: ChannelTransportMode;
  botTokenEnv?: string;
  webhookUrlEnv?: string;
  appIdEnv?: string;
  appSecretEnv?: string;
  tenantKeyEnv?: string;
  cliCommand?: string;
  cliProfile?: string;
  cliSendArgsTemplate?: string;
  cliReceiveArgsTemplate?: string;
  allowedSenderIds?: string;
  allowedConversationIds?: string;
};

type ChannelRuntimeConfig = {
  items?: Partial<Record<ChannelProviderId, ChannelConnectionConfig>>;
};

export type ChannelBridgeDispatch = (message: ChannelInboundMessage) => Promise<void> | void;

export type ChannelBridgeController = {
  stop: () => void;
  sendText: (target: ChannelReplyTarget, text: string) => Promise<void>;
};

const POLL_INTERVAL_MS = 2500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getChannelRuntimeConfig(): ChannelRuntimeConfig {
  const config = loadGlobalRuntimeConfig();
  return isRecord(config.channels) ? config.channels as ChannelRuntimeConfig : {};
}

function getChannelConfig(provider: ChannelProviderId): ChannelConnectionConfig | null {
  const config = getChannelRuntimeConfig();
  const item = isRecord(config.items) ? config.items[provider] : undefined;
  return isRecord(item) ? item as ChannelConnectionConfig : null;
}

function resolveConfiguredEnvValue(envName?: string): string | undefined {
  const normalized = envName?.trim();
  if (!normalized) return undefined;
  const runtimeEnv = getGlobalRuntimeEnvConfig();
  return runtimeEnv[normalized] || process.env[normalized];
}

function runCli(command: string, args: string[], timeout = 15_000, cwd?: string): Promise<{ stdout: string; stderr: string }> {
  return runExternalCli(command, args, {
    timeout,
    cwd,
    env: { ...process.env, ...getGlobalRuntimeEnvConfig() },
  });
}

function extractTelegramMessage(update: Record<string, unknown>): ChannelInboundMessage | null {
  const message = isRecord(update.message) ? update.message : isRecord(update.edited_message) ? update.edited_message : null;
  if (!message) return null;
  const text = String(message.text ?? "").trim();
  if (!text) return null;
  const chat = isRecord(message.chat) ? message.chat : {};
  const from = isRecord(message.from) ? message.from : {};
  const chatId = String(chat.id ?? "default");
  const senderName = [from.first_name, from.last_name].map((item) => typeof item === "string" ? item : "").filter(Boolean).join(" ");
  return {
    provider: "telegram",
    text,
    externalConversationId: chatId,
    externalMessageId: String(message.message_id ?? update.update_id ?? `${Date.now()}`),
    senderId: from.id ? String(from.id) : undefined,
    senderName: senderName || (typeof from.username === "string" ? from.username : undefined),
    channelName: typeof chat.title === "string" ? chat.title : typeof chat.username === "string" ? chat.username : chatId,
    receivedAt: typeof message.date === "number" ? message.date * 1000 : Date.now(),
  };
}

async function pollTelegram(signal: AbortSignal, dispatch: ChannelBridgeDispatch) {
  let offset = 0;
  while (!signal.aborted) {
    const config = getChannelConfig("telegram");
    const token = config?.enabled && config.transport === "bot-api"
      ? resolveConfiguredEnvValue(config.botTokenEnv)
      : undefined;

    if (!token) {
      await delay(POLL_INTERVAL_MS, undefined, { signal }).catch(() => undefined);
      continue;
    }

    try {
      const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
      url.searchParams.set("timeout", "20");
      if (offset > 0) url.searchParams.set("offset", String(offset));
      const response = await fetch(url, { signal });
      const payload = await response.json() as unknown;
      const result = isRecord(payload) && Array.isArray(payload.result) ? payload.result : [];
      for (const update of result) {
        if (!isRecord(update)) continue;
        const updateId = Number(update.update_id);
        if (Number.isFinite(updateId)) offset = Math.max(offset, updateId + 1);
        const message = extractTelegramMessage(update);
        if (message) await dispatch(message);
      }
    } catch (error) {
      if (!signal.aborted) console.warn("[channel-bridge] Telegram polling failed:", error);
      await delay(POLL_INTERVAL_MS, undefined, { signal }).catch(() => undefined);
    }
  }
}

function startHermesWeixinInboundBridge(dispatch: ChannelBridgeDispatch): ChildProcessWithoutNullStreams | null {
  const config = getChannelConfig("wechat");
  if (!config?.enabled || config.transport !== "weixin-openclaw") return null;

  const script = `
import asyncio
import json
import os
import signal
import sys
from gateway.config import PlatformConfig
from gateway.platforms.weixin import WeixinAdapter

async def main():
    stop_event = asyncio.Event()

    def stop(*_args):
        stop_event.set()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    adapter = WeixinAdapter(
        PlatformConfig(
            enabled=True,
            token=os.environ.get("WEIXIN_TOKEN", ""),
            extra={
                "account_id": os.environ.get("WEIXIN_ACCOUNT_ID", ""),
                "base_url": os.environ.get("WEIXIN_BASE_URL", ""),
                "cdn_base_url": os.environ.get("WEIXIN_CDN_BASE_URL", ""),
                "dm_policy": os.environ.get("WEIXIN_DM_POLICY", "open"),
                "group_policy": os.environ.get("WEIXIN_GROUP_POLICY", "open"),
                "allow_from": os.environ.get("WEIXIN_ALLOWED_USERS", ""),
                "group_allow_from": os.environ.get("WEIXIN_GROUP_ALLOWED_USERS", ""),
            },
        )
    )

    async def handle(event):
        source = event.source
        payload = {
            "provider": "wechat",
            "text": event.text,
            "externalConversationId": getattr(source, "chat_id", None),
            "externalMessageId": event.message_id,
            "senderId": getattr(source, "user_id", None),
            "senderName": getattr(source, "user_name", None),
            "channelName": getattr(source, "chat_name", None) or getattr(source, "chat_type", None),
            "receivedAt": int(event.timestamp.timestamp() * 1000),
        }
        print(json.dumps(payload, ensure_ascii=False), flush=True)

    adapter.set_message_handler(handle)
    connected = await adapter.connect()
    if not connected:
        print("Hermes WeixinAdapter failed to connect", file=sys.stderr, flush=True)
        return 1
    await stop_event.wait()
    await adapter.disconnect()
    return 0

raise SystemExit(asyncio.run(main()))
`.trim();

  const child = spawn(
    getHermesPythonCommand(),
    ["-c", script],
    {
      cwd: getHermesAgentRoot(),
      env: { ...process.env, ...getGlobalRuntimeEnvConfig() },
    },
  );

  let stdoutBuffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += String(chunk);
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!isRecord(parsed)) continue;
        const text = String(parsed.text ?? "").trim();
        if (!text) continue;
        void Promise.resolve(dispatch({
          provider: "wechat",
          text,
          externalConversationId: asOptionalString(parsed.externalConversationId),
          externalMessageId: asOptionalString(parsed.externalMessageId) ?? `${Date.now()}`,
          senderId: asOptionalString(parsed.senderId),
          senderName: asOptionalString(parsed.senderName),
          channelName: asOptionalString(parsed.channelName),
          receivedAt: typeof parsed.receivedAt === "number" ? parsed.receivedAt : Date.now(),
        })).catch((error) => {
          console.warn("[channel-bridge] Hermes Weixin dispatch failed:", error);
        });
      } catch (error) {
        console.warn("[channel-bridge] Hermes Weixin stdout parse failed:", error);
      }
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) console.warn("[channel-bridge] Hermes Weixin:", text);
  });
  child.on("error", (error) => {
    console.warn(`[channel-bridge] Hermes Weixin bridge unavailable: ${error.message}`);
  });
  child.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      console.warn(`[channel-bridge] Hermes Weixin bridge exited: code=${code} signal=${signal}`);
    }
  });

  return child;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

async function sendTelegramText(target: ChannelReplyTarget, text: string): Promise<void> {
  const config = getChannelConfig("telegram");
  const token = config?.enabled ? resolveConfiguredEnvValue(config.botTokenEnv) : undefined;
  if (!token) return;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: target.rawConversationId,
      text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed: ${response.status} ${response.statusText}`);
  }
}

async function sendWebhookText(target: ChannelReplyTarget, text: string): Promise<void> {
  const config = getChannelConfig(target.provider);
  const url = config?.enabled ? resolveConfiguredEnvValue(config.webhookUrlEnv) : undefined;
  if (!url) return;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text,
      conversationId: target.rawConversationId,
      provider: target.provider,
    }),
  });
  if (!response.ok) {
    throw new Error(`${target.provider} webhook send failed: ${response.status} ${response.statusText}`);
  }
}

function getHermesHome(): string {
  return process.env.HERMES_HOME?.trim() || join(homedir(), ".hermes");
}

function getHermesAgentRoot(): string {
  return process.env.HERMES_AGENT_ROOT?.trim() || join(getHermesHome(), "hermes-agent");
}

function getHermesPythonCommand(): string {
  const venvPython = join(getHermesAgentRoot(), "venv", "bin", "python3");
  return existsSync(venvPython) ? venvPython : "python3";
}

async function sendHermesWeixinText(target: ChannelReplyTarget, text: string): Promise<void> {
  const config = getChannelConfig("wechat");
  if (!config?.enabled || config.transport !== "weixin-openclaw") return;

  const script = `
import asyncio
import json
import os
import sys
from gateway.platforms.weixin import send_weixin_direct

async def main():
    result = await send_weixin_direct(
        extra={
            "account_id": os.environ.get("WEIXIN_ACCOUNT_ID", ""),
            "base_url": os.environ.get("WEIXIN_BASE_URL", ""),
            "cdn_base_url": os.environ.get("WEIXIN_CDN_BASE_URL", ""),
        },
        token=os.environ.get("WEIXIN_TOKEN", ""),
        chat_id=sys.argv[1],
        message=sys.argv[2],
    )
    print(json.dumps(result, ensure_ascii=False))

asyncio.run(main())
`.trim();

  const { stdout } = await runCli(
    getHermesPythonCommand(),
    ["-c", script, target.rawConversationId, text],
    30_000,
    getHermesAgentRoot(),
  );
  const lastLine = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) || "{}";
  const parsed = JSON.parse(lastLine) as unknown;
  if (isRecord(parsed) && parsed.error) {
    throw new Error(String(parsed.error));
  }
  if (!isRecord(parsed) || parsed.success !== true) {
    throw new Error(`Hermes Weixin send failed: ${lastLine}`);
  }
}

export function startChannelBridge(dispatch: ChannelBridgeDispatch): ChannelBridgeController {
  const controller = new AbortController();
  const weixinBridge = startHermesWeixinInboundBridge(dispatch);
  void pollTelegram(controller.signal, dispatch);

  return {
    stop: () => {
      controller.abort();
      weixinBridge?.kill("SIGTERM");
    },
    sendText: async (target, text) => {
      if (target.provider === "telegram") {
        await sendTelegramText(target, text);
        return;
      }
      if (target.provider === "wechat") {
        const config = getChannelConfig("wechat");
        if (config?.transport === "weixin-openclaw") {
          await sendHermesWeixinText(target, text);
          return;
        }
      }
      await sendWebhookText(target, text);
    },
  };
}
