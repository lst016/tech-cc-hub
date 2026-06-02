import { CODEX_OAUTH_COMPACT_MODEL_SUFFIX } from "../codex-oauth.js";

export type SharedApiProviderMode = "custom" | "deepseek" | "codex" | "minimax";

export function isCodexModelName(modelName: string): boolean {
  const normalized = stripCodexCompactSuffix(modelName).toLowerCase();
  return /^gpt-5(?:[.-]|$)/.test(normalized) || /(?:^|[._-])codex(?:[._-]|$)/.test(normalized);
}

export function isDeepSeekModelName(modelName: string): boolean {
  return modelName.trim().toLowerCase().includes("deepseek");
}

export function isMiniMaxModelName(modelName: string): boolean {
  return modelName.trim().toLowerCase().includes("minimax");
}

export function isModelCompatibleWithApiProvider(
  provider: SharedApiProviderMode | undefined,
  modelName: string,
): boolean {
  const normalized = modelName.trim();
  if (!normalized) {
    return false;
  }

  if (provider === "codex") {
    return isCodexModelName(normalized);
  }

  if (provider === "deepseek") {
    return isDeepSeekModelName(normalized);
  }

  if (provider === "minimax") {
    return isMiniMaxModelName(normalized);
  }

  return true;
}

export function pickProviderCompatibleModel(
  provider: SharedApiProviderMode | undefined,
  primaryModel: string | undefined,
  fallbackModel: string | undefined,
): string {
  const primary = primaryModel?.trim();
  if (primary && isModelCompatibleWithApiProvider(provider, primary)) {
    return primary;
  }

  const fallback = fallbackModel?.trim();
  if (fallback && isModelCompatibleWithApiProvider(provider, fallback)) {
    return fallback;
  }

  return "";
}

export function normalizeProviderModelName(
  provider: SharedApiProviderMode | undefined,
  modelName: string,
): string {
  const normalized = modelName.trim();
  if (!normalized) {
    return "";
  }

  if (provider === "deepseek" && isDeepSeekModelName(normalized)) {
    return normalized.toLowerCase();
  }

  return normalized;
}

function stripCodexCompactSuffix(modelName: string): string {
  const normalized = modelName.trim();
  return normalized.endsWith(CODEX_OAUTH_COMPACT_MODEL_SUFFIX)
    ? normalized.slice(0, -CODEX_OAUTH_COMPACT_MODEL_SUFFIX.length)
    : normalized;
}
