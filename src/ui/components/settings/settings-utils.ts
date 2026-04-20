import type { ApiConfigProfile, ApiModelConfigProfile } from "../../types";

export function createModel(): ApiModelConfigProfile {
  return {
    name: "",
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

function normalizeModel(model: ApiModelConfigProfile): ApiModelConfigProfile | null {
  const name = model.name.trim();
  if (!name) {
    return null;
  }

  const contextWindow = normalizePositiveInteger(model.contextWindow);
  const compressionThresholdPercent = normalizePercent(model.compressionThresholdPercent) ?? 70;

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
      compressionThresholdPercent: normalized.compressionThresholdPercent ?? previous?.compressionThresholdPercent ?? 70,
    });
  }

  return Array.from(deduped.values());
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
  ]);
  const selectedModel = profile.model.trim() || models[0]?.name || "";

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
    baseURL: profile.baseURL.trim(),
    model: selectedModel,
    expertModel: normalizeRoleModel(profile.expertModel, selectedModel),
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
  return `主 ${mainModel} · 专家 ${expertModel}`;
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
      return `配置「${profile.name}」必须填写 API Key。`;
    }
    if (!profile.baseURL) {
      return `配置「${profile.name}」必须填写接口地址。`;
    }
    if (!profile.model) {
      return `配置「${profile.name}」必须选择默认主模型。`;
    }
    if ((profile.models ?? []).length === 0) {
      return `配置「${profile.name}」至少要保留一个模型。`;
    }

    const selectedModel = profile.models?.find((item) => item.name === profile.model);
    if (!selectedModel?.contextWindow) {
      return `配置「${profile.name}」的默认主模型需要填写上下文窗口。`;
    }

    try {
      new URL(profile.baseURL);
    } catch {
      return `配置「${profile.name}」的接口地址格式不正确。`;
    }
  }

  return null;
}
