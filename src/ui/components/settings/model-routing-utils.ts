import type { ApiConfigProfile } from "../../types.js";
import {
  getAvailableModels,
  getAvailableModelsForProfiles,
  getEnabledProfiles,
  getImageGenerationModelsForProfiles,
  getImageUnderstandingModelsForProfiles,
  getRoutedModelOptionsForProfiles,
} from "./settings-utils.js";

export type ModelSlotPatch = Partial<Pick<ApiConfigProfile, "model" | "expertModel" | "smallModel" | "analysisModel" | "imageModel" | "imageGenerationModel">>;

export type SharedModelRoutingState = {
  routedProfileIds: string[];
  routedProfileNames: string[];
  enabledCount: number;
  availableModels: string[];
  roleModels: string[];
  imageUnderstandingModels: string[];
  imageGenerationModels: string[];
  mainModel: string;
  expertModel: string;
  smallModel: string;
  analysisModel: string;
  imageModel: string;
  imageGenerationModel: string;
};

export function buildSharedModelRoutingState(profiles: ApiConfigProfile[]): SharedModelRoutingState {
  const enabledCount = profiles.filter((profile) => profile.enabled).length;
  const routedProfiles = getEnabledProfiles(profiles);
  const availableModels = getAvailableModelsForProfiles(routedProfiles);
  const primaryProfile = routedProfiles[0];
  const roleModels = primaryProfile ? getAvailableModels(primaryProfile) : [];
  const mainModel = pickAvailableModel(primaryProfile?.model, availableModels) || availableModels[0] || "";

  return {
    routedProfileIds: routedProfiles.map((profile) => profile.id),
    routedProfileNames: routedProfiles.map((profile) => profile.name || "未命名配置"),
    enabledCount,
    availableModels,
    roleModels,
    imageUnderstandingModels: getImageUnderstandingModelsForProfiles(routedProfiles),
    imageGenerationModels: getImageGenerationModelsForProfiles(routedProfiles),
    mainModel,
    expertModel: pickAvailableModel(primaryProfile?.expertModel, roleModels) || mainModel,
    smallModel: pickAvailableModel(primaryProfile?.smallModel, roleModels) || mainModel,
    analysisModel: pickAvailableModel(primaryProfile?.analysisModel, roleModels) || mainModel,
    imageModel: pickFirstConfiguredSlotModel(routedProfiles, "imageModel", availableModels),
    imageGenerationModel: pickFirstConfiguredSlotModel(routedProfiles, "imageGenerationModel", availableModels),
  };
}

export function applySharedModelRoutingPatch(profiles: ApiConfigProfile[], patch: ModelSlotPatch): ApiConfigProfile[] {
  const state = buildSharedModelRoutingState(profiles);
  const routedIds = new Set(state.routedProfileIds);
  const hasModelPatch = Object.prototype.hasOwnProperty.call(patch, "model");
  const hasExpertModelPatch = Object.prototype.hasOwnProperty.call(patch, "expertModel");
  const hasSmallModelPatch = Object.prototype.hasOwnProperty.call(patch, "smallModel");
  const hasAnalysisModelPatch = Object.prototype.hasOwnProperty.call(patch, "analysisModel");
  const hasImageModelPatch = Object.prototype.hasOwnProperty.call(patch, "imageModel");
  const hasImageGenerationModelPatch = Object.prototype.hasOwnProperty.call(patch, "imageGenerationModel");
  const routedProfiles = getEnabledProfiles(profiles);
  const modelOwners = getRoutedModelOptionsForProfiles(routedProfiles);
  const findOwnerId = (modelName: string | undefined): string | undefined => {
    const normalized = modelName?.trim();
    return normalized
      ? modelOwners.find((option) => option.value === normalized)?.profileId
      : undefined;
  };
  const mainOwnerId = hasModelPatch ? findOwnerId(patch.model) : state.routedProfileIds[0];
  const roleOwnerId = mainOwnerId ?? state.routedProfileIds[0];
  const imageOwnerId = hasImageModelPatch ? findOwnerId(patch.imageModel) : undefined;
  const imageGenerationOwnerId = hasImageGenerationModelPatch ? findOwnerId(patch.imageGenerationModel) : undefined;

  const nextProfiles = profiles.map((profile) => {
    if (!routedIds.has(profile.id)) {
      return profile;
    }

    const locallyManagedModels = new Set(getAvailableModels(profile));
    const fallbackModel = locallyManagedModels.values().next().value ?? "";

    return {
      ...profile,
      model: resolveRequiredLocalSlot(
        profile.model,
        patch.model,
        hasModelPatch && profile.id === mainOwnerId,
        locallyManagedModels,
        fallbackModel,
      ),
      expertModel: resolveRequiredLocalSlot(
        profile.expertModel,
        patch.expertModel,
        hasExpertModelPatch && profile.id === roleOwnerId,
        locallyManagedModels,
        fallbackModel,
      ),
      smallModel: resolveRequiredLocalSlot(
        profile.smallModel,
        patch.smallModel,
        hasSmallModelPatch && profile.id === roleOwnerId,
        locallyManagedModels,
        fallbackModel,
      ),
      analysisModel: resolveRequiredLocalSlot(
        profile.analysisModel,
        patch.analysisModel,
        hasAnalysisModelPatch && profile.id === roleOwnerId,
        locallyManagedModels,
        fallbackModel,
      ),
      imageModel: hasImageModelPatch
        ? profile.id === imageOwnerId ? patch.imageModel?.trim() || undefined : undefined
        : retainOptionalLocalSlot(profile.imageModel, locallyManagedModels),
      imageGenerationModel: hasImageGenerationModelPatch
        ? profile.id === imageGenerationOwnerId ? patch.imageGenerationModel?.trim() || undefined : undefined
        : retainOptionalLocalSlot(profile.imageGenerationModel, locallyManagedModels),
    };
  });

  if (!hasModelPatch || !mainOwnerId) {
    return nextProfiles;
  }
  return promoteEnabledProfile(nextProfiles, mainOwnerId);
}

function promoteEnabledProfile(profiles: ApiConfigProfile[], profileId: string): ApiConfigProfile[] {
  const enabledProfiles = profiles.filter((profile) => profile.enabled);
  const ownerIndex = enabledProfiles.findIndex((profile) => profile.id === profileId);
  if (ownerIndex <= 0) {
    return profiles;
  }

  const [owner] = enabledProfiles.splice(ownerIndex, 1);
  enabledProfiles.unshift(owner);
  let enabledIndex = 0;
  return profiles.map((profile) => profile.enabled ? enabledProfiles[enabledIndex++] : profile);
}

function resolveRequiredLocalSlot(
  currentValue: string | undefined,
  requestedValue: string | undefined,
  hasPatch: boolean,
  locallyManagedModels: Set<string>,
  fallbackModel: string,
): string {
  const current = currentValue?.trim() ?? "";
  const requested = requestedValue?.trim() ?? "";
  if (hasPatch && requested && locallyManagedModels.has(requested)) {
    return requested;
  }
  return locallyManagedModels.has(current) ? current : fallbackModel;
}

function retainOptionalLocalSlot(
  currentValue: string | undefined,
  locallyManagedModels: Set<string>,
): string | undefined {
  const current = currentValue?.trim() ?? "";
  return locallyManagedModels.has(current) ? current : undefined;
}

function pickAvailableModel(model: string | undefined, availableModels: string[]): string {
  const normalized = model?.trim();
  return normalized && availableModels.includes(normalized) ? normalized : "";
}

function pickFirstConfiguredSlotModel(
  profiles: ApiConfigProfile[],
  slot: "imageModel" | "imageGenerationModel",
  availableModels: string[],
): string {
  for (const profile of profiles) {
    const picked = pickAvailableModel(profile[slot], availableModels);
    if (picked) {
      return picked;
    }
  }
  return "";
}
