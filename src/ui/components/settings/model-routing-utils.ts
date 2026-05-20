import type { ApiConfigProfile, ApiModelConfigProfile } from "../../types.js";
import {
  getAvailableModelsForProfiles,
  getEnabledProfiles,
} from "./settings-utils.js";

const DEFAULT_CONTEXT_WINDOW = 200_000;

export type ModelSlotPatch = Partial<Pick<ApiConfigProfile, "model" | "expertModel" | "smallModel" | "analysisModel" | "imageModel" | "embeddingModel" | "wikiModel">>;

export type SharedModelRoutingState = {
  routedProfileIds: string[];
  routedProfileNames: string[];
  enabledCount: number;
  availableModels: string[];
  mainModel: string;
  expertModel: string;
  smallModel: string;
  analysisModel: string;
  imageModel: string;
  embeddingModel: string;
  wikiModel: string;
};

export function buildSharedModelRoutingState(profiles: ApiConfigProfile[]): SharedModelRoutingState {
  const enabledCount = profiles.filter((profile) => profile.enabled).length;
  const routedProfiles = getEnabledProfiles(profiles);
  const availableModels = getAvailableModelsForProfiles(routedProfiles);
  const primaryProfile = routedProfiles[0];
  const mainModel = pickAvailableModel(primaryProfile?.model, availableModels) || availableModels[0] || "";

  return {
    routedProfileIds: routedProfiles.map((profile) => profile.id),
    routedProfileNames: routedProfiles.map((profile) => profile.name || "未命名配置"),
    enabledCount,
    availableModels,
    mainModel,
    expertModel: pickAvailableModel(primaryProfile?.expertModel, availableModels) || mainModel,
    smallModel: pickAvailableModel(primaryProfile?.smallModel, availableModels) || mainModel,
    analysisModel: pickAvailableModel(primaryProfile?.analysisModel, availableModels) || mainModel,
    imageModel: pickAvailableModel(primaryProfile?.imageModel, availableModels),
    embeddingModel: pickAvailableModel(primaryProfile?.embeddingModel, availableModels),
    wikiModel: pickAvailableModel(primaryProfile?.wikiModel, availableModels),
  };
}

export function applySharedModelRoutingPatch(profiles: ApiConfigProfile[], patch: ModelSlotPatch): ApiConfigProfile[] {
  const state = buildSharedModelRoutingState(profiles);
  const routedIds = new Set(state.routedProfileIds);
  const routedProfiles = profiles.filter((profile) => routedIds.has(profile.id));
  const mergedModels = mergeModelConfigs(routedProfiles, state.availableModels);
  const hasImageModelPatch = Object.prototype.hasOwnProperty.call(patch, "imageModel");
  const hasEmbeddingModelPatch = Object.prototype.hasOwnProperty.call(patch, "embeddingModel");
  const hasWikiModelPatch = Object.prototype.hasOwnProperty.call(patch, "wikiModel");

  return profiles.map((profile) => {
    if (!routedIds.has(profile.id)) {
      return profile;
    }

    return {
      ...profile,
      ...patch,
      imageModel: hasImageModelPatch ? patch.imageModel || undefined : profile.imageModel,
      embeddingModel: hasEmbeddingModelPatch ? patch.embeddingModel || undefined : profile.embeddingModel,
      wikiModel: hasWikiModelPatch ? patch.wikiModel || undefined : profile.wikiModel,
      models: mergeModelConfigsForProfile(profile, mergedModels, state.availableModels),
    };
  });
}

function pickAvailableModel(model: string | undefined, availableModels: string[]): string {
  const normalized = model?.trim();
  return normalized && availableModels.includes(normalized) ? normalized : "";
}

function mergeModelConfigs(profiles: ApiConfigProfile[], availableModels: string[]): ApiModelConfigProfile[] {
  const byName = new Map<string, ApiModelConfigProfile>();

  for (const profile of profiles) {
    for (const model of profile.models ?? []) {
      const name = model.name.trim();
      if (!name) {
        continue;
      }
      const previous = byName.get(name);
      byName.set(name, {
        name,
        contextWindow: model.contextWindow ?? previous?.contextWindow,
        compressionThresholdPercent: model.compressionThresholdPercent ?? previous?.compressionThresholdPercent,
        routingWeight: model.routingWeight ?? previous?.routingWeight,
      });
    }
  }

  return availableModels.map((name) => {
    const model = byName.get(name);
    return {
      name,
      contextWindow: model?.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
      compressionThresholdPercent: model?.compressionThresholdPercent ?? 70,
      routingWeight: model?.routingWeight,
    };
  });
}

function mergeModelConfigsForProfile(
  profile: ApiConfigProfile,
  fallbackModels: ApiModelConfigProfile[],
  availableModels: string[],
): ApiModelConfigProfile[] {
  const localModels = new Map((profile.models ?? [])
    .map((model) => [model.name.trim(), model] as const)
    .filter(([name]) => Boolean(name)));
  const fallbackByName = new Map(fallbackModels.map((model) => [model.name, model] as const));

  return availableModels.map((name) => {
    const localModel = localModels.get(name);
    const fallbackModel = fallbackByName.get(name);
    return {
      name,
      contextWindow: localModel?.contextWindow ?? fallbackModel?.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
      compressionThresholdPercent: localModel?.compressionThresholdPercent ?? fallbackModel?.compressionThresholdPercent ?? 70,
      routingWeight: localModel?.routingWeight,
    };
  });
}
