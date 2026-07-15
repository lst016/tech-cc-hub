export type ClipboardTextSource = Pick<DataTransfer, "getData">;

const HTTP_URL_PATTERN = /\bhttps?:\/\/[^\s<>"')]+/i;

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function containsHttpUrl(value: string) {
  return HTTP_URL_PATTERN.test(value);
}

function htmlToPlainText(html: string) {
  if (typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = html;
    return (container.innerText || container.textContent || "").replace(/\u00a0/g, " ");
  }

  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function formatMarkdownLink(label: string, href: string) {
  const normalizedLabel = label.replace(/\s+/g, " ").trim();
  if (!normalizedLabel || normalizedLabel === href || containsHttpUrl(normalizedLabel)) {
    return href;
  }

  return `[${normalizedLabel.replace(/([\\\]])/g, "\\$1")}](${href})`;
}

type ClipboardHttpLink = {
  href: string;
  label: string;
};

function extractHttpLinks(html: string): ClipboardHttpLink[] {
  const links: ClipboardHttpLink[] = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let anchorMatch: RegExpExecArray | null;

  while ((anchorMatch = anchorPattern.exec(html))) {
    const attributes = anchorMatch[1] ?? "";
    const hrefMatch = attributes.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    const href = decodeHtmlAttribute(hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? "") : "").trim();
    const label = htmlToPlainText(anchorMatch[2] ?? "").trim();
    if (label && isHttpUrl(href)) links.push({ href, label });
  }

  return links;
}

function preserveRichHttpLinks(text: string, links: ClipboardHttpLink[]) {
  const replacements: Array<{ start: number; end: number; markdown: string }> = [];

  for (const link of [...links].sort((left, right) => right.label.length - left.label.length)) {
    if (text.includes(link.href)) continue;
    const start = text.indexOf(link.label);
    if (start < 0 || text.indexOf(link.label, start + link.label.length) >= 0) continue;
    const end = start + link.label.length;
    if (replacements.some((replacement) => start < replacement.end && end > replacement.start)) continue;
    replacements.push({ start, end, markdown: formatMarkdownLink(link.label, link.href) });
  }

  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (result, replacement) => `${result.slice(0, replacement.start)}${replacement.markdown}${result.slice(replacement.end)}`,
      text,
    );
}

export function getPlainTextFromClipboardData(clipboardData: ClipboardTextSource) {
  const plainText = clipboardData.getData("text/plain") || clipboardData.getData("text");
  const html = clipboardData.getData("text/html");
  const links = html ? extractHttpLinks(html) : [];

  if (plainText) {
    return preserveRichHttpLinks(plainText, links);
  }

  if (!html) return "";

  const htmlText = htmlToPlainText(html);
  return preserveRichHttpLinks(htmlText, links);
}
