import type { ApiConfigProfile, ApiModelConfigProfile } from "../../types.js";
import {
  getAvailableModelsForProfiles,
  getEnabledProfiles,
} from "./settings-utils.js";

const DEFAULT_CONTEXT_WINDOW = 200_000;

export type ModelSlotPatch = Partial<Pick<ApiConfigProfile, "model" | "expertModel" | "smallModel" | "analysisModel" | "imageModel">>;

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
  };
}

export function applySharedModelRoutingPatch(profiles: ApiConfigProfile[], patch: ModelSlotPatch): ApiConfigProfile[] {
  const state = buildSharedModelRoutingState(profiles);
  const routedIds = new Set(state.routedProfileIds);
  const routedProfiles = profiles.filter((profile) => routedIds.has(profile.id));
  const mergedModels = mergeModelConfigs(routedProfiles, state.availableModels);
  const hasImageModelPatch = Object.prototype.hasOwnProperty.call(patch, "imageModel");

  return profiles.map((profile) => {
    if (!routedIds.has(profile.id)) {
      return profile;
    }

    return {
      ...profile,
      ...patch,
      imageModel: hasImageModelPatch ? patch.imageModel || undefined : profile.imageModel,
      models: mergedModels,
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
      });
    }
  }

  return availableModels.map((name) => {
    const model = byName.get(name);
    return {
      name,
      contextWindow: model?.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
      compressionThresholdPercent: model?.compressionThresholdPercent ?? 70,
    };
  });
}
