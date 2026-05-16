# src/shared/lark-runtime-defaults.ts

> 模块：`shared` · 语言：`typescript` · 行数：117

## 文件职责

管理 Lark/飞书 CLI 运行时的默认配置和环境变量注入逻辑

## 关键符号

- `LARK_CLI_SKILL_ENV_KEYS@0 - Lark CLI 环境变量键名数组`
- `DEFAULT_LARK_CHANNEL_CONFIG@0 - 默认 Lark channel 配置对象，包含 provider、transport、cliCommand 等`
- `ensureLarkCliRuntimeDefaults@0 - 校验并补充运行时默认配置，确保 channels.items.lark 配置完整`

## 对外暴露

- `LARK_CLI_COMMAND_ENV`
- `LARK_CLI_PROFILE_ENV`
- `LARK_CLI_SKILL_ENV_KEYS`
- `LARK_CLI_SYSTEM_PROMPT_EXT`
- `DEFAULT_LARK_CHANNEL_CONFIG`
- `ensureLarkCliRuntimeDefaults`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export const LARK_CLI_COMMAND_ENV = "LARK_CLI_COMMAND";
export const LARK_CLI_PROFILE_ENV = "LARK_CLI_PROFILE";

export const LARK_CLI_SKILL_ENV_KEYS = [
  LARK_CLI_COMMAND_ENV,
  LARK_CLI_PROFILE_ENV,
] as const;

export const LARK_CLI_SYSTEM_PROMPT_EXT = [
  "飞书/Lark 技能默认优先读取全局配置 `channels.items.lark`，或使用注入环境变量 `LARK_CLI_COMMAND` / `LARK_CLI_PROFILE` 调用 lark-cli；CLI profile 默认使用 `default`，appSecret/token 由本机 lark-cli 配置和系统 keychain 管理，不写入 tech-cc-hub；需要新增或修正配置时，优先用 tech-cc-hub admin MCP 持久化到 `agent-runtime.json`。",
].join("");

export const DEFAULT_LARK_CHANNEL_CONFIG = {
  provider: "lark",
  enabled: true,
  transport: "lark-cli",
  displayName: "飞书 / Lark",
  appIdEnv: "LARK_APP_ID",
  appSecretEnv: "LARK_APP_SECRET",
  tenantKeyEnv: "LARK_TENANT_KEY",
  cliCommand: "lark-cli",
  cliProfile: "default",
  cliSendArgsTemplate: "event send --profile {{profile}} --type message --content \"{{text}}\"",
  cliReceiveArgsTemplate: "event receive --profile {{profile}}",
  notes: "",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function collectCredentialEnvNames(value: unknown): string[] {
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (isRecord(value) && Array.isArray(value.env)) {
    return value.env
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

function mergeCredentialEnv(
  current: unknown,
  envNames: readonly string[],
): { env: string[] } | Record<string, unknown> {
  const merged = Array.from(new Set([
    ...collectCredentialEnvNames(current),
    ...envNames,
  ])).sort();

  if (isRecord(current)) {
    return { ...current, env: merged };
  }
  return { env: merged };
}

function mergeSystemPromptExt(current: unknown, line: string): string[] {
  const existing = typeof current === "string"
    ? [current]
    : Array.isArray(current)
      ? current
      : [];
  const lines = existing
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  if (!lines.includes(line)) {
    lines.push(line);
  }
  return lines;
}

export function ensureLarkCliRuntimeDefaults(input: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...input };
  const channels = isRecord(next.channels) ? { ...next.channels } : {};
  const items = isRecord(channels.items) ? { ...channels.items } : {};
  const rawLark = isRecord(items.lark) ? items.lark : {};
  const lark = {
    ...DEFAULT_LARK_CHANNEL_CONFIG,
    ...rawLark,
    provider: "lark",
  };

  items.lark = lark;
  channels.version = 1;
  channels.items = items;
  next.channels = channels;

  const env = isRecord(next.env) ? { ...next.env } : {};
  env[LARK_CLI_COMMAND_ENV] = asNonEmptyString(env[LARK_CLI_COMMAND_ENV])
    ?? asNonEmptyString(lark.cliCommand)
    ?? DEFAULT_LARK_CHANNEL_CONFIG.cliCommand;
  env[LARK_CLI_PROFILE_ENV] = asNonEmptyString(env[LARK_CLI_PROFILE_ENV])
    ?? asNonEmptyString(lark.cliProfile)
    ?? DEFAULT_LARK_CHANNEL_CONFIG.cliProfile;
  next.env = env;

  const skillCredentials = isRecord(next.skillCredentials) ? { ...next.skillCredentials } : {};
  skillCredentials.lark = mergeCredentialEnv(skillCredentials.lark, LARK_CLI_SKILL_ENV_KEYS);
  skillCredentials.feishu = mergeCredentialEnv(skillCredentials.feishu, LARK_CLI_SKILL_ENV_KEYS);
  next.skillCredentials = skillCredentials;

  next.systemPromptExt = mergeSystemPromptExt(next.systemPromptExt, LARK_CLI_SYSTEM_PROMPT_EXT);

  return next;
}

```
