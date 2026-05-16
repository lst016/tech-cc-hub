# src/ui/render/markdown.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：131

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `handleWorkbenchLinkClick@13`
- `MarkdownLink@26`
- `extractText@54`
- `MDContent@63`
- `url@15`
- `normalizedHref@35`
- `classes@36`
- `code@89`
- `match@110`
- `isInline@111`
- `h1@70`
- `h2@71`
- `h3@72`
- `p@73`
- `ul@74`
- `ol@75`
- `li@76`
- `a@77`
- `strong@78`
- `em@79`
- `table@80`
- `th@85`
- `td@86`
- `input@87`
- `pre@88`
- `code@108`

## 依赖输入

- `react`
- `react-markdown`
- `rehype-highlight`
- `rehype-katex`
- `rehype-raw`
- `remark-breaks`
- `remark-gfm`
- `remark-math`
- `../utils/clipboard`
- `../events`
- `../utils/workbench-url`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { memo } from "react";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { copyTextToClipboard } from "../utils/clipboard";
import { OPEN_BROWSER_WORKBENCH_URL_EVENT, type OpenBrowserWorkbenchUrlDetail } from "../events";
import { normalizeWorkbenchUrl } from "../utils/workbench-url";

function handleWorkbenchLinkClick(event: MouseEvent<HTMLAnchorElement>, href?: string): void {
  const url = normalizeWorkbenchUrl(href);
  if (!url || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  window.dispatchEvent(new CustomEvent<OpenBrowserWorkbenchUrlDetail>(OPEN_BROWSER_WORKBENCH_URL_EVENT, {
    detail: { url },
  }));
}

function MarkdownLink({
  href,
  className,
  children,
  node: _node,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) {
  void _node;
  const normalizedHref = normalizeWorkbenchUrl(href) ?? href;
  const classes = [
    "font-medium text-accent underline decoration-accent/30 underline-offset-2 transition hover:text-accent/80 hover:decoration-accent [overflow-wrap:anywhere]",
    className,
  ].filter(Boolean).join(" ");

  return (
    <a
      {...props}
      href={normalizedHref}
      className={classes}
      rel="noreferrer"
      target={normalizedHref?.startsWith("http") ? "_blank" : props.target}
      onClick={(event) => handleWorkbenchLinkClick(event, normalizedHref)}
    >
      {children}
    </a>
  );
}

function extractText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractText((children as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function MDContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
      rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
      components={{
        h1: (props) => <h1 className="mt-4 text-xl font-semibold text-ink-900" {...props} />,
        h2: (props) => <h2 className="mt-4 text-lg font-semibold text-ink-900" {...props} />,
        h3: (props) => <h3 className="mt-3 text-base font-semibold text-ink-800" {...props} />,
        p: (props) => <p className="mt-2 min-w-0 text-base leading-relaxed text-ink-700 [overflow-wrap:anywhere]" {...props} />,
        ul: (props) => <ul className="mt-2 ml-4 grid min-w-0 list-disc gap-1 has-[:checked]:list-none has-[:checked]:ml-0" {...props} />,
        ol: (props) => <ol className="mt-2 ml-4 grid min-w-0 list-decimal gap-1" {...props} />,
        li: (props) => <li className="min-w-0 text-ink-700 marker:text-muted [overflow-wrap:anywhere]" {...props} />,
        a: (props) => <MarkdownLink {...props} />,
        strong: (props) => <strong className="text-ink-900 font-semibold" {...props} />,
        em: (props) => <em className="text-ink-800" {...props} />,
        table: (props) => (
          <div className="mt-3 max-w-full overflow-x-auto rounded-xl border border-black/8 bg-white">
            <table className="min-w-full border-collapse text-sm" {...props} />
          </div>
        ),
        th: (props) => <th className="border-b border-black/8 bg-surface-secondary px-3 py-2 text-left font-semibold text-ink-800 [overflow-wrap:anywhere]" {...props} />,
        td: (props) => <td className="border-b border-black/6 px-3 py-2 text-ink-700 [overflow-wrap:anywhere]" {...props} />,
        input: (props) => <input className="mr-2 align-middle accent-[var(--color-accent)]" disabled {...props} />,
        pre: ({ children, ...props }) => {
          const code = extractText(children);
          return (
... (truncated)
```
