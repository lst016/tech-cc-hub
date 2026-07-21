import type { ApiConfigProfile } from "../../types.js";
import { areModelNamesEquivalent } from "../../../shared/models/model-provider-routing.js";
import {
  getAvailableModels,
  getAvailableModelsForProfiles,
  getEnabledProfiles,
  getImageGenerationModelsForProfiles,
  getImageUnderstandingModelsForProfiles,
  getRoutedModelOptionsForProfiles,
  type RoutedModelOption,
} from "./settings-utils.js";

export type ModelSlotPatch = Partial<Pick<ApiConfigProfile, "model" | "expertModel" | "smallModel" | "analysisModel" | "imageModel" | "imageGenerationModel">>;

export type SharedModelRoutingState = {
  routedProfileIds: string[];
  routedProfileNames: string[];
  enabledCount: number;
  availableModels: string[];
  roleModels: string[];
  roleModelOptions: RoutedModelOption[];
  analysisModels: string[];
  analysisModelOptions: RoutedModelOption[];
  roleProfileId: string;
  roleProfileName: string;
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
  const mainModel = pickAvailableModel(primaryProfile?.model, availableModels) || availableModels[0] || "";
  const roleProfiles = mainModel
    ? routedProfiles.filter((profile) => findLocalModelName(profile, mainModel))
    : primaryProfile ? [primaryProfile] : [];
  const routedRoleModelOptions = getRoutedModelOptionsForProfiles(roleProfiles);
  const primaryRoleModelOptions = primaryProfile
    ? getRoutedModelOptionsForProfiles([primaryProfile])
    : [];
  const roleModelOptions = routedRoleModelOptions.map((option) => (
    primaryRoleModelOptions.find((primaryOption) => areModelNamesEquivalent(primaryOption.value, option.value))
    ?? option
  ));
  const roleModels = roleModelOptions.map((option) => option.value);
  const allRoutedModelOptions = getRoutedModelOptionsForProfiles(routedProfiles);
  const analysisModelOptions = routedRoleModelOptions.map((option) => (
    allRoutedModelOptions.find((routedOption) => areModelNamesEquivalent(routedOption.value, option.value))
    ?? option
  ));
  const analysisModels = analysisModelOptions.map((option) => option.value);

  return {
    routedProfileIds: routedProfiles.map((profile) => profile.id),
    routedProfileNames: routedProfiles.map((profile) => profile.name || "未命名配置"),
    enabledCount,
    availableModels,
    roleModels,
    roleModelOptions,
    analysisModels,
    analysisModelOptions,
    roleProfileId: primaryProfile?.id ?? "",
    roleProfileName: primaryProfile?.name?.trim() || "未命名配置",
    imageUnderstandingModels: getImageUnderstandingModelsForProfiles(routedProfiles),
    imageGenerationModels: getImageGenerationModelsForProfiles(routedProfiles),
    mainModel,
    expertModel: pickAvailableModel(primaryProfile?.expertModel, roleModels) || mainModel,
    smallModel: pickAvailableModel(primaryProfile?.smallModel, roleModels) || mainModel,
    analysisModel: pickAvailableModel(primaryProfile?.analysisModel, analysisModels) || mainModel,
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
  const requestedRoleModels = [
    hasExpertModelPatch ? patch.expertModel : undefined,
    hasSmallModelPatch ? patch.smallModel : undefined,
    hasAnalysisModelPatch ? patch.analysisModel : undefined,
  ].map((model) => model?.trim()).filter((model): model is string => Boolean(model));
  const hasRolePatch = requestedRoleModels.length > 0;
  const nextMainModel = (hasModelPatch ? patch.model : state.mainModel)?.trim() || state.mainModel;
  const roleOwnerId = hasRolePatch
    ? findRoleOwnerId(routedProfiles, nextMainModel, requestedRoleModels, mainOwnerId ?? state.roleProfileId)
    : mainOwnerId ?? state.roleProfileId;
  const routeOwnerId = hasRolePatch ? roleOwnerId : mainOwnerId;
  const switchingRoleProfile = hasRolePatch && Boolean(roleOwnerId) && roleOwnerId !== state.roleProfileId;
  const imageOwnerId = hasImageModelPatch ? findOwnerId(patch.imageModel) : undefined;
  const imageGenerationOwnerId = hasImageGenerationModelPatch ? findOwnerId(patch.imageGenerationModel) : undefined;

  const nextProfiles = profiles.map((profile) => {
    if (!routedIds.has(profile.id)) {
      return profile;
    }

    const isRouteOwner = Boolean(routeOwnerId) && profile.id === routeOwnerId;
    const isRoleOwner = Boolean(roleOwnerId) && profile.id === roleOwnerId;

    return {
      ...profile,
      model: isRouteOwner ? findLocalModelName(profile, nextMainModel) ?? profile.model : profile.model,
      expertModel: resolveRoleSlot(profile, profile.expertModel, state.expertModel, patch.expertModel, hasExpertModelPatch, isRoleOwner, switchingRoleProfile),
      smallModel: resolveRoleSlot(profile, profile.smallModel, state.smallModel, patch.smallModel, hasSmallModelPatch, isRoleOwner, switchingRoleProfile),
      analysisModel: resolveRoleSlot(profile, profile.analysisModel, state.analysisModel, patch.analysisModel, hasAnalysisModelPatch, isRoleOwner, switchingRoleProfile),
      imageModel: hasImageModelPatch
        ? profile.id === imageOwnerId ? patch.imageModel?.trim() || undefined : undefined
        : profile.imageModel,
      imageGenerationModel: hasImageGenerationModelPatch
        ? profile.id === imageGenerationOwnerId ? patch.imageGenerationModel?.trim() || undefined : undefined
        : profile.imageGenerationModel,
    };
  });

  if (!routeOwnerId) {
    return nextProfiles;
  }
  return promoteEnabledProfile(nextProfiles, routeOwnerId);
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

function findRoleOwnerId(
  profiles: ApiConfigProfile[],
  mainModel: string,
  roleModels: string[],
  preferredProfileId: string | undefined,
): string | undefined {
  const eligibleProfiles = profiles.filter((profile) => (
    Boolean(findLocalModelName(profile, mainModel))
    && roleModels.every((model) => Boolean(findLocalModelName(profile, model)))
  ));
  const preferredProfile = eligibleProfiles.find((profile) => profile.id === preferredProfileId);
  if (preferredProfile) {
    return preferredProfile.id;
  }
  const routedOwnerId = getRoutedModelOptionsForProfiles(eligibleProfiles)
    .find((option) => areModelNamesEquivalent(option.value, roleModels[0] ?? ""))
    ?.profileId;
  return routedOwnerId ?? eligibleProfiles[0]?.id;
}

function resolveRoleSlot(
  profile: ApiConfigProfile,
  currentValue: string | undefined,
  visibleValue: string,
  requestedValue: string | undefined,
  hasPatch: boolean,
  isRoleOwner: boolean,
  switchingRoleProfile: boolean,
): string | undefined {
  if (!isRoleOwner) {
    return currentValue;
  }
  if (hasPatch) {
    return findLocalModelName(profile, requestedValue) ?? currentValue;
  }
  if (switchingRoleProfile) {
    return findLocalModelName(profile, visibleValue) ?? currentValue;
  }
  return currentValue;
}

function findLocalModelName(profile: ApiConfigProfile, modelName: string | undefined): string | undefined {
  const normalized = modelName?.trim();
  if (!normalized) {
    return undefined;
  }
  return getAvailableModels(profile).find((model) => areModelNamesEquivalent(model, normalized));
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
