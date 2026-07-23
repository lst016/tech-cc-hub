import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";

import {
  parseLarkChatDetails,
  parseLarkUserName,
  resolveChannelWorkspaceDisplayNames,
  resolveLarkConversationDisplayNameWithCli,
  type LarkWorkspaceLabelCliInvoker,
} from "../../src/electron/libs/channel/lark-workspace-label.js";

const cliConfig = { command: "lark-cli-test", runtimeEnv: {} };

test("formats a Lark group workspace from the chat name", async () => {
  const calls: string[][] = [];
  const label = await resolveLarkConversationDisplayNameWithCli(
    { conversationId: "oc_project", channelName: "group", senderId: "ou_owner" },
    cliConfig,
    async (_command, args) => {
      calls.push(args);
      return {
        stdout: JSON.stringify({
          ok: true,
          data: { name: "项目协作群", chat_mode: "group", owner_id: "ou_owner" },
        }),
        stderr: "",
      };
    },
  );

  assert.equal(label, "飞书-项目协作群");
  assert.deepEqual(calls, [[
    "im", "chats", "get", "--chat-id", "oc_project", "--as", "user", "--format", "json",
  ]]);
});

test("formats a Lark direct-message workspace from the sender contact", async () => {
  const calls: string[][] = [];
  const label = await resolveLarkConversationDisplayNameWithCli(
    { conversationId: "oc_direct", channelName: "p2p", senderId: "ou_alice" },
    cliConfig,
    async (_command, args) => {
      calls.push(args);
      if (args[0] === "im") {
        return {
          stdout: JSON.stringify({
            ok: true,
            data: { chat_mode: "p2p", owner_id: "ou_alice" },
          }),
          stderr: "",
        };
      }
      return {
        stdout: JSON.stringify({
          ok: true,
          data: { user: { name: "Alice", user_id: "ou_alice" } },
        }),
        stderr: "",
      };
    },
  );

  assert.equal(label, "飞书-Alice");
  assert.deepEqual(calls[1], ["contact", "+get-user", "--user-id", "ou_alice"]);
});

test("falls back from user to bot identity when resolving a visible group", async () => {
  const calls: string[][] = [];
  const invoke: LarkWorkspaceLabelCliInvoker = async (_command, args) => {
    calls.push(args);
    if (args.includes("user")) throw new Error("user scope unavailable");
    return {
      stdout: JSON.stringify({ ok: true, data: { name: "机器人所在群", chat_mode: "group" } }),
      stderr: "",
    };
  };

  const label = await resolveLarkConversationDisplayNameWithCli(
    { conversationId: "oc_bot_group", channelName: "group" },
    cliConfig,
    invoke,
  );

  assert.equal(label, "飞书-机器人所在群");
  assert.equal(calls.length, 2);
  assert.equal(calls[1][calls[1].indexOf("--as") + 1], "bot");
});

test("parses localized Lark names after CLI informational output", () => {
  assert.deepEqual(parseLarkChatDetails([
    "Lark CLI notice",
    JSON.stringify({
      ok: true,
      data: { chat_mode: "group", i18n_names: { zh_cn: "国际化群名" } },
    }),
  ].join("\n")), {
    name: "国际化群名",
    chatMode: "group",
    ownerId: undefined,
  });
  assert.equal(parseLarkUserName(JSON.stringify({
    ok: true,
    data: { user: { i18n_name: { zh_cn: "张三" } } },
  })), "张三");
});

test("resolves existing channel logs once and reuses the persisted label cache", async (t) => {
  const tempRoot = mkdtempSync(join(tmpdir(), "techcc-lark-workspace-label-"));
  t.after(() => {
    assert.equal(relative(tmpdir(), tempRoot).startsWith(".."), false);
    rmSync(tempRoot, { recursive: true, force: true });
  });
  const channelsRoot = join(tempRoot, "channels");
  const workspaceRoot = join(channelsRoot, "lark", "oc_cached");
  const channelMetadataRoot = join(workspaceRoot, ".channel");
  mkdirSync(channelMetadataRoot, { recursive: true });
  writeFileSync(join(channelMetadataRoot, "messages.jsonl"), `${JSON.stringify({
    direction: "inbound",
    provider: "lark",
    conversationId: "oc_cached",
    senderId: "ou_cached",
    channelName: "p2p",
  })}\n`, "utf8");

  let resolutionCount = 0;
  const first = await resolveChannelWorkspaceDisplayNames([workspaceRoot], channelsRoot, {
    now: () => 1_000,
    resolveLarkLabel: async (conversation) => {
      resolutionCount += 1;
      assert.deepEqual(conversation, {
        conversationId: "oc_cached",
        senderId: "ou_cached",
        senderName: undefined,
        channelName: "p2p",
      });
      return "飞书-缓存联系人";
    },
  });
  const second = await resolveChannelWorkspaceDisplayNames([workspaceRoot], channelsRoot, {
    now: () => 2_000,
    resolveLarkLabel: async () => {
      resolutionCount += 1;
      return "飞书-不应重复请求";
    },
  });

  assert.deepEqual(first, { [workspaceRoot]: "飞书-缓存联系人" });
  assert.deepEqual(second, first);
  assert.equal(resolutionCount, 1);
  assert.deepEqual(JSON.parse(readFileSync(join(channelMetadataRoot, "workspace-label.json"), "utf8")), {
    label: "飞书-缓存联系人",
    resolvedAt: 1_000,
  });
});

test("wires Lark workspace labels through Electron into the sidebar", () => {
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const sidebarSource = readFileSync("src/ui/components/Sidebar.tsx", "utf8");

  assert.match(mainSource, /channel:resolve-workspace-labels/);
  assert.match(mainSource, /resolveChannelWorkspaceDisplayNames/);
  assert.match(sidebarSource, /channel:resolve-workspace-labels/);
  assert.match(sidebarSource, /workspaceDisplayNames\[cwd\]/);
});
