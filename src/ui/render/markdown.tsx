import { isValidElement, memo, useEffect, useId, useMemo, useRef, useState } from "react";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
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

function stripMarkdownLinkTarget(value: string): string {
  return value.trim().replace(/^<(.+)>$/, "$1").replace(/^file=/i, "");
}

function parseLineTarget(value: string): { cleanPath: string; startLine?: number } {
  let cleanPath = value;
  let startLine: number | undefined;
  const hashIndex = cleanPath.indexOf("#");
  const anchor = hashIndex >= 0 ? cleanPath.slice(hashIndex + 1) : "";
  if (hashIndex >= 0) {
    cleanPath = cleanPath.slice(0, hashIndex);
  }
  const anchorLine = /(?:^|-)L?(\d+)/i.exec(anchor);
  if (anchorLine) {
    startLine = Number(anchorLine[1]);
  } else {
    const suffixLine = /:(\d+)(?:-\d+)?$/.exec(cleanPath);
    if (suffixLine) {
      startLine = Number(suffixLine[1]);
      cleanPath = cleanPath.slice(0, -suffixLine[0].length);
    }
  }
  return { cleanPath, startLine };
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
  const { cleanPath, startLine } = parseLineTarget(raw);
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
  return { filePath: absolutePath, startLine };
}

function handleMarkdownLinkClick(event: MouseEvent<HTMLAnchorElement>, href?: string, sourceRoot?: string): void {
  const sourceFile = parseSourceFileLink(href, sourceRoot);
  if (sourceFile && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent<PreviewOpenFileDetail>(PREVIEW_OPEN_FILE_EVENT, {
      detail: sourceFile,
    }));
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

function MarkdownLink({
  href,
  className,
  children,
  node: _node,
  sourceRoot,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown; sourceRoot?: string }) {
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
      onClick={(event) => handleMarkdownLinkClick(event, href ?? normalizedHref, sourceRoot)}
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

function splitMermaidSvg(svg: string): { svg: string; css: string } {
  const cssBlocks: string[] = [];
  const withoutEmbeddedStyles = svg.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (styleTag) => {
    const css = /<style\b[^>]*>([\s\S]*?)<\/style>/i.exec(styleTag)?.[1]?.trim();
    if (css) cssBlocks.push(css);
    return "";
  });
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
      <div className="group relative mt-3 overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
        <button
          type="button"
          className="absolute right-2 top-2 z-10 rounded-full border border-amber-200 bg-white/90 px-2 py-1 text-[11px] font-semibold text-amber-700 opacity-0 shadow-sm transition hover:text-amber-900 group-hover:opacity-100"
          onClick={() => void copyTextToClipboard(normalizedChart)}
        >
          复制源码
        </button>
        <div className="px-3 pt-3 text-xs font-semibold text-amber-800">Mermaid 图渲染失败</div>
        <div className="px-3 pt-1 text-xs leading-5 text-amber-700 [overflow-wrap:anywhere]">{renderState.error}</div>
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap p-3 pr-20 text-sm text-amber-900 [overflow-wrap:anywhere]">
          {normalizedChart}
        </pre>
      </div>
    );
  }

  return (
    <div className="group relative mt-3 overflow-x-auto rounded-xl border border-black/8 bg-white p-4 shadow-sm">
      <button
        type="button"
        className="absolute right-2 top-2 z-10 rounded-full border border-black/8 bg-white/90 px-2 py-1 text-[11px] font-semibold text-muted opacity-0 shadow-sm transition hover:text-accent group-hover:opacity-100"
        onClick={() => void copyTextToClipboard(normalizedChart)}
      >
        复制源码
      </button>
      {renderState.status === "loading" ? (
        <div className="flex min-h-28 items-center justify-center text-sm font-medium text-muted">正在渲染 Mermaid 图...</div>
      ) : (
        <div
          ref={containerRef}
          className="mermaid-diagram min-w-fit [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-none"
          dangerouslySetInnerHTML={{ __html: renderState.svg ?? "" }}
        />
      )}
    </div>
  );
}

function MDContent({ text, sourceRoot }: { text: string; sourceRoot?: string }) {
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
        a: (props) => <MarkdownLink {...props} sourceRoot={sourceRoot} />,
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
          const language = extractCodeLanguage(children);
          if (language === "mermaid") {
            return <MermaidDiagram chart={code} />;
          }
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
                className="max-w-full overflow-x-auto whitespace-pre-wrap p-3 pr-20 text-sm text-ink-700 [overflow-wrap:anywhere]"
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
            <code className="rounded bg-surface-tertiary px-1.5 py-0.5 text-accent font-mono text-base [overflow-wrap:anywhere]" {...rest}>
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
