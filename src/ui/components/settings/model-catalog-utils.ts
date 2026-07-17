import type { ApiConfigProfile, ApiModelConfigProfile } from "../../types.js";
import { DEFAULT_MODEL_ROUTING_WEIGHT } from "../../../shared/models/model-routing-weight.js";
import { isLikelyImageUnderstandingModel } from "../../../shared/models/model-capabilities.js";

export type ModelCapability =
  | "text"
  | "reasoning"
  | "image-understanding"
  | "image-generation"
  | "embedding"
  | "rerank"
  | "audio";

export type ModelRouteSlot =
  | "model"
  | "expertModel"
  | "smallModel"
  | "analysisModel"
  | "imageModel"
  | "imageGenerationModel";

export type ModelRouteState = "assigned" | "available" | "excluded" | "gateway-disabled";

export type ModelCatalogEntry = {
  key: string;
  profileId: string;
  profileName: string;
  provider: ApiConfigProfile["provider"];
  gatewayEnabled: boolean;
  modelName: string;
  alias?: string;
  ownedBy?: string;
  supportedEndpointTypes: string[];
  protocols: string[];
  capabilities: ModelCapability[];
  capabilitiesInferred: boolean;
  createdAt?: number;
  contextWindow?: number;
  compressionThresholdPercent?: number;
  routingWeight: number;
  catalogStatus: "managed" | "excluded";
  managed: boolean;
  tags: string[];
  notes?: string;
  routeSlots: ModelRouteSlot[];
  routeState: ModelRouteState;
};

export type ModelCatalogFilters = {
  query?: string;
  profileId?: string;
  ownedBy?: string;
  capability?: ModelCapability | "";
  managed?: boolean;
  catalogStatus?: ModelCatalogEntry["catalogStatus"] | "";
};

export type ModelCatalogEntryPatch = Pick<ApiModelConfigProfile,
  "alias" | "tags" | "notes" | "contextWindow" | "compressionThresholdPercent" | "routingWeight" | "catalogStatus"
>;

const ROUTE_SLOTS: ModelRouteSlot[] = [
  "model",
  "expertModel",
  "smallModel",
  "analysisModel",
  "imageModel",
  "imageGenerationModel",
];

const PROTOCOL_ENDPOINT_TYPES = new Set(["anthropic", "openai", "openai-response", "gemini"]);

export function createModelDeploymentKey(profileId: string, modelName: string): string {
  return `${profileId}\0${modelName}`;
}

export function getModelCatalogStatus(model: ApiModelConfigProfile): ModelCatalogEntry["catalogStatus"] {
  return model.catalogStatus === "excluded" ? "excluded" : "managed";
}

export function inferModelCapabilities(model: Pick<ApiModelConfigProfile, "name" | "supportedEndpointTypes">): ModelCapability[] {
  const endpoints = (model.supportedEndpointTypes ?? []).map((endpoint) => endpoint.toLowerCase());
  if (endpoints.length > 0) {
    const capabilities: ModelCapability[] = [];
    if (endpoints.some((endpoint) => endpoint === "image-generation" || endpoint === "images")) {
      capabilities.push("image-generation");
    }
    if (endpoints.some((endpoint) => endpoint === "vision" || endpoint === "multimodal" || endpoint === "image-understanding")) {
      capabilities.push("image-understanding");
    }
    if (endpoints.some((endpoint) => endpoint.includes("embed"))) capabilities.push("embedding");
    if (endpoints.some((endpoint) => endpoint.includes("rerank"))) capabilities.push("rerank");
    if (endpoints.some((endpoint) => endpoint.includes("audio") || endpoint.includes("speech") || endpoint.includes("tts"))) {
      capabilities.push("audio");
    }
    if (capabilities.length > 0) return capabilities;
  }

  const name = model.name.toLowerCase();
  if (/(^|[/_-])(embed|embedding)([/_-]|$)/.test(name)) return ["embedding"];
  if (/(^|[/_-])rerank([/_-]|$)/.test(name)) return ["rerank"];
  if (/(^|[/_-])(tts|speech|audio)([/_-]|$)/.test(name)) return ["audio"];
  if (/(gpt-image|dall-?e|stable-diffusion|(^|[/_-])flux([/_-]|$)|image-gen)/.test(name)) return ["image-generation"];
  if (isLikelyImageUnderstandingModel(name)) return ["image-understanding"];
  if (/(reasoner|reasoning|deepseek-r1|(^|[/_-])o[134]([/_-]|$))/.test(name)) return ["reasoning"];
  return ["text"];
}

export function buildModelCatalogEntries(profiles: ApiConfigProfile[]): ModelCatalogEntry[] {
  return profiles.flatMap((profile) => (profile.models ?? [])
    .filter((model) => Boolean(model.name.trim()))
    .map((model) => {
      const modelName = model.name.trim();
      const supportedEndpointTypes = model.supportedEndpointTypes ?? [];
      const catalogStatus = getModelCatalogStatus(model);
      const routeSlots = ROUTE_SLOTS.filter((slot) => profile[slot]?.trim() === modelName);
      return {
        key: createModelDeploymentKey(profile.id, modelName),
        profileId: profile.id,
        profileName: profile.name.trim() || "未命名网关",
        provider: profile.provider,
        gatewayEnabled: profile.enabled,
        modelName,
        alias: model.alias,
        ownedBy: model.ownedBy,
        supportedEndpointTypes,
        protocols: supportedEndpointTypes.filter((endpoint) => PROTOCOL_ENDPOINT_TYPES.has(endpoint.toLowerCase())),
        capabilities: inferModelCapabilities(model),
        capabilitiesInferred: !hasExplicitCapabilityMetadata(supportedEndpointTypes),
        createdAt: model.createdAt,
        contextWindow: model.contextWindow,
        compressionThresholdPercent: model.compressionThresholdPercent,
        routingWeight: model.routingWeight ?? DEFAULT_MODEL_ROUTING_WEIGHT,
        catalogStatus,
        managed: catalogStatus === "managed",
        tags: model.tags ?? [],
        notes: model.notes,
        routeSlots,
        routeState: !profile.enabled
          ? "gateway-disabled"
          : catalogStatus === "excluded"
            ? "excluded"
            : routeSlots.length > 0 ? "assigned" : "available",
      } satisfies ModelCatalogEntry;
    }));
}

function hasExplicitCapabilityMetadata(endpointTypes: string[]): boolean {
  return endpointTypes.some((endpoint) => {
    const normalized = endpoint.toLowerCase();
    return normalized === "image-generation"
      || normalized === "images"
      || normalized === "vision"
      || normalized === "multimodal"
      || normalized === "image-understanding"
      || normalized.includes("embed")
      || normalized.includes("rerank")
      || normalized.includes("audio")
      || normalized.includes("speech")
      || normalized.includes("tts");
  });
}

export function filterModelCatalogEntries(entries: ModelCatalogEntry[], filters: ModelCatalogFilters): ModelCatalogEntry[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const ownedBy = filters.ownedBy?.trim().toLowerCase() ?? "";
  return entries.filter((entry) => {
    if (query && ![
      entry.modelName,
      entry.alias,
      entry.profileName,
      entry.ownedBy,
      ...entry.tags,
    ].some((value) => value?.toLowerCase().includes(query))) return false;
    if (filters.profileId && entry.profileId !== filters.profileId) return false;
    if (ownedBy && entry.ownedBy?.toLowerCase() !== ownedBy) return false;
    if (filters.capability && !entry.capabilities.includes(filters.capability)) return false;
    if (typeof filters.managed === "boolean" && entry.managed !== filters.managed) return false;
    if (filters.catalogStatus && entry.catalogStatus !== filters.catalogStatus) return false;
    return true;
  });
}

export function applyModelCatalogBulkAction(
  profiles: ApiConfigProfile[],
  keys: string[],
  action: "manage" | "exclude",
): { profiles: ApiConfigProfile[]; blockedKeys: string[] } {
  const selected = new Set(keys);
  const blockedKeys: string[] = [];
  const entries = new Map(buildModelCatalogEntries(profiles).map((entry) => [entry.key, entry] as const));

  if (action === "exclude") {
    for (const key of keys) {
      if ((entries.get(key)?.routeSlots.length ?? 0) > 0) blockedKeys.push(key);
    }
  }
  const blocked = new Set(blockedKeys);

  const nextProfiles = profiles.map((profile) => {
    let changed = false;
    const models = (profile.models ?? []).map((model) => {
      const key = createModelDeploymentKey(profile.id, model.name.trim());
      if (!selected.has(key) || blocked.has(key)) return model;
      const catalogStatus: ApiModelConfigProfile["catalogStatus"] = action === "manage" ? "managed" : "excluded";
      if (model.catalogStatus === catalogStatus) return model;
      changed = true;
      return { ...model, catalogStatus };
    });
    return changed ? { ...profile, models } : profile;
  });

  return { profiles: nextProfiles, blockedKeys };
}

export function updateModelCatalogEntry(
  profiles: ApiConfigProfile[],
  key: string,
  patch: Partial<ModelCatalogEntryPatch>,
): ApiConfigProfile[] {
  return profiles.map((profile) => {
    let changed = false;
    const models = (profile.models ?? []).map((model) => {
      if (createModelDeploymentKey(profile.id, model.name.trim()) !== key) return model;
      const next = { ...model };
      if (Object.prototype.hasOwnProperty.call(patch, "alias")) next.alias = normalizeTextPatch(patch.alias, model.alias);
      if (Object.prototype.hasOwnProperty.call(patch, "tags")) next.tags = normalizeTagsPatch(patch.tags, model.tags);
      if (Object.prototype.hasOwnProperty.call(patch, "notes")) next.notes = normalizeTextPatch(patch.notes, model.notes);
      if (Object.prototype.hasOwnProperty.call(patch, "contextWindow")) {
        next.contextWindow = normalizePositiveIntegerPatch(patch.contextWindow, model.contextWindow);
      }
      if (Object.prototype.hasOwnProperty.call(patch, "compressionThresholdPercent")) {
        next.compressionThresholdPercent = normalizePercentPatch(patch.compressionThresholdPercent, model.compressionThresholdPercent);
      }
      if (Object.prototype.hasOwnProperty.call(patch, "routingWeight")) {
        next.routingWeight = normalizeRoutingWeightPatch(patch.routingWeight, model.routingWeight);
      }
      if (Object.prototype.hasOwnProperty.call(patch, "catalogStatus")) next.catalogStatus = patch.catalogStatus;
      changed = true;
      return next;
    });
    return changed ? { ...profile, models } : profile;
  });
}

export function normalizeModelCatalogTextDraft(value: string): string | undefined {
  return value.trim() || undefined;
}

export function normalizeModelCatalogTagsDraft(value: string): string[] | undefined {
  return normalizeTagsPatch(value.split(/[,，]/), undefined);
}

function normalizeTextPatch(value: string | undefined, fallback: string | undefined): string | undefined {
  if (value === undefined) return fallback;
  return normalizeModelCatalogTextDraft(value);
}

function normalizeTagsPatch(value: string[] | undefined, fallback: string[] | undefined): string[] | undefined {
  if (value === undefined) return fallback;
  const tags = Array.from(new Set(value.map((tag) => tag.trim()).filter(Boolean)));
  return tags.length > 0 ? tags : undefined;
}

function normalizePositiveIntegerPatch(value: number | undefined, fallback: number | undefined): number | undefined {
  if (value === undefined) return fallback;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

function normalizePercentPatch(value: number | undefined, fallback: number | undefined): number | undefined {
  if (value === undefined) return fallback;
  return Number.isFinite(value) && value >= 1 && value <= 100 ? Math.floor(value) : undefined;
}

function normalizeRoutingWeightPatch(value: number | undefined, fallback: number | undefined): number | undefined {
  if (value === undefined) return fallback;
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.floor(value))) : undefined;
}
