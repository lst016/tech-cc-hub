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

export function resolveImagePreprocessRouteConfig<T extends ImagePreprocessRouteConfig>(
  selectedConfig: T | null | undefined,
  enabledConfigs: readonly T[],
): T | null {
  const imageModel = selectedConfig?.imageModel?.trim()
    || enabledConfigs.find((config) => config.imageModel?.trim())?.imageModel?.trim();

  return pickImagePreprocessConfig(selectedConfig, enabledConfigs, imageModel);
}

export function pickImagePreprocessConfig<T extends ImagePreprocessRouteConfig>(
  selectedConfig: T | null | undefined,
  enabledConfigs: readonly T[],
  imageModel: string | null | undefined,
): T | null {
  const normalizedImageModel = imageModel?.trim();
  if (!normalizedImageModel) {
    return getUsableImageModelName(selectedConfig)
      ? selectedConfig ?? null
      : enabledConfigs.find((config) => getUsableImageModelName(config)) ?? null;
  }

  const orderedConfigs = orderSelectedConfigFirst(selectedConfig, enabledConfigs);
  const matchingConfigs = orderedConfigs.filter((config) => getUsableImageModelName(config) === normalizedImageModel);
  const routedOwner = pickHighestWeightedModelOwner(
    matchingConfigs,
    normalizedImageModel,
    (config, targetModel) => getRoutableImageModelNames(config).includes(targetModel),
  );
  if (routedOwner) {
    return routedOwner;
  }

  return matchingConfigs[0] ?? null;
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

function getUsableImageModelName(config: ImagePreprocessRouteConfig | null | undefined): string | null {
  const imageModel = config?.imageModel?.trim();
  if (!imageModel || !isModelCompatibleWithApiProvider(config?.provider, imageModel)) {
    return null;
  }
  return imageModel;
}
