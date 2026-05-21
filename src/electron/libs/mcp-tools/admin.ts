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

function normalizeChannelText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length > MAX_CHANNEL_FIELD_LENGTH) {
    throw new Error(`channels 字段值长度超限（max ${MAX_CHANNEL_FIELD_LENGTH}）。`);
  }
  return trimmed;
}

function normalizeLarkChannelPatch(value: unknown): Record<string, string | boolean> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const patch: Record<string, string | boolean> = { provider: "lark" };
  for (const field of LARK_CHANNEL_BOOLEAN_FIELDS) {
    if (typeof value[field] === "boolean") {
      patch[field] = value[field];
    }
  }
  if (isChannelTransportMode(value.transport)) {
    patch.transport = value.transport;
  }
  for (const field of LARK_CHANNEL_STRING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      const text = normalizeChannelText(value[field]);
      if (text !== undefined) {
        patch[field] = text;
      }
    }
  }

  return Object.keys(patch).length > 1 ? patch : undefined;
}

function normalizeChannelsPatch(value: unknown): ChannelPatch | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const patch: ChannelPatch = {};
  if (isChannelProviderId(value.defaultChannel)) {
    patch.defaultChannel = value.defaultChannel;
  }

  const rawItems = isRecord(value.items) ? value.items : {};
  const lark = normalizeLarkChannelPatch(rawItems.lark);
  if (lark) {
    patch.items = { lark };
  }

  return patch.defaultChannel || patch.items ? patch : undefined;
}

// 把 MCP 输入归一成内部补丁结构。这里会过滤非法 key，而不是把模型给的 JSON 原样写盘。
function normalizePatch(input: unknown): AdminToolInput {
  const patch: NonNullable<AdminToolInput["patch"]> = {};
  const remove: NonNullable<AdminToolInput["remove"]> = {};
  const rootInput = isRecord(input) ? input : {};

  const patchInput = isRecord(rootInput.patch) ? rootInput.patch : null;
  if (patchInput?.env && isRecord(patchInput.env)) {
    const envEntries = Object.entries(patchInput.env);
    if (envEntries.length > MAX_ENV_ENTRIES) {
      throw new Error(`env 字段不能超过 ${MAX_ENV_ENTRIES} 项。`);
    }
    for (const [rawKey, rawValue] of envEntries) {
      const key = String(rawKey).trim();
      if (!isAllowedEnvKey(key) || ![ "string", "number", "boolean" ].includes(typeof rawValue)) {
        continue;
      }
      const value = toEnvString(rawValue as string | number | boolean);
      if (!value) {
        continue;
      }
      if (value.length > MAX_ENV_VALUE_LENGTH) {
        throw new Error(`环境变量 ${key} 值长度超限（max ${MAX_ENV_VALUE_LENGTH}）。`);
      }
      patch.env ??= {};
      patch.env[key] = value;
    }
  }

  if (patchInput?.skillCredentials && isRecord(patchInput.skillCredentials)) {
    const skillEntries = Object.entries(patchInput.skillCredentials);
    if (skillEntries.length > MAX_SKILL_CREDENTIAL_ENTRIES) {
      throw new Error(`skillCredentials 字段不能超过 ${MAX_SKILL_CREDENTIAL_ENTRIES} 项。`);
    }
    for (const [rawSkillName, rawSkillValue] of skillEntries) {
      const skillName = String(rawSkillName).trim();
      if (!skillName || skillName.length > MAX_SKILL_NAME_LENGTH) {
        continue;
      }
      const envCandidates = collectSkillEnvCandidates(rawSkillValue);
      if (envCandidates.length === 0) {
        continue;
      }
      const filtered = envCandidates
        .filter(isAllowedEnvKey)
        .map((item) => item.trim())
        .filter(Boolean);
      if (filtered.length === 0) {
        continue;
      }
      patch.skillCredentials ??= {};
      patch.skillCredentials[skillName] = filtered;
    }
  }

  if (patchInput && Object.prototype.hasOwnProperty.call(patchInput, "closeSidebarOnBrowserOpen")) {
    const raw = patchInput.closeSidebarOnBrowserOpen;
    if (typeof raw === "boolean") {
      patch.closeSidebarOnBrowserOpen = raw;
    }
  }

  if (patchInput && Object.prototype.hasOwnProperty.call(patchInput, "systemPromptExt")) {
    const lines = normalizeSystemPromptExt(patchInput.systemPromptExt);
    if (lines.length > 0) {
      patch.systemPromptExt = lines;
    }
  }

  if (patchInput && Object.prototype.hasOwnProperty.call(patchInput, "channels")) {
    const channels = normalizeChannelsPatch(patchInput.channels);
    if (channels) {
      patch.channels = channels;
    }
  }

  const removeInput = isRecord(rootInput.remove) ? rootInput.remove : null;
  if (removeInput?.env && Array.isArray(removeInput.env)) {
    const envKeys = removeInput.env
      .map((raw) => String(raw).trim())
      .filter((key) => isAllowedEnvKey(key));
    if (envKeys.length > MAX_DELETE_ITEMS) {
      throw new Error(`remove.env 不能超过 ${MAX_DELETE_ITEMS} 项。`);
    }
    if (envKeys.length > 0) {
      remove.env = Array.from(new Set(envKeys));
    }
  }

  if (removeInput?.skillCredentials && Array.isArray(removeInput.skillCredentials)) {
    const skills = removeInput.skillCredentials
      .map((raw) => String(raw).trim())
      .filter(Boolean);
    if (skills.length > MAX_DELETE_ITEMS) {
      throw new Error(`remove.skillCredentials 不能超过 ${MAX_DELETE_ITEMS} 项。`);
    }
    if (skills.length > 0) {
      remove.skillCredentials = Array.from(new Set(skills));
    }
  }

  if (removeInput?.sections && Array.isArray(removeInput.sections)) {
    const validSections = removeInput.sections.filter((section): section is ConfigSection => {
      return section === "env"
        || section === "skillCredentials"
        || section === "closeSidebarOnBrowserOpen"
        || section === "systemPromptExt"
        || section === "channels";
    });
    if (validSections.length > 0) {
      remove.sections = Array.from(new Set(validSections));
    }
  }

  return {
    patch: Object.keys(patch).length > 0 ? patch : undefined,
    remove: Object.keys(remove).length > 0 ? remove : undefined,
  };
}

function collectSkillEnvCandidates(rawValue: unknown): string[] {
  if (typeof rawValue === "string") {
    return rawValue.trim() ? [rawValue.trim()] : [];
  }

  if (Array.isArray(rawValue)) {
    return rawValue
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (isRecord(rawValue)) {
    const envValue = rawValue.env;
    if (Array.isArray(envValue)) {
      return envValue
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }
  }

  return [];
}

function readSystemPromptExtLines(value: unknown): string[] {
  const raw = typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value
      : [];
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function mergeSystemPromptExtLines(current: unknown, patchLines: string[]): string[] {
  return Array.from(new Set([
    ...readSystemPromptExtLines(current),
    ...patchLines,
  ]));
}

// 合并策略是“只改传入字段”：没有出现在 patch/remove 里的配置会原样保留。
function mergeConfig(currentConfig: unknown, patch?: AdminToolInput["patch"], remove?: AdminToolInput["remove"]): GlobalRuntimeConfig {
  const base: GlobalRuntimeConfig = isRecord(currentConfig) ? { ...currentConfig } : {};
  const sections = new Set(remove?.sections ?? []);
  const shouldTouchEnv = Boolean(patch?.env || remove?.env);
  const shouldTouchSkillCredentials = Boolean(patch?.skillCredentials || remove?.skillCredentials);
  const shouldTouchChannels = Boolean(patch?.channels);
  const nextEnv = sections.has("env") ? {} : isRecord(base.env) ? { ...base.env } : {};
  const nextSkillCredentials = sections.has("skillCredentials")
    ? {}
    : isRecord(base.skillCredentials)
      ? { ...base.skillCredentials }
      : {};
  const nextChannels = sections.has("channels")
    ? {}
    : isRecord(base.channels)
      ? { ...base.channels }
      : {};

  if (patch?.closeSidebarOnBrowserOpen !== undefined) {
    base.closeSidebarOnBrowserOpen = patch.closeSidebarOnBrowserOpen;
    sections.delete("closeSidebarOnBrowserOpen");
  }

  if (remove?.sections?.includes("closeSidebarOnBrowserOpen")) {
    delete (base as Record<string, unknown>).closeSidebarOnBrowserOpen;
  }

  if (patch?.env) {
    for (const [key, value] of Object.entries(patch.env)) {
      const currentEnv: string = typeof value === "string" ? value : String(value);
      nextEnv[key] = currentEnv;
    }
  }
  if (remove?.env) {
    for (const key of remove.env) {
      delete nextEnv[key];
    }
  }
  if (sections.has("env")) {
    delete (base as Record<string, unknown>).env;
  } else if (shouldTouchEnv) {
    base.env = nextEnv;
  }

  if (patch?.skillCredentials) {
    for (const [skillName, envList] of Object.entries(patch.skillCredentials)) {
      nextSkillCredentials[skillName] = Array.from(new Set(envList.map((item) => item.trim()).filter(Boolean)));
    }
  }
  if (remove?.skillCredentials) {
    for (const skillName of remove.skillCredentials) {
      delete nextSkillCredentials[skillName];
    }
  }
  if (sections.has("skillCredentials")) {
    delete (base as Record<string, unknown>).skillCredentials;
  } else if (shouldTouchSkillCredentials) {
    base.skillCredentials = nextSkillCredentials;
  }

  if (patch?.systemPromptExt) {
    base.systemPromptExt = mergeSystemPromptExtLines(base.systemPromptExt, patch.systemPromptExt);
    sections.delete("systemPromptExt");
  }
  if (sections.has("systemPromptExt")) {
    delete (base as Record<string, unknown>).systemPromptExt;
  }

  if (patch?.channels?.defaultChannel) {
    nextChannels.defaultChannel = patch.channels.defaultChannel;
  }
  if (patch?.channels?.items) {
    const nextItems = isRecord(nextChannels.items) ? { ...nextChannels.items } : {};
    for (const [provider, channelPatch] of Object.entries(patch.channels.items)) {
      const currentChannel = isRecord(nextItems[provider]) ? { ...nextItems[provider] } : {};
      nextItems[provider] = {
        ...currentChannel,
        ...channelPatch,
        provider,
      };
    }
    nextChannels.version = 1;
    nextChannels.items = nextItems;
  }
  if (sections.has("channels")) {
    delete (base as Record<string, unknown>).channels;
  } else if (shouldTouchChannels) {
    base.channels = nextChannels;
  }

  return base;
}

function buildResultSummary(nextConfig: GlobalRuntimeConfig): Record<string, unknown> {
  const env = isRecord(nextConfig.env) ? Object.keys(nextConfig.env) : [];
  const skillCredentials = isRecord(nextConfig.skillCredentials)
    ? Object.keys(nextConfig.skillCredentials as Record<string, unknown>)
    : [];
  const channels = isRecord(nextConfig.channels) && isRecord(nextConfig.channels.items)
    ? Object.keys(nextConfig.channels.items)
    : [];
  const systemPromptExt = readSystemPromptExtLines(nextConfig.systemPromptExt);
  const closeSidebarOnBrowserOpen = Object.prototype.hasOwnProperty.call(nextConfig, "closeSidebarOnBrowserOpen")
    ? Boolean(nextConfig.closeSidebarOnBrowserOpen)
    : undefined;

  return {
    sections: {
      env: env.length,
      skillCredentials: skillCredentials.length,
      channels: channels.length,
      systemPromptExt: systemPromptExt.length,
      closeSidebarOnBrowserOpen,
    },
    envKeys: env,
    skillCredentialSkills: skillCredentials,
    channelProviders: channels,
  };
}

// Claude Agent SDK 的 tool schema 需要字段对象；具体的业务校验再交给 normalizePatch 兜底。
const TOOL_INPUT_SCHEMA = {
  patch: z
    .object({
      env: z.record(z.string(), z.union([z.string().min(1), z.number(), z.boolean()])),
      skillCredentials: z.record(
        z.string(),
        z.union([
          z.array(z.string().trim().min(1)).max(200),
          z.string().trim().min(1),
          z.object({ env: z.array(z.string().trim().min(1)).max(200) }),
        ]),
      ),
      closeSidebarOnBrowserOpen: z.boolean(),
      systemPromptExt: z.union([
        z.string().trim().min(1),
        z.array(z.string().trim().min(1)).max(MAX_SYSTEM_PROMPT_EXT_LINES),
      ]),
      channels: z.object({
        defaultChannel: z.enum(CHANNEL_PROVIDER_IDS).optional(),
        items: z.object({
          lark: z.object({
            enabled: z.boolean().optional(),
            chatEnabled: z.boolean().optional(),
            transport: z.enum(CHANNEL_TRANSPORT_MODES).optional(),
            displayName: z.string().optional(),
            botTokenEnv: z.string().optional(),
            chatIdEnv: z.string().optional(),
            webhookUrlEnv: z.string().optional(),
            appIdEnv: z.string().optional(),
            appSecretEnv: z.string().optional(),
            tenantKeyEnv: z.string().optional(),
            cliCommand: z.string().optional(),
            cliProfile: z.string().optional(),
            cliSendArgsTemplate: z.string().optional(),
            cliReceiveArgsTemplate: z.string().optional(),
            allowedSenderIds: z.string().optional(),
            allowedConversationIds: z.string().optional(),
            notes: z.string().optional(),
          }).partial().optional(),
        }).partial().optional(),
      }).partial(),
    })
    .partial(),
  remove: z
    .object({
      env: z.array(z.string().trim().min(1)).max(MAX_DELETE_ITEMS),
      skillCredentials: z.array(z.string().trim().min(1)).max(MAX_DELETE_ITEMS),
      sections: z.array(z.enum(["env", "skillCredentials", "closeSidebarOnBrowserOpen", "systemPromptExt", "channels"])),
    })
    .partial(),
};

export function getAdminMcpServer(): McpSdkServerConfigWithInstance {
  const toolHandler = tool(
    "set_global_runtime_config",
    "写入/更新 tech-cc-hub 全局运行配置（agent-runtime.json）。支持 env、skillCredentials、channels、systemPromptExt 等字段；用于将凭证变量、技能映射、渠道入口和全局提示持久化，避免重复手工配置。",
    TOOL_INPUT_SCHEMA,
    async (input) => {
      try {
        const normalized = normalizePatch(input);
        if (!normalized.patch && !normalized.remove) {
          return toTextToolResult({ action: "set_global_runtime_config", success: false, error: "未提供任何可执行变更。" }, true);
        }

        const current = loadGlobalRuntimeConfig();
        const next = mergeConfig(current, normalized.patch, normalized.remove);
        saveGlobalRuntimeConfig(next);
        const summary = buildResultSummary(next);
        return toTextToolResult({
          action: "set_global_runtime_config",
          success: true,
          summary,
        });
      } catch (error) {
        return toTextToolResult({
          action: "set_global_runtime_config",
          success: false,
          error: error instanceof Error ? error.message : "更新全局配置失败。",
        }, true);
      }
    },
  );

  return createSdkMcpServer({
    name: ADMIN_TOOLS_SERVER_NAME,
    version: ADMIN_MCP_SERVER_VERSION,
    tools: [toolHandler],
  });

}
