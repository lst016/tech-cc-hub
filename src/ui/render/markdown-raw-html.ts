export type MarkdownAstNode = {
  type?: string;
  value?: string;
  children?: MarkdownAstNode[];
};

const LARK_MENTION_OPEN_TAG_PATTERN =
  /^<at\s+user_id=(?:"[^"<>\r\n]*"|'[^'<>\r\n]*')\s*>$/i;
const LARK_MENTION_CLOSE_TAG_PATTERN = /^<\/at\s*>$/i;
const LARK_MENTION_ELEMENT_PATTERN =
  /^<at\s+user_id=(?:"[^"<>\r\n]*"|'[^'<>\r\n]*')\s*>[^<>]*<\/at\s*>$/i;

function isSupportedRawHtml(value: string): boolean {
  const tag = value.trim();
  return (
    LARK_MENTION_OPEN_TAG_PATTERN.test(tag) ||
    LARK_MENTION_CLOSE_TAG_PATTERN.test(tag) ||
    LARK_MENTION_ELEMENT_PATTERN.test(tag)
  );
}

/**
 * Keep raw HTML out of the rendered document while preserving the one custom
 * element emitted by the Lark mention picker. Converting an MDAST html node to
 * text makes React Markdown escape it before rehypeRaw can create DOM nodes.
 */
export function restrictMarkdownRawHtml(tree: MarkdownAstNode): void {
  if (
    tree.type === "html" &&
    typeof tree.value === "string" &&
    !isSupportedRawHtml(tree.value)
  ) {
    tree.type = "text";
  }

  tree.children?.forEach(restrictMarkdownRawHtml);
}

export function remarkRestrictRawHtml() {
  return restrictMarkdownRawHtml;
}
