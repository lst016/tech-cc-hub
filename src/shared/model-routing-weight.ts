export type WeightedModelConfig = {
  name: string;
  routingWeight?: number;
};

export type WeightedModelConfigOwner = {
  models?: readonly WeightedModelConfig[];
};

export const DEFAULT_MODEL_ROUTING_WEIGHT = 0;

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

  let weight = DEFAULT_MODEL_ROUTING_WEIGHT;
  for (const model of owner.models ?? []) {
    if (model.name.trim() !== targetName) {
      continue;
    }

    weight = Math.max(
      weight,
      normalizeModelRoutingWeight(model.routingWeight) ?? DEFAULT_MODEL_ROUTING_WEIGHT,
    );
  }

  return weight;
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
