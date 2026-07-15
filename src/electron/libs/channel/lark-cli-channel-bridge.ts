import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";

import { loadGlobalRuntimeConfig } from "../config-store.js";
import { prepareExternalCliCommand, runExternalCli } from "../external-cli.js";
import type { ChannelInboundMessage, ChannelReplyTarget } from "./channel-workspace.js";

type UnknownRecord = Record<string, unknown>;

export type LarkCliChannelBridge = {
  stop: () => void;
  sendText: (target: ChannelReplyTarget, text: string) => Promise<void>;
  sendImage: (target: ChannelReplyTarget, relativePath: string) => Promise<void>;
  sendFile: (target: ChannelReplyTarget, relativePath: string) => Promise<void>;
  addReaction: (target: ChannelReplyTarget, emojiType: string) => Promise<string>;
  removeReaction: (target: ChannelReplyTarget, reactionId: string) => Promise<void>;
};

type LarkIdentity = {
  appId: string | null;
  botOpenId: string | null;
};

const LARK_CLI_COMMAND = "lark-cli";
const LARK_EVENT_KEY = "im.message.receive_v1";
const IDENTITY_POLL_MS = 30_000;
const RECONNECT_DELAY_MS = 3_000;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function isLarkCliRealtimeEnabled(rootConfig: UnknownRecord): boolean {
  const channels = isRecord(rootConfig.channels) ? rootConfig.channels : {};
  const items = isRecord(channels.items) ? channels.items : {};
  const lark = isRecord(items.lark) ? items.lark : {};
  return lark.enabled === true
    && lark.chatEnabled === true
    && lark.realtimeEnabled === true
    && lark.transport === "lark-cli";
}

export function normalizeLarkCliRealtimeEvent(
  value: unknown,
  botOpenId?: string | null,
): ChannelInboundMessage | null {
  if (!isRecord(value) || value.type !== LARK_EVENT_KEY) return null;
  if (value.sender_type === "bot") return null;

  const text = asString(value.content);
  const chatId = asString(value.chat_id);
  const messageId = asString(value.message_id) ?? asString(value.id);
  if (!text || !chatId || !messageId) return null;

  const chatType = asString(value.chat_type);
  if (chatType === "group") {
    if (!botOpenId) return null;
    const mentions = Array.isArray(value.mentions) ? value.mentions : [];
    const mentioned = mentions.some((mention) => isRecord(mention) && asString(mention.id) === botOpenId);
    if (!mentioned) return null;
  }

  const receivedAtRaw = asString(value.create_time) ?? asString(value.timestamp);
  const receivedAt = receivedAtRaw ? Number(receivedAtRaw) : Date.now();
  return {
    provider: "lark",
    text,
    externalConversationId: chatId,
    externalMessageId: messageId,
    senderId: asString(value.sender_id),
    channelName: chatType,
    receivedAt: Number.isFinite(receivedAt) ? receivedAt : Date.now(),
  };
}

export function parseCurrentLarkAppId(stdout: string): string | null {
  try {
    const value = JSON.parse(stdout) as unknown;
    if (!isRecord(value) || !Array.isArray(value.apps)) return null;
    for (const app of value.apps) {
      if (isRecord(app)) {
        const appId = asString(app.app_id);
        if (appId) return appId;
      }
    }
  } catch {
    // Invalid CLI output is treated as an unavailable identity signal.
  }
  return null;
}

function parseLarkIdentity(stdout: string): LarkIdentity {
  try {
    const value = JSON.parse(stdout) as unknown;
    if (!isRecord(value)) return { appId: null, botOpenId: null };
    const identities = isRecord(value.identities) ? value.identities : {};
    const bot = isRecord(identities.bot) ? identities.bot : {};
    return {
      appId: asString(value.appId) ?? null,
      botOpenId: asString(bot.openId) ?? null,
    };
  } catch {
    return { appId: null, botOpenId: null };
  }
}

export function buildLarkCliMessageArgs(
  target: ChannelReplyTarget,
  contentFlag: "--markdown" | "--image" | "--file",
  content: string,
  idempotencyKey: string,
): string[] {
  const targetArgs = target.externalMessageId
    ? ["+messages-reply", "--message-id", target.externalMessageId]
    : ["+messages-send", "--chat-id", target.rawConversationId];
  return [
    "im",
    ...targetArgs,
    contentFlag,
    content,
    "--as",
    "bot",
    "--idempotency-key",
    idempotencyKey,
    "--json",
  ];
}

function buildIdempotencyKey(target: ChannelReplyTarget, kind: string, value: string): string {
  const digest = createHash("sha256")
    .update([target.rawConversationId, target.externalMessageId ?? "", kind, value].join("\0"))
    .digest("hex")
    .slice(0, 40);
  return `techcc-${digest}`;
}

function assertSafeRelativeMediaPath(value: string): void {
  if (!value.trim() || isAbsolute(value) || value === ".." || value.startsWith(`..\\`) || value.startsWith("../")) {
    throw new Error("Lark media replies require a workspace-relative path");
  }
}

function findReactionId(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findReactionId(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  const direct = asString(value.reaction_id);
  if (direct) return direct;
  for (const nested of Object.values(value)) {
    const found = findReactionId(nested);
    if (found) return found;
  }
  return null;
}

async function readCurrentIdentity(): Promise<LarkIdentity> {
  try {
    const { stdout } = await runExternalCli(LARK_CLI_COMMAND, ["auth", "status", "--verify", "--json"], { timeout: 15_000 });
    return parseLarkIdentity(stdout);
  } catch {
    return { appId: null, botOpenId: null };
  }
}

async function readCurrentAppId(): Promise<string | null> {
  try {
    const { stdout } = await runExternalCli(LARK_CLI_COMMAND, ["event", "status", "--current", "--json"], { timeout: 10_000 });
    return parseCurrentLarkAppId(stdout);
  } catch {
    return null;
  }
}

export function startLarkCliChannelBridge(
  dispatch: (message: ChannelInboundMessage) => Promise<void> | void,
): LarkCliChannelBridge {
  let stopped = false;
  let child: ChildProcessWithoutNullStreams | null = null;
  let stdoutBuffer = "";
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let identityTimer: ReturnType<typeof setInterval> | null = null;
  let activeAppId: string | null = null;
  let botOpenId: string | null = null;

  const realtimeEnabled = () => isLarkCliRealtimeEnabled(loadGlobalRuntimeConfig());

  function stopConsumer(): void {
    const current = child;
    child = null;
    stdoutBuffer = "";
    if (!current) return;
    current.removeAllListeners("error");
    current.removeAllListeners("close");
    current.stdin.end();
    const killTimer = setTimeout(() => current.kill("SIGTERM"), 1_500);
    killTimer.unref?.();
  }

  function scheduleReconnect(): void {
    if (stopped || reconnectTimer || !realtimeEnabled()) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      startConsumer();
    }, RECONNECT_DELAY_MS);
    reconnectTimer.unref?.();
  }

  function handleConsumerEnd(process: ChildProcessWithoutNullStreams, error?: unknown): void {
    if (child !== process) return;
    child = null;
    stdoutBuffer = "";
    if (error) console.warn("[lark-cli-channel] realtime consumer stopped unexpectedly");
    scheduleReconnect();
  }

  function handleStdout(chunk: Buffer | string): void {
    stdoutBuffer += String(chunk);
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = normalizeLarkCliRealtimeEvent(JSON.parse(line), botOpenId);
        if (!message) continue;
        void Promise.resolve(dispatch(message)).catch((error) => {
          console.warn("[lark-cli-channel] inbound dispatch failed:", error);
        });
      } catch {
        console.warn("[lark-cli-channel] ignored malformed event output");
      }
    }
  }

  function startConsumer(): void {
    if (stopped || child || !realtimeEnabled()) return;
    const prepared = prepareExternalCliCommand(LARK_CLI_COMMAND, [
      "event",
      "consume",
      LARK_EVENT_KEY,
      "--as",
      "bot",
      "--quiet",
    ]);
    const process = spawn(prepared.command, prepared.args, {
      env: prepared.env,
      windowsHide: true,
      windowsVerbatimArguments: prepared.windowsVerbatimArguments,
      stdio: "pipe",
    });
    child = process;
    process.stdout.on("data", handleStdout);
    process.stderr.on("data", () => {
      // lark-cli readiness and daemon diagnostics intentionally stay out of logs;
      // they can contain local app metadata and do not affect NDJSON processing.
    });
    process.once("error", (error) => handleConsumerEnd(process, error));
    process.once("close", (code) => handleConsumerEnd(process, code === 0 ? undefined : new Error(`exit ${code}`)));
  }

  async function refreshIdentity(restartOnChange: boolean): Promise<void> {
    const nextAppId = await readCurrentAppId();
    if (stopped) return;
    if (restartOnChange && activeAppId && nextAppId && nextAppId !== activeAppId) {
      const identity = await readCurrentIdentity();
      if (stopped) return;
      activeAppId = identity.appId ?? nextAppId;
      botOpenId = identity.botOpenId;
      stopConsumer();
      startConsumer();
      return;
    }
    if (!activeAppId && nextAppId) activeAppId = nextAppId;
  }

  void (async () => {
    if (!realtimeEnabled()) return;
    const identity = await readCurrentIdentity();
    if (stopped) return;
    activeAppId = identity.appId;
    botOpenId = identity.botOpenId;
    startConsumer();
    identityTimer = setInterval(() => void refreshIdentity(true), IDENTITY_POLL_MS);
    identityTimer.unref?.();
  })();

  async function send(target: ChannelReplyTarget, flag: "--markdown" | "--image" | "--file", value: string): Promise<void> {
    if (flag !== "--markdown") assertSafeRelativeMediaPath(value);
    const args = buildLarkCliMessageArgs(target, flag, value, buildIdempotencyKey(target, flag, value));
    await runExternalCli(LARK_CLI_COMMAND, args, { cwd: target.workspaceRoot, timeout: 60_000 });
  }

  return {
    stop: () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (identityTimer) clearInterval(identityTimer);
      reconnectTimer = null;
      identityTimer = null;
      stopConsumer();
    },
    sendText: async (target, text) => await send(target, "--markdown", text),
    sendImage: async (target, relativePath) => await send(target, "--image", relativePath),
    sendFile: async (target, relativePath) => await send(target, "--file", relativePath),
    addReaction: async (target, emojiType) => {
      if (!target.externalMessageId) throw new Error("Lark reaction requires an external message id");
      const { stdout } = await runExternalCli(LARK_CLI_COMMAND, [
        "im",
        "reactions",
        "create",
        "--message-id",
        target.externalMessageId,
        "--data",
        JSON.stringify({ reaction_type: { emoji_type: emojiType } }),
        "--as",
        "bot",
        "--json",
      ], { cwd: target.workspaceRoot, timeout: 30_000 });
      const reactionId = (() => {
        try { return findReactionId(JSON.parse(stdout)); } catch { return null; }
      })();
      if (!reactionId) throw new Error("Lark reaction response did not include reaction_id");
      return reactionId;
    },
    removeReaction: async (target, reactionId) => {
      if (!target.externalMessageId) throw new Error("Lark reaction removal requires an external message id");
      await runExternalCli(LARK_CLI_COMMAND, [
        "im",
        "reactions",
        "delete",
        "--message-id",
        target.externalMessageId,
        "--reaction-id",
        reactionId,
        "--as",
        "bot",
        "--json",
      ], { cwd: target.workspaceRoot, timeout: 30_000 });
    },
  };
}
