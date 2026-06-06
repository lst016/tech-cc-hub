import { app } from "electron";
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
} from "../../shared/codex-oauth.js";
import {
  MINIMAX_ANTHROPIC_BASE_URL,
  MINIMAX_DEFAULT_MODEL,
  MINIMAX_SMALL_MODEL,
} from "../../shared/models/minimax.js";
import {
  isModelCompatibleWithApiProvider,
  pickProviderCompatibleModel,
} from "../../shared/models/model-provider-routing.js";
import { normalizeModelRoutingWeight } from "../../shared/models/model-routing-weight.js";

export type ApiType = "anthropic";
export type ApiProviderMode = "custom" | "deepseek" | "codex" | "minimax";

export type ApiModelConfig = {
  name: string;
  contextWindow?: number;
  compressionThresholdPercent?: number;
  routingWeight?: number;
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
  analysisModel?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  embeddingBatchSize?: number;
  wikiModel?: string;
  wikiModelCostTier?: "free" | "cheap" | "standard";
  wikiModelMaxInputTokens?: number;
  wikiModelMaxOutputTokens?: number;
  models?: ApiModelConfig[];
  enabled: boolean;
  provider?: ApiProviderMode;
  apiType?: ApiType;
};

export type ApiConfigSettings = {
  profiles: ApiConfig[];
};

export type GlobalRuntimeConfig = Record<string, unknown>;

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
        embeddingModel: undefined,
        embeddingDimension: 1536,
        embeddingBatchSize: 16,
        wikiModel: undefined,
        wikiModelCostTier: "cheap",
        wikiModelMaxInputTokens: 16_000,
        wikiModelMaxOutputTokens: 4_000,
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
  if (!config?.name) {
    return null;
  }

  const provider = normalizeProvider(config.provider, config.baseURL);
  const baseURL = normalizeBaseURL(config.baseURL, provider);
  if (!baseURL) {
    return null;
  }

  const dedupedModels = dedupeModelConfigs([
    config.model,
    config.expertModel,
    config.smallModel,
    config.imageModel,
    config.analysisModel,
    config.embeddingModel,
    config.wikiModel,
    ...(config.models ?? []),
  ]);
  const compatibleModels = filterProviderCompatibleModels(provider, dedupedModels);
  const compatibleModelNames = compatibleModels.map((item) => item.name);
  const selectedModel = pickProviderCompatibleModel(provider, config.model, compatibleModelNames[0])
    || getProviderDefaultModel(provider, "main")
    || compatibleModelNames[0];
  if (!selectedModel) {
    return null;
  }

  if (!compatibleModelNames.includes(selectedModel)) {
    compatibleModels.unshift({
      name: selectedModel,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      compressionThresholdPercent: 70,
    });
    compatibleModelNames.unshift(selectedModel);
  }

  return {
    id: config.id?.trim() || crypto.randomUUID(),
    name: normalizeKnownConfigName(config.name, provider),
    apiKey: config.apiKey.trim(),
    baseURL,
    model: selectedModel,
    expertModel: normalizeProviderRoleModel(provider, config.expertModel, selectedModel),
    smallModel: normalizeProviderRoleModel(provider, config.smallModel, normalizeProviderRoleModel(provider, config.analysisModel, getProviderDefaultModel(provider, "small") || selectedModel)),
    imageModel: normalizeOptionalModel(config.imageModel, compatibleModelNames),
    analysisModel: normalizeProviderRoleModel(provider, config.analysisModel, getProviderDefaultModel(provider, "small") || selectedModel),
    embeddingModel: normalizeOptionalModel(config.embeddingModel, compatibleModelNames),
    embeddingDimension: normalizePositiveInteger(config.embeddingDimension) ?? 1536,
    embeddingBatchSize: normalizePositiveInteger(config.embeddingBatchSize) ?? 16,
    wikiModel: normalizeOptionalModel(config.wikiModel, compatibleModelNames),
    wikiModelCostTier: normalizeWikiModelCostTier(config.wikiModelCostTier),
    wikiModelMaxInputTokens: normalizePositiveInteger(config.wikiModelMaxInputTokens) ?? 16_000,
    wikiModelMaxOutputTokens: normalizePositiveInteger(config.wikiModelMaxOutputTokens) ?? 4_000,
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

function filterProviderCompatibleModels(provider: ApiProviderMode, models: ApiModelConfig[]): ApiModelConfig[] {
  if (provider === "custom") {
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

function normalizeProviderRoleModel(provider: ApiProviderMode, value: string | undefined, fallbackModel: string): string {
  return pickProviderCompatibleModel(provider, value, fallbackModel) || fallbackModel;
}

function normalizeProvider(value: unknown, baseURL: string): ApiProviderMode {
  if (value === "custom" || value === "deepseek" || value === "codex" || value === "minimax") {
    return value;
  }

  try {
    const hostname = new URL(baseURL.trim()).hostname;
    if (hostname === "api.deepseek.com") return "deepseek";
    if (hostname === "chatgpt.com") return "codex";
    if (hostname === "api.minimax.io" || hostname === "api.minimaxi.com") return "minimax";
    return "custom";
  } catch {
    return "custom";
  }
}

function normalizeBaseURL(value: string, provider: ApiProviderMode): string {
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

function normalizeModelConfig(input: string | ApiModelConfig | null | undefined): ApiModelConfig | null {
  if (typeof input === "string") {
    const name = input.trim();
    if (!name) {
      return null;
    }
    return {
      name,
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
    compressionThresholdPercent: normalizePercent(input.compressionThresholdPercent),
    routingWeight: normalizeModelRoutingWeight(input.routingWeight),
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
      compressionThresholdPercent: model.compressionThresholdPercent ?? previous?.compressionThresholdPercent,
      routingWeight: model.routingWeight ?? previous?.routingWeight,
    });
  }

  return Array.from(deduped.values()).map((model) => ({
    ...model,
    contextWindow: model.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
    compressionThresholdPercent: model.compressionThresholdPercent ?? 70,
  }));
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

function normalizeOptionalModel(value: string | undefined, availableModels: string[]): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return availableModels.includes(normalized) ? normalized : undefined;
}

function normalizeWikiModelCostTier(value: string | undefined): "free" | "cheap" | "standard" {
  if (value === "free" || value === "cheap" || value === "standard") {
    return value;
  }
  return "cheap";
}
