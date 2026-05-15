import {
  loadApiConfigSettings,
  type ApiConfig,
} from "../config-store.js";
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

function normalizeCostTier(value: string | undefined): WikiModelSettings["costTier"] {
  if (value === "free" || value === "cheap" || value === "standard") {
    return value;
  }
  return "cheap";
}

export function resolveKnowledgeModelSettings(): KnowledgeModelSettings {
  const profiles = loadApiConfigSettings().profiles.filter(isUsableProfile);
  const embeddingProfile = profiles.find((profile) => profile.embeddingModel?.trim());
  const wikiProfile = profiles.find((profile) => profile.wikiModel?.trim());

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

  const wiki: WikiModelSettings | undefined = wikiProfile?.wikiModel?.trim()
    ? {
        profileId: wikiProfile.id,
        profileName: wikiProfile.name,
        apiKey: wikiProfile.apiKey.trim(),
        baseURL: wikiProfile.baseURL.replace(/\/$/, ""),
        model: wikiProfile.wikiModel.trim(),
        costTier: normalizeCostTier(wikiProfile.wikiModelCostTier),
        maxInputTokens: normalizePositiveInteger(wikiProfile.wikiModelMaxInputTokens, DEFAULT_WIKI_MAX_INPUT_TOKENS),
        maxOutputTokens: normalizePositiveInteger(wikiProfile.wikiModelMaxOutputTokens, DEFAULT_WIKI_MAX_OUTPUT_TOKENS),
      }
    : undefined;

  return { embedding, wiki };
}

export function assertEmbeddingConfigured(settings = resolveKnowledgeModelSettings()): EmbeddingModelSettings {
  if (!settings.embedding) {
    throw new Error("Knowledge Engine 未启用：请先在模型设置里配置向量模型 embeddingModel。");
  }
  return settings.embedding;
}
