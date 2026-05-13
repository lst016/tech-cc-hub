import test from "node:test";
import assert from "node:assert/strict";

import { isChannelChatEnabled } from "../../src/shared/channel-config.js";
import {
  ensureLarkCliRuntimeDefaults,
  LARK_CLI_COMMAND_ENV,
  LARK_CLI_PROFILE_ENV,
  LARK_CLI_SYSTEM_PROMPT_EXT,
} from "../../src/shared/lark-runtime-defaults.js";

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

test("lark cli runtime defaults seed reusable global config without overwriting user choices", () => {
  const config = ensureLarkCliRuntimeDefaults({
    env: {
      [LARK_CLI_COMMAND_ENV]: "C:\\tools\\lark-cli.cmd",
    },
    channels: {
      items: {
        lark: {
          transport: "lark-open-platform",
          cliProfile: "work",
        },
      },
    },
    systemPromptExt: ["保留现有规则"],
  });

  const env = config.env as Record<string, unknown>;
  const channels = config.channels as { items: Record<string, Record<string, unknown>> };
  const skillCredentials = config.skillCredentials as Record<string, { env: string[] }>;

  assert.equal(env[LARK_CLI_COMMAND_ENV], "C:\\tools\\lark-cli.cmd");
  assert.equal(env[LARK_CLI_PROFILE_ENV], "work");
  assert.equal(channels.items.lark.transport, "lark-open-platform");
  assert.equal(channels.items.lark.cliProfile, "work");
  assert.deepEqual(skillCredentials.lark.env, [LARK_CLI_COMMAND_ENV, LARK_CLI_PROFILE_ENV]);
  assert.deepEqual(skillCredentials.feishu.env, [LARK_CLI_COMMAND_ENV, LARK_CLI_PROFILE_ENV]);
  assert.deepEqual(config.systemPromptExt, ["保留现有规则", LARK_CLI_SYSTEM_PROMPT_EXT]);
});

test("lark cli runtime defaults enable the default cli channel", () => {
  const config = ensureLarkCliRuntimeDefaults({});

  const env = config.env as Record<string, unknown>;
  const channels = config.channels as { items: Record<string, Record<string, unknown>> };

  assert.equal(env[LARK_CLI_COMMAND_ENV], "lark-cli");
  assert.equal(env[LARK_CLI_PROFILE_ENV], "default");
  assert.equal(channels.items.lark.enabled, true);
  assert.equal(channels.items.lark.transport, "lark-cli");
  assert.equal(channels.items.lark.cliProfile, "default");
});
