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

export function normalizeRunnerError(error: unknown, requestedModel?: string): string {
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

  return raw || "运行失败，请稍后重试。";
}
