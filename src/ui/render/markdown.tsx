import { isValidElement, memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { copyTextToClipboard } from "../utils/clipboard";
import {
  OPEN_BROWSER_WORKBENCH_URL_EVENT,
  PREVIEW_OPEN_FILE_EVENT,
  type OpenBrowserWorkbenchUrlDetail,
  type PreviewOpenFileDetail,
} from "../events";
import { normalizeWorkbenchUrl } from "../utils/workbench-url";

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }>;
};

let mermaidInitialized = false;

const SOURCE_FILE_EXTENSION_PATTERN = /\.(?:[cm]?[jt]sx?|jsonc?|ya?ml|toml|mdx?|py|sh|zsh|css|scss|html|go|rs|java|kt|swift|sql|vue|svelte|astro)(?::\d+(?:-\d+)?)?$/i;
const DEFAULT_EXPANDABLE_FRAME_CLASS = "group relative mt-3 overflow-hidden rounded-xl border border-black/8 bg-surface-tertiary";

function stripMarkdownLinkTarget(value: string): string {
  const trimmed = value.trim();
  const markdownLink = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(trimmed);
  return (markdownLink?.[2] ?? trimmed).replace(/^<(.+)>$/, "$1").replace(/^file=/i, "");
}

function parseLineTarget(value: string): { cleanPath: string; startLine?: number; endLine?: number } {
  let cleanPath = value;
  let startLine: number | undefined;
  let endLine: number | undefined;
  const hashIndex = cleanPath.indexOf("#");
  const anchor = hashIndex >= 0 ? cleanPath.slice(hashIndex + 1) : "";
  if (hashIndex >= 0) {
    cleanPath = cleanPath.slice(0, hashIndex);
  }
  const anchorLine = /^L?(\d+)(?:-L?(\d+))?$/i.exec(anchor);
  if (anchorLine) {
    startLine = Number(anchorLine[1]);
    endLine = anchorLine[2] ? Number(anchorLine[2]) : undefined;
  } else {
    const suffixLine = /:(\d+)(?:-\d+)?$/.exec(cleanPath);
    if (suffixLine) {
      startLine = Number(suffixLine[1]);
      const suffixRange = /:(\d+)-(\d+)$/.exec(cleanPath);
      endLine = suffixRange?.[2] ? Number(suffixRange[2]) : undefined;
      cleanPath = cleanPath.slice(0, -suffixLine[0].length);
    }
  }
  if (endLine && startLine && endLine < startLine) {
    endLine = startLine;
  }
  return { cleanPath, startLine, endLine };
}

function decodeFileTarget(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function joinWorkspacePath(sourceRoot: string, relativePath: string): string {
  const root = sourceRoot.replace(/[\\/]+$/, "");
  const child = relativePath.replace(/^[\\/]+/, "");
  return `${root}/${child}`;
}

function looksLikeWorkspaceSourcePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!SOURCE_FILE_EXTENSION_PATTERN.test(normalized)) return false;
  if (normalized.startsWith("./") || normalized.startsWith("../")) return false;
  if (normalized.includes("/")) return true;
  return /^(?:readme|package|tsconfig|vite\.config|eslint\.config|tailwind\.config|postcss\.config)\./i.test(normalized);
}

function parseSourceFileLink(href?: string, sourceRoot?: string): PreviewOpenFileDetail | null {
  const raw = stripMarkdownLinkTarget(href ?? "");
  if (!raw) return null;
  const { cleanPath, startLine, endLine } = parseLineTarget(raw);
  let path = cleanPath;
  let explicitFileLink = false;
  const fileSchemeMatch = /^file:\/\/(.*)$/i.exec(path);
  if (fileSchemeMatch) {
    explicitFileLink = true;
    path = fileSchemeMatch[1] ?? "";
    if (path.startsWith("/")) {
      path = `/${path.replace(/^\/+/, "")}`;
    }
  } else if (!sourceRoot || !looksLikeWorkspaceSourcePath(path)) {
    return null;
  }

  path = decodeFileTarget(path).trim();
  if (!path) return null;
  if (/^[a-z]+:\/\//i.test(path) || /^(?:javascript|data|mailto|tel):/i.test(path)) return null;
  if (!explicitFileLink && !looksLikeWorkspaceSourcePath(path)) return null;

  const absolutePath = path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path)
    ? path
    : sourceRoot
      ? joinWorkspacePath(sourceRoot, path)
      : "";
  if (!absolutePath) return null;
  return { filePath: absolutePath, startLine, endLine };
}

function openSourceFileFromMarkdown(sourceFile: PreviewOpenFileDetail, onOpenSourceFile?: (detail: PreviewOpenFileDetail) => void): void {
  if (onOpenSourceFile) {
    onOpenSourceFile(sourceFile);
    return;
  }
  window.dispatchEvent(new CustomEvent<PreviewOpenFileDetail>(PREVIEW_OPEN_FILE_EVENT, {
    detail: sourceFile,
  }));
}

function handleMarkdownLinkClick(
  event: MouseEvent<HTMLAnchorElement>,
  href?: string,
  sourceRoot?: string,
  onOpenSourceFile?: (detail: PreviewOpenFileDetail) => void,
): void {
  const sourceFile = parseSourceFileLink(href, sourceRoot);
  if (sourceFile && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    event.stopPropagation();
    openSourceFileFromMarkdown(sourceFile, onOpenSourceFile);
    return;
  }

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

function handleInlineCodeClick(
  event: MouseEvent<HTMLButtonElement>,
  sourceFile: PreviewOpenFileDetail,
  onOpenSourceFile?: (detail: PreviewOpenFileDetail) => void,
): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  openSourceFileFromMarkdown(sourceFile, onOpenSourceFile);
}

function MarkdownBlockLightbox({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[2147483647] flex h-dvh w-dvw items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[min(86vh,880px)] w-[min(92vw,1280px)] min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4">
          <div className="min-w-0 truncate text-sm font-semibold text-slate-900">{title}</div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            aria-label="关闭放大预览"
            title="关闭"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-white p-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MarkdownBlockActions({
  copyLabel,
  copyText,
  onExpand,
}: {
  copyLabel?: string;
  copyText?: string;
  onExpand: () => void;
}) {
  return (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
      {copyText ? (
        <button
          type="button"
          className="rounded-full border border-black/8 bg-white/90 px-2 py-1 text-[11px] font-semibold text-muted shadow-sm transition hover:text-accent"
          onClick={(event) => {
            event.stopPropagation();
            void copyTextToClipboard(copyText);
          }}
        >
          {copyLabel ?? "复制"}
        </button>
      ) : null}
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/8 bg-white/90 text-muted shadow-sm transition hover:text-accent"
        onClick={(event) => {
          event.stopPropagation();
          onExpand();
        }}
        aria-label="放大查看"
        title="放大查看"
      >
        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function ExpandableMarkdownBlock({
  title,
  copyLabel,
  copyText,
  className = DEFAULT_EXPANDABLE_FRAME_CLASS,
  children,
  expandedChildren,
}: {
  title: string;
  copyLabel?: string;
  copyText?: string;
  className?: string;
  children: ReactNode;
  expandedChildren?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className={className} onDoubleClick={() => setExpanded(true)}>
        <MarkdownBlockActions
          copyLabel={copyLabel}
          copyText={copyText}
          onExpand={() => setExpanded(true)}
        />
        {children}
      </div>
      {expanded ? (
        <MarkdownBlockLightbox title={title} onClose={() => setExpanded(false)}>
          {expandedChildren ?? children}
        </MarkdownBlockLightbox>
      ) : null}
    </>
  );
}

function MarkdownLink({
  href,
  className,
  children,
  node: _node,
  sourceRoot,
  onOpenSourceFile,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  node?: unknown;
  sourceRoot?: string;
  onOpenSourceFile?: (detail: PreviewOpenFileDetail) => void;
}) {
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
      onClick={(event) => handleMarkdownLinkClick(event, href ?? normalizedHref, sourceRoot, onOpenSourceFile)}
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

function extractCodeLanguage(children: ReactNode): string | undefined {
  if (Array.isArray(children)) {
    for (const child of children) {
      const language = extractCodeLanguage(child);
      if (language) return language;
    }
    return undefined;
  }
  if (!isValidElement(children)) return undefined;
  const props = children.props as { className?: string; children?: ReactNode };
  const match = /(?:^|\s)language-([\w-]+)/.exec(props.className ?? "");
  return match?.[1]?.toLowerCase() ?? extractCodeLanguage(props.children);
}

function getMermaidErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "Mermaid 渲染失败");
}

function removeMermaidCssTextNodes(element: Element): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.textContent?.trim() ?? "";
    if (/^#mermaid-[\s\S]*\{[\s\S]*font-family/i.test(text) || /^#mermaid-[\s\S]*\{[\s\S]*--mermaid/i.test(text)) {
      nodes.push(node);
    }
  }
  for (const node of nodes) {
    node.remove();
  }
}

function sanitizeMermaidSvgWithDom(svg: string): { svg: string; css: string } | null {
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (doc.querySelector("parsererror")) return null;
    const svgElement = doc.documentElement;
    if (!svgElement || svgElement.tagName.toLowerCase() !== "svg") return null;
    const cssBlocks: string[] = [];
    for (const style of Array.from(svgElement.querySelectorAll("style"))) {
      const css = style.textContent?.trim();
      if (css) cssBlocks.push(css);
      style.remove();
    }
    removeMermaidCssTextNodes(svgElement);
    svgElement.removeAttribute("role");
    svgElement.removeAttribute("aria-roledescription");
    svgElement.removeAttribute("aria-label");
    svgElement.removeAttribute("aria-labelledby");
    svgElement.removeAttribute("aria-describedby");
    svgElement.setAttribute("role", "img");
    svgElement.setAttribute("aria-label", "Mermaid 图表");
    return {
      svg: new XMLSerializer().serializeToString(svgElement),
      css: cssBlocks.join("\n"),
    };
  } catch {
    return null;
  }
}

function splitMermaidSvg(svg: string): { svg: string; css: string } {
  const parsed = sanitizeMermaidSvgWithDom(svg);
  if (parsed) return parsed;

  const cssBlocks: string[] = [];
  const withoutEmbeddedStyles = svg.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (styleTag) => {
    const css = /<style\b[^>]*>([\s\S]*?)<\/style>/i.exec(styleTag)?.[1]?.trim();
    if (css) cssBlocks.push(css);
    return "";
  }).replace(/#mermaid-[^<>{]*\{[^<]*font-family[^<]*\}/gi, "");
  const normalizedSvg = withoutEmbeddedStyles.replace(
    /<svg\b([^>]*)>/i,
    (_match, attributes: string) => {
      const normalizedAttributes = String(attributes ?? "")
        .replace(/\srole="[^"]*"/i, "")
        .replace(/\saria-roledescription="[^"]*"/i, "")
        .replace(/\saria-label="[^"]*"/i, "");
      return `<svg${normalizedAttributes} role="img" aria-label="Mermaid 图表">`;
    },
  );
  return { svg: normalizedSvg, css: cssBlocks.join("\n") };
}

function MermaidDiagram({ chart }: { chart: string }) {
  const rawId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedChart = useMemo(() => chart.trim(), [chart]);
  const diagramId = useMemo(() => `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [rawId]);
  const [renderState, setRenderState] = useState<{ status: "loading" | "ready" | "error"; svg?: string; css?: string; error?: string }>({
    status: "loading",
  });

  useEffect(() => {
    let disposed = false;
    setRenderState({ status: "loading" });
    if (!normalizedChart) {
      setRenderState({ status: "error", error: "Mermaid 图为空" });
      return () => {
        disposed = true;
      };
    }

    void import("mermaid")
      .then(async (mod) => {
        const mermaid = mod.default as MermaidApi;
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "base",
            themeVariables: {
              fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
              primaryColor: "#f8fafc",
              primaryTextColor: "#0f172a",
              primaryBorderColor: "#94a3b8",
              lineColor: "#64748b",
              secondaryColor: "#eef2ff",
              tertiaryColor: "#ecfdf5",
            },
          });
          mermaidInitialized = true;
        }
        return mermaid.render(diagramId, normalizedChart);
      })
      .then(({ svg, bindFunctions }) => {
        if (disposed) return;
        const normalized = splitMermaidSvg(svg);
        setRenderState({ status: "ready", svg: normalized.svg, css: normalized.css });
        window.requestAnimationFrame(() => {
          if (!disposed && containerRef.current && bindFunctions) {
            bindFunctions(containerRef.current);
          }
        });
      })
      .catch((error) => {
        if (!disposed) {
          setRenderState({ status: "error", error: getMermaidErrorMessage(error) });
        }
      });

    return () => {
      disposed = true;
    };
  }, [diagramId, normalizedChart]);

  useEffect(() => {
    if (renderState.status !== "ready" || !renderState.css) return undefined;
    const styleId = `tech-cc-mermaid-style-${diagramId}`;
    let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = styleId;
      styleElement.dataset.techCcMermaid = "true";
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = renderState.css;
    return () => {
      styleElement?.remove();
    };
  }, [diagramId, renderState.css, renderState.status]);

  if (renderState.status === "error") {
    return (
      <ExpandableMarkdownBlock
        title="Mermaid 源码"
        copyLabel="复制源码"
        copyText={normalizedChart}
        className="group relative mt-3 overflow-hidden rounded-xl border border-amber-200 bg-amber-50"
        expandedChildren={(
          <pre className="m-0 max-w-none whitespace-pre-wrap rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900 [overflow-wrap:anywhere]">
            {normalizedChart}
          </pre>
        )}
      >
        <div className="px-3 pt-3 text-xs font-semibold text-amber-800">Mermaid 图渲染失败</div>
        <div className="px-3 pt-1 text-xs leading-5 text-amber-700 [overflow-wrap:anywhere]">{renderState.error}</div>
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap p-3 pr-20 text-sm text-amber-900 [overflow-wrap:anywhere]">
          {normalizedChart}
        </pre>
      </ExpandableMarkdownBlock>
    );
  }

  return (
    <ExpandableMarkdownBlock
      title="Mermaid 图表"
      copyLabel="复制源码"
      copyText={normalizedChart}
      className="group relative mt-3 overflow-x-auto rounded-xl border border-black/8 bg-white p-4 shadow-sm"
      expandedChildren={renderState.status === "loading" ? (
        <div className="flex min-h-64 items-center justify-center text-sm font-medium text-muted">正在渲染 Mermaid 图...</div>
      ) : (
        <div
          className="mermaid-diagram min-w-fit [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-none"
          dangerouslySetInnerHTML={{ __html: renderState.svg ?? "" }}
        />
      )}
    >
      {renderState.status === "loading" ? (
        <div className="flex min-h-28 items-center justify-center text-sm font-medium text-muted">正在渲染 Mermaid 图...</div>
      ) : (
        <div
          ref={containerRef}
          className="mermaid-diagram min-w-fit [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-none"
          dangerouslySetInnerHTML={{ __html: renderState.svg ?? "" }}
        />
      )}
    </ExpandableMarkdownBlock>
  );
}

function MDContent({
  text,
  sourceRoot,
  onOpenSourceFile,
}: {
  text: string;
  sourceRoot?: string;
  onOpenSourceFile?: (detail: PreviewOpenFileDetail) => void;
}) {
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
        a: (props) => <MarkdownLink {...props} sourceRoot={sourceRoot} onOpenSourceFile={onOpenSourceFile} />,
        strong: (props) => <strong className="text-ink-900 font-semibold" {...props} />,
        em: (props) => <em className="text-ink-800" {...props} />,
        table: (props) => {
          const table = <table className="min-w-full border-collapse text-sm" {...props} />;
          const expandedTable = <table className="min-w-full border-collapse text-sm" {...props} />;
          return (
            <ExpandableMarkdownBlock
              title="表格预览"
              copyLabel="复制表格"
              copyText={extractText(props.children)}
              className="group relative mt-3 max-w-full overflow-x-auto rounded-xl border border-black/8 bg-white"
              expandedChildren={(
                <div className="min-w-fit">
                  {expandedTable}
                </div>
              )}
            >
              {table}
            </ExpandableMarkdownBlock>
          );
        },
        th: (props) => <th className="border-b border-black/8 bg-surface-secondary px-3 py-2 text-left font-semibold text-ink-800 [overflow-wrap:anywhere]" {...props} />,
        td: (props) => <td className="border-b border-black/6 px-3 py-2 text-ink-700 [overflow-wrap:anywhere]" {...props} />,
        input: (props) => <input className="mr-2 align-middle accent-[var(--color-accent)]" disabled {...props} />,
        pre: ({ children, ...props }) => {
          const code = extractText(children);
          const language = extractCodeLanguage(children);
          if (language === "mermaid") {
            return <MermaidDiagram chart={code} />;
          }
          return (
            <ExpandableMarkdownBlock
              title={language ? `${language} 代码` : "代码块"}
              copyLabel="复制代码"
              copyText={code}
              expandedChildren={(
                <pre
                  className="m-0 max-w-none whitespace-pre-wrap rounded-lg bg-surface-tertiary p-4 text-sm leading-6 text-ink-700 [overflow-wrap:anywhere]"
                  {...props}
                >
                  {children}
                </pre>
              )}
            >
              <pre
                className="max-w-full overflow-x-auto whitespace-pre-wrap p-3 pr-20 text-sm text-ink-700 [overflow-wrap:anywhere]"
                {...props}
              >
                {children}
              </pre>
            </ExpandableMarkdownBlock>
          );
        },
        code: (props) => {
          const { children, className, ...rest } = props;
          const match = /language-(\w+)/.exec(className || "");
          const rawCode = extractText(children).trim();
          const isInline = !match && !rawCode.includes("\n");
          const sourceFile = isInline ? parseSourceFileLink(rawCode, sourceRoot) : null;

          return isInline ? (
            sourceFile ? (
              <button
                type="button"
                className="inline rounded bg-surface-tertiary px-1.5 py-0.5 text-left font-mono text-base text-accent underline-offset-2 transition [overflow-wrap:anywhere] hover:bg-accent/10 hover:underline"
                onClick={(event) => handleInlineCodeClick(event, sourceFile, onOpenSourceFile)}
                aria-label={`打开源码文件 ${rawCode}`}
                title="打开源码文件"
              >
                <code {...rest}>{children}</code>
              </button>
            ) : (
              <code className="rounded bg-surface-tertiary px-1.5 py-0.5 text-accent font-mono text-base [overflow-wrap:anywhere]" {...rest}>
                {children}
              </code>
            )
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
