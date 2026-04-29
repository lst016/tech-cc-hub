const WORKBENCH_URL_PATTERN = /(?:https?:\/\/|file:\/\/\/?|(?:localhost|127\.0\.0\.1|\[::1\]):\d+|(?:\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?)(?:\/[^\s<>"'`)]*)?|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9](?::\d+)?(?:\/[^\s<>"'`)]*)?)[^\s<>"'`)]*/i;
const ENCODED_SENTENCE_STOP_PATTERN = /(?:%EF%BC%8C|%E3%80%82|%EF%BC%9B|%EF%BC%9A|%E3%80%81).*/i;
const RAW_BROWSER_SCHEME = /^(https?:|file:)/i;
const EXTERNAL_SCHEME = /^(?:javascript|data|mailto|tel|ftp|ssh):/i;

export function extractWorkbenchUrlCandidate(href: string): string {
  const match = href.trim().match(WORKBENCH_URL_PATTERN);
  let candidate = match?.[0] ?? href.trim();

  candidate = candidate
    .replace(ENCODED_SENTENCE_STOP_PATTERN, "")
    .replace(/[，。；：、].*$/, "")
    .replace(/(?:\*\*|__)+$/g, "")
    .replace(/\/\*+$/g, "/")
    .replace(/[.,;:!?]+$/g, "")
    .replace(/[)\]}]+$/g, "");

  return candidate;
}

export function normalizeWorkbenchUrl(href?: string): string | null {
  const value = href ? extractWorkbenchUrlCandidate(href) : "";
  if (!value) return null;
  if (EXTERNAL_SCHEME.test(value)) return null;
  if (RAW_BROWSER_SCHEME.test(value)) return value;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(value)) return `http://${value}`;
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/|$)/.test(value)) return `http://${value}`;
  if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\:\d+)?(?:\/.*)?$/i.test(value)) return `https://${value}`;
  if (/^(localhost|127\.0\.0\.1|\[::1\]):\d+/i.test(value)) return `http://${value}`;
  return null;
}
