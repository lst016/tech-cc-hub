# src/electron/libs/channel-bridge.ts

> 模块：`electron` · 语言：`typescript` · 行数：372

## 文件职责

外部聊天渠道（Telegram、Webhook等）的消息桥接和分发

## 关键符号

- `startChannelBridge@0 - 启动渠道桥接服务，根据配置选择Telegram轮询、Webhook或其他方式`
- `startHermesWeixinInboundBridge@0 - 启动微信渠道桥接（通过Hermes代理）`
- `pollTelegram@0 - 轮询Telegram Bot API获取新消息`
- `extractTelegramMessage@0 - 解析Telegram更新中的消息内容`

## 依赖输入

- `child_process`
- `fs`
- `os`
- `path`
- `timers/promises`
- `./claude-settings.js`
- `./config-store.js`
- `./external-cli.js`
- `./channel-workspace.js`

## 对外暴露

- `ChannelBridgeDispatch`
- `ChannelBridgeController`
- `startChannelBridge`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { setTimeout as delay } from "timers/promises";

import { getGlobalRuntimeEnvConfig } from "./claude-settings.js";
import { loadGlobalRuntimeConfig } from "./config-store.js";
import { runExternalCli } from "./external-cli.js";
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
... (truncated)
```
