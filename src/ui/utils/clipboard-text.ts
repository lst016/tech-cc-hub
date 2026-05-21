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

function extractFirstLinkHref(html: string) {
  const hrefMatch = html.match(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const href = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? "") : "";
  return decodeHtmlAttribute(href).trim();
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

export function getPlainTextFromClipboardData(clipboardData: ClipboardTextSource) {
  const plainText = clipboardData.getData("text/plain");
  const html = clipboardData.getData("text/html");
  const href = html ? extractFirstLinkHref(html) : "";
  const shouldPreserveRichHttpLink = Boolean(href) && isHttpUrl(href);

  if (plainText) {
    if (shouldPreserveRichHttpLink && !containsHttpUrl(plainText)) {
      return formatMarkdownLink(plainText, href);
    }
    return plainText;
  }

  if (!html) return "";

  const htmlText = htmlToPlainText(html);
  if (shouldPreserveRichHttpLink && !containsHttpUrl(htmlText)) {
    return formatMarkdownLink(htmlText, href);
  }
  return htmlText;
}
