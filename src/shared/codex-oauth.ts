export const CODEX_OAUTH_BASE_URL = "https://chatgpt.com";
export const CODEX_OAUTH_COMPACT_MODEL_SUFFIX = "-openai-compact";
export const CODEX_OAUTH_DEFAULT_MODEL = "gpt-5.5";
export const CODEX_OAUTH_SMALL_MODEL = "gpt-5.3-codex-spark";
export const CODEX_OAUTH_STORED_CREDENTIAL = "__tech_cc_hub_codex_oauth_stored__";

const CODEX_BASE_MODELS = [
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark",
  "gpt-5.2",
  "gpt-5",
  "gpt-5-codex",
  "gpt-5-codex-mini",
  "gpt-5.1",
  "gpt-5.1-codex",
  "gpt-5.1-codex-max",
  "gpt-5.1-codex-mini",
  "gpt-5.2-codex",
] as const;

export function withCodexCompactModelSuffix(models: readonly string[]): string[] {
  const normalizedModels = normalizeCodexBaseModelIds(models);
  return Array.from(new Set([
    ...normalizedModels,
    ...normalizedModels.map((model) => `${model}${CODEX_OAUTH_COMPACT_MODEL_SUFFIX}`),
  ]));
}

function normalizeCodexBaseModelIds(models: readonly string[]): string[] {
  return Array.from(new Set(models
    .map((model) => model.trim())
    .filter(Boolean)
    .map((model) => (
      model.endsWith(CODEX_OAUTH_COMPACT_MODEL_SUFFIX)
        ? model.slice(0, -CODEX_OAUTH_COMPACT_MODEL_SUFFIX.length)
        : model
    ))));
}

export function extractCodexModelIdsFromCache(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) {
    return [];
  }

  return Array.from(new Set(models
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const slug = (item as { slug?: unknown }).slug;
      const visibility = (item as { visibility?: unknown }).visibility;
      if (visibility === "hide") return "";
      return typeof slug === "string" ? slug.trim() : "";
    })
    .filter(Boolean)));
}

export function mergeCodexModelIds(modelIds: readonly string[]): string[] {
  const fallbackModels = [...CODEX_BASE_MODELS];
  const fallbackModelSet = new Set<string>(fallbackModels);
  const cacheModels = normalizeCodexBaseModelIds(modelIds);
  const newerCacheModels = cacheModels.filter((model) => !fallbackModelSet.has(model));

  return withCodexCompactModelSuffix([
    ...newerCacheModels,
    ...fallbackModels,
    ...cacheModels,
  ]);
}

export const CODEX_OAUTH_MODELS = mergeCodexModelIds([]);
