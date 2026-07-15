import { app, safeStorage } from "electron";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import {
  CODEX_OAUTH_BASE_URL,
  CODEX_OAUTH_DEFAULT_MODEL,
  CODEX_OAUTH_SMALL_MODEL,
  CODEX_OAUTH_STORED_CREDENTIAL,
} from "../../shared/codex-oauth.js";
import {
  MINIMAX_ANTHROPIC_BASE_URL,
  MINIMAX_DEFAULT_MODEL,
  MINIMAX_SMALL_MODEL,
} from "../../shared/models/minimax.js";
import {
  BOKE_GATEWAY_BASE_URL,
  isModelCompatibleWithApiProvider,
  resolveSharedApiProviderMode,
  type SharedApiProviderMode,
} from "../../shared/models/model-provider-routing.js";
import { normalizeImportedApiModels } from "../../shared/models/api-model-metadata.js";
import { normalizeModelRoutingWeight } from "../../shared/models/model-routing-weight.js";
import { removeLegacyLarkRuntimeConfig } from "../../shared/lark-cli-runtime.js";

export type ApiType = "anthropic";
export type ApiProviderMode = SharedApiProviderMode;

export type ApiModelConfig = {
  name: string;
  contextWindow?: number;
  compressionThresholdPercent?: number;
  routingWeight?: number;
  catalogStatus?: "discovered" | "managed" | "excluded";
  alias?: string;
  tags?: string[];
  notes?: string;
  ownedBy?: string;
  supportedEndpointTypes?: string[];
  createdAt?: number;
};

export type ApiConfig = {
  id: string;
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  expertModel?: string;
  smallModel?: string;
  imageModel?: string;
  imageGenerationModel?: string;
  analysisModel?: string;
  models?: ApiModelConfig[];
  enabled: boolean;
  provider?: ApiProviderMode;
  apiType?: ApiType;
};

export type ApiConfigSettings = {
  profiles: ApiConfig[];
};

export type GlobalRuntimeConfig = Record<string, unknown>;

const globalRuntimeConfigListeners = new Set<(config: GlobalRuntimeConfig) => void>();

export function onGlobalRuntimeConfigSaved(listener: (config: GlobalRuntimeConfig) => void): () => void {
  globalRuntimeConfigListeners.add(listener);
  return () => globalRuntimeConfigListeners.delete(listener);
}

const DEFAULT_MODEL = "claude-sonnet-4-5";
const DEFAULT_MODEL_CONFIG: ApiModelConfig = {
  name: DEFAULT_MODEL,
  contextWindow: 200_000,
  compressionThresholdPercent: 70,
};
const DEFAULT_CONTEXT_WINDOW = 200_000;
const DEEPSEEK_OFFICIAL_BASE_URL = "https://api.deepseek.com/anthropic";
const CONFIG_FILE_NAME = "api-config.json";
const GLOBAL_CONFIG_FILE_NAME = "agent-runtime.json";
const CODEX_SAFE_STORAGE_PREFIX = "safe-storage:v1:";

export function isUnreadableStoredCodexCredential(value: string | undefined): boolean {
  return Boolean(value?.startsWith(CODEX_SAFE_STORAGE_PREFIX));
}

class CodexCredentialStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexCredentialStorageError";
  }
}

function getConfigPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, CONFIG_FILE_NAME);
}

function getGlobalConfigPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, GLOBAL_CONFIG_FILE_NAME);
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
        smallModel: DEFAULT_MODEL,
        imageModel: undefined,
        analysisModel: DEFAULT_MODEL,
        models: [DEFAULT_MODEL_CONFIG],
        enabled: true,
        provider: "custom",
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
    const raw = stripUtf8Bom(readFileSync(configPath, "utf8"));
    const parsed = JSON.parse(raw) as ApiConfig | ApiConfigSettings;
    return normalizeApiSettings(decryptStoredCodexCredentials(parsed));
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

    const persisted = encryptStoredCodexCredentials(normalized);
    writeFileSync(configPath, JSON.stringify(persisted, null, 2), "utf8");
    console.info("[config-store] API config saved successfully");
  } catch (error) {
    console.error("[config-store] Failed to save API config:", error);
    throw error;
  }
}

export function redactApiConfigSettingsForRenderer(settings: ApiConfigSettings): ApiConfigSettings {
  return {
    profiles: settings.profiles.map((profile) => (
      profile.provider === "codex" && profile.apiKey
        ? { ...profile, apiKey: CODEX_OAUTH_STORED_CREDENTIAL }
        : profile
    )),
  };
}

export function mergeRendererApiConfigSettings(
  incoming: ApiConfigSettings,
  existing: ApiConfigSettings,
): ApiConfigSettings {
  const existingById = new Map(existing.profiles.map((profile) => [profile.id, profile]));
  return {
    profiles: incoming.profiles.map((profile) => {
      if (profile.provider !== "codex") {
        return profile;
      }
      const stored = existingById.get(profile.id);
      const shouldPreserveStoredCredential = stored?.provider === "codex"
        && Boolean(stored.apiKey)
        && (!profile.apiKey || profile.apiKey === CODEX_OAUTH_STORED_CREDENTIAL);
      return {
        ...profile,
        apiKey: shouldPreserveStoredCredential ? stored.apiKey : profile.apiKey,
      };
    }),
  };
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

    const raw = stripUtf8Bom(readFileSync(configPath, "utf8"));
    const parsed = JSON.parse(raw) as unknown;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      console.error("[config-store] Invalid global runtime config format, expecting object:", configPath);
      return {};
    }

    const migrated = removeLegacyLarkRuntimeConfig(parsed as GlobalRuntimeConfig);
    if (migrated.changed) {
      saveGlobalRuntimeConfig(migrated.config);
    }
    return migrated.config;
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
    for (const listener of globalRuntimeConfigListeners) {
      try {
        listener(config);
      } catch (error) {
        console.warn("[config-store] Global runtime config listener failed:", error);
      }
    }
  } catch (error) {
    console.error("[config-store] Failed to save global runtime config:", error);
    throw error;
  }
}

function normalizeApiConfig(config: ApiConfig | null | undefined): ApiConfig | null {
  const name = normalizeOptionalText(config?.name);
  if (!config || !name) {
    return null;
  }

  const rawBaseURL = normalizeOptionalText(config.baseURL) ?? "";
  const provider = normalizeProvider(config.provider, rawBaseURL);
  const baseURL = normalizeBaseURL(rawBaseURL, provider);
  if (!baseURL) {
    return null;
  }

  const rawModels: readonly unknown[] = Array.isArray(config.models) ? config.models : [];
  const hasDeclaredModels = rawModels.some(hasModelName);
  const configuredModel = normalizeOptionalText(config.model);
  const configuredExpertModel = normalizeOptionalText(config.expertModel);
  const configuredSmallModel = normalizeOptionalText(config.smallModel);
  const configuredImageModel = normalizeOptionalText(config.imageModel);
  const configuredImageGenerationModel = normalizeOptionalText(config.imageGenerationModel);
  const configuredAnalysisModel = normalizeOptionalText(config.analysisModel);
  const dedupedModels = dedupeModelConfigs(hasDeclaredModels
    ? rawModels
    : [
      configuredModel,
      configuredExpertModel,
      configuredSmallModel,
      configuredImageModel,
      configuredImageGenerationModel,
      configuredAnalysisModel,
    ]);
  const compatibleModels = filterProviderCompatibleModels(provider, dedupedModels);
  const compatibleModelNames = compatibleModels.map((item) => item.name);
  const managedModelNames = compatibleModels
    .filter((model) => model.catalogStatus !== "excluded")
    .map((model) => model.name);
  let selectedModel = pickLocalModelName(provider, managedModelNames, [
    configuredModel,
    getProviderDefaultModel(provider, "main"),
    managedModelNames[0],
  ]);
  if (!selectedModel && !hasDeclaredModels) {
    selectedModel = [configuredModel, getProviderDefaultModel(provider, "main")]
      .find((candidate): candidate is string => Boolean(candidate && isModelCompatibleWithApiProvider(provider, candidate))) ?? "";
  }
  if (!selectedModel) {
    return null;
  }

  if (!hasDeclaredModels && !compatibleModelNames.includes(selectedModel)) {
    compatibleModels.unshift({
      name: selectedModel,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      compressionThresholdPercent: 70,
    });
    compatibleModelNames.unshift(selectedModel);
    managedModelNames.unshift(selectedModel);
  }
  const analysisModel = pickLocalModelName(provider, managedModelNames, [
    configuredAnalysisModel,
    getProviderDefaultModel(provider, "small"),
    selectedModel,
  ]) || selectedModel;

  return {
    id: normalizeOptionalText(config.id) || crypto.randomUUID(),
    name: normalizeKnownConfigName(name, provider),
    apiKey: normalizeOptionalText(config.apiKey) ?? "",
    baseURL,
    model: selectedModel,
    expertModel: pickLocalModelName(provider, managedModelNames, [configuredExpertModel, selectedModel]) || selectedModel,
    smallModel: pickLocalModelName(provider, managedModelNames, [configuredSmallModel, analysisModel, selectedModel]) || selectedModel,
    imageModel: normalizeOptionalModel(configuredImageModel, managedModelNames),
    imageGenerationModel: normalizeOptionalModel(configuredImageGenerationModel, managedModelNames),
    analysisModel,
    models: compatibleModels,
    enabled: Boolean(config.enabled),
    provider,
    apiType: config.apiType ?? "anthropic",
  };
}

function normalizeKnownConfigName(name: string, provider: ApiProviderMode): string {
  const trimmed = name.trim();
  if (provider === "minimax" && /^MiniMax\s+(官方|瀹樻柟|瀚樟柿)$/.test(trimmed)) {
    return "MiniMax 官方";
  }
  if (provider === "deepseek" && /^DeepSeek\s+(官方|瀹樻柟)$/.test(trimmed)) {
    return "DeepSeek 官方";
  }
  if (trimmed === "榛樿閰嶇疆") {
    return "默认配置";
  }
  return trimmed;
}

function stripUtf8Bom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

function decryptStoredCodexCredentials(input: ApiConfig | ApiConfigSettings): ApiConfig | ApiConfigSettings {
  const decryptProfile = (profile: ApiConfig): ApiConfig => {
    if (!profile.apiKey?.startsWith(CODEX_SAFE_STORAGE_PREFIX)) {
      return profile;
    }
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("OS credential encryption is unavailable");
      }
      const encoded = profile.apiKey.slice(CODEX_SAFE_STORAGE_PREFIX.length);
      return {
        ...profile,
        apiKey: safeStorage.decryptString(Buffer.from(encoded, "base64")),
      };
    } catch (error) {
      console.error("[config-store] Failed to decrypt a Codex credential:", error instanceof Error ? error.message : String(error));
      // Keep the opaque envelope so one unreadable credential cannot hide all
      // profiles. A later login can replace it without losing other settings.
      return profile;
    }
  };

  if (Array.isArray((input as ApiConfigSettings).profiles)) {
    return {
      profiles: (input as ApiConfigSettings).profiles.map(decryptProfile),
    };
  }
  return decryptProfile(input as ApiConfig);
}

function encryptStoredCodexCredentials(settings: ApiConfigSettings): ApiConfigSettings {
  return {
    profiles: settings.profiles.map((profile) => {
      if (
        profile.provider !== "codex"
        || !profile.apiKey
        || profile.apiKey === CODEX_OAUTH_STORED_CREDENTIAL
        || profile.apiKey.startsWith(CODEX_SAFE_STORAGE_PREFIX)
      ) {
        return profile;
      }
      try {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new CodexCredentialStorageError("系统凭据加密不可用，Codex 凭据未保存。");
        }
        const encrypted = safeStorage.encryptString(profile.apiKey).toString("base64");
        return {
          ...profile,
          apiKey: `${CODEX_SAFE_STORAGE_PREFIX}${encrypted}`,
        };
      } catch (error) {
        console.error("[config-store] Failed to encrypt a Codex credential:", error instanceof Error ? error.message : String(error));
        if (error instanceof CodexCredentialStorageError) {
          throw error;
        }
        throw new CodexCredentialStorageError("系统凭据加密失败，Codex 凭据未保存。");
      }
    }),
  };
}

function filterProviderCompatibleModels(provider: ApiProviderMode, models: ApiModelConfig[]): ApiModelConfig[] {
  if (provider === "custom" || provider === "boke") {
    return models;
  }
  return models.filter((model) => isModelCompatibleWithApiProvider(provider, model.name));
}

function getProviderDefaultModel(provider: ApiProviderMode, slot: "main" | "small"): string {
  if (provider === "codex") {
    return slot === "small" ? CODEX_OAUTH_SMALL_MODEL : CODEX_OAUTH_DEFAULT_MODEL;
  }
  if (provider === "deepseek") {
    return slot === "small" ? "deepseek-v4-flash" : "deepseek-v4-flash";
  }
  if (provider === "minimax") {
    return slot === "small" ? MINIMAX_SMALL_MODEL : MINIMAX_DEFAULT_MODEL;
  }
  return "";
}

function normalizeProvider(value: unknown, baseURL: string): ApiProviderMode {
  return resolveSharedApiProviderMode(value, baseURL);
}

function normalizeBaseURL(value: string, provider: ApiProviderMode): string {
  if (provider === "boke") {
    return BOKE_GATEWAY_BASE_URL;
  }
  if (provider === "deepseek") {
    return DEEPSEEK_OFFICIAL_BASE_URL;
  }
  if (provider === "codex") {
    return CODEX_OAUTH_BASE_URL;
  }
  if (provider === "minimax") {
    return MINIMAX_ANTHROPIC_BASE_URL;
  }

  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, "");
    if (!pathname || pathname === "/" || pathname.startsWith("/console")) {
      url.pathname = "/v1";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return trimmed;
  }
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

  const normalizedProfiles = profiles.map((profile) => ({
    ...profile,
    enabled: Boolean(profile.enabled),
  }));

  if (normalizedProfiles.every((profile) => !profile.enabled)) {
    normalizedProfiles[0] = { ...normalizedProfiles[0], enabled: true };
  }

  return { profiles: normalizedProfiles };
}

function normalizeModelConfig(input: unknown): ApiModelConfig | null {
  if (typeof input === "string") {
    const name = input.trim();
    if (!name) {
      return null;
    }
    return {
      name,
    };
  }

  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const name = normalizeOptionalText(record.name);
  if (!name) {
    return null;
  }

  const metadata = normalizeImportedApiModels([record])[0];
  return {
    name,
    contextWindow: normalizePositiveInteger(record.contextWindow),
    compressionThresholdPercent: normalizePercent(record.compressionThresholdPercent),
    routingWeight: normalizeModelRoutingWeight(record.routingWeight),
    catalogStatus: normalizeCatalogStatus(record.catalogStatus),
    alias: normalizeOptionalText(record.alias),
    tags: normalizeTags(record.tags),
    notes: normalizeOptionalText(record.notes),
    ownedBy: metadata?.ownedBy,
    supportedEndpointTypes: metadata?.supportedEndpointTypes,
    createdAt: metadata?.createdAt,
  };
}

function dedupeModelConfigs(inputs: readonly unknown[]): ApiModelConfig[] {
  const deduped = new Map<string, ApiModelConfig>();

  for (const input of inputs) {
    const model = normalizeModelConfig(input);
    if (!model) {
      continue;
    }

    const previous = deduped.get(model.name);
    const metadata = normalizeImportedApiModels([
      ...(previous ? [previous] : []),
      model,
    ])[0];
    deduped.set(model.name, {
      name: model.name,
      contextWindow: model.contextWindow ?? previous?.contextWindow,
      compressionThresholdPercent: model.compressionThresholdPercent ?? previous?.compressionThresholdPercent,
      routingWeight: model.routingWeight ?? previous?.routingWeight,
      catalogStatus: model.catalogStatus ?? previous?.catalogStatus,
      alias: model.alias ?? previous?.alias,
      tags: model.tags ?? previous?.tags,
      notes: model.notes ?? previous?.notes,
      ownedBy: metadata?.ownedBy,
      supportedEndpointTypes: metadata?.supportedEndpointTypes,
      createdAt: metadata?.createdAt,
    });
  }

  return Array.from(deduped.values()).map((model) => ({
    ...model,
    contextWindow: model.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
    compressionThresholdPercent: model.compressionThresholdPercent ?? 70,
  }));
}

function normalizeCatalogStatus(value: unknown): ApiModelConfig["catalogStatus"] {
  if (value === "excluded") return "excluded";
  if (value === "discovered" || value === "managed") return "managed";
  return undefined;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}

function normalizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = Array.from(new Set(value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean)));
  return tags.length > 0 ? tags : undefined;
}

function hasModelName(value: unknown): boolean {
  if (typeof value === "string") return Boolean(value.trim());
  if (!value || typeof value !== "object") return false;
  return Boolean(normalizeOptionalText((value as Record<string, unknown>).name));
}

function normalizePositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
}

function normalizePercent(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);
  if (normalized < 1 || normalized > 100) {
    return undefined;
  }

  return normalized;
}

function normalizeOptionalModel(value: string | undefined, availableModels: string[]): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return availableModels.includes(normalized) ? normalized : undefined;
}

function pickLocalModelName(
  provider: ApiProviderMode,
  availableModels: readonly string[],
  candidates: readonly (string | undefined)[],
): string {
  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (!normalized || !isModelCompatibleWithApiProvider(provider, normalized)) continue;
    const exact = availableModels.find((model) => model === normalized);
    if (exact) return exact;
    if (provider === "deepseek" || provider === "minimax") {
      const caseInsensitive = availableModels.find((model) => model.toLowerCase() === normalized.toLowerCase());
      if (caseInsensitive) return caseInsensitive;
    }
  }
  return "";
}
