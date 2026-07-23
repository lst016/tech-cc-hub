import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

import { loadGlobalRuntimeConfig } from "../config-store.js";
import { prepareExternalCliCommand, runExternalCli } from "../external-cli.js";
import type { ChannelInboundMessage, ChannelReplyTarget } from "./channel-workspace.js";
import {
  buildLarkCliCardPatchFileArgs,
  buildLarkCliDelayedCardUpdateFileArgs,
  buildLarkCliWorkflowCardSendFileArgs,
  buildLarkWorkflowCardSendBody,
  normalizeLarkCardActionEvent,
  parseLarkWorkflowCardSendResponse,
  type LarkCardActionEvent,
  type LarkCardJson,
  type LarkWorkflowCardSendResult,
} from "./lark-workflow-card.js";

type UnknownRecord = Record<string, unknown>;

export type LarkCliChannelBridge = {
  stop: () => void;
  sendText: (target: ChannelReplyTarget, text: string) => Promise<void>;
  sendImage: (target: ChannelReplyTarget, relativePath: string) => Promise<void>;
  sendFile: (target: ChannelReplyTarget, relativePath: string) => Promise<void>;
  addReaction: (target: ChannelReplyTarget, emojiType: string) => Promise<string>;
  removeReaction: (target: ChannelReplyTarget, reactionId: string) => Promise<void>;
  sendWorkflowCard: (
    target: ChannelReplyTarget,
    card: LarkCardJson,
    idempotencyKey: string,
  ) => Promise<LarkWorkflowCardSendResult>;
  updateWorkflowCard: (messageId: string, card: LarkCardJson) => Promise<void>;
  updateWorkflowCardAfterAction: (token: string, card: LarkCardJson) => Promise<void>;
};

type LarkIdentity = {
  appId: string | null;
  botOpenId: string | null;
  // 机器人所有者（lark-cli 当前登录用户）的 openId，用于把群聊响应限定为本人 @。
  ownerOpenId: string | null;
};

type LarkOutboundFingerprintLookup = {
  has: (fingerprint: string) => boolean;
};

export type RecentLarkOutboundTracker = LarkOutboundFingerprintLookup & {
  remember: (chatId: string, content: string) => string;
  forget: (fingerprint: string) => void;
};

const LARK_CLI_COMMAND = "lark-cli";
const LARK_EVENT_KEY = "im.message.receive_v1";
const LARK_CARD_ACTION_EVENT_KEY = "card.action.trigger";
const IDENTITY_POLL_MS = 30_000;
const RECONNECT_DELAY_MS = 3_000;
const RECENT_OUTBOUND_TTL_MS = 30_000;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildLarkMessageFingerprint(chatId: string, content: string): string {
  return createHash("sha256")
    .update([chatId.trim(), content.trim()].join("\0"))
    .digest("hex");
}

export function createRecentLarkOutboundTracker(
  ttlMs = RECENT_OUTBOUND_TTL_MS,
  now: () => number = Date.now,
): RecentLarkOutboundTracker {
  const fingerprints = new Map<string, number>();

  const prune = () => {
    const cutoff = now() - ttlMs;
    for (const [fingerprint, sentAt] of fingerprints) {
      if (sentAt <= cutoff) fingerprints.delete(fingerprint);
    }
  };

  return {
    remember: (chatId, content) => {
      prune();
      const fingerprint = buildLarkMessageFingerprint(chatId, content);
      fingerprints.set(fingerprint, now());
      return fingerprint;
    },
    forget: (fingerprint) => {
      fingerprints.delete(fingerprint);
    },
    has: (fingerprint) => {
      prune();
      return fingerprints.has(fingerprint);
    },
  };
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

export function isLarkGroupChatEnabled(rootConfig: UnknownRecord): boolean {
  const channels = isRecord(rootConfig.channels) ? rootConfig.channels : {};
  const items = isRecord(channels.items) ? channels.items : {};
  const lark = isRecord(items.lark) ? items.lark : {};
  // Default to enabled so existing setups keep responding to group @mentions.
  return lark.groupChatEnabled !== false;
}

export function shouldRefreshLarkIdentity(
  activeAppId: string | null,
  botOpenId: string | null,
  nextAppId: string | null,
  ownerOpenId?: string | null,
): boolean {
  // Bot 或 owner 身份任一缺失都需重拉，否则群聊 owner 限制无法生效。
  return !botOpenId
    || !ownerOpenId
    || Boolean(activeAppId && nextAppId && nextAppId !== activeAppId);
}

export function normalizeLarkCliRealtimeEvent(
  value: unknown,
  botOpenId?: string | null,
  recentOutbound?: LarkOutboundFingerprintLookup,
  groupChatEnabled: boolean = true,
  ownerOpenId?: string | null,
): ChannelInboundMessage | null {
  if (!isRecord(value) || value.type !== LARK_EVENT_KEY) return null;
  const text = asString(value.content);
  const chatId = asString(value.chat_id);
  const messageId = asString(value.message_id) ?? asString(value.id);
  if (!text || !chatId || !messageId) return null;

  const senderType = asString(value.sender_type)?.toLowerCase();
  const senderId = asString(value.sender_id);
  if (senderType === "bot" || (senderType && senderType !== "user")) return null;
  if (!senderId) return null;
  // Older CLI event shapes can omit sender_type for valid human messages, so
  // keep sender_id-bearing events compatible while still rejecting anonymous
  // payloads and anything sent by the current bot identity.
  if (botOpenId && senderId === botOpenId) return null;
  // The fallback fingerprint is only needed for legacy events with no sender
  // type. Explicit user events must not be suppressed when a person repeats a
  // recent bot response verbatim.
  if (!senderType && recentOutbound?.has(buildLarkMessageFingerprint(chatId, text))) return null;

  const chatType = asString(value.chat_type);
  if (chatType === "group") {
    if (!groupChatEnabled) return null;
    if (!botOpenId) return null;
    const mentions = Array.isArray(value.mentions) ? value.mentions : [];
    const mentioned = mentions.some((mention) => isRecord(mention) && asString(mention.id) === botOpenId);
    if (!mentioned) return null;
    // 群聊硬限制：只有机器人所有者本人 @ 机器人时才响应；其他成员 @ 一律忽略。
    if (ownerOpenId && senderId !== ownerOpenId) return null;
  }

  const receivedAtRaw = asString(value.create_time) ?? asString(value.timestamp);
  const receivedAt = receivedAtRaw ? Number(receivedAtRaw) : Date.now();
  return {
    provider: "lark",
    text,
    externalConversationId: chatId,
    externalMessageId: messageId,
    senderId,
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
    if (!isRecord(value)) return { appId: null, botOpenId: null, ownerOpenId: null };
    const identities = isRecord(value.identities) ? value.identities : {};
    const bot = isRecord(identities.bot) ? identities.bot : {};
    const user = isRecord(identities.user) ? identities.user : {};
    return {
      appId: asString(value.appId) ?? null,
      botOpenId: asString(bot.openId) ?? null,
      ownerOpenId: asString(user.openId) ?? null,
    };
  } catch {
    return { appId: null, botOpenId: null, ownerOpenId: null };
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
  ];
}

export type LarkStructuredTextFormat = "post" | "text";

export function buildLarkCliStructuredTextArgs(
  target: ChannelReplyTarget,
  text: string,
  format: LarkStructuredTextFormat,
  idempotencyKey: string,
): string[] {
  const targetArgs = target.externalMessageId
    ? ["+messages-reply", "--message-id", target.externalMessageId]
    : ["+messages-send", "--chat-id", target.rawConversationId];
  const content = format === "post"
    ? { zh_cn: { content: [[{ tag: "md", text }]] } }
    : { text };
  return [
    "im",
    ...targetArgs,
    "--msg-type",
    format,
    "--content",
    JSON.stringify(content),
    "--as",
    "bot",
    "--idempotency-key",
    idempotencyKey,
  ];
}

function buildIdempotencyKey(target: ChannelReplyTarget, kind: string, value: string): string {
  const digest = createHash("sha256")
    .update([target.rawConversationId, target.externalMessageId ?? "", kind, value].join("\0"))
    .digest("hex")
    .slice(0, 40);
  return `techcc-${digest}`;
}

type LarkTextReplyAttempt = (
  format: LarkStructuredTextFormat,
  idempotencyKey: string,
  preserveFingerprintOnFailure: boolean,
) => Promise<void>;

export function isAmbiguousLarkDeliveryError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const code = typeof error.code === "string" ? error.code.toUpperCase() : "";
  const message = typeof error.message === "string" ? error.message : "";
  return error.killed === true
    || typeof error.signal === "string"
    || ["ETIMEDOUT", "ECONNRESET", "EPIPE"].includes(code)
    || /timed?\s*out|timeout/i.test(message);
}

export async function sendLarkCliTextWithFallback(
  target: ChannelReplyTarget,
  text: string,
  sendAttempt: LarkTextReplyAttempt,
): Promise<void> {
  const idempotencyKey = buildIdempotencyKey(target, "text", text);
  const failures: unknown[] = [];
  let preserveFingerprintOnFailure = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await sendAttempt("post", idempotencyKey, preserveFingerprintOnFailure);
      return;
    } catch (error) {
      failures.push(error);
      preserveFingerprintOnFailure ||= isAmbiguousLarkDeliveryError(error);
    }
  }

  if (!preserveFingerprintOnFailure) {
    try {
      await sendAttempt("text", idempotencyKey, false);
      return;
    } catch (error) {
      failures.push(error);
    }
  }

  throw new AggregateError(failures, "Lark text reply failed after structured retry and plain-text fallback");
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
    return { appId: null, botOpenId: null, ownerOpenId: null };
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

async function runLarkCliWithJsonFile(
  payload: UnknownRecord,
  buildArgs: (dataFilePath: string) => string[],
  options: { timeout: number },
): Promise<{ stdout: string; stderr: string }> {
  const directory = await mkdtemp(join(tmpdir(), "techcc-lark-card-"));
  const dataFilePath = join(directory, "payload.json");
  try {
    await writeFile(dataFilePath, JSON.stringify(payload), { encoding: "utf8", mode: 0o600 });
    return await runExternalCli(LARK_CLI_COMMAND, buildArgs("payload.json"), {
      ...options,
      cwd: directory,
    });
  } finally {
    await unlink(dataFilePath).catch(() => undefined);
    await rmdir(directory).catch(() => undefined);
  }
}

export function startLarkCliChannelBridge(
  dispatch: (message: ChannelInboundMessage) => Promise<void> | void,
  dispatchCardAction?: (event: LarkCardActionEvent) => Promise<void> | void,
): LarkCliChannelBridge {
  let stopped = false;
  let child: ChildProcessWithoutNullStreams | null = null;
  let stdoutBuffer = "";
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let cardActionChild: ChildProcessWithoutNullStreams | null = null;
  let cardActionStdoutBuffer = "";
  let cardActionReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let identityTimer: ReturnType<typeof setInterval> | null = null;
  let activeAppId: string | null = null;
  let botOpenId: string | null = null;
  let ownerOpenId: string | null = null;
  const recentOutbound = createRecentLarkOutboundTracker();

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

  function stopCardActionConsumer(): void {
    const current = cardActionChild;
    cardActionChild = null;
    cardActionStdoutBuffer = "";
    if (!current) return;
    current.removeAllListeners("error");
    current.removeAllListeners("close");
    current.stdin.end();
    const killTimer = setTimeout(() => current.kill("SIGTERM"), 1_500);
    killTimer.unref?.();
  }

  function scheduleCardActionReconnect(): void {
    if (stopped || !dispatchCardAction || cardActionReconnectTimer || !realtimeEnabled()) return;
    cardActionReconnectTimer = setTimeout(() => {
      cardActionReconnectTimer = null;
      startCardActionConsumer();
    }, RECONNECT_DELAY_MS);
    cardActionReconnectTimer.unref?.();
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
    const groupChatEnabled = isLarkGroupChatEnabled(loadGlobalRuntimeConfig());
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = normalizeLarkCliRealtimeEvent(JSON.parse(line), botOpenId, recentOutbound, groupChatEnabled, ownerOpenId);
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

  function handleCardActionStdout(chunk: Buffer | string): void {
    cardActionStdoutBuffer += String(chunk);
    const lines = cardActionStdoutBuffer.split(/\r?\n/);
    cardActionStdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = normalizeLarkCardActionEvent(JSON.parse(line));
        if (!event || (ownerOpenId && event.operatorId !== ownerOpenId)) continue;
        void Promise.resolve(dispatchCardAction?.(event)).catch((error) => {
          console.warn("[lark-cli-channel] card action dispatch failed:", error);
        });
      } catch {
        console.warn("[lark-cli-channel] ignored malformed card action output");
      }
    }
  }

  function handleCardActionConsumerEnd(process: ChildProcessWithoutNullStreams, error?: unknown): void {
    if (cardActionChild !== process) return;
    cardActionChild = null;
    cardActionStdoutBuffer = "";
    if (error) console.warn("[lark-cli-channel] card action consumer stopped unexpectedly");
    scheduleCardActionReconnect();
  }

  function startCardActionConsumer(): void {
    if (stopped || !dispatchCardAction || cardActionChild || !realtimeEnabled()) return;
    const prepared = prepareExternalCliCommand(LARK_CLI_COMMAND, [
      "event",
      "consume",
      LARK_CARD_ACTION_EVENT_KEY,
      "--as",
      "bot",
    ]);
    const process = spawn(prepared.command, prepared.args, {
      env: prepared.env,
      windowsHide: true,
      windowsVerbatimArguments: prepared.windowsVerbatimArguments,
      stdio: "pipe",
    });
    cardActionChild = process;
    process.stdout.on("data", handleCardActionStdout);
    process.stderr.on("data", () => {
      // The ready marker and daemon diagnostics are intentionally consumed here.
    });
    process.once("error", (error) => handleCardActionConsumerEnd(process, error));
    process.once("close", (code) => handleCardActionConsumerEnd(
      process,
      code === 0 ? undefined : new Error(`exit ${code}`),
    ));
  }

  async function refreshIdentity(restartOnChange: boolean): Promise<void> {
    const nextAppId = await readCurrentAppId();
    if (stopped) return;
    const appChanged = Boolean(restartOnChange && activeAppId && nextAppId && nextAppId !== activeAppId);
    if (shouldRefreshLarkIdentity(activeAppId, botOpenId, nextAppId, ownerOpenId)) {
      const identity = await readCurrentIdentity();
      if (stopped) return;
      activeAppId = identity.appId ?? nextAppId;
      botOpenId = identity.botOpenId;
      ownerOpenId = identity.ownerOpenId;
      if (appChanged) {
        stopConsumer();
        stopCardActionConsumer();
        startConsumer();
        startCardActionConsumer();
      }
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
    ownerOpenId = identity.ownerOpenId;
    startConsumer();
    startCardActionConsumer();
    identityTimer = setInterval(() => void refreshIdentity(true), IDENTITY_POLL_MS);
    identityTimer.unref?.();
  })();

  async function send(
    target: ChannelReplyTarget,
    flag: "--image" | "--file",
    value: string,
    idempotencyKey = buildIdempotencyKey(target, flag, value),
  ): Promise<void> {
    assertSafeRelativeMediaPath(value);
    const args = buildLarkCliMessageArgs(target, flag, value, idempotencyKey);
    await runExternalCli(LARK_CLI_COMMAND, args, { cwd: target.workspaceRoot, timeout: 60_000 });
  }

  async function sendStructuredText(
    target: ChannelReplyTarget,
    text: string,
    format: LarkStructuredTextFormat,
    idempotencyKey: string,
    preserveFingerprintOnFailure: boolean,
  ): Promise<void> {
    const outboundFingerprint = recentOutbound.remember(target.rawConversationId, text);
    const args = buildLarkCliStructuredTextArgs(target, text, format, idempotencyKey);
    try {
      await runExternalCli(LARK_CLI_COMMAND, args, { cwd: target.workspaceRoot, timeout: 60_000 });
    } catch (error) {
      if (!preserveFingerprintOnFailure && !isAmbiguousLarkDeliveryError(error)) {
        recentOutbound.forget(outboundFingerprint);
      }
      throw error;
    }
  }

  return {
    stop: () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (cardActionReconnectTimer) clearTimeout(cardActionReconnectTimer);
      if (identityTimer) clearInterval(identityTimer);
      reconnectTimer = null;
      cardActionReconnectTimer = null;
      identityTimer = null;
      stopConsumer();
      stopCardActionConsumer();
    },
    sendText: async (target, text) => await sendLarkCliTextWithFallback(
      target,
      text,
      async (format, idempotencyKey, preserveFingerprintOnFailure) => await sendStructuredText(
        target,
        text,
        format,
        idempotencyKey,
        preserveFingerprintOnFailure,
      ),
    ),
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
    sendWorkflowCard: async (target, card, idempotencyKey) => {
      const { stdout } = await runLarkCliWithJsonFile(
        buildLarkWorkflowCardSendBody(target, card, idempotencyKey),
        buildLarkCliWorkflowCardSendFileArgs,
        { timeout: 60_000 },
      );
      return parseLarkWorkflowCardSendResponse(stdout);
    },
    updateWorkflowCard: async (messageId, card) => {
      await runLarkCliWithJsonFile(
        { content: JSON.stringify(card) },
        (dataFilePath) => buildLarkCliCardPatchFileArgs(messageId, dataFilePath),
        { timeout: 60_000 },
      );
    },
    updateWorkflowCardAfterAction: async (token, card) => {
      await runLarkCliWithJsonFile(
        { token, card },
        buildLarkCliDelayedCardUpdateFileArgs,
        { timeout: 60_000 },
      );
    },
  };
}
