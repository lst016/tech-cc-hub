export type MarkdownSelectionRange = {
  startLine: number;
  endLine: number;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toRenderedLineText(line: string): string {
  return line
    .replace(/^\s*(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]*>/g, "");
}

export function findMarkdownSelectionRange(source: string, selectedText: string): MarkdownSelectionRange | null {
  const selected = normalizeText(selectedText);
  if (!selected) return null;

  const lines = source.split(/\r?\n/);
  for (let startIndex = 0; startIndex < lines.length; startIndex += 1) {
    let renderedText = "";
    for (let endIndex = startIndex; endIndex < lines.length; endIndex += 1) {
      renderedText = normalizeText(`${renderedText} ${toRenderedLineText(lines[endIndex] ?? "")}`);
      if (renderedText.includes(selected)) {
        return { startLine: startIndex + 1, endLine: endIndex + 1 };
      }
    }
  }

  return null;
}
