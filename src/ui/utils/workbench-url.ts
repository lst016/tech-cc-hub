const WORKBENCH_URL_PATTERN = /(?:https?:\/\/|file:\/\/\/?|(?:localhost|127\.0\.0\.1|\[::1\]):\d+)[^\s<>"'`)]*/i;
const ENCODED_SENTENCE_STOP_PATTERN = /(?:%EF%BC%8C|%E3%80%82|%EF%BC%9B|%EF%BC%9A|%E3%80%81).*/i;

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
  if (/^(https?:|file:)/i.test(value)) return value;
  if (/^(localhost|127\.0\.0\.1|\[::1\]):\d+/i.test(value)) return `http://${value}`;
  return null;
}
