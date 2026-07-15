import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLarkCliMessageArgs,
  isLarkCliRealtimeEnabled,
  normalizeLarkCliRealtimeEvent,
  parseCurrentLarkAppId,
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

  assert.equal(normalizeLarkCliRealtimeEvent({
    type: "im.message.receive_v1",
    content: "loop",
    chat_id: "oc_demo",
    message_id: "om_bot",
    sender_type: "bot",
  }), null);
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

test("current Lark app identity can be monitored without reading credentials", () => {
  assert.equal(parseCurrentLarkAppId('{"apps":[{"app_id":"cli_current","running":true}]}'), "cli_current");
  assert.equal(parseCurrentLarkAppId('{"apps":[]}'), null);
  assert.equal(parseCurrentLarkAppId("not json"), null);
});
