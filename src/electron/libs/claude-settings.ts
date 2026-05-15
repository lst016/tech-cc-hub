import { existsSync, readFileSync, realpathSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { spawnSync } from "child_process";
import {
  CODEX_OAUTH_DEFAULT_MODEL,
  CODEX_OAUTH_SMALL_MODEL,
} from "../../shared/codex-oauth.js";
import {
  isModelCompatibleWithApiProvider,
  pickProviderCompatibleModel,
} from "../../shared/model-provider-routing.js";
import {
  loadApiConfigSettings,
  loadGlobalRuntimeConfig,
  type ApiConfig,
  type ApiModelConfig,
  type GlobalRuntimeConfig,
} from "./config-store.js";
import { app } from "electron";
import { getCodexAnthropicProxyBaseURL } from "./codex-anthropic-proxy.js";

function isUsableConfig(config: ApiConfig | null | undefined): config is ApiConfig {
  return Boolean(
    config?.apiKey?.trim() &&
    config.baseURL?.trim() &&
    config.model?.trim(),
  );
}

function getEnabledUsableApiConfigs(): ApiConfig[] {
  return loadApiConfigSettings().profiles.filter((profile) => profile.enabled && isUsableConfig(profile));
}

function resolveSystemClaudePath(): string | null {
  const candidates = [
    process.env.CLAUDE_CODE_PATH,
    process.env.CLAUDE_PATH,
    ...getPathsFromEnvironment(),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    join(homedir(), ".local/bin/claude"),
    join(homedir(), ".volta/bin/claude"),
    join(homedir(), ".volta/tools/image/node/22.22.1/bin/claude"),
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()));

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const resolvedPath = resolveNativeClaudePath(candidate);
    if (resolvedPath) {
      return resolvedPath;
    }
  }

  const result = spawnSync("which", ["claude"], {
    encoding: "utf8",
    env: process.env,
  });

  if (result.status === 0) {
    const path = result.stdout.trim();
    if (path && existsSync(path)) {
      const resolvedPath = resolveNativeClaudePath(path);
      if (resolvedPath) {
        return resolvedPath;
      }
    }
  }

  return null;
}

function getPathsFromEnvironment(): string[] {
  const pathValue = process.env.PATH ?? "";
  return pathValue
    .split(":")
    .filter(Boolean)
    .map((entry) => join(entry, "claude"));
}

function resolveNativeClaudePath(candidatePath: string): string | null {
  try {
    const realPath = realpathSync(candidatePath);
    if (
      candidatePath.includes("/.volta/bin/") ||
      realPath.includes("/.volta/bin/") ||
      realPath.endsWith("/volta-shim")
    ) {
      return null;
    }

    return candidatePath;
  } catch {
    return null;
  }
}

function resolveSdkBundledClaudePath(): string | null {
  const basePath = app.isPackaged
    ? join(process.resourcesPath, "app.asar.unpacked/node_modules")
    : join(app.getAppPath(), "node_modules");

  const candidates = [
    join(basePath, "@anthropic-ai/claude-agent-sdk-darwin-arm64/claude"),
    join(basePath, "@anthropic-ai/claude-agent-sdk-darwin-x64/claude"),
    join(basePath, "@anthropic-ai/claude-agent-sdk-linux-arm64/claude"),
    join(basePath, "@anthropic-ai/claude-agent-sdk-linux-x64/claude"),
    join(basePath, "@anthropic-ai/claude-agent-sdk-linux-arm64-musl/claude"),
    join(basePath, "@anthropic-ai/claude-agent-sdk-linux-x64-musl/claude"),
    join(basePath, "@anthropic-ai/claude-agent-sdk-win32-arm64/claude.exe"),
    join(basePath, "@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

// Get Claude Code executable path
export function getClaudeCodePath(): string | undefined {
  const explicitPath = process.env.CLAUDE_CODE_PATH;
  if (explicitPath && existsSync(explicitPath)) {
    return explicitPath;
  }

  return resolveSystemClaudePath() ?? resolveSdkBundledClaudePath() ?? undefined;
}

// 获取当前有效的配置（优先界面配置，回退到文件配置）
export function getCurrentApiConfig(): ApiConfig | null {
  const uiConfig = getEnabledUsableApiConfigs()[0] ?? null;
  if (isUsableConfig(uiConfig)) {
    return uiConfig;
  }

  return getFallbackClaudeSettingsConfig();
}

export function getConfiguredModelNames(config: ApiConfig): string[] {
  return Array.from(new Set([
    config.model,
    config.expertModel,
    config.smallModel,
    config.imageModel,
    config.analysisModel,
    config.embeddingModel,
    config.wikiModel,
    ...(config.models ?? []).map((item) => item.name),
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

export function getRoutableModelNames(config: ApiConfig): string[] {
  return getConfiguredModelNames(config)
    .filter((modelName) => isModelCompatibleWithApiProvider(config.provider, modelName));
}

export function getApiConfigForModel(modelName?: string): ApiConfig | null {
  const normalizedModel = modelName?.trim();
  const enabledConfigs = getEnabledUsableApiConfigs();

  if (!normalizedModel) {
    return enabledConfigs[0] ?? getFallbackClaudeSettingsConfig();
  }

  const matchedConfig = enabledConfigs.find((config) => getRoutableModelNames(config).includes(normalizedModel));
  if (matchedConfig) {
    return matchedConfig;
  }

  const fallbackConfig = getFallbackClaudeSettingsConfig();
  return fallbackConfig && getRoutableModelNames(fallbackConfig).includes(normalizedModel)
    ? fallbackConfig
    : null;
}

export type ResolvedApiConfigForModel = {
  config: ApiConfig;
  model: string;
  requestedModel?: string;
  fellBack: boolean;
};

export function resolveApiConfigForModel(modelName?: string): ResolvedApiConfigForModel | null {
  const defaultConfig = getCurrentApiConfig();
  if (!defaultConfig) {
    return null;
  }

  const requestedModel = modelName?.trim() || defaultConfig.model;
  const matchedConfig = getApiConfigForModel(requestedModel);
  if (matchedConfig) {
    const model = normalizeModelForApiConfig(matchedConfig, requestedModel, matchedConfig.model);
    return {
      config: matchedConfig,
      model,
      requestedModel,
      fellBack: model !== requestedModel,
    };
  }

  const model = normalizeModelForApiConfig(defaultConfig, defaultConfig.model, defaultConfig.model);
  return {
    config: defaultConfig,
    model,
    requestedModel,
    fellBack: Boolean(requestedModel && requestedModel !== model),
  };
}

export function resolveImagePreprocessApiConfig(selectedModel?: string): ApiConfig | null {
  const selectedConfig = resolveApiConfigForModel(selectedModel)?.config ?? getCurrentApiConfig();
  const imageModel = selectedConfig?.imageModel?.trim();
  if (!imageModel) {
    return selectedConfig;
  }

  const imageModelConfigs = getEnabledUsableApiConfigs().filter((config) => {
    return config.imageModel?.trim() === imageModel
      || config.models?.some((model) => model.name.trim() === imageModel);
  });

  return imageModelConfigs.find((config) => config.provider !== "codex")
    ?? imageModelConfigs[0]
    ?? selectedConfig;
}

function getFallbackClaudeSettingsConfig(): ApiConfig | null {
  // 回退到 ~/.claude/settings.json
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    const raw = readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as { env?: Record<string, unknown> };
    if (parsed.env) {
      const authToken = parsed.env.ANTHROPIC_AUTH_TOKEN;
      const baseURL = parsed.env.ANTHROPIC_BASE_URL;
      const model = parsed.env.ANTHROPIC_MODEL;

      if (authToken && baseURL && model) {
        const config: ApiConfig = {
          id: crypto.randomUUID(),
          name: "默认配置",
          apiKey: String(authToken),
          baseURL: String(baseURL),
          model: String(model),
          expertModel: String(model),
          smallModel: String(model),
          analysisModel: String(model),
          embeddingModel: undefined,
          embeddingDimension: 1536,
          embeddingBatchSize: 16,
          wikiModel: undefined,
          wikiModelCostTier: "cheap",
          wikiModelMaxInputTokens: 16_000,
          wikiModelMaxOutputTokens: 4_000,
          models: [{ name: String(model), compressionThresholdPercent: 70 }],
          enabled: true,
          provider: "custom",
          apiType: "anthropic"
        };
        return config;
      }
    }
  } catch {
    // Ignore missing or invalid settings file.
  }

  return null;
}

export function getGlobalRuntimeConfig(): GlobalRuntimeConfig {
  return loadGlobalRuntimeConfig();
}

export function buildEnvForConfig(config: ApiConfig, modelOverride?: string): Record<string, string> {
  const baseEnv = { ...process.env } as Record<string, string>;
  const selectedModel = normalizeModelForApiConfig(config, modelOverride ?? config.model, config.model);
  const smallModel = normalizeSmallModelForApiConfig(
    config,
    config.smallModel?.trim() || config.analysisModel?.trim() || selectedModel,
    selectedModel,
  );
  const modelEnv = buildClaudeCodeModelEnv(selectedModel, smallModel);
  const nonEssentialTrafficEnv = buildClaudeCodeNonEssentialTrafficEnv();
  const anthropicAuthToken = config.provider === "codex" ? "codex-oauth" : config.apiKey;
  const anthropicBaseURL = config.provider === "codex"
    ? getCodexAnthropicProxyBaseURL(config.id)
    : normalizeAnthropicBaseUrlForClaudeCode(config.baseURL);

  baseEnv.ANTHROPIC_AUTH_TOKEN = anthropicAuthToken;
  baseEnv.ANTHROPIC_BASE_URL = anthropicBaseURL;
  Object.assign(baseEnv, modelEnv);

  const runtimeEnv = buildGlobalRuntimeEnvConfig();
  return {
    ...baseEnv,
    ...runtimeEnv,
    ANTHROPIC_AUTH_TOKEN: anthropicAuthToken,
    ANTHROPIC_BASE_URL: anthropicBaseURL,
    ...modelEnv,
    ...nonEssentialTrafficEnv,
  };
}

export function normalizeModelForApiConfig(
  config: ApiConfig,
  modelName: string | undefined,
  fallbackModel = config.model,
): string {
  const providerFallbackModel = getProviderDefaultModel(config, "main");
  return (
    pickProviderCompatibleModel(config.provider, modelName, fallbackModel) ||
    pickProviderCompatibleModel(config.provider, providerFallbackModel, config.model) ||
    modelName?.trim() ||
    config.model
  );
}

function normalizeSmallModelForApiConfig(
  config: ApiConfig,
  modelName: string | undefined,
  selectedModel: string,
): string {
  const providerFallbackModel = getProviderDefaultModel(config, "small") || selectedModel;
  return (
    pickProviderCompatibleModel(config.provider, modelName, providerFallbackModel) ||
    pickProviderCompatibleModel(config.provider, selectedModel, config.model) ||
    selectedModel
  );
}

function getProviderDefaultModel(config: ApiConfig, slot: "main" | "small"): string {
  if (config.provider === "codex") {
    return slot === "small" ? CODEX_OAUTH_SMALL_MODEL : CODEX_OAUTH_DEFAULT_MODEL;
  }

  if (config.provider === "deepseek") {
    return "deepseek-v4-flash";
  }

  return config.model;
}

function buildClaudeCodeNonEssentialTrafficEnv(): Record<string, string> {
  return {
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    DISABLE_AUTOUPDATER: "1",
    DISABLE_BUG_COMMAND: "1",
    DISABLE_ERROR_REPORTING: "1",
    DISABLE_TELEMETRY: "1",
  };
}

function buildClaudeCodeModelEnv(mainModel: string, smallModel: string): Record<string, string> {
  return {
    ANTHROPIC_MODEL: mainModel,
    ANTHROPIC_DEFAULT_MODEL: mainModel,
    ANTHROPIC_DEFAULT_SONNET_MODEL: mainModel,
    ANTHROPIC_DEFAULT_OPUS_MODEL: mainModel,
    ANTHROPIC_REASONING_MODEL: mainModel,
    CLAUDE_CODE_SUBAGENT_MODEL: mainModel,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: smallModel,
    ANTHROPIC_SMALL_FAST_MODEL: smallModel,
    CLAUDE_CODE_SMALL_FAST_MODEL: smallModel,
  };
}

export function getClaudeCodeModelOption(config: ApiConfig, modelName: string | undefined): string | undefined {
  const normalizedModel = modelName?.trim();
  if (!normalizedModel) {
    return undefined;
  }

  try {
    const url = new URL(config.baseURL);
    if (url.hostname === "api.anthropic.com") {
      return normalizedModel;
    }
  } catch {
    // Invalid URLs are handled later by the SDK/network path.
  }

  // For custom Anthropic-compatible gateways, let ANTHROPIC_MODEL carry the
  // provider-specific model name. Passing it as --model makes Claude Code apply
  // its own model availability validation before the request reaches the gateway.
  return undefined;
}

export function normalizeAnthropicBaseUrlForClaudeCode(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/v1$/i, "");
}

export function getGlobalRuntimeEnvConfig(): Record<string, string> {
  return buildGlobalRuntimeEnvConfig();
}

function buildGlobalRuntimeEnvConfig(): Record<string, string> {
  const config = loadGlobalRuntimeConfig();
  const env = isRecord(config?.env) ? config.env : null;
  if (!env) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!isUsableEnvKey(key)) {
      continue;
    }
    const normalizedValue = toEnvValue(value);
    if (normalizedValue == null) {
      continue;
    }
    result[key] = normalizedValue;
  }

  return result;
}

function isUsableEnvKey(name: unknown): name is string {
  if (typeof name !== "string") {
    return false;
  }

  const normalized = name.trim();
  if (!normalized) {
    return false;
  }

  return /^([A-Z_][A-Z0-9_]*)$/i.test(normalized) && !normalized.toUpperCase().startsWith("ANTHROPIC_");
}

function toEnvValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getModelConfig(config: ApiConfig, modelName = config.model): ApiModelConfig | null {
  const targetName = modelName.trim();
  if (!targetName) {
    return null;
  }

  const existing = config.models?.find((item) => item.name === targetName);
  return (
    existing ?? {
      name: targetName,
    }
  );
}

export function supportsRemoteSessionResume(config: ApiConfig): boolean {
  try {
    const url = new URL(config.baseURL);
    return url.hostname === "api.anthropic.com";
  } catch {
    return false;
  }
}
