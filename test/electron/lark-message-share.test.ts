import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildLarkShareSendArgs,
  parseLarkChatSearchResponse,
  searchLarkShareChatsWithCli,
  searchLarkShareRecipientsWithCli,
  sendLarkShareMessageWithCli,
} from "../../src/electron/libs/lark-message-share.js";

test("combines matching Lark people and groups into one recipient list", async () => {
  const calls: string[][] = [];
  const recipients = await searchLarkShareRecipientsWithCli(
    "项目",
    { command: "lark-cli-test", runtimeEnv: {} },
    async (_command, args) => {
      calls.push(args);
      return {
        stdout: JSON.stringify({
          ok: true,
          data: {
            chats: [{
              chat_id: "oc_project",
              name: "项目协作群",
              chat_status: "normal",
              external: false,
              avatar: "https://example.test/project.png",
            }],
          },
        }),
        stderr: "",
      };
    },
    async () => [{ openId: "ou_alice", name: "项目负责人", department: "产品部" }],
  );

  assert.deepEqual(recipients, [
    { kind: "user", id: "ou_alice", name: "项目负责人", detail: "产品部" },
    {
      kind: "chat",
      id: "oc_project",
      name: "项目协作群",
      detail: "群聊",
      avatarUrl: "https://example.test/project.png",
    },
  ]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    "im", "+chat-search", "--query", "项目", "--page-size", "10", "--as", "user", "--format", "json",
  ]);
});

test("parses only active named Lark chats", () => {
  assert.deepEqual(parseLarkChatSearchResponse(JSON.stringify({
    ok: true,
    data: {
      chats: [
        {
          chat_id: "oc_active",
          name: "研发群",
          chat_status: "normal",
          external: true,
          avatar: "https://example.test/research.png",
        },
        { chat_id: "oc_dissolved", name: "旧群", chat_status: "dissolved" },
        { chat_id: "", name: "无 ID 群", chat_status: "normal" },
      ],
    },
  })), [
    {
      kind: "chat",
      id: "oc_active",
      name: "研发群",
      detail: "外部群聊",
      avatarUrl: "https://example.test/research.png",
    },
  ]);
});

test("searches Lark chats independently so the UI can render partial results", async () => {
  const calls: string[][] = [];
  const chats = await searchLarkShareChatsWithCli(
    "宁",
    { command: "lark-cli-test", runtimeEnv: {} },
    async (_command, args) => {
      calls.push(args);
      return {
        stdout: JSON.stringify({
          ok: true,
          data: {
            chats: [{
              chat_id: "oc_support",
              name: "客服问题处理群",
              chat_status: "normal",
              external: false,
            }],
          },
        }),
        stderr: "",
      };
    },
  );

  assert.deepEqual(chats, [
    { kind: "chat", id: "oc_support", name: "客服问题处理群", detail: "群聊" },
  ]);
  assert.deepEqual(calls[0], [
    "im", "+chat-search", "--query", "宁", "--page-size", "10", "--as", "user", "--format", "json",
  ]);
});

test("bounds a stalled recipient search instead of leaving the dialog loading forever", async () => {
  const { withSearchTimeout } = await import("../../src/ui/utils/lark-search.js");
  await assert.rejects(
    withSearchTimeout(new Promise<never>(() => undefined), "人员", 10),
    /人员搜索超时，请重试/,
  );
});

test("builds an explicit user-identity send with an idempotency key", () => {
  const text = "构建完成\n下一步：发布";
  assert.deepEqual(buildLarkShareSendArgs({
    recipient: { kind: "user", id: "ou_alice", name: "Alice" },
    text,
  }, "techcc-share-123"), [
    "im",
    "+messages-send",
    "--user-id",
    "ou_alice",
    "--msg-type",
    "post",
    "--content",
    JSON.stringify({ zh_cn: { content: [[{ tag: "md", text }]] } }),
    "--as",
    "user",
    "--idempotency-key",
    "techcc-share-123",
    "--format",
    "json",
  ]);
  assert.equal(buildLarkShareSendArgs({
    recipient: { kind: "user", id: "ou_alice", name: "Alice" },
    text,
  }, "techcc-share-123").includes(text), false);
});

test("surfaces a structured Lark user-send error without hiding the recovery hint", async () => {
  await assert.rejects(
    sendLarkShareMessageWithCli(
      {
        recipient: { kind: "chat", id: "oc_project", name: "项目协作群" },
        text: "构建完成",
      },
      { command: "lark-cli-test", runtimeEnv: {} },
      async () => Promise.reject({
        stdout: JSON.stringify({
          error: {
            message: "missing im:message.send_as_user",
            hint: "authorize the user scope and try again",
          },
        }),
      }),
      "techcc-share-456",
    ),
    /missing im:message.send_as_user authorize the user scope and try again/,
  );
});

test("assistant message actions expose the confirmed Lark send flow", () => {
  const eventCardSource = readFileSync("src/ui/components/EventCard.tsx", "utf8");
  const dialogSource = readFileSync("src/ui/components/chat/LarkMessageShareDialog.tsx", "utf8");
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const preloadSource = readFileSync("src/electron/preload.cts", "utf8");

  assert.match(eventCardSource, /label="发送到飞书"/);
  assert.match(eventCardSource, /<LarkMessageShareDialog/);
  assert.match(eventCardSource, /LARK_USER_SEND_PERMISSION_AGENT_PROMPT/);
  assert.match(eventCardSource, /--domain im/);
  assert.match(eventCardSource, /不要使用 --domain all/);
  assert.match(eventCardSource, /onRequestPermissionAssist=\{requestLarkPermissionAssist\}/);
  assert.match(dialogSource, /placeholder=\{`输入\$\{recipientLabel\}名称`\}/);
  assert.match(dialogSource, /role="tablist"/);
  assert.match(dialogSource, /activeTab/);
  assert.match(dialogSource, /aria-selected=\{activeTab === "people"\}/);
  assert.match(dialogSource, /aria-selected=\{activeTab === "chats"\}/);
  assert.match(dialogSource, /type="checkbox"/);
  assert.match(dialogSource, /已选择/);
  assert.match(dialogSource, /当前登录的飞书账号本人身份发送/);
  assert.match(dialogSource, /SEARCH_TIMEOUT_MS/);
  assert.match(dialogSource, /Agent 辅助申请权限/);
  assert.match(dialogSource, /sendError\?\.includes\("im:message\.send_as_user"\)/);
  assert.match(dialogSource, /overflow-wrap:anywhere/);
  assert.match(dialogSource, /searchLarkContacts/);
  assert.match(dialogSource, /searchLarkShareChats/);
  assert.doesNotMatch(dialogSource, /发送内容/);
  assert.match(dialogSource, /sendLarkShareMessage/);
  assert.match(mainSource, /lark:search-share-chats/);
  assert.match(mainSource, /lark:search-share-recipients/);
  assert.match(mainSource, /lark:send-shared-message/);
  assert.match(preloadSource, /searchLarkShareChats/);
  assert.match(preloadSource, /searchLarkShareRecipients/);
  assert.match(preloadSource, /sendLarkShareMessage/);
});
