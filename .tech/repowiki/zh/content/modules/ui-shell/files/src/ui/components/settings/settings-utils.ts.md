# src/ui/components/settings/settings-utils.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：363

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `createModel@14`
- `createProfile@22`
- `createDeepSeekOfficialProfile@47`
- `createCodexOAuthProfile@78`
- `normalizePositiveInteger@109`
- `normalizePercent@118`
- `normalizeProvider@130`
- `normalizeBaseURL@145`
- `normalizeModel@168`
- `dedupeModels@184`
- `normalizeRoleModel@208`
- `normalizeProfile@213`
- `getEnabledProfile@263`
- `getEnabledProfiles@267`
- `getAvailableModels@275`
- `getAvailableModelsForProfiles@292`
- `buildRoutingSummary@298`
- `validateProfiles@311`
- `DEFAULT_CONTEXT_WINDOW@8`
- `DEEPSEEK_CONTEXT_WINDOW@10`
- `CODEX_CONTEXT_WINDOW@11`
- `DEEPSEEK_OFFICIAL_BASE_URL@12`
- `DEEPSEEK_OFFICIAL_MODELS@13`
- `models@49`
- `models@80`
- `normalized@114`
- `normalized@123`
- `hostname@137`
- `trimmed@153`
- `url@158`
- `pathname@159`
- `name@170`
- `contextWindow@174`
- `compressionThresholdPercent@176`
- `deduped@186`
- `normalized@189`
- `previous@193`
- `normalized@210`
- `provider@215`
- `models@216`

## 依赖输入

- `../../types.js`
- `../../../shared/codex-oauth.js`

## 对外暴露

- `DEEPSEEK_OFFICIAL_BASE_URL`
- `DEEPSEEK_OFFICIAL_MODELS`
- `createModel`
- `createProfile`
- `createDeepSeekOfficialProfile`
- `createCodexOAuthProfile`
- `normalizeProfile`
- `getEnabledProfile`
- `getEnabledProfiles`
- `getAvailableModels`
- `getAvailableModelsForProfiles`
- `buildRoutingSummary`
- `validateProfiles`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { ApiConfigProfile, ApiModelConfigProfile } from "../../types.js";
import {
  CODEX_OAUTH_BASE_URL,
  CODEX_OAUTH_DEFAULT_MODEL,
  CODEX_OAUTH_MODELS,
  CODEX_OAUTH_SMALL_MODEL,
} from "../../../shared/codex-oauth.js";

const DEFAULT_CONTEXT_WINDOW = 200_000;
const DEEPSEEK_CONTEXT_WINDOW = 1_000_000;
const CODEX_CONTEXT_WINDOW = 200_000;
export const DEEPSEEK_OFFICIAL_BASE_URL = "https://api.deepseek.com/anthropic";
export const DEEPSEEK_OFFICIAL_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;

export function createModel(): ApiModelConfigProfile {
  return {
    name: "",
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    compressionThresholdPercent: 70,
  };
}

export function createProfile(): ApiConfigProfile {
  return {
    id: crypto.randomUUID(),
    name: "新配置",
    apiKey: "",
    baseURL: "",
    model: "",
    expertModel: "",
    smallModel: "",
    imageModel: undefined,
    analysisModel: "",
    embeddingModel: undefined,
    embeddingDimension: 1536,
    embeddingBatchSize: 16,
    wikiModel: undefined,
    wikiModelCostTier: "cheap",
    wikiModelMaxInputTokens: 16_000,
    wikiModelMaxOutputTokens: 4_000,
    models: [createModel()],
    enabled: true,
    provider: "custom",
    apiType: "anthropic",
  };
}

export function createDeepSeekOfficialProfile(): ApiConfigProfile {
  const models = DEEPSEEK_OFFICIAL_MODELS.map((name) => ({
    name,
    contextWindow: DEEPSEEK_CONTEXT_WINDOW,
    compressionThresholdPercent: 70,
  }));

  return {
    id: crypto.randomUUID(),
    name: "DeepSeek 官方",
    apiKey: "",
    baseURL: DEEPSEEK_OFFICIAL_BASE_URL,
    model: "deepseek-v4-flash",
    expertModel: "deepseek-v4-pro",
    smallModel: "deepseek-v4-flash",
    imageModel: undefined,
    analysisModel: "deepseek-v4-flash",
    embeddingModel: undefined,
    embeddingDimension: 1536,
    embeddingBatchSize: 16,
    wikiModel: "deepseek-v4-flash",
    wikiModelCostTier: "cheap",
    wikiModelMaxInputTokens: 16_000,
    wikiModelMaxOutputTokens: 4_000,
    models,
    enabled: true,
    provider: "deepseek",
    apiType: "anthropic",
  };
}

export function createCodexOAuthProfile(): ApiConfigProfile {
  const models = CODEX_OAUTH_MODELS.map((name) => ({
    name,
    contextWindow: CODEX_CONTEXT_WINDOW,
    compressionThresholdPercent: 70,
  }));

  return {
    id: crypto.randomUUID(),
    name: "Codex OAuth",
    apiKey: "",
    baseURL: CODEX_OAUTH_BASE_URL,
    model: CODEX_OAUTH_DEFAULT_MODEL,
    expertModel: CODEX_OAUTH_DEFAULT_MODEL,
    smallModel: CODEX_OAUTH_SMALL_MODEL,
    imageModel: undefined,
    analysisModel: CODEX_OAUTH_SMALL_MODEL,
    embeddingModel: undefined,
    embeddingDimension: 1536,
    embeddingBatchSize: 16,
    wikiModel: CODEX_OAUTH_SMALL_MODEL,
    wikiModelCostTier: "cheap",
    wikiModelMaxInputTokens: 16_000,
    wikiModelMaxOutputTokens: 4_000,
    models,
    enabled: true,
    provider: "codex",
    apiType: "anthropic",
  };
}

function normalizePositiveInteger(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
}

function normalizePercent(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);
  if (normalized < 1 || normalized > 100) {
    return undefined;
  }
  return normalized;
}

function normalizeProvider(value: unknown, baseURL: string): "custom" | "deepseek" | "codex" {
  if (value === "custom" || value === "deepseek" || value === "codex") {
    return value;
  }

  try {
    const hostname = new URL(baseURL.trim()).hostname;
    if (hostname === "api.deepseek.com") return "deepseek";
    if (hostname === "chatgpt.com") return "codex";
    return "custom";
  } catch {
    return "custom";
  }
}

function normalizeBaseURL(value: string, provider: "custom" | "deepseek" | "codex"): string {
  if (provider === "deepseek") {
    return DEEPSEEK_OFFICIAL_BASE_URL;
  }
  if (provider === "codex") {
    return CODEX_OAUTH_BASE_URL;
  }

  co
... (truncated)
```
