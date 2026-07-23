import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  remarkRestrictRawHtml,
  restrictMarkdownRawHtml,
  type MarkdownAstNode,
} from "../../src/ui/render/markdown-raw-html.js";

test("restrictMarkdownRawHtml renders untrusted HTML as text", () => {
  const tree: MarkdownAstNode = {
    type: "root",
    children: [
      {
        type: "html",
        value: '<div><style>body { text-align: center; }</style><p>Verification Code</p></div>',
      },
      {
        type: "html",
        value: '<img src="https://example.test/pixel" style="display:none">',
      },
      {
        type: "html",
        value: '<script>globalThis.compromised = true</script>',
      },
    ],
  };

  restrictMarkdownRawHtml(tree);

  assert.deepEqual(
    tree.children?.map((node) => node.type),
    ["text", "text", "text"],
  );
});

test("restrictMarkdownRawHtml preserves only the supported Lark mention tag", () => {
  const tree: MarkdownAstNode = {
    type: "root",
    children: [
      { type: "html", value: '<at user_id="ou_abc">' },
      { type: "text", value: "顾凯歌" },
      { type: "html", value: "</at>" },
      { type: "html", value: '<at user_id="ou_abc" style="position:fixed">' },
      { type: "html", value: '<span data-safe="false">' },
    ],
  };

  restrictMarkdownRawHtml(tree);

  assert.deepEqual(
    tree.children?.map((node) => node.type),
    ["html", "text", "html", "text", "text"],
  );
});

test("Markdown renderer restricts raw HTML before rehypeRaw parses it", () => {
  const markdownSource = readFileSync("src/ui/render/markdown.tsx", "utf8");
  const pluginIndex = markdownSource.indexOf("remarkRestrictRawHtml");
  const rawHtmlIndex = markdownSource.indexOf("rehypeRaw");

  assert.ok(pluginIndex >= 0, "Markdown renderer must register the raw HTML restriction plugin");
  assert.ok(rawHtmlIndex >= 0, "Lark mention rendering still relies on rehypeRaw");
  assert.match(
    markdownSource,
    /MARKDOWN_REMARK_PLUGINS\s*=\s*\[\s*remarkRestrictRawHtml,/,
    "raw HTML must be restricted in the Markdown AST before rehypeRaw runs",
  );
});

test("remarkRestrictRawHtml exposes the Markdown transformer", () => {
  const transformer = remarkRestrictRawHtml();
  const tree: MarkdownAstNode = {
    type: "root",
    children: [{ type: "html", value: "<style>body{display:none}</style>" }],
  };

  transformer(tree);

  assert.equal(tree.children?.[0]?.type, "text");
});

test("Markdown rendering cannot mount email HTML or its global styles", () => {
  const emailContent =
    '<div><!DOCTYPE html><html lang="en"><head><style>body {text-align: center;}</style></head>' +
    '<body><p>Your verification is 0892</p><img src="https://example.test/pixel" /></body></html></div>';
  const rendered = renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkRestrictRawHtml],
        rehypePlugins: [rehypeRaw],
      },
      emailContent,
    ),
  );

  assert.doesNotMatch(rendered, /<(?:style|script|img|html|body)(?:\s|>)/i);
  assert.match(rendered, /&lt;style&gt;body \{text-align: center;\}&lt;\/style&gt;/);
  assert.match(rendered, /Your verification is 0892/);
});

test("Markdown rendering still parses Lark mention elements", () => {
  const rendered = renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkRestrictRawHtml],
        rehypePlugins: [rehypeRaw],
      },
      '<at user_id="ou_abc">顾凯歌</at>',
    ),
  );

  assert.equal(rendered, '<p><at user_id="ou_abc">顾凯歌</at></p>');
});
