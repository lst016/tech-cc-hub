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
    defaultTransport: "lark-open-platform",
    defaults: {
      enabled: false,
      transport: "lark-open-platform",
      displayName: "飞书 / Lark",
      appIdEnv: "LARK_APP_ID",
      appSecretEnv: "LARK_APP_SECRET",
      tenantKeyEnv: "LARK_TENANT_KEY",
      cliCommand: "lark-cli",
      cliProfile: "default",
      cliSendArgsTemplate: "event send --profile {{profile}} --type message --content \"{{text}}\"",
      cliReceiveArgsTemplate: "event receive --profile {{profile}}",
      notes: "",
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
    const enabled = typeof rawItem.enabled === "boolean" ? rawItem.enabled : definition.defaults.enabled;
    items[definition.id] = {
      provider: definition.id,
      ...definition.defaults,
      enabled,
      chatEnabled: typeof rawItem.chatEnabled === "boolean"
        ? rawItem.chatEnabled
        : definition.defaults.chatEnabled,
      transport: asTransport(rawItem.transport, definition.defaultTransport),
      displayName: asText(rawItem.displayName) ?? definition.defaults.displayName,
      botTokenEnv: asText(rawItem.botTokenEnv) ?? definition.defaults.botTokenEnv,
      chatIdEnv: asText(rawItem.chatIdEnv) ?? definition.defaults.chatIdEnv,
      webhookUrlEnv: asText(rawItem.webhookUrlEnv) ?? definition.defaults.webhookUrlEnv,
      appIdEnv: asText(rawItem.appIdEnv) ?? definition.defaults.appIdEnv,
      appSecretEnv: asText(rawItem.appSecretEnv) ?? definition.defaults.appSecretEnv,
      tenantKeyEnv: asText(rawItem.tenantKeyEnv) ?? definition.defaults.tenantKeyEnv,
      cliCommand: asText(rawItem.cliCommand) ?? definition.defaults.cliCommand,
      cliProfile: asText(rawItem.cliProfile) ?? definition.defaults.cliProfile,
      cliSendArgsTemplate: asText(rawItem.cliSendArgsTemplate) ?? definition.defaults.cliSendArgsTemplate,
      cliReceiveArgsTemplate: asText(rawItem.cliReceiveArgsTemplate) ?? definition.defaults.cliReceiveArgsTemplate,
      allowedSenderIds: asText(rawItem.allowedSenderIds) ?? definition.defaults.allowedSenderIds,
      allowedConversationIds: asText(rawItem.allowedConversationIds) ?? definition.defaults.allowedConversationIds,
      notes: asText(rawItem.notes) ?? definition.defaults.notes,
    };
  }

  const rawDefaultChannel = asText(rawChannels.defaultChannel);
  const defaultChannel = rawDefaultChannel && CHANNEL_BY_ID.has(rawDefaultChannel as ChannelProviderId)
    ? rawDefaultChannel as ChannelProviderId
    : "telegram";
  return { version: 1, defaultChannel, items };
}

function collectEnvNames(channel: ChannelConnectionConfig): string[] {
  return [
    channel.botTokenEnv,
    channel.chatIdEnv,
    channel.webhookUrlEnv,
    channel.appIdEnv,
    channel.appSecretEnv,
    channel.tenantKeyEnv,
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
}

function withSkillCredentialHint(
  config: Record<string, unknown>,
  channel: ChannelConnectionConfig,
): Record<string, unknown> {
  const env = collectEnvNames(channel);
  if (env.length === 0) return config;
  const skillCredentials = isRecord(config.skillCredentials) ? { ...config.skillCredentials } : {};
  skillCredentials[channel.provider] = { env };
  return { ...config, skillCredentials };
}

function serializeConfigWithChannel(
  rootConfig: Record<string, unknown>,
  channel: ChannelConnectionConfig,
): string {
  const runtimeConfig = readChannelRuntimeConfig(rootConfig);
  const items = { ...runtimeConfig.items, [channel.provider]: channel };
  const nextConfig = withSkillCredentialHint({
    ...rootConfig,
    channels: {
      version: 1,
      defaultChannel: runtimeConfig.defaultChannel,
      items,
    },
  }, channel);
  return JSON.stringify(nextConfig, null, 2);
}

export function getChannelSettingsSummary(configText: string): string {
  const rootConfig = parseJsonObject(configText);
  const runtimeConfig = readChannelRuntimeConfig(rootConfig);
  const enabled = Object.values(runtimeConfig.items).filter((item) => item?.enabled).length;
  return `${enabled} 已启用 / Telegram · 飞书 · 微信`;
}

function getChannelStatus(channel: ChannelConnectionConfig): ChannelStatus {
  if (!channel.enabled) return "stopped";
  return "running";
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  label: string;
  value?: string;
  placeholder?: string;
  onChange: (next: string) => void;
  type?: "text" | "password";
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-[#4E5969]">{label}</span>
      <input
        value={value ?? ""}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-xl border border-[#E5E6EB] bg-[#F7F8FA] px-3 text-sm text-[#1D2129] outline-none transition focus:border-[#D96B3A] focus:bg-white"
      />
    </label>
  );
}

function PreferenceRow({ label, description, children }: { label: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-[#F2F3F5] py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[#1D2129]">{label}</div>
        {description && <div className="mt-1 text-xs leading-5 text-[#86909C]">{description}</div>}
      </div>
      <div className="min-w-[220px] max-w-[520px] flex-1">{children}</div>
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="m-0 text-sm font-semibold text-[#1D2129]">{title}</h3>
      {action}
    </div>
  );
}

function buildFeishuAppGuidePrompt(channel: ChannelConnectionConfig): string {
  return [
    "你在 tech-cc-hub 的系统工作区里，目标是引导用户完成飞书开放平台应用的申请到接入全流程。",
    "",
    "请按这个顺序引导用户操作：",
    "1. 打开 https://open.feishu.cn/，登录飞书企业管理员账号。",
    "2. 进入「开发者后台」→「创建企业自建应用」，填写应用名称和描述。",
    "3. 创建完成后，进入「凭证与基础信息」，复制 App ID 和 App Secret。",
    "4. 进入「权限管理」，添加以下权限（按需）：",
    "   - im:message（发送消息）",
    "   - im:message:read（读取消息）",
    "   - im:resource（获取消息中的图片/文件）",
    "   - contact:user.base:read（读取用户基础信息）",
    "5. 进入「事件订阅」，添加回调：",
    "   - im.message.receive_v1（接收消息事件）",
    "6. 配置订阅方式为「Webhook」，填写 tech-cc-hub 提供的 Webhook URL（如果可用）。",
    "7. 进入「安全设置」，配置服务器 IP 白名单（如果适用）。",
    "8. 发布应用：进入「版本管理与发布」，创建版本并提交发布。",
    "9. 发布成功后，将 App ID/App Secret 配置到 tech-cc-hub 的 Lark 渠道设置中。",
    "10. 使用 mcp__tech-cc-hub-admin__set_global_runtime_config 持久化凭证配置。",
    "",
    "注意：IM 消息收发请使用飞书开放平台模式。Lark CLI 模式保留用于其他非 IM 场景。",
    "",
    "当前 UI 配置快照：",
    JSON.stringify({
      enabled: channel.enabled,
      appIdEnv: channel.appIdEnv,
      appSecretEnv: channel.appSecretEnv,
      tenantKeyEnv: channel.tenantKeyEnv,
    }, null, 2),
  ].join("\n");
}

function ChannelHeader({
  definition,
  channel,
  disabled,
  onPatch,
}: {
  definition: ChannelDefinition;
  channel: ChannelConnectionConfig;
  disabled: boolean;
  onPatch: (patch: Partial<ChannelConnectionConfig>) => void;
}) {
  const status = getChannelStatus(channel);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#E5E6EB] bg-white text-sm font-semibold text-[#1D2129]">
          {definition.title.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-[#1D2129]">{definition.title}</span>
            <span className="rounded-full border border-[#F0C7B4] bg-[#FFF4EF] px-2 py-0.5 text-[11px] font-medium text-[#C9572C]">
              {definition.badge}
            </span>
            <span className="rounded-full bg-[#F2F3F5] px-2 py-0.5 text-[11px] text-[#6B778C]">
              {status === "running" ? "已启用" : "未启用"}
            </span>
          </div>
          <div className="mt-1 text-xs leading-5 text-[#86909C]">{definition.description}</div>
        </div>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E5E6EB] bg-[#F7F8FA] px-3 py-2 text-sm font-medium text-[#4E5969]">
        <input
          type="checkbox"
          checked={channel.enabled}
          disabled={disabled}
          onChange={(event) => onPatch({ enabled: event.target.checked })}
          className="h-4 w-4 rounded border-[#C9CDD4] text-[#D96B3A] focus:ring-[#D96B3A]"
        />
        启用
      </label>
    </div>
  );
}

function TelegramConfigForm({
  channel,
  onPatch,
  onStartGuideSession,
}: {
  channel: ChannelConnectionConfig;
  onPatch: (patch: Partial<ChannelConnectionConfig>) => void;
  onStartGuideSession?: (request: ChannelGuideSessionRequest) => Promise<void> | void;
}) {
  const [launchingGuide, setLaunchingGuide] = useState(false);
  const guideLaunchInFlightRef = useRef(false);
  const handleStartGuideSession = () => {
    if (!onStartGuideSession || guideLaunchInFlightRef.current) return;
    guideLaunchInFlightRef.current = true;
    setLaunchingGuide(true);
    const prompt = [
      "你在 tech-cc-hub 的系统工作区里，目标是把 Telegram Bot 通道配置到可用。",
      "",
      "请按这个顺序处理：",
      "1. 在 Telegram 中找 @BotFather，发送 /newbot 按提示创建 Bot，记录返回的 Bot Token。",
      "2. 把 Bot Token 填入全局配置 channels.items.telegram.botTokenEnv（默认 TELEGRAM_BOT_TOKEN）。",
      "3. 找 @userinfobot 或发送 /start 给你的 Bot，获取你的 Chat ID，填入 chatIdEnv（默认 TELEGRAM_CHAT_ID）。",
      "4. 如果需要，先给 Bot 发一条消息再获取 Chat ID。",
      "5. 使用 mcp__tech-cc-hub-admin__set_global_runtime_config 持久化配置，或直接编辑系统工作区配置文件。",
      "6. 完成后给出：Token 环境变量名、Chat ID 环境变量名、验证命令、还缺什么。",
      "",
      "当前 UI 配置快照：",
      JSON.stringify({ enabled: channel.enabled, botTokenEnv: channel.botTokenEnv, chatIdEnv: channel.chatIdEnv }, null, 2),
    ].join("\n");
    void Promise.resolve(onStartGuideSession({
      title: "Telegram Bot 引导配置",
      prompt,
      agentId: "telegram-guide",
      allowedTools: "Read,Edit,MultiEdit,Write,Bash,Glob,Search,update_plan",
    })).catch(() => {
      guideLaunchInFlightRef.current = false;
      setLaunchingGuide(false);
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionHeader
          title="Bot 配置"
          action={onStartGuideSession ? (
            <button
              type="button"
              disabled={launchingGuide}
              onClick={(e) => { e.stopPropagation(); handleStartGuideSession(); }}
              className="inline-flex h-8 items-center rounded-full border border-[#F0C7B4] bg-[#FFF4EF] px-3 text-xs font-semibold text-[#C9572C] transition hover:border-[#D96B3A] hover:bg-[#FFEADF] disabled:cursor-not-allowed disabled:border-[#E5E6EB] disabled:bg-[#F7F8FA] disabled:text-[#86909C]"
            >
              {launchingGuide ? "正在启动..." : "Agent 引导配置"}
            </button>
          ) : null}
        />
        <div className="rounded-2xl border border-[#E5E6EB] bg-white px-4">
          <PreferenceRow label="Bot Token Env" description="Telegram Bot 的 token 环境变量名。">
            <Field label="" value={channel.botTokenEnv} placeholder="TELEGRAM_BOT_TOKEN" onChange={(botTokenEnv) => onPatch({ botTokenEnv })} />
          </PreferenceRow>
          <PreferenceRow label="Chat ID Env" description="默认回复目标的 Chat ID 环境变量名。">
            <Field label="" value={channel.chatIdEnv} placeholder="TELEGRAM_CHAT_ID" onChange={(chatIdEnv) => onPatch({ chatIdEnv })} />
          </PreferenceRow>
        </div>
      </div>
    </div>
  );
}

function LarkConfigForm({
  channel,
  onPatch,
  onStartGuideSession,
}: {
  channel: ChannelConnectionConfig;
  onPatch: (patch: Partial<ChannelConnectionConfig>) => void;
  onStartGuideSession?: (request: ChannelGuideSessionRequest) => Promise<void> | void;
}) {
  const [launchingGuide, setLaunchingGuide] = useState(false);
  const guideLaunchInFlightRef = useRef(false);
  const mode = channel.transport === "lark-cli" ? "lark-cli" : "lark-open-platform";
  const isOpenPlatform = mode === "lark-open-platform";

  const handleStartGuideSession = () => {
    if (!onStartGuideSession || guideLaunchInFlightRef.current) {
      return;
    }

    guideLaunchInFlightRef.current = true;
    setLaunchingGuide(true);

    void Promise.resolve(onStartGuideSession({
      title: "飞书应用引导配置",
      prompt: buildFeishuAppGuidePrompt(channel),
      agentId: "lark-guide",
      allowedTools: "Read,Edit,MultiEdit,Write,Bash,Glob,Search,update_plan",
    })).catch(() => {
      guideLaunchInFlightRef.current = false;
      setLaunchingGuide(false);
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionHeader title="连接方式" />
        <div className="flex flex-wrap gap-2 rounded-2xl border border-[#E5E6EB] bg-[#FAFAFB] p-3">
          <button
            type="button"
            onClick={() => onPatch({ transport: "lark-open-platform" })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition ${isOpenPlatform ? "border-[#D96B3A] bg-[#FFF4EF] text-[#C9572C]" : "border-[#E5E6EB] bg-white text-[#4E5969]"}`}
          >
            <span className="block font-semibold">飞书开放平台</span>
            <span className="mt-1 block opacity-80">IM 消息通过飞书应用接入。</span>
          </button>
          <button
            type="button"
            onClick={() => onPatch({ transport: "lark-cli" })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition ${mode === "lark-cli" ? "border-[#D96B3A] bg-[#FFF4EF] text-[#C9572C]" : "border-[#E5E6EB] bg-white text-[#4E5969]"}`}
          >
            <span className="block font-semibold">Lark CLI</span>
            <span className="mt-1 block opacity-80">CLI 模式，用于非 IM 场景。</span>
          </button>
        </div>
      </div>

      {isOpenPlatform ? (
        <div>
          <SectionHeader
            title="飞书开放平台凭证"
            action={onStartGuideSession ? (
              <button
                type="button"
                disabled={launchingGuide}
                onClick={handleStartGuideSession}
                className="inline-flex h-8 items-center rounded-full border border-[#F0C7B4] bg-[#FFF4EF] px-3 text-xs font-semibold text-[#C9572C] transition hover:border-[#D96B3A] hover:bg-[#FFEADF] disabled:cursor-not-allowed disabled:border-[#E5E6EB] disabled:bg-[#F7F8FA] disabled:text-[#86909C]"
              >
                {launchingGuide ? "正在启动..." : "Agent 引导配置"}
              </button>
            ) : null}
          />
          <div className="rounded-2xl border border-[#E5E6EB] bg-white px-4 pt-1">
            <PreferenceRow label="App ID Env" description="飞书应用的 App ID 环境变量名。">
              <Field label="" value={channel.appIdEnv} placeholder="LARK_APP_ID" onChange={(appIdEnv) => onPatch({ appIdEnv })} />
            </PreferenceRow>
            <PreferenceRow label="App Secret Env" description="飞书应用的 App Secret 环境变量名。">
              <Field label="" value={channel.appSecretEnv} placeholder="LARK_APP_SECRET" onChange={(appSecretEnv) => onPatch({ appSecretEnv })} />
            </PreferenceRow>
            <PreferenceRow label="Tenant Key Env" description="飞书企业自建应用的 Tenant Key 环境变量名。">
              <Field label="" value={channel.tenantKeyEnv} placeholder="LARK_TENANT_KEY" onChange={(tenantKeyEnv) => onPatch({ tenantKeyEnv })} />
            </PreferenceRow>
          </div>
        </div>
      ) : (
        <div>
          <SectionHeader title="CLI 配置" />
          <div className="rounded-2xl border border-[#E5E6EB] bg-white px-4 pt-1">
            <PreferenceRow label="CLI 命令" description="lark-cli 的可执行路径或命令名。">
              <Field label="" value={channel.cliCommand} placeholder="lark-cli" onChange={(cliCommand) => onPatch({ cliCommand })} />
            </PreferenceRow>
            <PreferenceRow label="CLI Profile" description="lark-cli 使用的 profile 名称。">
              <Field label="" value={channel.cliProfile} placeholder="default" onChange={(cliProfile) => onPatch({ cliProfile })} />
            </PreferenceRow>
            <PreferenceRow label="发送参数模板" description="event send 命令的参数模板，支持 {{profile}} {{text}} 占位。">
              <Field label="" value={channel.cliSendArgsTemplate} placeholder='event send --profile {{profile}} --type message --content "{{text}}"' onChange={(cliSendArgsTemplate) => onPatch({ cliSendArgsTemplate })} />
            </PreferenceRow>
            <PreferenceRow label="接收参数模板" description="event receive 命令的参数模板，支持 {{profile}} 占位。">
              <Field label="" value={channel.cliReceiveArgsTemplate} placeholder="event receive --profile {{profile}}" onChange={(cliReceiveArgsTemplate) => onPatch({ cliReceiveArgsTemplate })} />
            </PreferenceRow>
            <PreferenceRow label="允许的发送者 ID" description="逗号分隔的飞书用户 ID 白名单，留空表示不限制。">
              <Field label="" value={channel.allowedSenderIds} placeholder="" onChange={(allowedSenderIds) => onPatch({ allowedSenderIds })} />
            </PreferenceRow>
            <PreferenceRow label="允许的会话 ID" description="逗号分隔的飞书会话 ID 白名单，留空表示不限制。">
              <Field label="" value={channel.allowedConversationIds} placeholder="" onChange={(allowedConversationIds) => onPatch({ allowedConversationIds })} />
            </PreferenceRow>
          </div>
        </div>
      )}
    </div>
  );
}

function WeixinConfigForm({
  channel,
  onPatch,
}: {
  channel: ChannelConnectionConfig;
  onPatch: (patch: Partial<ChannelConnectionConfig>) => void;
}) {
  const mode = channel.transport === "weixin-native" ? "weixin-native" : "weixin-openclaw";
  const isClawMode = mode === "weixin-openclaw";
  return (
    <div className="space-y-5">
      <div>
        <SectionHeader title="连接方式" />
        <div className="flex flex-wrap gap-2 rounded-2xl border border-[#E5E6EB] bg-[#FAFAFB] p-3">
          <button
            type="button"
            onClick={() => onPatch({ transport: "weixin-native" })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition ${mode === "weixin-native" ? "border-[#D96B3A] bg-[#FFF4EF] text-[#C9572C]" : "border-[#E5E6EB] bg-white text-[#4E5969]"}`}
          >
            <span className="block font-semibold">微信原版</span>
            <span className="mt-1 block opacity-80">保留原版登录入口。</span>
          </button>
          <button
            type="button"
            onClick={() => onPatch({ transport: "weixin-openclaw" })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition ${mode === "weixin-openclaw" ? "border-[#D96B3A] bg-[#FFF4EF] text-[#C9572C]" : "border-[#E5E6EB] bg-white text-[#4E5969]"}`}
          >
            <span className="block font-semibold">微信 Claw</span>
            <span className="mt-1 block opacity-80">由 app 接管微信会话。</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E5E6EB] bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[#1D2129]">
              {isClawMode ? "使用 tech-cc-hub 全局配置" : "原版微信入口待接入"}
            </div>
            <div className="mt-1 text-xs leading-5 text-[#86909C]">
              {isClawMode
                ? "账号、Token、Home Channel 和 Base URL 保存在应用全局运行时配置里，不在这里展开底层字段。"
                : "当前只保留模式选择，运行时先以微信 Claw 为主。"}
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${isClawMode ? "bg-[#E8F7F1] text-[#0B8F61]" : "bg-[#F2F3F5] text-[#6B778C]"}`}>
            {isClawMode ? "推荐" : "未启用"}
          </span>
        </div>
      </div>
    </div>
  );
}

function ChannelItem({
  definition,
  channel,
  disabled,
  collapsed,
  onToggleCollapse,
  onPatch,
  onStartGuideSession,
}: {
  definition: ChannelDefinition;
  channel: ChannelConnectionConfig;
  disabled: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onPatch: (patch: Partial<ChannelConnectionConfig>) => void;
  onStartGuideSession?: (request: ChannelGuideSessionRequest) => Promise<void> | void;
}) {
  return (
    <section data-channel-id={definition.id} className="rounded-2xl border border-[#E5E6EB] bg-white shadow-[0_10px_30px_rgba(24,32,46,0.04)]">
      <button type="button" className="w-full px-4 py-4 text-left" onClick={onToggleCollapse}>
        <ChannelHeader definition={definition} channel={channel} disabled={disabled} onPatch={onPatch} />
      </button>
      {!collapsed && (
        <div className="border-t border-[#F2F3F5] px-4 py-4">
          {definition.id === "telegram" && <TelegramConfigForm channel={channel} onPatch={onPatch} onStartGuideSession={onStartGuideSession} />}
          {definition.id === "lark" && (
            <LarkConfigForm channel={channel} onPatch={onPatch} onStartGuideSession={onStartGuideSession} />
          )}
          {definition.id === "wechat" && <WeixinConfigForm channel={channel} onPatch={onPatch} />}
        </div>
      )}
    </section>
  );
}

export function ChannelsSettingsPage({ configText, parseError, onChange, onStartGuideSession }: ChannelsSettingsPageProps) {
  const rootConfig = useMemo(() => parseJsonObject(configText), [configText]);
  const runtimeConfig = useMemo(() => readChannelRuntimeConfig(rootConfig), [rootConfig]);
  const enabledCount = Object.values(runtimeConfig.items).filter((item) => item?.enabled).length;
  const [collapseKeys, setCollapseKeys] = useState<Record<ChannelProviderId, boolean>>({
    telegram: false,
    lark: true,
    wechat: true,
  });

  const updateChannel = (provider: ChannelProviderId, patch: Partial<ChannelConnectionConfig>) => {
    if (!rootConfig || parseError) return;
    const current = runtimeConfig.items[provider];
    const definition = CHANNEL_BY_ID.get(provider);
    if (!current || !definition) return;
    const nextChannel: ChannelConnectionConfig = {
      ...definition.defaults,
      ...current,
      ...patch,
      provider,
    };
    onChange(serializeConfigWithChannel(rootConfig, nextChannel));
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section className="rounded-[28px] border border-[#E5E6EB] bg-white p-5 shadow-[0_18px_44px_rgba(24,32,46,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#86909C]">Channels</div>
            <h2 className="mt-2 text-xl font-bold text-[#1D2129]">渠道连接</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6B778C]">
              支持 Telegram、飞书/Lark、微信三种消息渠道接入。未完整接入的平台不显示。
            </p>
          </div>
          <div className="rounded-2xl bg-[#FFF4EF] px-4 py-3 text-sm text-[#C9572C]">
            <div className="text-xs opacity-80">已启用</div>
            <div className="mt-1 text-2xl font-bold">{enabledCount}</div>
          </div>
        </div>
        {parseError && (
          <div className="mt-4 rounded-2xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
            全局配置 JSON 当前不合法，先修复 JSON 后才能编辑渠道。
          </div>
        )}
      </section>

      <div className="grid gap-3">
        {CHANNEL_DEFINITIONS.map((definition) => {
          const channel = runtimeConfig.items[definition.id];
          if (!channel) return null;
          return (
            <ChannelItem
              key={definition.id}
              definition={definition}
              channel={channel}
              disabled={Boolean(parseError)}
              collapsed={collapseKeys[definition.id]}
              onToggleCollapse={() => setCollapseKeys((current) => ({ ...current, [definition.id]: !current[definition.id] }))}
              onPatch={(patch) => updateChannel(definition.id, patch)}
              onStartGuideSession={onStartGuideSession}
            />
          );
        })}
      </div>
    </div>
  );
}
