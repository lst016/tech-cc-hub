# src/electron/libs/mcp-tools/admin.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：572

## 文件职责

源码文件。运行信号：mcp tool: set_global_runtime_config；依赖：@anthropic-ai/claude-agent-sdk、zod、../config-store.js、./tool-result.js

## 运行信号

- `mcp tool: set_global_runtime_config`

## 关键符号

- `isAllowedEnvKey@78 - mcp tool: set_global_runtime_config`
- `toEnvString@93 - mcp tool: set_global_runtime_config`
- `normalizeSystemPromptExt@103 - mcp tool: set_global_runtime_config`
- `isChannelProviderId@126 - mcp tool: set_global_runtime_config`
- `isChannelTransportMode@130 - mcp tool: set_global_runtime_config`
- `normalizeChannelText@134 - mcp tool: set_global_runtime_config`
- `normalizeLarkChannelPatch@148 - mcp tool: set_global_runtime_config`
- `normalizeChannelsPatch@174 - mcp tool: set_global_runtime_config`
- `normalizePatch@195 - mcp tool: set_global_runtime_config`
- `collectSkillEnvCandidates@313 - mcp tool: set_global_runtime_config`
- `readSystemPromptExtLines@336 - mcp tool: set_global_runtime_config`
- `mergeSystemPromptExtLines@347 - mcp tool: set_global_runtime_config`
- `mergeConfig@356 - mcp tool: set_global_runtime_config`
- `buildResultSummary@448 - mcp tool: set_global_runtime_config`
- `getAdminMcpServer@528 - mcp tool: set_global_runtime_config`
- `ADMIN_TOOL_NAMES@13 - mcp tool: set_global_runtime_config`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `zod`
- `../config-store.js`
- `./tool-result.js`

## 对外暴露

- `ADMIN_TOOL_NAMES`
- `getAdminMcpServer`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// 管理类 MCP 工具：只负责让 Agent 受控地修改 tech-cc-hub 自己的运行配置。
// 放在独立文件里，方便审阅哪些字段允许被 AI 写入，哪些字段会被拒绝。
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import type { GlobalRuntimeConfig } from "../config-store.js";
import { loadGlobalRuntimeConfig, saveGlobalRuntimeConfig } from "../config-store.js";
import { toTextToolResult } from "./tool-result.js";

export const ADMIN_TOOL_NAMES = ["set_global_runtime_config"] as const;

const ADMIN_TOOLS_SERVER_NAME = "tech-cc-hub-admin";
const ADMIN_MCP_SERVER_VERSION = "1.0.0";

// 这些上限是工具的安全边界：AI 可以帮用户写配置，但不能一次塞入超大对象或覆盖主模型凭证。
const MAX_ENV_KEY_LENGTH = 128;
const MAX_ENV_VALUE_LENGTH = 4096;
const MAX_ENV_ENTRIES = 120;
const MAX_SKILL_NAME_LENGTH = 128;
const MAX_SKILL_CREDENTIAL_ENTRIES = 80;
const MAX_DELETE_ITEMS = 80;
const MAX_SYSTEM_PROMPT_EXT_LINES = 40;
const MAX_SYSTEM_PROMPT_EXT_LINE_LENGTH = 2000;
const MAX_CHANNEL_FIELD_LENGTH = 4096;
const CHANNEL_PROVIDER_IDS = ["telegram", "lark", "wechat"] as const;
const CHANNEL_TRANSPORT_MODES = ["bot-api", "lark-cli", "lark-open-platform", "weixin-native", "weixin-openclaw"] as const;
const LARK_CHANNEL_STRING_FIELDS = [
  "displayName",
  "botTokenEnv",
  "chatIdEnv",
  "webhookUrlEnv",
  "appIdEnv",
  "appSecretEnv",
  "tenantKeyEnv",
  "cliCommand",
  "cliProfile",
  "cliSendArgsTemplate",
  "cliReceiveArgsTemplate",
  "allowedSenderIds",
  "allowedConversationIds",
  "notes",
] as const;
const LARK_CHANNEL_BOOLEAN_FIELDS = ["enabled", "chatEnabled"] as const;

type ChannelProviderId = typeof CHANNEL_PROVIDER_IDS[number];
type ChannelTransportMode = typeof CHANNEL_TRANSPORT_MODES[number];
type ChannelPatch = {
  defaultChannel?: ChannelProviderId;
  items?: {
    lark?: Record<string, string | boolean>;
  };
};
type ConfigSection = "env" | "skillCredentials" | "closeSidebarOnBrowserOpen" | "systemPromptExt" | "channels";

type AdminToolInput = {
  patch?: {
    env?: Record<string, string | number | boolean>;
    skillCredentials?: Record<string, string[]>;
    closeSidebarOnBrowserOpen?: boolean;
    systemPromptExt?: string[];
    channels?: ChannelPatch;
  };
  remove?: {
    env?: string[];
    skillCredentials?: string[];
    sections?: ConfigSection[];
  };
};

let adminMcpServer: McpSdkServerConfigWithInstance | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function isAllowedEnvKey(key: string): boolean {
  const normalized = key.trim();
  if (!normalized || normalized.length > MAX_ENV_KEY_LENGTH) {
    return false;
  }
  if (!/^[_A-Za-z][_A-Za-z0-9]*$/.test(normalized)) {
    return false;
  }
  // ANTHROPIC_* 是主运行时通道配置，避免被技能凭证工具误写或误回显。
  if (normalized.toUpperCase().startsWith("ANTHROPIC_")) {
    return false;
  }
  return true;
}

function toEnvString(value: string | number | boolean): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  return value ? "true" : "false";
}

function normalizeSystemPromptExt(value: unknown): string[] {
  const candidates = typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value
      : [];
  const lines = candidates
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  if (lines.length > MAX_SYSTEM_PROMPT_EXT_LINES) {
    throw new Error(`systemPromptExt 不能超过 ${MAX_SYSTEM_PROMPT_EXT_LINES} 行。`);
  }

  for (const line of lines) {
    if (line.length > MAX_SYSTEM_PROMPT_EXT_LINE_LENGTH) {
      throw new Error(`systemPromptExt 单行长度超限（max ${MAX_SYSTEM_PROMPT_EXT_LINE_LENGTH}）。`);
    }
  }

  return Array.from(new Set(lines));
}

function isChannelProviderId(value: unknown): value is ChannelProviderId {
  return typeof value === "string" && (CHANNEL_PROVIDER_IDS as readonly string[]).includes(value);
}

function isChannelTransportMode(value: unknown): value is ChannelTransportMode {
  return typeof value === "string" && (CHANNEL_TRANSPORT_MODES as readonly string[]).includes(value);
}

function normalizeChannelText(v
... (truncated)
```
