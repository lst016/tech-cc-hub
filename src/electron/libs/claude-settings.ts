import { existsSync, readFileSync, realpathSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { spawnSync } from "child_process";
import {
  loadApiConfigSettings,
  loadGlobalRuntimeConfig,
  saveApiConfigSettings,
  type ApiConfig,
  type ApiModelConfig,
  type GlobalRuntimeConfig,
} from "./config-store.js";
import { app } from "electron";

function isUsableConfig(config: ApiConfig | null | undefined): config is ApiConfig {
  return Boolean(
    config?.apiKey?.trim() &&
    config.baseURL?.trim() &&
    config.model?.trim(),
  );
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
  const uiConfig = loadApiConfigSettings().profiles.find((profile) => profile.enabled) ?? null;
  if (isUsableConfig(uiConfig)) {
    return uiConfig;
  }

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
          analysisModel: String(model),
          models: [{ name: String(model), compressionThresholdPercent: 70 }],
          enabled: true,
          apiType: "anthropic"
        };
        // 持久化到 api-config.json
        try {
          saveApiConfigSettings({ profiles: [config] });
        } catch (e) {
          console.error("[claude-settings] Failed to persist config:", e);
        }
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
  const selectedModel = modelOverride ?? config.model;

  baseEnv.ANTHROPIC_AUTH_TOKEN = config.apiKey;
  baseEnv.ANTHROPIC_BASE_URL = normalizeAnthropicBaseUrlForClaudeCode(config.baseURL);
  baseEnv.ANTHROPIC_MODEL = selectedModel;
  baseEnv.CLAUDE_CODE_SUBAGENT_MODEL = selectedModel;

  const runtimeEnv = buildGlobalRuntimeEnvConfig();
  return {
    ...baseEnv,
    ...runtimeEnv,
    ANTHROPIC_AUTH_TOKEN: config.apiKey,
    ANTHROPIC_BASE_URL: normalizeAnthropicBaseUrlForClaudeCode(config.baseURL),
    ANTHROPIC_MODEL: selectedModel,
    CLAUDE_CODE_SUBAGENT_MODEL: selectedModel,
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
