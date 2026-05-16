# src/ui/components/settings/ChannelsSettingsPage.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：792

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `isRecord@104`
- `parseJsonObject@108`
- `asText@118`
- `asTransport@122`
- `readChannelRuntimeConfig@132`
- `collectEnvNames@173`
- `withSkillCredentialHint@186`
- `serializeConfigWithChannel@197`
- `getChannelSettingsSummary@214`
- `getChannelStatus@221`
- `Field@226`
- `PreferenceRow@253`
- `SectionHeader@265`
- `buildFeishuAppGuidePrompt@274`
- `buildLarkCliGuidePrompt@307`
- `ChannelHeader@372`
- `TelegramConfigForm@417`
- `LarkConfigForm@486`
- `WeixinConfigForm@634`
- `ChannelItem@688`
- `ChannelsSettingsPage@723`
- `CHANNEL_BY_ID@102`
- `parsed@112`
- `rawChannels@134`
- `rawItems@135`
- `maybeRawItem@139`
- `rawItem@140`
- `enabled@141`
- `rawDefaultChannel@166`
- `defaultChannel@168`
- `env@191`
- `skillCredentials@193`
- `runtimeConfig@202`
- `items@203`
- `nextConfig@204`
- `rootConfig@216`
- `runtimeConfig@217`
- `enabled@218`
- `cliCommand@309`
- `cliProfile@310`

## 依赖输入

- `react`
- `../../types`
- `../../../shared/lark-runtime-defaults.js`

## 对外暴露

- `ChannelGuideSessionRequest`
- `getChannelSettingsSummary`
- `ChannelsSettingsPage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Source copy/adaptation:
 * - AionUi SettingsModal channel modules under doc/00-research/AionUi.
 *
 * tech-cc-hub adapter notes:
 * - Keep only Telegram, Lark/Feishu and Weixin, as requested.
 * - Preserve AionUi channel boundaries: ChannelModalContent -> ChannelItem -> ChannelHeader -> platform config forms.
 * - Persist through tech-cc-hub global JSON until the AionUi process ChannelManager is copied in.
 */

import { useMemo, useRef, useState, type ReactNode } from "react";
import type {
  ChannelConnectionConfig,
  ChannelProviderId,
  ChannelRuntimeConfig,
  ChannelTransportMode,
} from "../../types";
import {
  DEFAULT_LARK_CHANNEL_CONFIG,
  LARK_CLI_COMMAND_ENV,
  LARK_CLI_PROFILE_ENV,
  LARK_CLI_SKILL_ENV_KEYS,
  LARK_CLI_SYSTEM_PROMPT_EXT,
} from "../../../shared/lark-runtime-defaults.js";

type ChannelsSettingsPageProps = {
  configText: string;
  parseError: string | null;
  onChange: (next: string) => void;
  onStartGuideSession?: (request: ChannelGuideSessionRequest) => Promise<void> | void;
};

export type ChannelGuideSessionRequest = {
  title: string;
  prompt: string;
  agentId?: string;
  allowedTools?: string;
};

type ChannelStatus = "stopped" | "running" | "error";

type ChannelDefinition = {
  id: ChannelProviderId;
  title: string;
  description: string;
  badge: string;
  source: string;
  defaultTransport: ChannelTransportMode;
  defaults: Omit<ChannelConnectionConfig, "provider">;
};

const CHANNEL_DEFINITIONS: ChannelDefinition[] = [
  {
    id: "telegram",
    title: "Telegram",
    description: "Telegram Bot 消息通道。",
    badge: "Bot",
    source: "TelegramPlugin",
    defaultTransport: "bot-api",
    defaults: {
      enabled: false,
      transport: "bot-api",
      displayName: "Telegram",
      botTokenEnv: "TELEGRAM_BOT_TOKEN",
      chatIdEnv: "TELEGRAM_CHAT_ID",
    },
  },
  {
    id: "lark",
    title: "飞书 / Lark",
    description: "飞书 / Lark 通道。IM 消息通过飞书开放平台应用接入，CLI 模式保留用于非 IM 场景。",
    badge: "Lark",
    source: "Feishu Open Platform + Lark CLI",
    defaultTransport: "lark-cli",
    defaults: {
      ...DEFAULT_LARK_CHANNEL_CONFIG,
    },
  },
  {
    id: "wechat",
    title: "微信",
    description: "接入微信 Claw，会话由 tech-cc-hub 统一接管。",
    badge: "Hermes",
    source: "Hermes Weixin gateway + OpenClaw session",
    defaultTransport: "weixin-openclaw",
    defaults: {
      enabled: false,
      transport: "weixin-openclaw",
      displayName: "微信 / Hermes",
      botTokenEnv: "WEIXIN_TOKEN",
      chatIdEnv: "WEIXIN_HOME_CHANNEL",
      appIdEnv: "WEIXIN_ACCOUNT_ID",
      webhookUrlEnv: "WEIXIN_BASE_URL",
      tenantKeyEnv: "WEIXIN_CDN_BASE_URL",
    },
  },
];

const CHANNEL_BY_ID = new Map(CHANNEL_DEFINITIONS.map((definition) => [definition.id, definition]));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonObject(rawText: string): Record<string, unknown> | null {
  if (!rawText.trim()) return {};
  try {
    const parsed = JSON.parse(rawText) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asTransport(value: unknown, fallback: ChannelTransportMode): ChannelTransportMode {
  return value === "bot-api"
    || value === "lark-cli"
    || value === "lark-open-platform"
    || value === "weixin-native"
    || value === "weixin-openclaw"
    ? value
    : fallback;
}

function readChannelRuntimeConfig(rootConfig: Record<string, unknown> | null): ChannelRuntimeConfig {
  const rawChannels = isRecord(rootConfig?.channels) ? rootConfig.channels : {};
  const rawItems = isRecord(rawChannels.items) ? rawChannels.items : {};
  const items: ChannelRuntimeConfig["items"] = {};

  for (const definition of CHANNEL_DEFINITIONS) {
    const maybeRawItem = rawItems[definition.id];
    const rawItem = isRecord(maybeRawItem) ? maybeRawItem : {};
    const enabled = typeof rawItem.enabled === "boolean" ? rawItem.enabled : d
... (truncated)
```
