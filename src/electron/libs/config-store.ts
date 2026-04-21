import { app } from "electron";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export type ApiType = "anthropic";

export type ApiModelConfig = {
  name: string;
  contextWindow?: number;
  compressionThresholdPercent?: number;
};

export type ApiConfig = {
  id: string;
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  expertModel?: string;
  models?: ApiModelConfig[];
  enabled: boolean;
  apiType?: ApiType;
};

export type ApiConfigSettings = {
  profiles: ApiConfig[];
};

export type SkillSourceKind = "local" | "remote";

export type SkillScope = "single" | "bundle";

export type SkillSourceRecord = {
  id: string;
  name: string;
  kind: SkillSourceKind;
  enabled: boolean;
  path: string;
  gitUrl?: string;
  scope?: SkillScope;
  branch?: string;
  lastPulledAt?: number;
  lastCheckedAt?: number;
  checkEveryHours?: number;
  lastKnownCommit?: string;
  lastError?: string;
};

export type SkillRegistry = {
  sources: SkillSourceRecord[];
};

export type SkillSyncRequest = {
  sourceIds?: string[];
  force?: boolean;
};

export type SkillSyncResult = {
  sourceId: string;
  sourceName: string;
  status: "updated" | "checked" | "skipped" | "error";
  message?: string;
  previousCommit?: string;
  latestCommit?: string;
  checkedAt: number;
};

export type SkillSyncResponse = {
  results: SkillSyncResult[];
};

export type GlobalRuntimeConfig = Record<string, unknown>;

const DEFAULT_MODEL = "claude-sonnet-4-5";
const DEFAULT_MODEL_CONFIG: ApiModelConfig = {
  name: DEFAULT_MODEL,
  compressionThresholdPercent: 70,
};
const CONFIG_FILE_NAME = "api-config.json";
const GLOBAL_CONFIG_FILE_NAME = "agent-runtime.json";
const SKILL_REGISTRY_FILE_NAME = "skill-registry.json";
const DEFAULT_SKILL_PATH = join(homedir(), ".claude", "skills");

function getConfigPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, CONFIG_FILE_NAME);
}

function getGlobalConfigPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, GLOBAL_CONFIG_FILE_NAME);
}

export function getDefaultSkillPath(): string {
  return DEFAULT_SKILL_PATH;
}

function getSkillRegistryPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, SKILL_REGISTRY_FILE_NAME);
}

function createDefaultSettings(): ApiConfigSettings {
  return {
    profiles: [
      {
        id: crypto.randomUUID(),
        name: "默认配置",
        apiKey: "",
        baseURL: "https://api.anthropic.com",
        model: DEFAULT_MODEL,
        expertModel: DEFAULT_MODEL,
        models: [DEFAULT_MODEL_CONFIG],
        enabled: true,
        apiType: "anthropic",
      },
    ],
  };
}

export function loadApiConfigSettings(): ApiConfigSettings {
  try {
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
      return createDefaultSettings();
    }
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as ApiConfig | ApiConfigSettings;
    return normalizeApiSettings(parsed);
  } catch (error) {
    console.error("[config-store] Failed to load API config:", error);
    return createDefaultSettings();
  }
}

export function saveApiConfigSettings(settings: ApiConfigSettings): void {
  try {
    const configPath = getConfigPath();
    const userDataPath = app.getPath("userData");

    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true });
    }

    const normalized = normalizeApiSettings(settings);
    if (normalized.profiles.length === 0) {
      throw new Error("Invalid config: at least one valid profile is required");
    }

    writeFileSync(configPath, JSON.stringify(normalized, null, 2), "utf8");
    console.info("[config-store] API config saved successfully");
  } catch (error) {
    console.error("[config-store] Failed to save API config:", error);
    throw error;
  }
}

function createDefaultSkillRegistry(): SkillRegistry {
  return { sources: [] };
}

export function loadSkillRegistry(): SkillRegistry {
  try {
    const registryPath = getSkillRegistryPath();
    if (!existsSync(registryPath)) {
      return createDefaultSkillRegistry();
    }
    const raw = readFileSync(registryPath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeSkillRegistry(parsed);
  } catch (error) {
    console.error("[config-store] Failed to load skill registry:", error);
    return createDefaultSkillRegistry();
  }
}

export function saveSkillRegistry(registry: unknown): void {
  try {
    const registryPath = getSkillRegistryPath();
    const userDataPath = app.getPath("userData");

    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true });
    }

    const normalized = normalizeSkillRegistry(registry);
    writeFileSync(registryPath, JSON.stringify(normalized, null, 2), "utf8");
    console.info("[config-store] Skill registry saved successfully");
  } catch (error) {
    console.error("[config-store] Failed to save skill registry:", error);
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

export function loadGlobalRuntimeConfig(): GlobalRuntimeConfig {
  try {
    const configPath = getGlobalConfigPath();
    if (!existsSync(configPath)) {
      return {};
    }

    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      console.error("[config-store] Invalid global runtime config format, expecting object:", configPath);
      return {};
    }

    return parsed as GlobalRuntimeConfig;
  } catch (error) {
    console.error("[config-store] Failed to load global runtime config:", error);
    return {};
  }
}

export function saveGlobalRuntimeConfig(config: GlobalRuntimeConfig): void {
  try {
    const configPath = getGlobalConfigPath();
    const userDataPath = app.getPath("userData");

    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true });
    }

    if (typeof config !== "object" || config === null || Array.isArray(config)) {
      throw new Error("Invalid global runtime config: expected an object");
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    console.info("[config-store] Global runtime config saved successfully");
  } catch (error) {
    console.error("[config-store] Failed to save global runtime config:", error);
    throw error;
  }
}

function normalizeApiConfig(config: ApiConfig | null | undefined): ApiConfig | null {
  if (!config?.baseURL || !config.name) {
    return null;
  }

  const dedupedModels = dedupeModelConfigs([
    config.model,
    config.expertModel,
    ...(config.models ?? []),
  ]);
  const dedupedModelNames = dedupedModels.map((item) => item.name);
  const selectedModel = config.model?.trim() || dedupedModelNames[0];
  if (!selectedModel) {
    return null;
  }

  if (!dedupedModelNames.includes(selectedModel)) {
    dedupedModels.unshift({
      name: selectedModel,
      compressionThresholdPercent: 70,
    });
  }

  return {
    id: config.id?.trim() || crypto.randomUUID(),
    name: config.name.trim(),
    apiKey: config.apiKey.trim(),
    baseURL: config.baseURL.trim(),
    model: selectedModel,
    expertModel: normalizeRoleModel(config.expertModel, selectedModel),
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
  const normalizedProfiles = profiles.map((profile) => {
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

function normalizeSkillRegistry(input: unknown): SkillRegistry {
  const rawSources = Array.isArray((input as SkillRegistry | undefined)?.sources)
    ? (input as SkillRegistry).sources
    : [];

  const normalized = rawSources
    .map((source) => normalizeSkillSource(source))
    .filter((source): source is SkillSourceRecord => Boolean(source));

  return { sources: normalized };
}

function normalizeSkillSource(input: unknown): SkillSourceRecord | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const source = input as Partial<SkillSourceRecord>;
  const kind = source.kind === "remote" ? "remote" : "local";
  const path = typeof source.path === "string" ? source.path.trim() : "";
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const gitUrl = typeof source.gitUrl === "string" ? source.gitUrl.trim() : "";
  const scope = source.scope === "bundle" ? "bundle" : source.scope === "single" ? "single" : undefined;
  const checkEveryHours = typeof source.checkEveryHours === "number" && Number.isFinite(source.checkEveryHours)
    ? Math.max(1, Math.floor(source.checkEveryHours))
    : undefined;
  const lastPulledAt = normalizePositiveIntegerOrUndefined(source.lastPulledAt);
  const lastCheckedAt = normalizePositiveIntegerOrUndefined(source.lastCheckedAt);

  return {
    id: typeof source.id === "string" && source.id.trim() ? source.id.trim() : crypto.randomUUID(),
    name: name || "未命名Skill源",
    kind,
    enabled: source.enabled !== false,
    path,
    gitUrl,
    scope: kind === "remote" ? scope : undefined,
    branch: typeof source.branch === "string" ? source.branch.trim() : undefined,
    lastPulledAt,
    lastCheckedAt,
    checkEveryHours,
    lastKnownCommit: typeof source.lastKnownCommit === "string" ? source.lastKnownCommit.trim() : undefined,
    lastError: typeof source.lastError === "string" ? source.lastError : undefined,
  };
}

export function createDefaultSkillSource(path: string = "", kind: SkillSourceKind = "local"): SkillSourceRecord {
  return {
    id: crypto.randomUUID(),
    name: kind === "local" ? "本地技能源" : "远端技能源",
    kind,
    enabled: true,
    path: path.trim() || DEFAULT_SKILL_PATH,
  };
}

function normalizePositiveIntegerOrUndefined(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
}

function normalizeModelConfig(input: string | ApiModelConfig | null | undefined): ApiModelConfig | null {
  if (typeof input === "string") {
    const name = input.trim();
    if (!name) {
      return null;
    }
    return {
      name,
      compressionThresholdPercent: 70,
    };
  }

  if (!input) {
    return null;
  }

  const name = input.name?.trim();
  if (!name) {
    return null;
  }

  return {
    name,
    contextWindow: normalizePositiveInteger(input.contextWindow),
    compressionThresholdPercent: normalizePercent(input.compressionThresholdPercent) ?? 70,
  };
}

function dedupeModelConfigs(inputs: Array<string | ApiModelConfig | null | undefined>): ApiModelConfig[] {
  const deduped = new Map<string, ApiModelConfig>();

  for (const input of inputs) {
    const model = normalizeModelConfig(input);
    if (!model) {
      continue;
    }

    const previous = deduped.get(model.name);
    deduped.set(model.name, {
      name: model.name,
      contextWindow: model.contextWindow ?? previous?.contextWindow,
      compressionThresholdPercent: model.compressionThresholdPercent ?? previous?.compressionThresholdPercent ?? 70,
    });
  }

  return Array.from(deduped.values());
}

function normalizePositiveInteger(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
}

function normalizePercent(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);
  if (normalized < 1 || normalized > 100) {
    return undefined;
  }

  return normalized;
}

function normalizeRoleModel(value: string | undefined, fallbackModel: string): string {
  const normalized = value?.trim();
  return normalized || fallbackModel;
}
