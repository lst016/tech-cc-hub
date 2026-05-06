import test from "node:test";
import assert from "node:assert/strict";

import { buildLarkCliSendArgs, parseLarkAuthUserOpenId, shouldAcceptLarkEvent } from "../../src/shared/lark-channel.js";

test("lark IM rejects events when target sender is not configured", () => {
  assert.equal(shouldAcceptLarkEvent({}, { senderId: "ou_1", conversationId: "oc_1" }), false);
});

test("lark auth status userOpenId can seed the target sender", () => {
  const userOpenId = parseLarkAuthUserOpenId(JSON.stringify({
    tokenStatus: "valid",
    userName: "someone",
    userOpenId: "ou_from_cli",
  }));

  assert.equal(userOpenId, "ou_from_cli");
  assert.equal(shouldAcceptLarkEvent({ allowedSenderIds: userOpenId }, { senderId: "ou_from_cli", conversationId: "oc_1" }), true);
});

test("lark IM accepts only the configured target sender", () => {
  const config = { allowedSenderIds: "ou_target" };

  assert.equal(shouldAcceptLarkEvent(config, { senderId: "ou_target", conversationId: "oc_1" }), true);
  assert.equal(shouldAcceptLarkEvent(config, { senderId: "ou_other", conversationId: "oc_1" }), false);
});

test("lark IM can additionally lock to the app-to-person chat", () => {
  const config = { allowedSenderIds: "ou_target", allowedConversationIds: "oc_target" };

  assert.equal(shouldAcceptLarkEvent(config, { senderId: "ou_target", conversationId: "oc_target" }), true);
  assert.equal(shouldAcceptLarkEvent(config, { senderId: "ou_target", conversationId: "oc_other" }), false);
});

test("lark replies by message_id even when a legacy send template exists", () => {
  const args = buildLarkCliSendArgs(
    {
      cliProfile: "work",
      cliSendArgsTemplate: "im +messages-send --chat-id {chat_id} --text {text}",
    },
    {
      conversationId: "oc_legacy",
      rawConversationId: "oc_legacy",
      externalMessageId: "om_123",
    },
    "hello",
  );

  assert.deepEqual(args, [
    "--profile",
    "work",
    "im",
    "+messages-reply",
    "--message-id",
    "om_123",
    "--text",
    "hello",
    "--as",
    "bot",
  ]);
});

test("lark falls back to legacy send template only when no message_id exists", () => {
  const args = buildLarkCliSendArgs(
    {
      cliSendArgsTemplate: "im +messages-send --chat-id {chat_id} --text {text}",
    },
    {
      conversationId: "oc_legacy",
      rawConversationId: "oc_legacy",
    },
    "hello",
  );

  assert.deepEqual(args, ["im", "+messages-send", "--chat-id", "oc_legacy", "--text", "hello"]);
});
