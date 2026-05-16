# test/electron/channel-config.test.ts

> 模块：`test` · 语言：`typescript` · 行数：67

## 文件职责

测试通道配置和飞书CLI运行时默认值，验证chatEnabled开关、env变量设置、skill凭证env列表追加

## 关键符号

- `isChannelChatEnabled@0 - 判断通道的聊天功能是否启用`
- `ensureLarkCliRuntimeDefaults@0 - 确保飞书CLI运行时默认值，不覆盖用户已有选择`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/shared/channel-config.js`
- `../../src/shared/lark-runtime-defaults.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

```
