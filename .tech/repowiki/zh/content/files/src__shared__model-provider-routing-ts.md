# src/shared/model-provider-routing.ts

> 模块：`shared` · 语言：`typescript` · 行数：58

## 文件职责

根据 API provider 模式决定模型兼容性，辅助模型选择

## 关键符号

- `SharedApiProviderMode@0 - provider 模式：custom、deepseek、codex`
- `isCodexModelName@0 - 判断模型名是否为 Codex 系列（gpt-5.* 或包含 codex）`
- `pickProviderCompatibleModel@0 - 从 primary/fallback 模型中选择与 provider 兼容的第一个`

## 依赖输入

- `./codex-oauth.js`

## 对外暴露

- `SharedApiProviderMode`
- `isCodexModelName`
- `isDeepSeekModelName`
- `isModelCompatibleWithApiProvider`
- `pickProviderCompatibleModel`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { CODEX_OAUTH_COMPACT_MODEL_SUFFIX } from "./codex-oauth.js";

export type SharedApiProviderMode = "custom" | "deepseek" | "codex";

export function isCodexModelName(modelName: string): boolean {
  const normalized = stripCodexCompactSuffix(modelName).toLowerCase();
  return /^gpt-5(?:[.-]|$)/.test(normalized) || /(?:^|[._-])codex(?:[._-]|$)/.test(normalized);
}

export function isDeepSeekModelName(modelName: string): boolean {
  return modelName.trim().toLowerCase().includes("deepseek");
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

function stripCodexCompactSuffix(modelName: string): string {
  const normalized = modelName.trim();
  return normalized.endsWith(CODEX_OAUTH_COMPACT_MODEL_SUFFIX)
    ? normalized.slice(0, -CODEX_OAUTH_COMPACT_MODEL_SUFFIX.length)
    : normalized;
}

```
