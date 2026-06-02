import { isModelCompatibleWithApiProvider, type SharedApiProviderMode } from "./model-provider-routing.js";
import { pickHighestWeightedModelOwner } from "./model-routing-weight.js";

export type ImagePreprocessRouteConfig = {
  id?: string;
  provider?: SharedApiProviderMode;
  imageModel?: string;
  models?: Array<{
    name: string;
    routingWeight?: number;
  }>;
};

export function pickImagePreprocessConfig<T extends ImagePreprocessRouteConfig>(
  selectedConfig: T | null | undefined,
  enabledConfigs: readonly T[],
  imageModel: string | null | undefined,
): T | null {
  const normalizedImageModel = imageModel?.trim();
  if (!normalizedImageModel) {
    return selectedConfig ?? enabledConfigs[0] ?? null;
  }

  const orderedConfigs = orderSelectedConfigFirst(selectedConfig, enabledConfigs);
  const routedOwner = pickHighestWeightedModelOwner(
    orderedConfigs,
    normalizedImageModel,
    (config, targetModel) => getRoutableImageModelNames(config).includes(targetModel),
  );
  if (routedOwner) {
    return routedOwner;
  }

  return orderedConfigs.find((config) => config.imageModel?.trim() === normalizedImageModel)
    ?? orderedConfigs.find((config) => config.models?.some((model) => model.name.trim() === normalizedImageModel))
    ?? selectedConfig
    ?? enabledConfigs[0]
    ?? null;
}

function orderSelectedConfigFirst<T extends ImagePreprocessRouteConfig>(
  selectedConfig: T | null | undefined,
  enabledConfigs: readonly T[],
): T[] {
  if (!selectedConfig) {
    return [...enabledConfigs];
  }

  const selectedId = selectedConfig.id?.trim();
  const matchesSelected = (config: T) => (
    selectedId
      ? config.id?.trim() === selectedId
      : config === selectedConfig
  );

  return [
    selectedConfig,
    ...enabledConfigs.filter((config) => !matchesSelected(config)),
  ];
}

function getRoutableImageModelNames(config: ImagePreprocessRouteConfig): string[] {
  return Array.from(new Set([
    config.imageModel,
    ...(config.models ?? []).map((model) => model.name),
  ]
    .map((model) => model?.trim())
    .filter((model): model is string => Boolean(model))
    .filter((model) => isModelCompatibleWithApiProvider(config.provider, model))));
}
