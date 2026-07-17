export const TECHCC_VISUALIZATION_SCHEME = "techcc-visualize";
export const TECHCC_VISUALIZATION_CHANNEL = "techcc-visualization";
export const MAX_TECHCC_VISUALIZATION_PROMPT_LENGTH = 16_384;
export const MAX_TECHCC_VISUALIZATION_TITLE_LENGTH = 250;
export const MIN_TECHCC_VISUALIZATION_HEIGHT = 160;
export const MAX_TECHCC_VISUALIZATION_HEIGHT = 960;

const LAUNCH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{12,128}$/;
const MAX_TECHCC_VISUALIZATION_ERROR_LENGTH = 1_000;

export type TechccVisualizationAddress = {
  token: string;
};

export type TechccVisualizationLaunch = {
  url: string;
  nonce: string;
};

export type TechccVisualizationMetadata = {
  sessionId: string;
  fileName: string;
  sha256: string;
};

export type TechccVisualizationFollowUp = {
  type: "follow-up";
  prompt: string;
  title?: string;
};

export type TechccVisualizationMessage =
  | TechccVisualizationFollowUp
  | { type: "resize"; height: number }
  | { type: "ready" }
  | { type: "error"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoundedText(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maximumLength ? normalized : null;
}

export function clampTechccVisualizationHeight(height: number): number {
  if (!Number.isFinite(height)) return MIN_TECHCC_VISUALIZATION_HEIGHT;
  return Math.min(
    MAX_TECHCC_VISUALIZATION_HEIGHT,
    Math.max(MIN_TECHCC_VISUALIZATION_HEIGHT, Math.ceil(height)),
  );
}

export function createTechccVisualizationNonce(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") return randomUUID.call(globalThis.crypto);
  return `techcc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function parseTechccVisualizationMessage(
  value: unknown,
  expectedNonce: string,
): TechccVisualizationMessage | null {
  if (!isRecord(value)) return null;
  if (value.channel !== TECHCC_VISUALIZATION_CHANNEL || value.nonce !== expectedNonce) return null;
  if (value.type === "ready") return { type: "ready" };
  if (value.type === "resize") {
    if (typeof value.height !== "number" || !Number.isFinite(value.height)) return null;
    return { type: "resize", height: clampTechccVisualizationHeight(value.height) };
  }
  if (value.type === "error") {
    const message = readBoundedText(value.message, MAX_TECHCC_VISUALIZATION_ERROR_LENGTH);
    return message ? { type: "error", message } : null;
  }
  if (value.type !== "follow-up") return null;
  const prompt = readBoundedText(value.prompt, MAX_TECHCC_VISUALIZATION_PROMPT_LENGTH);
  if (!prompt) return null;
  if (value.title === undefined) return { type: "follow-up", prompt };
  const title = readBoundedText(value.title, MAX_TECHCC_VISUALIZATION_TITLE_LENGTH);
  return title ? { type: "follow-up", prompt, title } : null;
}

function isSafeAddress(input: TechccVisualizationAddress): boolean {
  return LAUNCH_TOKEN_PATTERN.test(input.token);
}

export function buildTechccVisualizationUrl(input: TechccVisualizationAddress): string {
  if (!isSafeAddress(input)) throw new Error("Invalid techcc visualization address.");
  return `${TECHCC_VISUALIZATION_SCHEME}://artifact/${encodeURIComponent(input.token)}`;
}

export function parseTechccVisualizationUrl(value: string): TechccVisualizationAddress | null {
  try {
    const url = new URL(value);
    if (url.protocol !== `${TECHCC_VISUALIZATION_SCHEME}:` || url.hostname !== "artifact") return null;
    if (url.search || url.hash || url.username || url.password || url.port) return null;
    const encodedParts = url.pathname.split("/").filter(Boolean);
    if (encodedParts.length !== 1) return null;
    const result = { token: decodeURIComponent(encodedParts[0] ?? "") };
    return isSafeAddress(result) ? result : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function buildTechccVisualizationDocument(input: {
  fragment: string;
  nonce: string;
  title?: string;
  metadata: TechccVisualizationMetadata;
}): string {
  if (!NONCE_PATTERN.test(input.nonce)) throw new Error("Invalid techcc visualization nonce.");
  const nonce = serializeForInlineScript(input.nonce);
  const metadata = serializeForInlineScript({
    ...input.metadata,
    scheme: TECHCC_VISUALIZATION_SCHEME,
  });
  const title = escapeHtml(input.title?.trim() || "交互式可视化");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'">
<title>${title}</title>
<style>
:root{color-scheme:light;--techcc-viz-background:#f7f8fb;--techcc-viz-foreground:#1f2937;--techcc-viz-muted:#667085;--techcc-viz-card:#fff;--techcc-viz-border:rgba(31,41,55,.1);--techcc-viz-accent:#4f46e5;--techcc-viz-accent-soft:#eef2ff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--techcc-viz-background);color:var(--techcc-viz-foreground)}body{padding:16px}.techcc-viz-shell{display:grid;gap:12px}.techcc-viz-card{border:1px solid var(--techcc-viz-border);border-radius:16px;background:var(--techcc-viz-card);padding:16px;box-shadow:0 10px 30px rgba(31,41,55,.06)}.techcc-viz-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.techcc-viz-control{min-height:36px;border:1px solid var(--techcc-viz-border);border-radius:10px;background:#fff;color:inherit;padding:7px 10px}.techcc-viz-btn{min-height:36px;border:0;border-radius:10px;background:var(--techcc-viz-accent);color:#fff;padding:8px 12px;font-weight:650;cursor:pointer}.techcc-viz-btn:focus-visible,.techcc-viz-control:focus-visible{outline:3px solid var(--techcc-viz-accent-soft);outline-offset:2px}@media(max-width:520px){body{padding:10px}.techcc-viz-card{padding:12px}}
</style>
<script>
(() => {
  "use strict";
  const channel = ${serializeForInlineScript(TECHCC_VISUALIZATION_CHANNEL)};
  const nonce = ${nonce};
  const metadata = Object.freeze(${metadata});
  const post = (payload) => window.parent.postMessage({ channel, nonce, ...payload }, "*");
  const sendFollowUpMessage = (input, optionalTitle) => {
    if (navigator.userActivation && !navigator.userActivation.isActive) return false;
    const payload = typeof input === "string" ? { prompt: input, title: optionalTitle } : input;
    if (!payload || typeof payload.prompt !== "string") return false;
    const prompt = payload.prompt.trim();
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    if (!prompt || prompt.length > ${MAX_TECHCC_VISUALIZATION_PROMPT_LENGTH} || title.length > ${MAX_TECHCC_VISUALIZATION_TITLE_LENGTH}) return false;
    post({ type: "follow-up", prompt, ...(title ? { title } : {}) });
    return true;
  };
  const visualization = Object.freeze({ sendFollowUpMessage });
  Object.defineProperty(window, "techcc", { value: Object.freeze({ visualization }), configurable: false, writable: false });
  Object.defineProperty(window, "techccVisualization", { value: metadata, configurable: false, writable: false });
  const reportSize = () => post({ type: "resize", height: Math.ceil(document.documentElement.scrollHeight) });
  window.addEventListener("error", (event) => post({ type: "error", message: String(event.message || "Visualization runtime error").slice(0, ${MAX_TECHCC_VISUALIZATION_ERROR_LENGTH}) }));
  window.addEventListener("unhandledrejection", (event) => post({ type: "error", message: String(event.reason || "Unhandled visualization error").slice(0, ${MAX_TECHCC_VISUALIZATION_ERROR_LENGTH}) }));
  const startRuntime = () => {
    if (typeof ResizeObserver === "function") new ResizeObserver(reportSize).observe(document.documentElement);
    document.addEventListener("click", (event) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (anchor) event.preventDefault();
    });
    post({ type: "ready" });
    reportSize();
  };
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", startRuntime, { once: true });
  } else {
    startRuntime();
  }
})();
</script>
</head>
<body>
<main class="techcc-viz-shell">${input.fragment}</main>
</body>
</html>`;
}
