export type CollapsibleTextPreviewOptions = {
  expanded: boolean;
  maxLines: number;
  maxChars: number;
};

export function getCollapsibleTextPreview(
  text: string,
  options: CollapsibleTextPreviewOptions,
) {
  const lines = text.split("\n");
  const maxLines = Math.max(1, options.maxLines);
  const maxChars = Math.max(1, options.maxChars);
  const lineLimitedText = lines.slice(0, maxLines).join("\n");
  const collapsedText = lineLimitedText.length > maxChars
    ? lineLimitedText.slice(0, maxChars).trimEnd()
    : lineLimitedText;
  const hasMore = collapsedText.length < text.length;
  const remainingLines = Math.max(lines.length - maxLines, 0);

  return {
    hasMore,
    remainingLines,
    visibleText: hasMore && !options.expanded ? collapsedText : text,
    expandLabel: options.expanded
      ? "收起"
      : remainingLines > 0
        ? `展开剩余 ${remainingLines} 行`
        : "展开全文",
  };
}
