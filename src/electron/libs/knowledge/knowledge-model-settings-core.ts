import type { ApiConfig } from "../config-store.js";
import type {
  EmbeddingModelSettings,
  KnowledgeModelSettings,
  WikiModelSettings,
} from "./knowledge-types.js";

const DEFAULT_EMBEDDING_DIMENSION = 1536;
const DEFAULT_EMBEDDING_BATCH_SIZE = 16;
const DEFAULT_WIKI_MAX_INPUT_TOKENS = 16_000;
const DEFAULT_WIKI_MAX_OUTPUT_TOKENS = 4_000;

const KNOWN_EMBEDDING_DIMENSIONS: Array<{ pattern: RegExp; dimension: number }> = [
  { pattern: /qwen3-embedding-0\.6b/i, dimension: 1024 },
  { pattern: /qwen3-embedding-4b/i, dimension: 2560 },
  { pattern: /qwen3-embedding-8b/i, dimension: 4096 },
  { pattern: /text-embedding-3-small/i, dimension: 1536 },
  { pattern: /text-embedding-3-large/i, dimension: 3072 },
];

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

function resolveEmbeddingDimension(model: string, configured: number | undefined): number {
  const known = KNOWN_EMBEDDING_DIMENSIONS.find((entry) => entry.pattern.test(model));
  if (known) return known.dimension;
  return normalizePositiveInteger(configured, DEFAULT_EMBEDDING_DIMENSION);
}

function isUsableProfile(profile: ApiConfig): boolean {
  return Boolean(profile.enabled && profile.apiKey.trim() && profile.baseURL.trim());
}

function isCodexProfile(profile: ApiConfig): boolean {
  if (profile.provider === "codex") {
    return true;
  }
  try {
    return new URL(profile.baseURL).hostname === "chatgpt.com";
  } catch {
    return false;
  }
}

function pickKnowledgeProfile(
  profiles: ApiConfig[],
  modelField: "embeddingModel" | "wikiModel",
): ApiConfig | undefined {
  const withModel = profiles.filter((profile) => profile[modelField]?.trim());
  return withModel.find((profile) => !isCodexProfile(profile)) ?? withModel[0];
}

function normalizeCostTier(value: string | undefined): WikiModelSettings["costTier"] {
  if (value === "free" || value === "cheap" || value === "standard") {
    return value;
  }
  return "cheap";
}

function isLikelyEmbeddingModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return (
    normalized.includes("embedding") ||
    normalized.startsWith("bge-") ||
    normalized.startsWith("gte-") ||
    normalized.startsWith("m3e-") ||
    normalized.startsWith("e5-")
  );
}

function pickWikiGenerationModel(profile: ApiConfig): string {
  const configuredWikiModel = profile.wikiModel?.trim() || "";
  if (configuredWikiModel && !isLikelyEmbeddingModel(configuredWikiModel)) {
    return configuredWikiModel;
  }

  return (
    [
      profile.smallModel,
      profile.analysisModel,
      profile.model,
      profile.expertModel,
    ]
      .map((model) => model?.trim() || "")
      .find((model) => model && !isLikelyEmbeddingModel(model)) ?? configuredWikiModel
  );
}

export function resolveKnowledgeModelSettingsFromProfiles(profiles: ApiConfig[]): KnowledgeModelSettings {
  const usableProfiles = profiles.filter(isUsableProfile);
  const embeddingProfile = pickKnowledgeProfile(usableProfiles, "embeddingModel");
  const wikiProfile = pickKnowledgeProfile(usableProfiles, "wikiModel");
  const wikiModel = wikiProfile ? pickWikiGenerationModel(wikiProfile) : "";

  const embedding: EmbeddingModelSettings | undefined = embeddingProfile?.embeddingModel?.trim()
    ? {
        profileId: embeddingProfile.id,
        profileName: embeddingProfile.name,
        apiKey: embeddingProfile.apiKey.trim(),
        baseURL: embeddingProfile.baseURL.replace(/\/$/, ""),
        model: embeddingProfile.embeddingModel.trim(),
        dimension: resolveEmbeddingDimension(embeddingProfile.embeddingModel.trim(), embeddingProfile.embeddingDimension),
        batchSize: Math.min(
          128,
          normalizePositiveInteger(embeddingProfile.embeddingBatchSize, DEFAULT_EMBEDDING_BATCH_SIZE),
        ),
      }
    : undefined;

  const wiki: WikiModelSettings | undefined = wikiProfile && wikiModel
    ? {
        profileId: wikiProfile.id,
        profileName: wikiProfile.name,
        apiKey: wikiProfile.apiKey.trim(),
        baseURL: wikiProfile.baseURL.replace(/\/$/, ""),
        model: wikiModel,
        costTier: normalizeCostTier(wikiProfile.wikiModelCostTier),
        maxInputTokens: normalizePositiveInteger(wikiProfile.wikiModelMaxInputTokens, DEFAULT_WIKI_MAX_INPUT_TOKENS),
        maxOutputTokens: normalizePositiveInteger(wikiProfile.wikiModelMaxOutputTokens, DEFAULT_WIKI_MAX_OUTPUT_TOKENS),
      }
    : undefined;

  return { embedding, wiki };
}
