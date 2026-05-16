# src/shared/codex-oauth.ts

> 模块：`shared` · 语言：`typescript` · 行数：77

## 文件职责

处理 Codex OAuth 模型的 ID 规范化和后缀管理，支持 compact 模型变体

## 关键符号

- `CODEX_BASE_MODELS@0 - 基础 Codex 模型 ID 列表`
- `CODEX_OAUTH_MODELS@0 - 合并后的完整 Codex 模型列表`
- `withCodexCompactModelSuffix@0 - 为模型列表添加 -openai-compact 后缀变体`
- `mergeCodexModelIds@0 - 合并缓存模型和 fallback 模型，去重排序`

## 对外暴露

- `CODEX_OAUTH_BASE_URL`
- `CODEX_OAUTH_COMPACT_MODEL_SUFFIX`
- `CODEX_OAUTH_DEFAULT_MODEL`
- `CODEX_OAUTH_SMALL_MODEL`
- `withCodexCompactModelSuffix`
- `extractCodexModelIdsFromCache`
- `mergeCodexModelIds`
- `CODEX_OAUTH_MODELS`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export const CODEX_OAUTH_BASE_URL = "https://chatgpt.com";
export const CODEX_OAUTH_COMPACT_MODEL_SUFFIX = "-openai-compact";
export const CODEX_OAUTH_DEFAULT_MODEL = "gpt-5.5";
export const CODEX_OAUTH_SMALL_MODEL = "gpt-5.3-codex-spark";

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

```
