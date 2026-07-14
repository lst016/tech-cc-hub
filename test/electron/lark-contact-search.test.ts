import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeLarkContactQuery,
  parseLarkContactSearchResponse,
} from "../../src/electron/libs/lark-contact-search.js";
import {
  getLarkMentionContext,
  serializeLarkMention,
} from "../../src/ui/components/prompt-input/lark-mention-options.js";
import { readFileSync } from "node:fs";

test("parses active Lark users into mention candidates", () => {
  const contacts = parseLarkContactSearchResponse(JSON.stringify({
    ok: true,
    data: {
      users: [
        {
          open_id: "ou_0bf7f514102da81960a8a5fef41e9f99",
          localized_name: "顾凯歌",
          department: "事业二处-游戏八组-产品组",
          is_activated: true,
        },
        {
          open_id: "ou_inactive",
          localized_name: "未激活用户",
          is_activated: false,
        },
      ],
    },
  }));

  assert.deepEqual(contacts, [{
    openId: "ou_0bf7f514102da81960a8a5fef41e9f99",
    name: "顾凯歌",
    department: "事业二处-游戏八组-产品组",
  }]);
});

test("recognizes Chinese @ mention input and serializes a real Lark mention", () => {
  assert.deepEqual(getLarkMentionContext("请 @顾", 4), {
    start: 2,
    end: 4,
    query: "顾",
  });
  assert.equal(
    serializeLarkMention({ openId: "ou_abc", name: "顾凯歌" }),
    '<at user_id="ou_abc">顾凯歌</at>',
  );
});

test("trims and bounds the Lark contact query", () => {
  assert.equal(normalizeLarkContactQuery("  顾凯歌  "), "顾凯歌");
  assert.equal(Array.from(normalizeLarkContactQuery("顾".repeat(101))).length, 100);
});

test("splits serialized Lark mentions into rich editor display parts", async () => {
  const module = await import("../../src/ui/components/prompt-input/lark-mention-options.js");
  const buildLarkMentionDisplayParts = (
    module as unknown as {
      buildLarkMentionDisplayParts?: (prompt: string) => unknown;
    }
  ).buildLarkMentionDisplayParts;

  assert.equal(typeof buildLarkMentionDisplayParts, "function");
  assert.deepEqual(
    buildLarkMentionDisplayParts?.('请联系 <at user_id="ou_abc">顾凯歌</at> 确认'),
    [
      { type: "text", text: "请联系 " },
      {
        type: "mention",
        raw: '<at user_id="ou_abc">顾凯歌</at>',
        openId: "ou_abc",
        name: "顾凯歌",
      },
      { type: "text", text: " 确认" },
    ],
  );
});

test("prompt editor renders Lark mentions as atomic rich-text chips", () => {
  const source = readFileSync("src/ui/utils/prompt-editor-content.ts", "utf8");

  assert.match(source, /dataset\.larkMentionRaw/);
  assert.match(source, /dataset\.larkMentionOpenId/);
  assert.match(source, /textContent\s*=\s*`@\$\{part\.name\}`/);
  assert.match(source, /contentEditable\s*=\s*"false"/);
  assert.match(source, /text-\[#3370ff\]/);
});

test("chat history renders serialized Lark mentions as neutral inline chips", () => {
  const markdownSource = readFileSync("src/ui/render/markdown.tsx", "utf8");
  const eventCardSource = readFileSync("src/ui/components/EventCard.tsx", "utf8");

  assert.match(markdownSource, /data-lark-mention-surface="chat"/);
  assert.match(markdownSource, /text-ink-800/);
  assert.match(markdownSource, /@\{children\}/);
  assert.match(eventCardSource, /larkMentionTone="chat"/);
});

test("does not execute contact search when lark-cli user auth is not ready", async () => {
  const module = await import("../../src/electron/libs/lark-contact-search.js");
  const searchLarkContactsWithCli = (
    module as unknown as {
      searchLarkContactsWithCli?: (
        query: unknown,
        config: { command: string; profile?: string; runtimeEnv: NodeJS.ProcessEnv },
        invoke: (command: string, args: string[], runtimeEnv: NodeJS.ProcessEnv) => Promise<{ stdout: string; stderr: string }>,
      ) => Promise<unknown>;
    }
  ).searchLarkContactsWithCli;
  const calls: string[][] = [];

  assert.equal(typeof searchLarkContactsWithCli, "function");
  if (!searchLarkContactsWithCli) return;
  await assert.rejects(
    () => searchLarkContactsWithCli("顾", {
      command: "lark-cli-test-unconfigured",
      runtimeEnv: {},
    }, async (_command, args) => {
      calls.push(args);
      return {
        stdout: JSON.stringify({
          identity: "user",
          verified: false,
          tokenStatus: "missing",
          scope: "",
        }),
        stderr: "",
      };
    }),
    /未完成配置或用户登录/,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["auth", "status", "--verify"]);
  assert.equal(calls.some((args) => args.includes("+search-user")), false);
});

test("normalizes Electron IPC failures into a user-facing Lark setup message", async () => {
  const module = await import("../../src/ui/components/prompt-input/lark-mention-options.js");
  const formatLarkMentionSearchError = (
    module as unknown as {
      formatLarkMentionSearchError?: (error: unknown) => string;
    }
  ).formatLarkMentionSearchError;

  assert.equal(typeof formatLarkMentionSearchError, "function");
  assert.equal(
    formatLarkMentionSearchError?.(new Error(
      "Error invoking remote method 'lark:search-contacts': Error: lark-cli 未完成配置或用户登录，已跳过联系人搜索。",
    )),
    "飞书联系人不可用，已回退到普通 @ 引用。lark-cli 未完成配置或用户登录，已跳过联系人搜索。",
  );
});

test("prompt input falls back to ordinary file mentions after a Lark setup failure", () => {
  const source = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");

  assert.match(source, /const \[larkMentionUnavailable, setLarkMentionUnavailable\] = useState\(false\)/);
  assert.match(source, /const useLarkMentionSearch =[\s\S]*!larkMentionUnavailable/);
  assert.match(source, /setLarkMentionUnavailable\(true\)/);
  assert.match(source, /setGlobalError\(formatLarkMentionSearchError\(error\)\)/);
  assert.match(source, /if \(!hasLarkMentionContext\) setLarkMentionUnavailable\(false\)/);
});

test("reuses a successful lark-cli readiness check across consecutive contact queries", async () => {
  const module = await import("../../src/electron/libs/lark-contact-search.js");
  const searchLarkContactsWithCli = (
    module as unknown as {
      searchLarkContactsWithCli?: (
        query: unknown,
        config: { command: string; profile?: string; runtimeEnv: NodeJS.ProcessEnv },
        invoke: (command: string, args: string[], runtimeEnv: NodeJS.ProcessEnv) => Promise<{ stdout: string; stderr: string }>,
      ) => Promise<unknown>;
    }
  ).searchLarkContactsWithCli;
  const calls: string[][] = [];

  assert.equal(typeof searchLarkContactsWithCli, "function");
  if (!searchLarkContactsWithCli) return;
  const invoke = async (_command: string, args: string[]) => {
    calls.push(args);
    if (args.includes("auth")) {
      return {
        stdout: JSON.stringify({
          identity: "user",
          verified: true,
          tokenStatus: "valid",
          scope: "contact:user:search",
        }),
        stderr: "",
      };
    }
    return {
      stdout: JSON.stringify({ ok: true, data: { users: [] } }),
      stderr: "",
    };
  };
  const config = { command: "lark-cli-test-ready-cache", runtimeEnv: {} };

  await searchLarkContactsWithCli("顾", config, invoke);
  await searchLarkContactsWithCli("顾凯", config, invoke);

  assert.equal(calls.filter((args) => args.includes("auth")).length, 1);
  assert.equal(calls.filter((args) => args.includes("+search-user")).length, 2);
});

test("does not execute contact search when the required Lark contact scope is missing", async () => {
  const module = await import("../../src/electron/libs/lark-contact-search.js");
  const searchLarkContactsWithCli = (
    module as unknown as {
      searchLarkContactsWithCli?: (
        query: unknown,
        config: { command: string; profile?: string; runtimeEnv: NodeJS.ProcessEnv },
        invoke: (command: string, args: string[], runtimeEnv: NodeJS.ProcessEnv) => Promise<{ stdout: string; stderr: string }>,
      ) => Promise<unknown>;
    }
  ).searchLarkContactsWithCli;
  const calls: string[][] = [];

  assert.equal(typeof searchLarkContactsWithCli, "function");
  if (!searchLarkContactsWithCli) return;
  await assert.rejects(
    () => searchLarkContactsWithCli("顾", {
      command: "lark-cli-test-missing-scope",
      runtimeEnv: {},
    }, async (_command, args) => {
      calls.push(args);
      return {
        stdout: JSON.stringify({
          identity: "user",
          verified: true,
          tokenStatus: "valid",
          scope: "contact:user.base:readonly",
        }),
        stderr: "",
      };
    }),
    /缺少 contact:user:search 权限/,
  );
  assert.equal(calls.some((args) => args.includes("+search-user")), false);
});
