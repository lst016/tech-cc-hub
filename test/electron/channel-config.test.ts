import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isChannelChatEnabled } from "../../src/shared/channel-config.js";
import { removeLegacyLarkRuntimeConfig } from "../../src/shared/lark-cli-runtime.js";

test("channel chat toggle is off when the channel is disabled", () => {
  assert.equal(isChannelChatEnabled({ enabled: false, chatEnabled: true }), false);
  assert.equal(isChannelChatEnabled(null), false);
});

test("channel chat toggle preserves old enabled-only configs", () => {
  assert.equal(isChannelChatEnabled({ enabled: true }), true);
});

test("channel chat toggle can disable chat while the channel remains enabled", () => {
  assert.equal(isChannelChatEnabled({ enabled: true, chatEnabled: false }), false);
  assert.equal(isChannelChatEnabled({ enabled: true, chatEnabled: true }), true);
});

test("Lark remains CLI-only while exposing a realtime message switch", () => {
  const source = readFileSync("src/ui/components/settings/ChannelsSettingsPage.tsx", "utf8");

  assert.match(source, /id:\s*"lark"/);
  assert.match(source, /defaultTransport:\s*"lark-cli"/);
  assert.match(source, /definition\.id === "lark"/);
  assert.match(source, /realtimeEnabled/);
  assert.doesNotMatch(source, /lark-open-platform/);
  assert.doesNotMatch(source, /cliProfile/);
  assert.doesNotMatch(source, /appSecretEnv/);
  assert.doesNotMatch(source, /protobufjs/);
});

test("Lark channel master switch and realtime preference are persisted independently", () => {
  const source = readFileSync("src/ui/components/settings/ChannelsSettingsPage.tsx", "utf8");

  assert.match(source, /checked=\{channel\.realtimeEnabled === true\}/);
  assert.match(source, /onChange=\{\(event\) => onPatch\(\{\s*chatEnabled: event\.target\.checked,\s*realtimeEnabled: event\.target\.checked,\s*\}\)\}/);
  assert.doesNotMatch(source, /provider === "lark" && typeof patch\.enabled === "boolean"/);
});

test("Lark CLI consumers rely on the active CLI profile instead of persisted channel pointers", () => {
  for (const file of [
    "src/electron/libs/lark-contact-search.ts",
    "src/electron/libs/task/providers/lark-provider.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /channels\.items\.lark|LARK_CLI_PROFILE|cliProfile|--profile/);
  }
});

test("legacy persisted Lark pointers are removed without touching unrelated runtime config", () => {
  const result = removeLegacyLarkRuntimeConfig({
    env: {
      KEEP_ME: "yes",
      LARK_CLI_COMMAND: "old-lark-cli",
      LARK_CLI_PROFILE: "stale-profile",
    },
    channels: {
      defaultChannel: "lark",
      items: {
        telegram: { provider: "telegram", enabled: true },
        lark: {
          provider: "lark",
          enabled: true,
          transport: "lark-open-platform",
          cliProfile: "stale-profile",
          appSecretEnv: "LARK_APP_SECRET",
          wsBridgeEnabled: true,
        },
      },
    },
    skillCredentials: {
      lark: { env: ["KEEP_ME", "LARK_CLI_PROFILE"] },
      feishu: { env: ["LARK_CLI_COMMAND"] },
    },
    systemPromptExt: [
      "保留现有规则",
      "飞书/Lark 技能默认优先读取全局配置 channels.items.lark，并使用 LARK_CLI_PROFILE。",
      "Additional Lark CLI configuration reference: profile=default (cli_old).",
    ],
  });

  assert.equal(result.changed, true);
  assert.deepEqual(result.config.env, { KEEP_ME: "yes" });
  assert.deepEqual(result.config.channels, {
    items: {
      telegram: { provider: "telegram", enabled: true },
      lark: { provider: "lark", enabled: true, chatEnabled: false, realtimeEnabled: false, transport: "lark-cli" },
    },
  });
  assert.deepEqual(result.config.skillCredentials, {
    lark: { env: ["KEEP_ME"] },
  });
  assert.deepEqual(result.config.systemPromptExt, ["保留现有规则"]);
  assert.equal(removeLegacyLarkRuntimeConfig(result.config).changed, false);
});

test("CLI realtime settings survive config migration without restoring profile pointers", () => {
  const result = removeLegacyLarkRuntimeConfig({
    channels: {
      items: {
        lark: {
          provider: "lark",
          enabled: true,
          chatEnabled: true,
          realtimeEnabled: true,
          transport: "lark-cli",
        },
      },
    },
  });

  assert.equal(result.changed, false);
  assert.deepEqual(result.config.channels, {
    items: {
      lark: {
        provider: "lark",
        enabled: true,
        chatEnabled: true,
        realtimeEnabled: true,
        transport: "lark-cli",
      },
    },
  });
});
