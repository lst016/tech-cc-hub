const LEGACY_LARK_ENV_KEYS = new Set([
  "LARK_CLI_COMMAND",
  "LARK_CLI_PROFILE",
]);

const LEGACY_LARK_CHANNEL_KEYS = [
  "appIdEnv",
  "appSecretEnv",
  "tenantKeyEnv",
  "botTokenEnv",
  "chatIdEnv",
  "webhookUrlEnv",
  "cliCommand",
  "cliProfile",
  "cliSendArgsTemplate",
  "cliReceiveArgsTemplate",
  "allowedSenderIds",
  "allowedConversationIds",
  "wsBridgeEnabled",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLegacyLarkPrompt(value: string): boolean {
  return value.includes("Additional Lark CLI configuration reference:")
    || (value.includes("飞书/Lark 技能默认优先读取全局配置")
      && (value.includes("channels.items.lark") || value.includes("LARK_CLI_PROFILE")));
}

function removeLegacyCredentialEnv(value: unknown): { value?: unknown; changed: boolean } {
  if (typeof value === "string") {
    return LEGACY_LARK_ENV_KEYS.has(value.trim())
      ? { changed: true }
      : { value, changed: false };
  }

  if (Array.isArray(value)) {
    const filtered = value.filter((item) => (
      typeof item !== "string" || !LEGACY_LARK_ENV_KEYS.has(item.trim())
    ));
    return filtered.length === value.length
      ? { value, changed: false }
      : { value: filtered.length > 0 ? filtered : undefined, changed: true };
  }

  if (!isRecord(value) || !Array.isArray(value.env)) {
    return { value, changed: false };
  }

  const filteredEnv = value.env.filter((item) => (
    typeof item !== "string" || !LEGACY_LARK_ENV_KEYS.has(item.trim())
  ));
  if (filteredEnv.length === value.env.length) {
    return { value, changed: false };
  }

  const next = { ...value };
  if (filteredEnv.length > 0) {
    next.env = filteredEnv;
  } else {
    delete next.env;
  }
  return {
    value: Object.keys(next).length > 0 ? next : undefined,
    changed: true,
  };
}

function normalizeLarkCliChannel(value: unknown): { value?: Record<string, unknown>; changed: boolean } {
  if (!isRecord(value)) {
    return { changed: value !== undefined };
  }

  const next = { ...value };
  let changed = false;
  for (const key of LEGACY_LARK_CHANNEL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(next, key)) {
      delete next[key];
      changed = true;
    }
  }
  if (next.provider !== "lark") {
    next.provider = "lark";
    changed = true;
  }
  if (next.transport !== "lark-cli") {
    next.transport = "lark-cli";
    changed = true;
  }
  const realtimeEnabled = next.realtimeEnabled === true;
  if (next.realtimeEnabled !== realtimeEnabled) {
    next.realtimeEnabled = realtimeEnabled;
    changed = true;
  }
  if (next.chatEnabled !== realtimeEnabled) {
    next.chatEnabled = realtimeEnabled;
    changed = true;
  }
  return { value: next, changed };
}

export function removeLegacyLarkRuntimeConfig(input: Record<string, unknown>): {
  config: Record<string, unknown>;
  changed: boolean;
} {
  const config = { ...input };
  let changed = false;

  if (isRecord(config.env)) {
    const env = { ...config.env };
    for (const key of LEGACY_LARK_ENV_KEYS) {
      if (Object.prototype.hasOwnProperty.call(env, key)) {
        delete env[key];
        changed = true;
      }
    }
    if (changed) {
      if (Object.keys(env).length > 0) config.env = env;
      else delete config.env;
    }
  }

  if (isRecord(config.channels)) {
    const channels = { ...config.channels };
    let channelsChanged = false;
    if (channels.defaultChannel === "lark") {
      delete channels.defaultChannel;
      channelsChanged = true;
    }
    if (isRecord(channels.items) && Object.prototype.hasOwnProperty.call(channels.items, "lark")) {
      const items = { ...channels.items };
      const lark = normalizeLarkCliChannel(items.lark);
      if (lark.changed) {
        if (lark.value) items.lark = lark.value;
        else delete items.lark;
        if (Object.keys(items).length > 0) channels.items = items;
        else delete channels.items;
        channelsChanged = true;
      }
    }
    if (channelsChanged) {
      if (Object.keys(channels).length > 0) config.channels = channels;
      else delete config.channels;
      changed = true;
    }
  }

  if (isRecord(config.skillCredentials)) {
    const skillCredentials = { ...config.skillCredentials };
    let credentialsChanged = false;
    for (const skillName of ["lark", "feishu"]) {
      if (!Object.prototype.hasOwnProperty.call(skillCredentials, skillName)) continue;
      const result = removeLegacyCredentialEnv(skillCredentials[skillName]);
      if (!result.changed) continue;
      if (result.value === undefined) delete skillCredentials[skillName];
      else skillCredentials[skillName] = result.value;
      credentialsChanged = true;
    }
    if (credentialsChanged) {
      if (Object.keys(skillCredentials).length > 0) config.skillCredentials = skillCredentials;
      else delete config.skillCredentials;
      changed = true;
    }
  }

  if (typeof config.systemPromptExt === "string") {
    if (isLegacyLarkPrompt(config.systemPromptExt)) {
      delete config.systemPromptExt;
      changed = true;
    }
  } else if (Array.isArray(config.systemPromptExt)) {
    const lines = config.systemPromptExt.filter((item) => (
      typeof item !== "string" || !isLegacyLarkPrompt(item)
    ));
    if (lines.length !== config.systemPromptExt.length) {
      if (lines.length > 0) config.systemPromptExt = lines;
      else delete config.systemPromptExt;
      changed = true;
    }
  }

  return { config, changed };
}
