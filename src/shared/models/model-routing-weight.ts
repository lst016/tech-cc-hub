import { areModelNamesEquivalent } from "./model-provider-routing.js";

export type WeightedModelConfig = {
  name: string;
  routingWeight?: number;
  catalogStatus?: string;
};

export type WeightedModelConfigOwner = {
  models?: readonly WeightedModelConfig[];
};

export const DEFAULT_MODEL_ROUTING_WEIGHT = 0;

export type AssignedModelOwner = WeightedModelConfigOwner & {
  model?: string;
  expertModel?: string;
  smallModel?: string;
  analysisModel?: string;
  imageModel?: string;
  imageGenerationModel?: string;
};

const MODEL_ROUTE_SLOT_KEYS = [
  "model",
  "expertModel",
  "smallModel",
  "analysisModel",
  "imageModel",
  "imageGenerationModel",
] as const;

/** The catalog is a selection pool; automatic routing only uses assigned slots. */
export function getAssignedModelNames(owner: AssignedModelOwner): string[] {
  const slotNames = MODEL_ROUTE_SLOT_KEYS
    .map((slot) => owner[slot]?.trim())
    .filter((name): name is string => Boolean(name));
  const catalog = owner.models ?? [];
  const hasDeclaredCatalog = catalog.some((model) => Boolean(model.name.trim()));

  return Array.from(new Set(slotNames)).filter((slotName) => {
    if (!hasDeclaredCatalog) {
      return true;
    }

    const catalogModel = catalog.find((model) => model.name.trim() === slotName)
      ?? catalog.find((model) => areModelNamesEquivalent(model.name, slotName));
    return Boolean(catalogModel && catalogModel.catalogStatus !== "excluded");
  });
}

export function findMatchingModelName(
  owner: WeightedModelConfigOwner,
  modelName: string,
): string | undefined {
  const targetName = modelName.trim();
  if (!targetName) {
    return undefined;
  }

  const exactMatch = owner.models?.find((model) => model.name.trim() === targetName);
  if (exactMatch) {
    return exactMatch.name.trim();
  }

  return owner.models?.find((model) => areModelNamesEquivalent(model.name, targetName))?.name.trim();
}

export function normalizeModelRoutingWeight(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);
  return normalized >= DEFAULT_MODEL_ROUTING_WEIGHT ? normalized : undefined;
}

export function getModelRoutingWeight(owner: WeightedModelConfigOwner, modelName: string): number {
  const targetName = modelName.trim();
  if (!targetName) {
    return DEFAULT_MODEL_ROUTING_WEIGHT;
  }

  return (owner.models ?? [])
    .filter((model) => areModelNamesEquivalent(model.name, targetName))
    .reduce(
      (weight, model) => Math.max(
        weight,
        normalizeModelRoutingWeight(model.routingWeight) ?? DEFAULT_MODEL_ROUTING_WEIGHT,
      ),
      DEFAULT_MODEL_ROUTING_WEIGHT,
    );
}

export function pickHighestWeightedModelOwner<T extends WeightedModelConfigOwner>(
  owners: readonly T[],
  modelName: string,
  isRoutable: (owner: T, modelName: string) => boolean,
): T | undefined {
  const normalizedModel = modelName.trim();
  if (!normalizedModel) {
    return undefined;
  }

  let selected: { owner: T; weight: number } | undefined;
  for (const owner of owners) {
    if (!isRoutable(owner, normalizedModel)) {
      continue;
    }

    const weight = getModelRoutingWeight(owner, normalizedModel);
    if (!selected || weight > selected.weight) {
      selected = { owner, weight };
    }
  }

  return selected?.owner;
}
