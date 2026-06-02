import type { ApiConfigProfile, ApiModelConfigProfile, ApiProviderMode } from "../../types.js";
import {
  CODEX_OAUTH_BASE_URL,
  CODEX_OAUTH_DEFAULT_MODEL,
  CODEX_OAUTH_MODELS,
  CODEX_OAUTH_SMALL_MODEL,
} from "../../../shared/codex-oauth.js";
import {
  MINIMAX_ANTHROPIC_BASE_URL,
  MINIMAX_DEFAULT_MODEL,
  MINIMAX_MODEL_CONFIGS,
  MINIMAX_SMALL_MODEL,
} from "../../../shared/models/minimax.js";
import {
  getModelRoutingWeight,
  normalizeModelRoutingWeight,
  pickHighestWeightedModelOwner,
} from "../../../shared/models/model-routing-weight.js";
import { isDeepSeekModelName, isMiniMaxModelName, isModelCompatibleWithApiProvider } from "../../../shared/models/model-provider-routing.js";

const DEFAULT_CONTEXT_WINDOW = 200_000;
const DEEPSEEK_CONTEXT_WINDOW = 1_000_000;
const CODEX_CONTEXT_WINDOW = 200_000;
export const DEEPSEEK_OFFICIAL_BASE_URL = "https://api.deepseek.com/anthropic";
export const DEEPSEEK_OFFICIAL_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;
export const MINIMAX_OFFICIAL_BASE_URL = MINIMAX_ANTHROPIC_BASE_URL;
export const MINIMAX_OFFICIAL_MODELS = MINIMAX_MODEL_CONFIGS.map((model) => model.name);

export type RoutedModelOption = {
  value: string;
  label: string;
  profileId: string;
  profileName: string;
  contextWindow?: number;
  provider?: ApiProviderMode;
  providerLabel: string;
  routingWeight: number;
  routeLabel: string;
};

export function createModel(): ApiModelConfigProfile {
  return {
    name: "",
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    compressionThresholdPercent: 70,
  };
}

export function createProfile(): ApiConfigProfile {
  return {
    id: crypto.randomUUID(),
    name: "新配置",
    apiKey: "",
    baseURL: "",
    model: "",
    expertModel: "",
    smallModel: "",
    imageModel: undefined,
    analysisModel: "",
    embeddingModel: undefined,
    embeddingDimension: 1536,
    embeddingBatchSize: 16,
    wikiModel: undefined,
    wikiModelCostTier: "cheap",
    wikiModelMaxInputTokens: 16_000,
    wikiModelMaxOutputTokens: 4_000,
    models: [createModel()],
    enabled: true,
    provider: "custom",
    apiType: "anthropic",
  };
}

export function createDeepSeekOfficialProfile(): ApiConfigProfile {
  const models = DEEPSEEK_OFFICIAL_MODELS.map((name) => ({
    name,
    contextWindow: DEEPSEEK_CONTEXT_WINDOW,
    compressionThresholdPercent: 70,
  }));

  return {
    id: crypto.randomUUID(),
    name: "DeepSeek 官方",
    apiKey: "",
    baseURL: DEEPSEEK_OFFICIAL_BASE_URL,
    model: "deepseek-v4-flash",
    expertModel: "deepseek-v4-pro",
    smallModel: "deepseek-v4-flash",
    imageModel: undefined,
    analysisModel: "deepseek-v4-flash",
    embeddingModel: undefined,
    embeddingDimension: 1536,
    embeddingBatchSize: 16,
    wikiModel: "deepseek-v4-flash",
    wikiModelCostTier: "cheap",
    wikiModelMaxInputTokens: 16_000,
    wikiModelMaxOutputTokens: 4_000,
    models,
    enabled: true,
    provider: "deepseek",
    apiType: "anthropic",
  };
}

export function createCodexOAuthProfile(): ApiConfigProfile {
  const models = CODEX_OAUTH_MODELS.map((name) => ({
    name,
    contextWindow: CODEX_CONTEXT_WINDOW,
    compressionThresholdPercent: 70,
  }));

  return {
    id: crypto.randomUUID(),
    name: "Codex OAuth",
    apiKey: "",
    baseURL: CODEX_OAUTH_BASE_URL,
    model: CODEX_OAUTH_DEFAULT_MODEL,
    expertModel: CODEX_OAUTH_DEFAULT_MODEL,
    smallModel: CODEX_OAUTH_SMALL_MODEL,
    imageModel: undefined,
    analysisModel: CODEX_OAUTH_SMALL_MODEL,
    embeddingModel: undefined,
    embeddingDimension: 1536,
    embeddingBatchSize: 16,
    wikiModel: CODEX_OAUTH_SMALL_MODEL,
    wikiModelCostTier: "cheap",
    wikiModelMaxInputTokens: 16_000,
    wikiModelMaxOutputTokens: 4_000,
    models,
    enabled: true,
    provider: "codex",
    apiType: "anthropic",
  };
}

export function createMiniMaxOfficialProfile(): ApiConfigProfile {
  const models = MINIMAX_MODEL_CONFIGS.map((model) => ({
    name: model.name,
    contextWindow: model.contextWindow,
    compressionThresholdPercent: 70,
  }));

  return {
    id: crypto.randomUUID(),
    name: "MiniMax 官方",
    apiKey: "",
    baseURL: MINIMAX_OFFICIAL_BASE_URL,
    model: MINIMAX_DEFAULT_MODEL,
    expertModel: MINIMAX_DEFAULT_MODEL,
    smallModel: MINIMAX_SMALL_MODEL,
    imageModel: undefined,
    analysisModel: MINIMAX_SMALL_MODEL,
    embeddingModel: undefined,
    embeddingDimension: 1536,
    embeddingBatchSize: 16,
    wikiModel: MINIMAX_SMALL_MODEL,
    wikiModelCostTier: "cheap",
    wikiModelMaxInputTokens: 16_000,
    wikiModelMaxOutputTokens: 4_000,
    models,
    enabled: true,
    provider: "minimax",
    apiType: "anthropic",
  };
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

function normalizeProvider(value: unknown, baseURL: string): "custom" | "deepseek" | "codex" | "minimax" {
  if (value === "custom" || value === "deepseek" || value === "codex" || value === "minimax") {
    return value;
  }

  try {
    const hostname = new URL(baseURL.trim()).hostname;
    if (hostname === "api.deepseek.com") return "deepseek";
    if (hostname === "chatgpt.com") return "codex";
    if (hostname === "api.minimax.io") return "minimax";
    return "custom";
  } catch {
    return "custom";
  }
}

function normalizeBaseURL(value: string, provider: "custom" | "deepseek" | "codex" | "minimax"): string {
  if (provider === "deepseek") {
    return DEEPSEEK_OFFICIAL_BASE_URL;
  }
  if (provider === "codex") {
    return CODEX_OAUTH_BASE_URL;
  }
  if (provider === "minimax") {
    return MINIMAX_OFFICIAL_BASE_URL;
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

function normalizeModel(model: ApiModelConfigProfile): ApiModelConfigProfile | null {
  const name = model.name.trim();
  if (!name) {
    return null;
  }

  const contextWindow = normalizePositiveInteger(model.contextWindow);
  const compressionThresholdPercent = normalizePercent(model.compressionThresholdPercent);

  return {
    name,
    contextWindow,
    compressionThresholdPercent,
    routingWeight: normalizeModelRoutingWeight(model.routingWeight),
  };
}

function dedupeModels(models: ApiModelConfigProfile[]): ApiModelConfigProfile[] {
  const deduped = new Map<string, ApiModelConfigProfile>();

  for (const model of models) {
    const normalized = normalizeModel(model);
    if (!normalized) {
      continue;
    }

    const previous = deduped.get(normalized.name);
    deduped.set(normalized.name, {
      name: normalized.name,
      contextWindow: normalized.contextWindow ?? previous?.contextWindow,
      compressionThresholdPercent: normalized.compressionThresholdPercent ?? previous?.compressionThresholdPercent,
      routingWeight: normalized.routingWeight ?? previous?.routingWeight,
    });
  }

  return Array.from(deduped.values()).map((model) => ({
    ...model,
    contextWindow: model.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
    compressionThresholdPercent: model.compressionThresholdPercent ?? 70,
  }));
}

function normalizeRoleModel(value: string | undefined, fallbackModel: string): string {
  const normalized = value?.trim();
  return normalized || fallbackModel;
}

export function normalizeProfile(profile: ApiConfigProfile): ApiConfigProfile {
  const provider = normalizeProvider(profile.provider, profile.baseURL);
  const models = dedupeModels([
    ...(profile.models ?? []),
    { name: profile.model },
    { name: profile.expertModel ?? "" },
    { name: profile.smallModel ?? "" },
    { name: profile.imageModel ?? "" },
    { name: profile.analysisModel ?? "" },
    { name: profile.embeddingModel ?? "" },
    { name: profile.wikiModel ?? "" },
  ]);
  const selectedModel = profile.model.trim() || models[0]?.name || "";
  const imageModel = profile.imageModel?.trim();
  const embeddingModel = profile.embeddingModel?.trim();
  const wikiModel = profile.wikiModel?.trim();

  if (selectedModel && !models.some((item) => item.name === selectedModel)) {
    models.unshift({
      name: selectedModel,
      compressionThresholdPercent: 70,
    });
  }

  return {
    ...profile,
    name: profile.name.trim() || "未命名配置",
    apiKey: profile.apiKey.trim(),
    baseURL: normalizeBaseURL(profile.baseURL, provider),
    model: selectedModel,
    expertModel: normalizeRoleModel(profile.expertModel, selectedModel),
    smallModel: normalizeRoleModel(profile.smallModel, normalizeRoleModel(profile.analysisModel, selectedModel)),
    imageModel: imageModel && models.some((item) => item.name === imageModel) ? imageModel : undefined,
    analysisModel: normalizeRoleModel(profile.analysisModel, selectedModel),
    embeddingModel: embeddingModel && models.some((item) => item.name === embeddingModel) ? embeddingModel : undefined,
    embeddingDimension: normalizePositiveInteger(profile.embeddingDimension) ?? 1536,
    embeddingBatchSize: normalizePositiveInteger(profile.embeddingBatchSize) ?? 16,
    wikiModel: wikiModel && models.some((item) => item.name === wikiModel) ? wikiModel : undefined,
    wikiModelCostTier: profile.wikiModelCostTier === "free" || profile.wikiModelCostTier === "cheap" || profile.wikiModelCostTier === "standard"
      ? profile.wikiModelCostTier
      : "cheap",
    wikiModelMaxInputTokens: normalizePositiveInteger(profile.wikiModelMaxInputTokens) ?? 16_000,
    wikiModelMaxOutputTokens: normalizePositiveInteger(profile.wikiModelMaxOutputTokens) ?? 4_000,
    models,
    enabled: Boolean(profile.enabled),
    provider,
    apiType: "anthropic",
  };
}

export function getEnabledProfile(profiles: ApiConfigProfile[]): ApiConfigProfile | undefined {
  return profiles.find((profile) => profile.enabled) ?? profiles[0];
}

export function getEnabledProfiles(profiles: ApiConfigProfile[]): ApiConfigProfile[] {
  const enabledProfiles = profiles.filter((profile) => profile.enabled);
  if (enabledProfiles.length > 0) {
    return enabledProfiles;
  }
  return profiles[0] ? [profiles[0]] : [];
}

export function getAvailableModels(profile: ApiConfigProfile): string[] {
  return dedupeAvailableModelNames([
    profile.model,
    profile.expertModel,
    profile.smallModel,
    profile.imageModel,
    profile.analysisModel,
    profile.embeddingModel,
    profile.wikiModel,
    ...(profile.models ?? []).map((item) => item.name),
  ]);
}

export function getAvailableModelsForProfiles(profiles: ApiConfigProfile[]): string[] {
  return dedupeAvailableModelNames(profiles.flatMap((profile) => getAvailableModels(profile)));
}

function dedupeAvailableModelNames(models: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const model of models) {
    const normalized = model?.trim() ?? "";
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

export function resolveAvailableModelName(modelName: string | undefined, availableModels: string[]): string {
  const normalized = modelName?.trim() ?? "";
  if (!normalized) {
    return "";
  }
  if (availableModels.includes(normalized)) {
    return normalized;
  }
  if (isDeepSeekModelName(normalized)) {
    const matchedModel = availableModels.find((availableModel) =>
      isDeepSeekModelName(availableModel) && availableModel.toLowerCase() === normalized.toLowerCase()
    );
    if (matchedModel) {
      return matchedModel;
    }
  }
  if (isMiniMaxModelName(normalized)) {
    const matchedModel = availableModels.find((availableModel) =>
      isMiniMaxModelName(availableModel) && availableModel.toLowerCase() === normalized.toLowerCase()
    );
    if (matchedModel) {
      return matchedModel;
    }
  }
  return normalized;
}

export function getRoutedModelOptionsForProfiles(profiles: ApiConfigProfile[]): RoutedModelOption[] {
  return getAvailableModelsForProfiles(profiles)
    .map((modelName) => buildRoutedModelOption(profiles, modelName))
    .filter((option): option is RoutedModelOption => Boolean(option));
}

function buildRoutedModelOption(profiles: ApiConfigProfile[], modelName: string): RoutedModelOption | null {
  const owner = pickHighestWeightedModelOwner(
    profiles,
    modelName,
    (profile, targetModel) => profileOwnsRoutableModel(profile, targetModel),
  );

  if (!owner) {
    return null;
  }

  const routingWeight = getModelRoutingWeight(owner, modelName);
  const profileName = owner.name?.trim() || "Unnamed profile";
  const providerLabel = getApiProviderLabel(owner.provider);
  const weightLabel = routingWeight > 0 ? ` / weight ${routingWeight}` : "";
  const modelConfig = owner.models?.find((model) => model.name === modelName);

  return {
    value: modelName,
    label: modelName,
    profileId: owner.id,
    profileName,
    contextWindow: modelConfig?.contextWindow,
    provider: owner.provider,
    providerLabel,
    routingWeight,
    routeLabel: `${profileName} / ${providerLabel}${weightLabel}`,
  };
}

function profileOwnsRoutableModel(profile: ApiConfigProfile, modelName: string): boolean {
  return getAvailableModels(profile).includes(modelName)
    && isModelCompatibleWithApiProvider(profile.provider, modelName);
}

function getApiProviderLabel(provider: ApiProviderMode | undefined): string {
  if (provider === "codex") return "Codex OAuth";
  if (provider === "deepseek") return "DeepSeek";
  if (provider === "minimax") return "MiniMax";
  return "Custom Gateway";
}

export function buildRoutingSummary(profile?: ApiConfigProfile): string {
  if (!profile) {
    return "还没有可用配置。";
  }

  const mainModel = profile.model || "-";
  const expertModel = profile.expertModel || mainModel;
  const smallModel = profile.smallModel || mainModel;
  const analysisModel = profile.analysisModel || mainModel;
  const imageModel = profile.imageModel || "未启用";
  return `主 ${mainModel} / 专家 ${expertModel} / 小模型 ${smallModel} / 分析 ${analysisModel} / 图片 ${imageModel}`;
}

export function validateProfiles(profiles: ApiConfigProfile[]): string | null {
  if (profiles.length === 0) {
    return "至少保留一个配置。";
  }

  const enabledIndex = profiles.findIndex((profile) => profile.enabled);
  if (enabledIndex === -1) {
    return "至少启用一个配置。";
  }

  for (const profile of profiles) {
    if (!profile.name) {
      return "每个配置都需要名称。";
    }
    if (!profile.apiKey) {
      return `配置“${profile.name}”必须填写 API Key。`;
    }
    if (!profile.baseURL) {
      return `配置“${profile.name}”必须填写接口地址。`;
    }
    if (!profile.model) {
      return `配置“${profile.name}”必须选择默认主模型。`;
    }
    if ((profile.models ?? []).length === 0) {
      return `配置“${profile.name}”至少要保留一个模型。`;
    }

    const selectedModel = profile.models?.find((item) => item.name === profile.model);
    if (!selectedModel?.contextWindow) {
      return `配置“${profile.name}”的默认主模型需要填写上下文窗口。`;
    }

    if (profile.imageModel && !profile.models?.some((item) => item.name === profile.imageModel)) {
      return `配置“${profile.name}”的图片预处理模型必须在模型列表中。`;
    }
    if (profile.smallModel && !profile.models?.some((item) => item.name === profile.smallModel)) {
      return `配置“${profile.name}”的小模型必须在模型列表中。`;
    }
    if (profile.analysisModel && !profile.models?.some((item) => item.name === profile.analysisModel)) {
      return `配置“${profile.name}”的 Prompt 分析模型必须在模型列表中。`;
    }

    try {
      new URL(profile.baseURL);
    } catch {
      return `配置“${profile.name}”的接口地址格式不正确。`;
    }
  }

  return null;
}
