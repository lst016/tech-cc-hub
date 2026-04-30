import type { ApiConfigProfile, ApiModelConfigProfile } from "../../types.js";

const DEFAULT_CONTEXT_WINDOW = 200_000;

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
    imageModel: undefined,
    analysisModel: "",
    models: [createModel()],
    enabled: true,
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

function normalizeBaseURL(value: string): string {
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
  const models = dedupeModels([
    ...(profile.models ?? []),
    { name: profile.model },
    { name: profile.expertModel ?? "" },
    { name: profile.imageModel ?? "" },
    { name: profile.analysisModel ?? "" },
  ]);
  const selectedModel = profile.model.trim() || models[0]?.name || "";
  const imageModel = profile.imageModel?.trim();

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
    baseURL: normalizeBaseURL(profile.baseURL),
    model: selectedModel,
    expertModel: normalizeRoleModel(profile.expertModel, selectedModel),
    imageModel: imageModel && models.some((item) => item.name === imageModel) ? imageModel : undefined,
    analysisModel: normalizeRoleModel(profile.analysisModel, selectedModel),
    models,
    enabled: Boolean(profile.enabled),
    apiType: "anthropic",
  };
}

export function getEnabledProfile(profiles: ApiConfigProfile[]): ApiConfigProfile | undefined {
  return profiles.find((profile) => profile.enabled) ?? profiles[0];
}

export function getAvailableModels(profile: ApiConfigProfile): string[] {
  return Array.from(
    new Set([
      profile.model,
      profile.expertModel,
      profile.imageModel,
      profile.analysisModel,
      ...(profile.models ?? []).map((item) => item.name),
    ]),
  )
    .map((item) => item?.trim() ?? "")
    .filter(Boolean);
}

export function buildRoutingSummary(profile?: ApiConfigProfile): string {
  if (!profile) {
    return "还没有可用配置。";
  }

  const mainModel = profile.model || "-";
  const expertModel = profile.expertModel || mainModel;
  const analysisModel = profile.analysisModel || mainModel;
  const imageModel = profile.imageModel || "未启用";
  return `主 ${mainModel} / 专家 ${expertModel} / 分析 ${analysisModel} / 图片 ${imageModel}`;
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
