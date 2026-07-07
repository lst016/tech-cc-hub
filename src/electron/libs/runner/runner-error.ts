import { FIGMA_MCP_SERVER_NAME, getFigmaOfficialPluginStatusFromConfig } from "../figma-official-plugin.js";

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
  const quotedRequestedModel = requestedModel ? ` "${requestedModel}"` : " current model";
  const hasModelContext =
    normalized.includes("model") ||
    (requestedModel ? normalized.includes(requestedModel.toLowerCase()) : false);
  const modelUnavailable =
    /(not found|unknown model|unsupported model|invalid model|model.*does not exist|no such model|unavailable model)/i.test(raw) ||
    /(model_not_found|invalid_request_error|unsupported_value)/i.test(raw);

  if (/\b(refusal|refused|stop_reason[\s\S]*refusal|safety refusal)\b/i.test(raw)) {
    return appendDiagnosticDetail(
      "The model refused this request because of safety policy. Adjust the prompt and retry.",
      diagnosticDetail,
    );
  }

  if (/\b(overloaded|529|rate overloaded|server overloaded|capacity)\b/i.test(raw)) {
    return appendDiagnosticDetail(
      "The upstream model service is overloaded or at capacity. Retry later or switch to another available model/provider.",
      diagnosticDetail,
    );
  }

  if (hasModelContext && modelUnavailable) {
    return appendDiagnosticDetail(
      `Requested model${quotedRequestedModel} is unavailable, offline, or not supported by the current provider. Switch to an available model and retry.`,
      diagnosticDetail,
    );
  }

  if (hasModelContext && /(404|status code 404|status: 404)/i.test(raw)) {
    return appendDiagnosticDetail(
      `Requested model${quotedRequestedModel} was not found by the provider. Check the model name or switch to an available model.`,
      diagnosticDetail,
    );
  }

  if (isLikelyFigmaAuthError(raw)) {
    const guidance = buildFigmaAuthGuidance(globalRuntimeConfig);
    return appendDiagnosticDetail(raw ? `${raw}\n\n${guidance}` : guidance, diagnosticDetail);
  }

  return appendDiagnosticDetail(raw || "Runner failed. Please retry later.", diagnosticDetail);
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
    const modeHint = hasConfiguredFigmaOfficialMcp(globalRuntimeConfig)
      ? "Current config has Figma REST/PAT and official Figma MCP enabled in parallel; either route can be used for comparison/debugging."
      : "Current config uses the locally stored Figma Personal Access Token; do not paste PAT into chat.";
    return [
      "Figma REST/PAT authorization may be invalid or missing required scope.",
      modeHint,
      "Revalidate the Figma Token in settings, complete missing REST API scope, or use the official Figma MCP route to compare behavior.",
    ].join("\n");
  }

  return "Figma OAuth authorization may be expired. Re-run OAuth only when the active route is official Figma MCP.";
}

function hasConfiguredFigmaOfficialMcp(config: unknown): boolean {
  if (!isRecord(config) || !isRecord(config.mcpServers)) {
    return false;
  }

  const figmaMcp = config.mcpServers[FIGMA_MCP_SERVER_NAME];
  return isRecord(figmaMcp) && figmaMcp.enabled !== false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLikelyFigmaAuthError(message: string): boolean {
  return /figma[\s\S]*(401|403|auth|authorize|unauthorized|expired|token|oauth|permission)/i.test(message);
}