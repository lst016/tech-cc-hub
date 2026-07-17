import type { ApiConfigProfile, ApiModelConfigProfile } from "../types.js";

export const MODEL_CATALOG_UPDATED_EVENT = "techcc:model-catalog-updated";

export type UiModelCatalogAddedModel = {
  profileId: string;
  profileName: string;
  modelName: string;
  model: ApiModelConfigProfile;
};

export type UiModelCatalogUpdatedPayload = {
  addedModels: UiModelCatalogAddedModel[];
  syncedAt: number;
};

export function mergeAutoSyncedModelsIntoDraft(
  profiles: readonly ApiConfigProfile[],
  addedModels: readonly UiModelCatalogAddedModel[],
): ApiConfigProfile[] {
  const additionsByProfileId = new Map<string, UiModelCatalogAddedModel[]>();
  for (const addition of addedModels) {
    const additions = additionsByProfileId.get(addition.profileId) ?? [];
    additions.push(addition);
    additionsByProfileId.set(addition.profileId, additions);
  }

  return profiles.map((profile) => {
    const additions = additionsByProfileId.get(profile.id);
    if (!additions?.length) return profile;

    const models = [...(profile.models ?? [])];
    const names = new Set(models.map((model) => model.name));
    for (const addition of additions) {
      if (names.has(addition.modelName)) continue;
      models.push({ ...addition.model, catalogStatus: "managed" });
      names.add(addition.modelName);
    }
    return models.length === (profile.models?.length ?? 0)
      ? profile
      : { ...profile, models };
  });
}
