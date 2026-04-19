import { app } from "electron";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";

export type ApiType = "anthropic";

export type ApiConfig = {
  id: string;
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  models?: string[];
  enabled: boolean;
  apiType?: ApiType; // "anthropic" 
};

export type ApiConfigSettings = {
  profiles: ApiConfig[];
};

const CONFIG_FILE_NAME = "api-config.json";

function getConfigPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, CONFIG_FILE_NAME);
}

export function loadApiConfigSettings(): ApiConfigSettings {
  try {
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
      return { profiles: [] };
    }
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as ApiConfig | ApiConfigSettings;
    return normalizeApiSettings(parsed);
  } catch (error) {
    console.error("[config-store] Failed to load API config:", error);
    return { profiles: [] };
  }
}

export function saveApiConfigSettings(settings: ApiConfigSettings): void {
  try {
    const configPath = getConfigPath();
    const userDataPath = app.getPath("userData");
    
    // 确保目录存在 make sure directory exists
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true });
    }
    
    // 验证配置 validate config
    const normalized = normalizeApiSettings(settings);
    if (normalized.profiles.length === 0) {
      throw new Error("Invalid config: at least one valid profile is required");
    }

    // 保存配置 save config
    writeFileSync(configPath, JSON.stringify(normalized, null, 2), "utf8");
    console.info("[config-store] API config saved successfully");
  } catch (error) {
    console.error("[config-store] Failed to save API config:", error);
    throw error;
  }
}

export function deleteApiConfig(): void {
  try {
    const configPath = getConfigPath();
    if (existsSync(configPath)) {
      unlinkSync(configPath);
      console.info("[config-store] API config deleted");
    }
  } catch (error) {
    console.error("[config-store] Failed to delete API config:", error);
  }
}

function normalizeApiConfig(config: ApiConfig | null | undefined): ApiConfig | null {
  if (!config?.apiKey || !config.baseURL || !config.name) {
    return null;
  }

  const dedupedModels = Array.from(
    new Set(
      [config.model, ...(config.models ?? [])]
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item))
    )
  );

  const selectedModel = config.model?.trim() || dedupedModels[0];
  if (!selectedModel) {
    return null;
  }

  if (!dedupedModels.includes(selectedModel)) {
    dedupedModels.unshift(selectedModel);
  }

  return {
    id: config.id?.trim() || crypto.randomUUID(),
    name: config.name.trim(),
    apiKey: config.apiKey.trim(),
    baseURL: config.baseURL.trim(),
    model: selectedModel,
    models: dedupedModels,
    enabled: Boolean(config.enabled),
    apiType: config.apiType ?? "anthropic",
  };
}

function normalizeApiSettings(input: ApiConfig | ApiConfigSettings | null | undefined): ApiConfigSettings {
  const rawProfiles = Array.isArray((input as ApiConfigSettings | undefined)?.profiles)
    ? (input as ApiConfigSettings).profiles
    : input
      ? [input as ApiConfig]
      : [];

  const profiles = rawProfiles
    .map((profile) => normalizeApiConfig(profile))
    .filter((profile): profile is ApiConfig => Boolean(profile));

  if (profiles.length === 0) {
    return { profiles: [] };
  }

  let hasEnabled = false;
  const normalizedProfiles = profiles.map((profile, index) => {
    if (profile.enabled && !hasEnabled) {
      hasEnabled = true;
      return profile;
    }
    return { ...profile, enabled: false };
  });

  if (!hasEnabled) {
    normalizedProfiles[0] = { ...normalizedProfiles[0], enabled: true };
  }

  return { profiles: normalizedProfiles };
}
