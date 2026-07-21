import { existsSync, readFileSync, realpathSync } from "fs";
import { delimiter, join } from "path";
import { homedir } from "os";
import { spawnSync } from "child_process";
import type { Settings } from "@anthropic-ai/claude-agent-sdk";
import {
  CODEX_OAUTH_DEFAULT_MODEL,
  CODEX_OAUTH_SMALL_MODEL,
} from "../../../shared/codex-oauth.js";
import {
  MINIMAX_DEFAULT_MODEL,
  MINIMAX_SMALL_MODEL,
} from "../../../shared/models/minimax.js";
import { CLAUDE_AGENT_TEAMS_MIN_CLAUDE_CODE_VERSION } from "../../../shared/claude-agent-teams.js";
import {
  isModelCompatibleWithApiProvider,
  normalizeProviderModelName,
  pickProviderCompatibleModel,
} from "../../../shared/models/model-provider-routing.js";
import { resolveImagePreprocessRouteConfig } from "../../../shared/models/image-preprocess-routing.js";
import {
  findMatchingModelName,
  getAssignedModelNames,
  pickHighestWeightedModelOwner,
} from "../../../shared/models/model-routing-weight.js";
import {
  isUnreadableStoredCodexCredential,
  loadApiConfigSettings,
  loadGlobalRuntimeConfig,
  type ApiConfig,
  type ApiModelConfig,
  type GlobalRuntimeConfig,
} from "../config-store.js";
import { app } from "electron";
import { getCodexAnthropicProxyBaseURL } from "../codex/codex-anthropic-proxy.js";
import {
  getAnthropicCompatProxyBaseURL,
} from "../anthropic/anthropic-compat-proxy.js";
import { shouldUseAnthropicCompatProxy } from "../anthropic/anthropic-compat.js";

const CLAUDE_CODE_OPUS_MODEL_OVERRIDE_KEYS = [
  "opus",
  "claude-opus-4",
  "claude-opus-4-0",
  "claude-opus-4-1",
  "claude-opus-4-5",
  "claude-opus-4-6",
  "claude-opus-4-7",
];

function isUsableConfig(config: ApiConfig | null | undefined): config is ApiConfig {
  return Boolean(
    config?.apiKey?.trim() &&
    !(config.provider === "codex" && isUnreadableStoredCodexCredential(config.apiKey)) &&
    config.baseURL?.trim() &&
    config.model?.trim(),
  );
}

export function getEnabledUsableApiConfigs(): ApiConfig[] {
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

  const result = spawnSync(process.platform === "win32" ? "where.exe" : "which", ["claude"], {
    encoding: "utf8",
    env: process.env,
  });

  if (result.status === 0) {
    for (const executablePath of result.stdout.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)) {
      const resolvedPath = resolveNativeClaudePath(executablePath);
      if (resolvedPath) {
        return resolvedPath;
      }
    }
  }

  return null;
}

function getPathsFromEnvironment(): string[] {
  const pathValue = process.env.PATH ?? "";
  const executableNames = process.platform === "win32"
    ? ["claude.exe", "claude.cmd", "claude.bat", "claude"]
    : ["claude"];
  return pathValue
    .split(delimiter)
    .filter(Boolean)
    .flatMap((entry) => executableNames.map((name) => join(entry, name)));
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

type ResolveSdkBundledClaudePathOptions = {
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  isPackaged?: boolean;
  appPath?: string;
  resourcesPath?: string;
  exists?: (path: string) => boolean;
};

function getSdkBundledClaudePackageNames(
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
): string[] {
  if (platform === "darwin" && (arch === "arm64" || arch === "x64")) {
    return [`@anthropic-ai/claude-agent-sdk-darwin-${arch}`];
  }
  if (platform === "win32" && (arch === "arm64" || arch === "x64")) {
    return [`@anthropic-ai/claude-agent-sdk-win32-${arch}`];
  }
  if (platform === "linux" && (arch === "arm64" || arch === "x64")) {
    return [
      `@anthropic-ai/claude-agent-sdk-linux-${arch}`,
      `@anthropic-ai/claude-agent-sdk-linux-${arch}-musl`,
    ];
  }
  return [];
}

export function resolveSdkBundledClaudePath(options: ResolveSdkBundledClaudePathOptions = {}): string | null {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const packageNames = getSdkBundledClaudePackageNames(platform, arch);
  if (packageNames.length === 0) {
    return null;
  }

  const isPackaged = options.isPackaged ?? app.isPackaged;
  const basePath = isPackaged
    ? join(options.resourcesPath ?? process.resourcesPath, "app.asar.unpacked/node_modules")
    : join(options.appPath ?? app.getAppPath(), "node_modules");
  const executableName = platform === "win32" ? "claude.exe" : "claude";
  const exists = options.exists ?? existsSync;

  return packageNames
    .map((packageName) => join(basePath, packageName, executableName))
    .find((candidate) => exists(candidate)) ?? null;
}

const claudeCodeAgentTeamsSupportCache = new Map<string, boolean>();

function supportsClaudeCodeAgentTeams(candidatePath: string): boolean {
  const cached = claudeCodeAgentTeamsSupportCache.get(candidatePath);
  if (cached !== undefined) {
    return cached;
  }

  const version = readClaudeCodeVersion(candidatePath);
  const supported = version ? compareSemver(version, CLAUDE_AGENT_TEAMS_MIN_CLAUDE_CODE_VERSION) >= 0 : false;
  claudeCodeAgentTeamsSupportCache.set(candidatePath, supported);
  return supported;
}

function readClaudeCodeVersion(candidatePath: string): string | null {
  const result = spawnSync(candidatePath, ["--version"], {
    encoding: "utf8",
    env: process.env,
    timeout: 3000,
  });
  if (result.status !== 0) {
    return null;
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const match = output.match(/(\d+\.\d+\.\d+)/);
  return match?.[1] ?? null;
}

function compareSemver(left: string, right: string): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  for (let index = 0; index < 3; index += 1) {
    const diff = leftParts[index] - rightParts[index];
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function parseSemver(version: string): [number, number, number] {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  return [
    Number.isFinite(parts[0]) ? parts[0] : 0,
    Number.isFinite(parts[1]) ? parts[1] : 0,
    Number.isFinite(parts[2]) ? parts[2] : 0,
  ];
}

// Get Claude Code executable path
export function getClaudeCodePath(): string | undefined {
  const explicitPath = process.env.CLAUDE_CODE_PATH?.trim();
  if (explicitPath) {
    return explicitPath;
  }

  // CLAUDE_PATH predates CLAUDE_CODE_PATH and is still an explicit operator
  // override. Keep it ahead of the SDK-bundled binary for compatibility.
  const legacyExplicitPath = process.env.CLAUDE_PATH?.trim();
  if (legacyExplicitPath) {
    return legacyExplicitPath;
  }

  const systemPath = resolveSystemClaudePath();
  const bundledPath = resolveSdkBundledClaudePath();
  // The SDK control protocol evolves together with its bundled CLI. Prefer the
  // matching binary so new message/control fields cannot be paired with an
  // older system installation. CLAUDE_CODE_PATH/CLAUDE_PATH remain explicit overrides.
  return bundledPath
    ?? (systemPath && supportsClaudeCodeAgentTeams(systemPath) ? systemPath : undefined)
    ?? systemPath
    ?? undefined;
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
  const modelsByName = new Map((config.models ?? [])
    .map((model) => [model.name.trim(), model] as const)
    .filter(([name]) => Boolean(name)));
  const isManagedModelName = (value: string | undefined): boolean => {
    const name = value?.trim();
    if (!name) return false;
    const model = modelsByName.get(name);
    return model ? model.catalogStatus !== "excluded" : modelsByName.size === 0;
  };
  return Array.from(new Set([
    isManagedModelName(config.model) ? config.model : undefined,
    isManagedModelName(config.expertModel) ? config.expertModel : undefined,
    isManagedModelName(config.smallModel) ? config.smallModel : undefined,
    isManagedModelName(config.imageModel) ? config.imageModel : undefined,
    isManagedModelName(config.imageGenerationModel) ? config.imageGenerationModel : undefined,
    isManagedModelName(config.analysisModel) ? config.analysisModel : undefined,
    ...(config.models ?? [])
      .filter((model) => model.catalogStatus !== "excluded")
      .map((item) => item.name),
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

export function getRoutableModelNames(config: ApiConfig): string[] {
  return getAssignedModelNames(config)
    .filter((modelName) => isModelCompatibleWithApiProvider(config.provider, modelName));
}

function findRoutableModelName(config: ApiConfig, modelName: string): string | undefined {
  return findMatchingModelName(
    { models: getRoutableModelNames(config).map((name) => ({ name })) },
    modelName,
  );
}

function findConfiguredModelName(config: ApiConfig, modelName: string): string | undefined {
  return findMatchingModelName(
    { models: getConfiguredModelNames(config).map((name) => ({ name })) },
    modelName,
  );
}

export function getApiConfigForModel(modelName?: string, configProfileId?: string): ApiConfig | null {
  const normalizedModel = modelName?.trim();
  const normalizedProfileId = configProfileId?.trim();
  const enabledConfigs = getEnabledUsableApiConfigs();

  if (normalizedProfileId) {
    const explicitConfig = enabledConfigs.find((config) => config.id === normalizedProfileId);
    if (!explicitConfig) {
      return null;
    }
    if (!normalizedModel) {
      return explicitConfig;
    }
    return findConfiguredModelName(explicitConfig, normalizedModel)
      ? explicitConfig
      : null;
  }

  if (!normalizedModel) {
    return enabledConfigs[0] ?? getFallbackClaudeSettingsConfig();
  }

  const isAssignedModel = enabledConfigs.some((config) => Boolean(findRoutableModelName(config, normalizedModel)));
  const matchedConfig = isAssignedModel
    ? pickHighestWeightedModelOwner(
      enabledConfigs,
      normalizedModel,
      (config, targetModel) => (
        isModelCompatibleWithApiProvider(config.provider, targetModel)
        && Boolean(findConfiguredModelName(config, targetModel))
      ),
    )
    : undefined;
  if (matchedConfig) {
    return matchedConfig;
  }

  const fallbackConfig = getFallbackClaudeSettingsConfig();
  return fallbackConfig && Boolean(findRoutableModelName(fallbackConfig, normalizedModel))
    ? fallbackConfig
    : null;
}

export type ResolvedApiConfigForModel = {
  config: ApiConfig;
  model: string;
  requestedModel?: string;
  fellBack: boolean;
};

export function resolveApiConfigForModel(modelName?: string, configProfileId?: string): ResolvedApiConfigForModel | null {
  const normalizedProfileId = configProfileId?.trim();
  const explicitConfig = normalizedProfileId
    ? getApiConfigForModel(undefined, normalizedProfileId)
    : null;
  if (normalizedProfileId && !explicitConfig) {
    return null;
  }
  const defaultConfig = explicitConfig ?? getCurrentApiConfig();
  if (!defaultConfig) {
    return null;
  }

  const requestedModel = modelName?.trim() || defaultConfig.model;
  const matchedConfig = getApiConfigForModel(requestedModel, normalizedProfileId);
  if (matchedConfig) {
    const routedModel = findRoutableModelName(matchedConfig, requestedModel) ?? requestedModel;
    const model = normalizeModelForApiConfig(matchedConfig, routedModel, matchedConfig.model);
    return {
      config: matchedConfig,
      model,
      requestedModel,
      fellBack: model !== requestedModel,
    };
  }

  if (normalizedProfileId) {
    return null;
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
  const enabledConfigs = getEnabledUsableApiConfigs();
  return resolveImagePreprocessRouteConfig(selectedConfig, enabledConfigs);
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
  const apiEnv = buildClaudeCodeSettingsEnv(config, modelOverride ?? config.model);
  Object.assign(baseEnv, apiEnv);

  const runtimeEnv = buildGlobalRuntimeEnvConfig();
  return {
    ...baseEnv,
    ...runtimeEnv,
    ...apiEnv,
  };
}

export function normalizeModelForApiConfig(
  config: ApiConfig,
  modelName: string | undefined,
  fallbackModel = config.model,
): string {
  const providerFallbackModel = getProviderDefaultModel(config, "main");
  const locallyNamedModel = modelName ? findConfiguredModelName(config, modelName) : undefined;
  const locallyNamedFallback = fallbackModel ? findConfiguredModelName(config, fallbackModel) : undefined;
  const selected = (
    pickProviderCompatibleModel(config.provider, locallyNamedModel ?? modelName, locallyNamedFallback ?? fallbackModel) ||
    pickProviderCompatibleModel(config.provider, providerFallbackModel, config.model) ||
    modelName?.trim() ||
    config.model
  );
  return normalizeProviderModelName(config.provider, selected);
}

function normalizeSmallModelForApiConfig(
  config: ApiConfig,
  modelName: string | undefined,
  selectedModel: string,
): string {
  const providerFallbackModel = getProviderDefaultModel(config, "small") || selectedModel;
  return (
    pickProviderOwnedModelForApiConfig(config, modelName, providerFallbackModel) ||
    pickProviderOwnedModelForApiConfig(config, selectedModel, config.model) ||
    selectedModel
  );
}

function normalizeExpertModelForApiConfig(
  config: ApiConfig,
  modelName: string | undefined,
  selectedModel: string,
): string {
  return (
    pickProviderOwnedModelForApiConfig(config, modelName, selectedModel) ||
    pickProviderOwnedModelForApiConfig(config, config.expertModel, selectedModel) ||
    selectedModel
  );
}

function pickProviderOwnedModelForApiConfig(
  config: ApiConfig,
  modelName: string | undefined,
  fallbackModel: string | undefined,
): string | null {
  const pickedModel = pickProviderCompatibleModel(config.provider, modelName, fallbackModel);
  if (!pickedModel) {
    return null;
  }

  const routedOwner = getApiConfigForModel(pickedModel, config.id);
  return routedOwner?.id === config.id
    ? findRoutableModelName(config, pickedModel) ?? pickedModel
    : null;
}

function getProviderDefaultModel(config: ApiConfig, slot: "main" | "small"): string {
  if (config.provider === "codex") {
    return slot === "small" ? CODEX_OAUTH_SMALL_MODEL : CODEX_OAUTH_DEFAULT_MODEL;
  }

  if (config.provider === "deepseek") {
    return "deepseek-v4-flash";
  }

  if (config.provider === "minimax") {
    return slot === "small" ? MINIMAX_SMALL_MODEL : MINIMAX_DEFAULT_MODEL;
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

function buildClaudeCodeAttributionHeaderEnv(anthropicBaseURL: string): Record<string, string> {
  if (!shouldSuppressClaudeCodeAttributionHeader(anthropicBaseURL)) {
    return {};
  }

  // Claude Code 2.1.x can prepend x-anthropic-billing-header into the system
  // prompt; third-party Anthropic-compatible gateways should not see it.
  return { CLAUDE_CODE_ATTRIBUTION_HEADER: "0" };
}

function shouldSuppressClaudeCodeAttributionHeader(anthropicBaseURL: string): boolean {
  try {
    return new URL(anthropicBaseURL).hostname !== "api.anthropic.com";
  } catch {
    return true;
  }
}

function buildClaudeCodeModelEnv(mainModel: string, expertModel: string, smallModel: string): Record<string, string> {
  return {
    ANTHROPIC_MODEL: mainModel,
    ANTHROPIC_DEFAULT_MODEL: mainModel,
    ANTHROPIC_DEFAULT_SONNET_MODEL: mainModel,
    ANTHROPIC_DEFAULT_OPUS_MODEL: expertModel,
    ANTHROPIC_REASONING_MODEL: expertModel,
    CLAUDE_CODE_SUBAGENT_MODEL: mainModel,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: smallModel,
    ANTHROPIC_SMALL_FAST_MODEL: smallModel,
    CLAUDE_CODE_SMALL_FAST_MODEL: smallModel,
  };
}

function buildClaudeCodeOpusModelOverrides(expertModel: string): Record<string, string> {
  return Object.fromEntries(
    CLAUDE_CODE_OPUS_MODEL_OVERRIDE_KEYS.map((modelName) => [modelName, expertModel]),
  );
}

export function getClaudeCodeExpertModel(config: ApiConfig, modelName: string | undefined): string {
  const selectedModel = normalizeModelForApiConfig(config, modelName?.trim() || config.model, config.model);
  return normalizeExpertModelForApiConfig(
    config,
    config.expertModel?.trim() || selectedModel,
    selectedModel,
  );
}

export function buildClaudeCodeModelSettings(config: ApiConfig, modelName: string | undefined): Settings {
  const selectedModel = normalizeModelForApiConfig(config, modelName?.trim() || config.model, config.model);
  const expertModel = getClaudeCodeExpertModel(config, selectedModel);

  return {
    model: selectedModel,
    modelOverrides: buildClaudeCodeOpusModelOverrides(expertModel),
    env: buildClaudeCodeSettingsEnv(config, selectedModel),
  };
}

function buildClaudeCodeSettingsEnv(config: ApiConfig, modelName: string | undefined): Record<string, string> {
  const selectedModel = normalizeModelForApiConfig(config, modelName?.trim() || config.model, config.model);
  const expertModel = normalizeExpertModelForApiConfig(
    config,
    config.expertModel?.trim() || selectedModel,
    selectedModel,
  );
  const smallModel = normalizeSmallModelForApiConfig(
    config,
    config.smallModel?.trim() || config.analysisModel?.trim() || selectedModel,
    selectedModel,
  );
  const anthropicAuthToken = config.provider === "codex" ? "codex-oauth" : config.apiKey;
  const anthropicBaseURL = config.provider === "codex"
    ? getCodexAnthropicProxyBaseURL(config.id)
    : shouldUseAnthropicCompatProxy(config)
      ? getAnthropicCompatProxyBaseURL(config.id)
    : normalizeAnthropicBaseUrlForClaudeCode(config.baseURL);

  return {
    ANTHROPIC_AUTH_TOKEN: anthropicAuthToken,
    ANTHROPIC_BASE_URL: anthropicBaseURL,
    ...buildClaudeCodeModelEnv(selectedModel, expertModel, smallModel),
    ...buildClaudeCodeNonEssentialTrafficEnv(),
    ...buildClaudeCodeAttributionHeaderEnv(anthropicBaseURL),
  };
}

export function getClaudeCodeModelOption(config: ApiConfig, modelName: string | undefined): string | undefined {
  const normalizedModel = modelName?.trim();
  if (!normalizedModel) {
    return undefined;
  }

  void config;

  // Claude Code 2.1.x can ignore environment-only default model overrides for
  // custom Anthropic-compatible gateways and fall back to its own Opus default.
  // Always pass the selected model through the SDK so the spawned CLI receives
  // an explicit --model value.
  return normalizedModel;
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
  // Claude Code resume is keyed by the SDK/CLI session, not by the upstream API host.
  return Boolean(config.baseURL?.trim());
}
