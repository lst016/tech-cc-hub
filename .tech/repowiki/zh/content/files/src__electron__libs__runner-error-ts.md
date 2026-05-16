# src/electron/libs/runner-error.ts

> 模块：`electron-runtime` · 语言：`typescript` · 行数：68

## 文件职责

错误处理和规范化模块，将底层错误转换为用户友好的中文错误消息

## 关键符号

- `stringifyRunnerError@0 - 将任意错误对象转换为字符串，处理Error类型、cause链和JSON序列化`
- `normalizeRunnerError@0 - 规范化错误消息，特别处理模型不可用（404、not found）和Figma认证错误，返回中文提示`
- `buildFigmaAuthGuidance@0 - 根据当前Figma配置模式（REST/PAT或OAuth）生成相应的重新授权指导信息`
- `isLikelyFigmaAuthError@0 - 检测错误消息是否包含Figma认证相关的问题`

## 依赖输入

- `./figma-official-plugin.js`

## 对外暴露

- `stringifyRunnerError`
- `normalizeRunnerError`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { getFigmaOfficialPluginStatusFromConfig } from "./figma-official-plugin.js";

export function stringifyRunnerError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    const base = error.message?.trim() || error.name;
    const cause = "cause" in error ? stringifyRunnerError((error as Error & { cause?: unknown }).cause) : "";
    return [base, cause].filter(Boolean).join(" | ");
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function normalizeRunnerError(
  error: unknown,
  requestedModel?: string,
  globalRuntimeConfig?: unknown,
): string {
  const raw = stringifyRunnerError(error).trim();
  const normalized = raw.toLowerCase();
  const quotedRequestedModel = requestedModel ? `「${requestedModel}」` : "当前模型";
  const hasModelContext =
    normalized.includes("model") ||
    (requestedModel ? normalized.includes(requestedModel.toLowerCase()) : false);
  const modelUnavailable =
    /(not found|unknown model|unsupported model|invalid model|model.*does not exist|no such model|unavailable model)/i.test(raw) ||
    /(model_not_found|invalid_request_error|unsupported_value)/i.test(raw);

  if (hasModelContext && modelUnavailable) {
    return `请求模型${quotedRequestedModel}失败：该模型当前不可用、已下线，或不被当前服务端支持，请切换到可用模型后重试。`;
  }

  if (hasModelContext && /(404|status code 404|status: 404)/i.test(raw)) {
    return `请求模型${quotedRequestedModel}失败：服务端没有找到对应模型，请检查模型名称或切换到可用模型。`;
  }

  if (isLikelyFigmaAuthError(raw)) {
    const guidance = buildFigmaAuthGuidance(globalRuntimeConfig);
    return raw ? `${raw}\n\n${guidance}` : guidance;
  }

  return raw || "运行失败，请稍后重试。";
}

function buildFigmaAuthGuidance(globalRuntimeConfig: unknown): string {
  const status = getFigmaOfficialPluginStatusFromConfig(globalRuntimeConfig);
  if (status.mode === "rest") {
    return [
      "Figma REST/PAT 授权可能无效或缺少 scope。",
      "当前配置走本机保存的 Figma Personal Access Token，不需要在聊天里粘贴 PAT，也不应优先走官方 OAuth。",
      "请在设置页重新校验 Figma Token，或补齐对应 REST API scope 后重试。",
    ].join("\n");
  }

  return "Figma OAuth 授权可能已过期；只有当前配置确实是官方 OAuth MCP 时，才需要重新走 OAuth 授权。";
}

function isLikelyFigmaAuthError(message: string): boolean {
  return /figma[\s\S]*(401|403|auth|authorize|unauthorized|expired|token|oauth|permission)/i.test(message);
}

```
