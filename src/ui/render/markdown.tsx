import type { AnchorHTMLAttributes, MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { normalizeWorkbenchUrl } from "../utils/workbench-url";

export const OPEN_BROWSER_WORKBENCH_URL_EVENT = "tech-cc-hub:open-browser-workbench-url";

export type OpenBrowserWorkbenchUrlDetail = {
  url: string;
};

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
    "font-medium text-blue-600 underline decoration-blue-500/30 underline-offset-2 transition hover:text-blue-700 hover:decoration-blue-500",
    className,
  ].filter(Boolean).join(" ");

  return (
    <a
      {...props}
      href={normalizedHref}
      className={classes}
      onClick={(event) => handleWorkbenchLinkClick(event, normalizedHref)}
    >
      {children}
    </a>
  );
}

export default function MDContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeHighlight]}
      components={{
        h1: (props) => <h1 className="mt-4 text-xl font-semibold text-ink-900" {...props} />,
        h2: (props) => <h2 className="mt-4 text-lg font-semibold text-ink-900" {...props} />,
        h3: (props) => <h3 className="mt-3 text-base font-semibold text-ink-800" {...props} />,
        p: (props) => <p className="mt-2 text-base leading-relaxed text-ink-700" {...props} />,
        ul: (props) => <ul className="mt-2 ml-4 grid list-disc gap-1" {...props} />,
        ol: (props) => <ol className="mt-2 ml-4 grid list-decimal gap-1" {...props} />,
        li: (props) => <li className="min-w-0 text-ink-700" {...props} />,
        a: (props) => <MarkdownLink {...props} />,
        strong: (props) => <strong className="text-ink-900 font-semibold" {...props} />,
        em: (props) => <em className="text-ink-800" {...props} />,
        pre: (props) => (
          <pre
            className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap rounded-xl bg-surface-tertiary p-3 text-sm text-ink-700"
            {...props}
          />
        ),
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
