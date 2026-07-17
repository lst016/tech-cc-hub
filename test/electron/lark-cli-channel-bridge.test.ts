import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLarkCliMessageArgs,
  buildLarkCliStructuredTextArgs,
  createRecentLarkOutboundTracker,
  isLarkCliRealtimeEnabled,
  normalizeLarkCliRealtimeEvent,
  parseCurrentLarkAppId,
  sendLarkCliTextWithFallback,
  shouldRefreshLarkIdentity,
} from "../../src/electron/libs/channel/lark-cli-channel-bridge.js";
import type { ChannelReplyTarget } from "../../src/electron/libs/channel/channel-workspace.js";

const target: ChannelReplyTarget = {
  provider: "lark",
  conversationId: "chat",
  rawConversationId: "oc_demo",
  externalMessageId: "om_demo",
  senderId: "ou_sender",
  workspaceRoot: "C:\\channels\\lark\\chat",
};

test("Lark realtime only starts for an enabled CLI chat channel", () => {
  assert.equal(isLarkCliRealtimeEnabled({
    channels: { items: { lark: { enabled: true, chatEnabled: true, realtimeEnabled: true, transport: "lark-cli" } } },
  }), true);
  assert.equal(isLarkCliRealtimeEnabled({
    channels: { items: { lark: { enabled: false, chatEnabled: true, realtimeEnabled: true, transport: "lark-cli" } } },
  }), false);
  assert.equal(isLarkCliRealtimeEnabled({
    channels: { items: { lark: { enabled: true, chatEnabled: false, realtimeEnabled: true, transport: "lark-cli" } } },
  }), false);
  assert.equal(isLarkCliRealtimeEnabled({
    channels: { items: { lark: { enabled: true, chatEnabled: true, realtimeEnabled: true, transport: "lark-open-platform" } } },
  }), false);
});

test("Lark CLI NDJSON events map to channel messages and reject bot loops", () => {
  assert.deepEqual(normalizeLarkCliRealtimeEvent({
    type: "im.message.receive_v1",
    content: "  ping  ",
    chat_id: "oc_demo",
    chat_type: "group",
    message_id: "om_demo",
    sender_id: "ou_sender",
    sender_type: "user",
    mentions: [{ id: "ou_bot", key: "@_user_1", name: "bot" }],
    create_time: "1784095200123",
  }, "ou_bot"), {
    provider: "lark",
    text: "ping",
    externalConversationId: "oc_demo",
    externalMessageId: "om_demo",
    senderId: "ou_sender",
    channelName: "group",
    receivedAt: 1784095200123,
  });
  assert.deepEqual(normalizeLarkCliRealtimeEvent({
    type: "im.message.receive_v1",
    content: "p2p ping",
    chat_id: "oc_p2p",
    chat_type: "p2p",
    message_id: "om_p2p",
    sender_id: "ou_human",
    sender_type: "user",
    create_time: "1784095200456",
  }, "ou_bot"), {
    provider: "lark",
    text: "p2p ping",
    externalConversationId: "oc_p2p",
    externalMessageId: "om_p2p",
    senderId: "ou_human",
    channelName: "p2p",
    receivedAt: 1784095200456,
  });

  assert.equal(normalizeLarkCliRealtimeEvent({
    type: "im.message.receive_v1",
    content: "loop",
    chat_id: "oc_demo",
    message_id: "om_bot",
    sender_type: "bot",
  }), null);
  assert.deepEqual(normalizeLarkCliRealtimeEvent({
    type: "im.message.receive_v1",
    content: "legacy p2p ping",
    chat_id: "oc_legacy_p2p",
    chat_type: "p2p",
    message_id: "om_legacy_p2p",
    sender_id: "ou_human",
    create_time: "1784095200789",
  }, "ou_bot"), {
    provider: "lark",
    text: "legacy p2p ping",
    externalConversationId: "oc_legacy_p2p",
    externalMessageId: "om_legacy_p2p",
    senderId: "ou_human",
    channelName: "p2p",
    receivedAt: 1784095200789,
  });
  assert.equal(normalizeLarkCliRealtimeEvent({
    type: "im.message.receive_v1",
    content: "legacy bot event without sender metadata",
    chat_id: "oc_demo",
    message_id: "om_unknown_sender",
  }), null);
  assert.equal(normalizeLarkCliRealtimeEvent({
    type: "im.message.receive_v1",
    content: "event with unsupported sender metadata",
    chat_id: "oc_demo",
    message_id: "om_unsupported_sender",
    sender_type: "app",
  }), null);
  assert.equal(normalizeLarkCliRealtimeEvent({
    type: "im.message.receive_v1",
    content: "self event with incorrect sender type",
    chat_id: "oc_demo",
    message_id: "om_self",
    sender_id: "ou_bot",
    sender_type: "user",
  }, "ou_bot"), null);
  const recentOutbound = createRecentLarkOutboundTracker();
  recentOutbound.remember("oc_demo", "recent automatic reply");
  assert.equal(normalizeLarkCliRealtimeEvent({
    type: "im.message.receive_v1",
    content: "recent automatic reply",
    chat_id: "oc_demo",
    message_id: "om_recent_outbound",
    sender_id: "ou_unknown_bot",
  }, null, recentOutbound), null);
  assert.equal(normalizeLarkCliRealtimeEvent({
    type: "im.message.receive_v1",
    content: "group without mention",
    chat_id: "oc_demo",
    chat_type: "group",
    message_id: "om_group",
    sender_id: "ou_sender",
    sender_type: "user",
  }, "ou_bot"), null);
  assert.equal(normalizeLarkCliRealtimeEvent({ content: "missing ids" }), null);
});

test("recent Lark outbound fingerprints expire instead of suppressing later human messages", () => {
  let now = 1_000;
  const tracker = createRecentLarkOutboundTracker(100, () => now);
  const fingerprint = tracker.remember("oc_demo", "same text");

  assert.equal(tracker.has(fingerprint), true);
  tracker.forget(fingerprint);
  assert.equal(tracker.has(fingerprint), false);
  tracker.remember("oc_demo", "same text");
  now = 1_101;
  assert.equal(tracker.has(fingerprint), false);
});

test("Lark identity polling retries a missing bot identity without requiring an app change", () => {
  assert.equal(shouldRefreshLarkIdentity("cli_app", null, "cli_app"), true);
  assert.equal(shouldRefreshLarkIdentity("cli_app", "ou_bot", "cli_app"), false);
  assert.equal(shouldRefreshLarkIdentity("cli_app", "ou_bot", "other_app"), true);
});

test("Lark CLI replies never fall through to webhook arguments", () => {
  assert.deepEqual(buildLarkCliMessageArgs(target, "--markdown", "**done**", "reply-key"), [
    "im",
    "+messages-reply",
    "--message-id",
    "om_demo",
    "--markdown",
    "**done**",
    "--as",
    "bot",
    "--idempotency-key",
    "reply-key",
    "--json",
  ]);

  assert.deepEqual(buildLarkCliMessageArgs({ ...target, externalMessageId: undefined }, "--file", "result.pdf", "send-key"), [
    "im",
    "+messages-send",
    "--chat-id",
    "oc_demo",
    "--file",
    "result.pdf",
    "--as",
    "bot",
    "--idempotency-key",
    "send-key",
    "--json",
  ]);
});

test("Lark text replies retry structured markdown and then fall back to structured plain text", async () => {
  const attempts: Array<{ format: string; idempotencyKey: string }> = [];

  await sendLarkCliTextWithFallback(target, "reply body", async (format, idempotencyKey) => {
    attempts.push({ format, idempotencyKey });
    if (attempts.length < 3) throw new Error(`attempt ${attempts.length} failed`);
  });

  assert.deepEqual(attempts.map((attempt) => attempt.format), ["post", "post", "text"]);
  assert.equal(new Set(attempts.map((attempt) => attempt.idempotencyKey)).size, 1);
  assert.match(attempts[0].idempotencyKey, /^techcc-[a-f0-9]{40}$/);
});

test("Lark structured text arguments never expose raw multiline text to cmd.exe", () => {
  const text = "first line\r\nsecond line\nthird line";
  const args = buildLarkCliStructuredTextArgs(target, text, "post", "reply-key");

  assert.equal(args.some((arg) => /[\r\n]/.test(arg)), false);
  assert.deepEqual(args.slice(0, 5), [
    "im",
    "+messages-reply",
    "--message-id",
    "om_demo",
    "--msg-type",
  ]);
  assert.equal(args[5], "post");
  const content = JSON.parse(args[args.indexOf("--content") + 1]);
  assert.equal(content.zh_cn.content[0][0].text, text);
  assert.equal(args[args.indexOf("--as") + 1], "bot");
});

test("Lark text replies stop after the first successful markdown send", async () => {
  let attempts = 0;

  await sendLarkCliTextWithFallback(target, "reply body", async () => {
    attempts += 1;
  });

  assert.equal(attempts, 1);
});

test("Lark text replies report every failed delivery attempt", async () => {
  let attempts = 0;

  await assert.rejects(
    sendLarkCliTextWithFallback(target, "reply body", async () => {
      attempts += 1;
      throw new Error(`attempt ${attempts} failed`);
    }),
    (error: unknown) => error instanceof AggregateError
      && error.errors.length === 3
      && /plain-text fallback/.test(error.message),
  );
  assert.equal(attempts, 3);
});

test("Lark text replies do not switch payload after an ambiguous timeout", async () => {
  const attempts: string[] = [];
  const timeout = Object.assign(new Error("reply timed out"), { killed: true, code: "ETIMEDOUT" });

  await assert.rejects(sendLarkCliTextWithFallback(target, "reply body", async (format) => {
    attempts.push(format);
    throw timeout;
  }), AggregateError);

  assert.deepEqual(attempts, ["post", "post"]);
});

test("current Lark app identity can be monitored without reading credentials", () => {
  assert.equal(parseCurrentLarkAppId('{"apps":[{"app_id":"cli_current","running":true}]}'), "cli_current");
  assert.equal(parseCurrentLarkAppId('{"apps":[]}'), null);
  assert.equal(parseCurrentLarkAppId("not json"), null);
});
