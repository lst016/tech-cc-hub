import { getFigmaOfficialPluginStatusFromConfig } from "../figma-official-plugin.js";

export type RunnerErrorDiagnostics = {
  processStderr?: string;
  maxDiagnosticChars?: number;
};

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
  diagnostics?: RunnerErrorDiagnostics,
): string {
  const raw = stringifyRunnerError(error).trim();
  const normalized = raw.toLowerCase();
  const diagnosticDetail = buildDiagnosticDetail(raw, diagnostics);
  const quotedRequestedModel = requestedModel ? `「${requestedModel}」` : "当前模型";
  const hasModelContext =
    normalized.includes("model") ||
    (requestedModel ? normalized.includes(requestedModel.toLowerCase()) : false);
  const modelUnavailable =
    /(not found|unknown model|unsupported model|invalid model|model.*does not exist|no such model|unavailable model)/i.test(raw) ||
    /(model_not_found|invalid_request_error|unsupported_value)/i.test(raw);

  if (/\b(refusal|refused|stop_reason[\s\S]*refusal|safety refusal)\b/i.test(raw)) {
    return appendDiagnosticDetail(
      "模型出于安全策略拒绝了本次请求。请调整输入，去除高风险、违规或不可执行的部分后重试。",
      diagnosticDetail,
    );
  }

  if (/\b(overloaded|529|rate overloaded|server overloaded|capacity)\b/i.test(raw)) {
    return appendDiagnosticDetail(
      "上游模型服务当前过载或容量不足，请稍后重试，或切换到其它可用模型/供应商。",
      diagnosticDetail,
    );
  }

  if (hasModelContext && modelUnavailable) {
    return appendDiagnosticDetail(
      `请求模型${quotedRequestedModel}失败：该模型当前不可用、已下线，或不被当前服务端支持，请切换到可用模型后重试。`,
      diagnosticDetail,
    );
  }

  if (hasModelContext && /(404|status code 404|status: 404)/i.test(raw)) {
    return appendDiagnosticDetail(
      `请求模型${quotedRequestedModel}失败：服务端没有找到对应模型，请检查模型名称或切换到可用模型。`,
      diagnosticDetail,
    );
  }

  if (isLikelyFigmaAuthError(raw)) {
    const guidance = buildFigmaAuthGuidance(globalRuntimeConfig);
    return appendDiagnosticDetail(raw ? `${raw}\n\n${guidance}` : guidance, diagnosticDetail);
  }

  return appendDiagnosticDetail(raw || "运行失败，请稍后重试。", diagnosticDetail);
}

function appendDiagnosticDetail(message: string, diagnosticDetail: string | null): string {
  if (!diagnosticDetail) {
    return message;
  }
  return `${message}\n\nClaude Code stderr:\n${diagnosticDetail}`;
}

function buildDiagnosticDetail(raw: string, diagnostics?: RunnerErrorDiagnostics): string | null {
  const stderr = sanitizeRunnerDiagnosticDetail(diagnostics?.processStderr ?? "");
  if (!stderr) {
    return null;
  }

  if (raw && raw.toLowerCase().includes(stderr.toLowerCase())) {
    return null;
  }

  const maxChars = diagnostics?.maxDiagnosticChars ?? 4000;
  return stderr.length > maxChars ? stderr.slice(-maxChars) : stderr;
}

function sanitizeRunnerDiagnosticDetail(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\b(ANTHROPIC_AUTH_TOKEN|ANTHROPIC_API_KEY|OPENAI_API_KEY|api[_-]?key|token|secret)\s*[:=]\s*["']?[^"'\s,}]+/gi, "$1=[redacted]")
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, "[redacted]")
    .trim();
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
