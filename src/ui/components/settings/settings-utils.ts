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
  findMatchingModelName,
  getAssignedModelNames,
  getModelRoutingWeight,
  normalizeModelRoutingWeight,
  pickHighestWeightedModelOwner,
} from "../../../shared/models/model-routing-weight.js";
import {
  areModelNamesEquivalent,
  BOKE_GATEWAY_BASE_URL,
  canonicalizeModelNameForRouting,
  isDeepSeekModelName,
  isMiniMaxModelName,
  isModelCompatibleWithApiProvider,
  resolveSharedApiProviderMode,
} from "../../../shared/models/model-provider-routing.js";
import {
  normalizeImportedApiModels,
} from "../../../shared/models/api-model-metadata.js";
import { inferModelCapabilities, type ModelCapability } from "./model-catalog-utils.js";
import { createModelDeploymentKey } from "./model-catalog-utils.js";

const DEFAULT_CONTEXT_WINDOW = 200_000;
const DEEPSEEK_CONTEXT_WINDOW = 1_000_000;
const CODEX_CONTEXT_WINDOW = 200_000;
export const DEEPSEEK_OFFICIAL_BASE_URL = "https://api.deepseek.com/anthropic";
export const DEEPSEEK_OFFICIAL_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;
export const MINIMAX_OFFICIAL_BASE_URL = MINIMAX_ANTHROPIC_BASE_URL;
export const MINIMAX_OFFICIAL_MODELS = MINIMAX_MODEL_CONFIGS.map((model) => model.name);

export type RoutedModelOption = {
  deploymentKey: string;
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
    imageGenerationModel: undefined,
    analysisModel: "",
    models: [createModel()],
    enabled: true,
    provider: "custom",
    apiType: "anthropic",
  };
}

export function createBokeGatewayProfile(): ApiConfigProfile {
  return {
    ...createProfile(),
    name: "波克网关",
    baseURL: BOKE_GATEWAY_BASE_URL,
    provider: "boke",
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
    imageGenerationModel: undefined,
    analysisModel: "deepseek-v4-flash",
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
    imageGenerationModel: undefined,
    analysisModel: CODEX_OAUTH_SMALL_MODEL,
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
    imageGenerationModel: undefined,
    analysisModel: MINIMAX_SMALL_MODEL,
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
  const metadata = normalizeImportedApiModels([model])[0];

  return {
    name,
    contextWindow,
    compressionThresholdPercent,
    routingWeight: normalizeModelRoutingWeight(model.routingWeight),
    catalogStatus: normalizeCatalogStatus(model.catalogStatus),
    alias: model.alias?.trim() || undefined,
    tags: normalizeModelTags(model.tags),
    notes: model.notes?.trim() || undefined,
    ownedBy: metadata?.ownedBy,
    supportedEndpointTypes: metadata?.supportedEndpointTypes,
    createdAt: metadata?.createdAt,
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
    const metadata = normalizeImportedApiModels([
      ...(previous ? [previous] : []),
      normalized,
    ])[0];
    deduped.set(normalized.name, {
      name: normalized.name,
      contextWindow: normalized.contextWindow ?? previous?.contextWindow,
      compressionThresholdPercent: normalized.compressionThresholdPercent ?? previous?.compressionThresholdPercent,
      routingWeight: normalized.routingWeight ?? previous?.routingWeight,
      catalogStatus: normalized.catalogStatus ?? previous?.catalogStatus,
      alias: normalized.alias ?? previous?.alias,
      tags: normalized.tags ?? previous?.tags,
      notes: normalized.notes ?? previous?.notes,
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

export function normalizeProfile(profile: ApiConfigProfile): ApiConfigProfile {
  const provider = normalizeProvider(profile.provider, profile.baseURL);
  const hasDeclaredModels = (profile.models ?? []).some((model) => Boolean(model.name.trim()));
  const dedupeInput = hasDeclaredModels
    ? profile.models ?? []
    : [
      { name: profile.model },
      { name: profile.expertModel ?? "" },
      { name: profile.smallModel ?? "" },
      { name: profile.imageModel ?? "" },
      { name: profile.imageGenerationModel ?? "" },
      { name: profile.analysisModel ?? "" },
    ];
  const models = filterProviderCompatibleModels(provider, dedupeModels(dedupeInput));
  const managedModels = models.filter(isManagedModel);
  const selectedModel = pickLocalManagedModel(provider, managedModels, [
    profile.model,
    getProviderDefaultModel(provider, "main"),
    managedModels[0]?.name,
  ]);
  const analysisModel = pickLocalManagedModel(provider, managedModels, [
    profile.analysisModel,
    getProviderDefaultModel(provider, "small"),
    selectedModel,
  ]);
  const expertModel = pickLocalManagedModel(provider, managedModels, [profile.expertModel, selectedModel]);
  const smallModel = pickLocalManagedModel(provider, managedModels, [
    profile.smallModel,
    analysisModel,
    getProviderDefaultModel(provider, "small"),
    selectedModel,
  ]);
  const imageModel = profile.imageModel?.trim();
  const imageGenerationModel = profile.imageGenerationModel?.trim();

  return {
    ...profile,
    name: normalizeKnownProfileName(profile.name, provider),
    apiKey: profile.apiKey.trim(),
    baseURL: normalizeBaseURL(profile.baseURL, provider),
    model: selectedModel,
    expertModel,
    smallModel,
    imageModel: imageModel && managedModels.some((item) => item.name === imageModel) ? imageModel : undefined,
    imageGenerationModel: imageGenerationModel && managedModels.some((item) => item.name === imageGenerationModel) ? imageGenerationModel : undefined,
    analysisModel,
    models,
    enabled: Boolean(profile.enabled),
    provider,
    apiType: "anthropic",
  };
}

function normalizeKnownProfileName(name: string, provider: ApiProviderMode): string {
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
  return trimmed || "未命名配置";
}

function filterProviderCompatibleModels(provider: ApiProviderMode, models: ApiModelConfigProfile[]): ApiModelConfigProfile[] {
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
    return "deepseek-v4-flash";
  }
  if (provider === "minimax") {
    return slot === "small" ? MINIMAX_SMALL_MODEL : MINIMAX_DEFAULT_MODEL;
  }
  return "";
}

function isManagedModel(model: ApiModelConfigProfile): boolean {
  return model.catalogStatus !== "excluded";
}

function pickLocalManagedModel(
  provider: ApiProviderMode,
  models: ApiModelConfigProfile[],
  candidates: Array<string | undefined>,
): string {
  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (!normalized || !isModelCompatibleWithApiProvider(provider, normalized)) {
      continue;
    }
    const exact = models.find((model) => model.name === normalized);
    if (exact) return exact.name;
    if (provider === "deepseek" || provider === "minimax") {
      const caseInsensitive = models.find((model) => model.name.toLowerCase() === normalized.toLowerCase());
      if (caseInsensitive) return caseInsensitive.name;
    }
  }
  return "";
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
  const modelsByName = new Map((profile.models ?? [])
    .map((model) => [model.name.trim(), model] as const)
    .filter(([name]) => Boolean(name)));
  const isManagedName = (name: string | undefined) => {
    const normalized = name?.trim();
    if (!normalized) return false;
    const model = modelsByName.get(normalized);
    return model
      ? isManagedModel(model)
      : modelsByName.size === 0;
  };
  return dedupeAvailableModelNames([
    isManagedName(profile.model) ? profile.model : undefined,
    isManagedName(profile.expertModel) ? profile.expertModel : undefined,
    isManagedName(profile.smallModel) ? profile.smallModel : undefined,
    isManagedName(profile.imageModel) ? profile.imageModel : undefined,
    isManagedName(profile.imageGenerationModel) ? profile.imageGenerationModel : undefined,
    isManagedName(profile.analysisModel) ? profile.analysisModel : undefined,
    ...(profile.models ?? [])
      .filter((model) => model.catalogStatus !== "excluded")
      .map((item) => item.name),
  ]);
}

export function getAvailableModelsForProfiles(profiles: ApiConfigProfile[]): string[] {
  return dedupeAvailableModelNames(profiles.flatMap((profile) => getAvailableModels(profile)), true);
}

function normalizeModelTags(tags: string[] | undefined): string[] | undefined {
  if (!tags) return undefined;
  const normalized = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeCatalogStatus(value: ApiModelConfigProfile["catalogStatus"]): ApiModelConfigProfile["catalogStatus"] {
  if (value === "excluded") return "excluded";
  if (value === "discovered" || value === "managed") return "managed";
  return undefined;
}

export function getImageUnderstandingModels(profile: ApiConfigProfile): string[] {
  return getImageUnderstandingModelsForProfiles([profile]);
}

export function getImageUnderstandingModelsForProfiles(profiles: ApiConfigProfile[]): string[] {
  const selected = new Set(profiles
    .map((profile) => profile.imageModel?.trim())
    .filter((model): model is string => Boolean(model)));
  return getRoutedCapabilityModels(profiles, "image-understanding", selected);
}

export function getImageGenerationModels(profile: ApiConfigProfile): string[] {
  return getImageGenerationModelsForProfiles([profile]);
}

export function getImageGenerationModelsForProfiles(profiles: ApiConfigProfile[]): string[] {
  const selected = new Set(profiles
    .map((profile) => profile.imageGenerationModel?.trim())
    .filter((model): model is string => Boolean(model)));
  return getRoutedCapabilityModels(profiles, "image-generation", selected);
}

function getRoutedCapabilityModels(
  profiles: ApiConfigProfile[],
  capability: ModelCapability,
  selected: Set<string>,
): string[] {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile] as const));
  return getRoutedModelOptionsForProfiles(profiles)
    .filter((option) => {
      if (selected.has(option.value)) return true;
      const owner = profilesById.get(option.profileId);
      const deployment = owner ? owner.models?.find((model) => (
        model.catalogStatus !== "excluded"
        && areModelNamesEquivalent(model.name, option.value)
      )) : undefined;
      return Boolean(deployment && inferModelCapabilities(deployment).includes(capability));
    })
    .map((option) => option.value);
}

function dedupeAvailableModelNames(
  models: Array<string | undefined>,
  canonicalizeMiniMax = false,
): string[] {
  const deduped: string[] = [];

  for (const model of models) {
    const normalized = model?.trim() ?? "";
    if (!normalized) {
      continue;
    }

    const existingIndex = deduped.findIndex((existing) => areModelNamesEquivalent(existing, normalized));
    if (existingIndex >= 0) {
      if (canonicalizeMiniMax && isMiniMaxModelName(normalized)) {
        deduped[existingIndex] = canonicalizeModelNameForRouting(normalized);
      }
      continue;
    }

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
    const matchedModel = availableModels.find((availableModel) => areModelNamesEquivalent(availableModel, normalized));
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

export function getAutomaticRoutedModelOptionsForProfiles(profiles: ApiConfigProfile[]): RoutedModelOption[] {
  return dedupeAvailableModelNames(
    profiles.flatMap((profile) => getAssignedModelNames(profile)),
    true,
  )
    .map((modelName) => buildRoutedModelOption(profiles, modelName, profileOwnsAssignedRoutableModel))
    .filter((option): option is RoutedModelOption => Boolean(option));
}

export function getModelDeploymentOptionsForProfiles(profiles: ApiConfigProfile[]): RoutedModelOption[] {
  return profiles.flatMap((profile) => getAvailableModels(profile)
    .filter((modelName) => isModelCompatibleWithApiProvider(profile.provider, modelName))
    .map((modelName) => buildModelDeploymentOption(profile, modelName)));
}

function buildRoutedModelOption(
  profiles: ApiConfigProfile[],
  modelName: string,
  isRoutable = profileOwnsRoutableModel,
): RoutedModelOption | null {
  const owner = pickHighestWeightedModelOwner(
    profiles,
    modelName,
    (profile, targetModel) => isRoutable(profile, targetModel),
  );

  if (!owner) {
    return null;
  }

  return buildModelDeploymentOption(owner, findMatchingModelName(owner, modelName) ?? modelName);
}

function buildModelDeploymentOption(profile: ApiConfigProfile, modelName: string): RoutedModelOption {
  const routedModelName = findMatchingModelName(profile, modelName) ?? modelName;
  const routingWeight = getModelRoutingWeight(profile, routedModelName);
  const profileName = profile.name?.trim() || "Unnamed profile";
  const providerLabel = getApiProviderLabel(profile.provider);
  const weightLabel = routingWeight > 0 ? ` / weight ${routingWeight}` : "";
  const modelConfig = profile.models?.find((model) => model.name === routedModelName);

  return {
    deploymentKey: createModelDeploymentKey(profile.id, routedModelName),
    value: routedModelName,
    label: routedModelName,
    profileId: profile.id,
    profileName,
    contextWindow: modelConfig?.contextWindow,
    provider: profile.provider,
    providerLabel,
    routingWeight,
    routeLabel: `${profileName} / ${providerLabel}${weightLabel}`,
  };
}

function profileOwnsRoutableModel(profile: ApiConfigProfile, modelName: string): boolean {
  return Boolean(findMatchingModelName(
    { models: getAvailableModels(profile).map((name) => ({ name })) },
    modelName,
  ))
    && isModelCompatibleWithApiProvider(profile.provider, modelName);
}

function profileOwnsAssignedRoutableModel(profile: ApiConfigProfile, modelName: string): boolean {
  return Boolean(findMatchingModelName(
    { models: getAssignedModelNames(profile).map((name) => ({ name })) },
    modelName,
  ))
    && isModelCompatibleWithApiProvider(profile.provider, modelName);
}

function getApiProviderLabel(provider: ApiProviderMode | undefined): string {
  if (provider === "boke") return "波克网关";
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

    const hasManagedModel = (modelName: string | undefined) => Boolean(modelName && profile.models?.some((item) => (
      item.name === modelName && isManagedModel(item)
    )));
    const selectedModel = profile.models?.find((item) => item.name === profile.model && isManagedModel(item));
    if (!selectedModel?.contextWindow) {
      return `配置“${profile.name}”的默认主模型需要填写上下文窗口。`;
    }

    if (profile.expertModel && !hasManagedModel(profile.expertModel)) {
      return `配置“${profile.name}”的专家模型必须属于该网关的已纳管模型。`;
    }
    if (profile.imageModel && !hasManagedModel(profile.imageModel)) {
      return `配置“${profile.name}”的图片预处理模型必须在模型列表中。`;
    }
    if (profile.imageGenerationModel && !hasManagedModel(profile.imageGenerationModel)) {
      return `配置“${profile.name}”的生图模型必须在模型列表中。`;
    }
    if (profile.smallModel && !hasManagedModel(profile.smallModel)) {
      return `配置“${profile.name}”的小模型必须在模型列表中。`;
    }
    if (profile.analysisModel && !hasManagedModel(profile.analysisModel)) {
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
