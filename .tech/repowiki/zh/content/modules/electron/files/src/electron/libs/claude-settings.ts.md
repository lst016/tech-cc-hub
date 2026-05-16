# src/electron/libs/claude-settings.ts

> 模块：`electron` · 语言：`typescript` · 行数：473

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `isUsableConfig@22`
- `getEnabledUsableApiConfigs@30`
- `resolveSystemClaudePath@34`
- `getPathsFromEnvironment@75`
- `resolveNativeClaudePath@83`
- `resolveSdkBundledClaudePath@100`
- `getClaudeCodePath@121`
- `getCurrentApiConfig@131`
- `getConfiguredModelNames@139`
- `getRoutableModelNames@152`
- `getApiConfigForModel@157`
- `resolveApiConfigForModel@183`
- `resolveImagePreprocessApiConfig@210`
- `getFallbackClaudeSettingsConfig@227`
- `getGlobalRuntimeConfig@270`
- `buildEnvForConfig@274`
- `normalizeModelForApiConfig@304`
- `normalizeSmallModelForApiConfig@318`
- `getProviderDefaultModel@331`
- `buildClaudeCodeNonEssentialTrafficEnv@343`
- `buildClaudeCodeModelEnv@353`
- `getClaudeCodeModelOption@367`
- `normalizeAnthropicBaseUrlForClaudeCode@388`
- `getGlobalRuntimeEnvConfig@393`
- `buildGlobalRuntimeEnvConfig@397`
- `isUsableEnvKey@419`
- `toEnvValue@432`
- `isRecord@446`
- `getModelConfig@450`
- `supportsRemoteSessionResume@464`
- `candidates@36`
- `resolvedPath@51`
- `result@57`
- `path@64`
- `resolvedPath@66`
- `pathValue@77`
- `realPath@86`
- `basePath@102`
- `candidates@105`
- `explicitPath@122`

## 依赖输入

- `fs`
- `path`
- `os`
- `child_process`
- `../../shared/codex-oauth.js`
- `../../shared/model-provider-routing.js`
- `./config-store.js`
- `electron`
- `./codex-anthropic-proxy.js`

## 对外暴露

- `getClaudeCodePath`
- `getCurrentApiConfig`
- `getConfiguredModelNames`
- `getRoutableModelNames`
- `getApiConfigForModel`
- `ResolvedApiConfigForModel`
- `resolveApiConfigForModel`
- `resolveImagePreprocessApiConfig`
- `getGlobalRuntimeConfig`
- `buildEnvForConfig`
- `normalizeModelForApiConfig`
- `getClaudeCodeModelOption`
- `normalizeAnthropicBaseUrlForClaudeCode`
- `getGlobalRuntimeEnvConfig`
- `getModelConfig`
- `supportsRemoteSessionResume`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
    config.mode
... (truncated)
```
