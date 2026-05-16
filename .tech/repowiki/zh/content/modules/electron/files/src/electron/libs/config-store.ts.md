# src/electron/libs/config-store.ts

> 模块：`electron` · 语言：`typescript` · 行数：412

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getConfigPath@60`
- `getGlobalConfigPath@65`
- `createDefaultSettings@70`
- `loadApiConfigSettings@99`
- `saveApiConfigSettings@114`
- `deleteApiConfig@136`
- `loadGlobalRuntimeConfig@148`
- `saveGlobalRuntimeConfig@174`
- `normalizeApiConfig@195`
- `normalizeProvider@253`
- `normalizeBaseURL@268`
- `normalizeApiSettings@291`
- `normalizeModelConfig@318`
- `dedupeModelConfigs@345`
- `normalizePositiveInteger@369`
- `normalizePercent@378`
- `normalizeRoleModel@391`
- `normalizeOptionalModel@396`
- `normalizeWikiModelCostTier@405`
- `DEFAULT_MODEL@49`
- `DEFAULT_CONTEXT_WINDOW@56`
- `DEEPSEEK_OFFICIAL_BASE_URL@57`
- `CONFIG_FILE_NAME@58`
- `GLOBAL_CONFIG_FILE_NAME@59`
- `userDataPath@62`
- `userDataPath@67`
- `configPath@102`
- `raw@106`
- `parsed@107`
- `configPath@117`
- `userDataPath@118`
- `normalized@123`
- `configPath@139`
- `configPath@151`
- `raw@155`
- `parsed@157`
- `configPath@177`
- `userDataPath@178`
- `provider@200`
- `baseURL@202`

## 依赖输入

- `electron`
- `fs`
- `path`
- `../../shared/codex-oauth.js`

## 对外暴露

- `ApiType`
- `ApiProviderMode`
- `ApiModelConfig`
- `ApiConfig`
- `ApiConfigSettings`
- `GlobalRuntimeConfig`
- `loadApiConfigSettings`
- `saveApiConfigSettings`
- `deleteApiConfig`
- `loadGlobalRuntimeConfig`
- `saveGlobalRuntimeConfig`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { app } from "electron";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { CODEX_OAUTH_BASE_URL } from "../../shared/codex-oauth.js";

export type ApiType = "anthropic";
export type ApiProviderMode = "custom" | "deepseek" | "codex";

export type ApiModelConfig = {
  name: string;
  contextWindow?: number;
  compressionThresholdPercent?: number;
};

export type ApiConfig = {
  id: string;
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  expertModel?: string;
  smallModel?: string;
  imageModel?: string;
  analysisModel?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  embeddingBatchSize?: number;
  wikiModel?: string;
  wikiModelCostTier?: "free" | "cheap" | "standard";
  wikiModelMaxInputTokens?: number;
  wikiModelMaxOutputTokens?: number;
  models?: ApiModelConfig[];
  enabled: boolean;
  provider?: ApiProviderMode;
  apiType?: ApiType;
};

export type ApiConfigSettings = {
  profiles: ApiConfig[];
};

export type GlobalRuntimeConfig = Record<string, unknown>;

const DEFAULT_MODEL = "claude-sonnet-4-5";
const DEFAULT_MODEL_CONFIG: ApiModelConfig = {
  name: DEFAULT_MODEL,
  contextWindow: 200_000,
  compressionThresholdPercent: 70,
};
const DEFAULT_CONTEXT_WINDOW = 200_000;
const DEEPSEEK_OFFICIAL_BASE_URL = "https://api.deepseek.com/anthropic";
const CONFIG_FILE_NAME = "api-config.json";
const GLOBAL_CONFIG_FILE_NAME = "agent-runtime.json";

function getConfigPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, CONFIG_FILE_NAME);
}

function getGlobalConfigPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, GLOBAL_CONFIG_FILE_NAME);
}

function createDefaultSettings(): ApiConfigSettings {
  return {
    profiles: [
      {
        id: crypto.randomUUID(),
        name: "默认配置",
        apiKey: "",
        baseURL: "https://api.anthropic.com",
        model: DEFAULT_MODEL,
        expertModel: DEFAULT_MODEL,
        smallModel: DEFAULT_MODEL,
        imageModel: undefined,
        analysisModel: DEFAULT_MODEL,
        embeddingModel: undefined,
        embeddingDimension: 1536,
        embeddingBatchSize: 16,
        wikiModel: undefined,
        wikiModelCostTier: "cheap",
        wikiModelMaxInputTokens: 16_000,
        wikiModelMaxOutputTokens: 4_000,
        models: [DEFAULT_MODEL_CONFIG],
        enabled: true,
        provider: "custom",
        apiType: "anthropic",
      },
    ],
  };
}

export function loadApiConfigSettings(): ApiConfigSettings {
  try {
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
      return createDefaultSettings();
    }
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as ApiConfig | ApiConfigSettings;
    return normalizeApiSettings(parsed);
  } catch (error) {
    console.error("[config-store] Failed to load API config:", error);
    return createDefaultSettings();
  }
}

export function saveApiConfigSettings(settings: ApiConfigSettings): void {
  try {
    const configPath = getConfigPath();
    const userDataPath = app.getPath("userData");

    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true });
    }

    const normalized = normalizeApiSettings(settings);
    if (normalized.profiles.length === 0) {
      throw new Error("Invalid config: at least one valid profile is required");
    }

    writeFileSync(configPath, JSON.stringify(normalized, null, 2), "utf8");
    console.info("[config-store] API config saved successfully");
  } catch (error) {
    console.error("[config-store] Failed to save API config:", error);
    throw error;
  }
}

export function deleteApiConfig(): void {
  try {
    const configPath = getConfigPath();
    if (existsSync(configPath)) {
      unlinkSync(configPath);
      console.info("[config-store] API config deleted");
    }
  } catch (error) {
    console.error("[config-store] Failed to delete API config:", error);
  }
}

export function loadGlobalRuntimeConfig(): GlobalRuntimeConfig {
  try {
    const configPath = getGlobalConfigPath();
    if (!exist
... (truncated)
```
