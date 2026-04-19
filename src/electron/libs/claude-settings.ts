import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { spawnSync } from "child_process";
import { loadApiConfigSettings, saveApiConfigSettings, type ApiConfig } from "./config-store.js";
import { app } from "electron";

function resolveSystemClaudePath(): string | null {
  const explicitPath = process.env.CLAUDE_CODE_PATH;
  if (explicitPath && existsSync(explicitPath)) {
    return explicitPath;
  }

  const result = spawnSync("which", ["claude"], {
    encoding: "utf8",
    env: process.env,
  });

  if (result.status === 0) {
    const path = result.stdout.trim();
    if (path && existsSync(path)) {
      return path;
    }
  }

  return null;
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
  return resolveSystemClaudePath() ?? resolveSdkBundledClaudePath() ?? undefined;
}

// 获取当前有效的配置（优先界面配置，回退到文件配置）
export function getCurrentApiConfig(): ApiConfig | null {
  const uiConfig = loadApiConfigSettings().profiles.find((profile) => profile.enabled) ?? null;
  if (uiConfig) {
    console.log("[claude-settings] Using UI config:", {
      name: uiConfig.name,
      baseURL: uiConfig.baseURL,
      model: uiConfig.model,
      models: uiConfig.models,
      apiType: uiConfig.apiType
    });
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
        console.log("[claude-settings] Using file config from ~/.claude/settings.json");
        const config: ApiConfig = {
          id: crypto.randomUUID(),
          name: "默认配置",
          apiKey: String(authToken),
          baseURL: String(baseURL),
          model: String(model),
          models: [String(model)],
          enabled: true,
          apiType: "anthropic"
        };
        // 持久化到 api-config.json
        try {
          saveApiConfigSettings({ profiles: [config] });
          console.log("[claude-settings] Persisted config to api-config.json");
        } catch (e) {
          console.error("[claude-settings] Failed to persist config:", e);
        }
        return config;
      }
    }
  } catch {
    // Ignore missing or invalid settings file.
  }
  
  console.log("[claude-settings] No config found");
  return null;
}

export function buildEnvForConfig(config: ApiConfig): Record<string, string> {
  const baseEnv = { ...process.env } as Record<string, string>;

  baseEnv.ANTHROPIC_AUTH_TOKEN = config.apiKey;
  baseEnv.ANTHROPIC_BASE_URL = config.baseURL;
  baseEnv.ANTHROPIC_MODEL = config.model;

  return baseEnv;
}
