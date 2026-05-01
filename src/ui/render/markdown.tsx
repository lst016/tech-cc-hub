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
  const normalizedHref = normalizeWorkbenchUrl(href) ?? href;
  const classes = [
    "font-medium text-accent underline decoration-accent/30 underline-offset-2 transition hover:text-accent/80 hover:decoration-accent",
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
        p: (props) => <p className="mt-2 text-base leading-relaxed text-ink-700" {...props} />,
        ul: (props) => <ul className="mt-2 ml-4 grid list-disc gap-1 has-[:checked]:list-none has-[:checked]:ml-0" {...props} />,
        ol: (props) => <ol className="mt-2 ml-4 grid list-decimal gap-1" {...props} />,
        li: (props) => <li className="min-w-0 text-ink-700 marker:text-muted" {...props} />,
        a: (props) => <MarkdownLink {...props} />,
        strong: (props) => <strong className="text-ink-900 font-semibold" {...props} />,
        em: (props) => <em className="text-ink-800" {...props} />,
        table: (props) => (
          <div className="mt-3 max-w-full overflow-x-auto rounded-xl border border-black/8 bg-white">
            <table className="min-w-full border-collapse text-sm" {...props} />
          </div>
        ),
        th: (props) => <th className="border-b border-black/8 bg-surface-secondary px-3 py-2 text-left font-semibold text-ink-800" {...props} />,
        td: (props) => <td className="border-b border-black/6 px-3 py-2 text-ink-700" {...props} />,
        input: (props) => <input className="mr-2 align-middle accent-[var(--color-accent)]" disabled {...props} />,
        pre: ({ children, ...props }) => {
          const code = extractText(children);
          return (
            <div className="group relative mt-3 overflow-hidden rounded-xl border border-black/8 bg-surface-tertiary">
              <button
                type="button"
                className="absolute right-2 top-2 z-10 rounded-full border border-black/8 bg-white/90 px-2 py-1 text-[11px] font-semibold text-muted opacity-0 shadow-sm transition hover:text-accent group-hover:opacity-100"
                onClick={() => void copyTextToClipboard(code)}
              >
                复制代码
              </button>
              <pre
                className="max-w-full overflow-x-auto whitespace-pre-wrap p-3 pr-20 text-sm text-ink-700"
                {...props}
              >
                {children}
              </pre>
            </div>
          );
        },
        code: (props) => {
          const { children, className, ...rest } = props;
          const match = /language-(\w+)/.exec(className || "");
          const isInline = !match && !String(children).includes("\n");

          return isInline ? (
            <code className="rounded bg-surface-tertiary px-1.5 py-0.5 text-accent font-mono text-base" {...rest}>
              {children}
            </code>
          ) : (
            <code className={`${className} font-mono`} {...rest}>
              {children}
            </code>
          );
        }
      }}
    >
      {String(text ?? "")}
    </ReactMarkdown>
  )
}

export default memo(MDContent);
