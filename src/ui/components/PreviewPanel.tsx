import { useCallback, useMemo, useRef, useState } from "react";
import hljs from "highlight.js";
import MDContent from "../render/markdown";

type PreviewFile = {
  path: string;
  content?: string;
  language?: string;
  error?: string;
};

type PreviewTab = PreviewFile & {
  id: string;
  loading: boolean;
  error?: string;
};

type PreviewPanelProps = {
  files: PreviewFile[];
  activeFileId?: string;
  onClose?: () => void;
  onSelectFile?: (fileId: string) => void;
};

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"]);

function isImageFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function detectLanguage(filePath: string): string | undefined {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
    ".py": "python", ".rb": "ruby", ".go": "go", ".rs": "rust", ".java": "java",
    ".css": "css", ".html": "html", ".json": "json", ".yaml": "yaml", ".yml": "yaml",
    ".xml": "xml", ".sql": "sql", ".sh": "bash", ".bash": "bash", ".md": "markdown",
    ".markdown": "markdown",
  };
  return map[ext];
}

function fileNameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

function highlightCode(code: string, language?: string): string {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(code, { language }).value;
  }
  const result = hljs.highlightAuto(code);
  return result.value;
}

export function PreviewPanel({ files, activeFileId, onClose, onSelectFile }: PreviewPanelProps) {
  const [closedTabIds, setClosedTabIds] = useState<Set<string>>(() => new Set());
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"preview" | "source">("preview");
  const [zoomedImageTabId, setZoomedImageTabId] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const tabs = useMemo<PreviewTab[]>(
    () =>
      files
        .filter((file) => !closedTabIds.has(file.path))
        .map((file) => ({
          ...file,
          id: file.path,
          loading: false,
          language: file.language ?? detectLanguage(file.path),
        })),
    [closedTabIds, files],
  );

  const resolvedActiveTabId =
    (activeFileId && tabs.some((tab) => tab.id === activeFileId) ? activeFileId : undefined) ??
    (activeTabId && tabs.some((tab) => tab.id === activeTabId) ? activeTabId : undefined) ??
    tabs[0]?.id ??
    "";
  const activeTab = tabs.find((t) => t.id === resolvedActiveTabId);
  const isMarkdown = activeTab?.language === "markdown";
  const isImage = activeTab ? isImageFile(activeTab.path) : false;
  const imageZoom = Boolean(resolvedActiveTabId && zoomedImageTabId === resolvedActiveTabId);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const removedIndex = tabs.findIndex((t) => t.id === tabId);
      const next = tabs.filter((t) => t.id !== tabId);
      setClosedTabIds((current) => {
        const updated = new Set(current);
        updated.add(tabId);
        return updated;
      });
      if (zoomedImageTabId === tabId) {
        setZoomedImageTabId(null);
      }
      if (next.length === 0) {
        setActiveTabId("");
        onClose?.();
        return;
      }
      if (tabId === resolvedActiveTabId) {
        const nextActive = next[Math.min(Math.max(removedIndex, 0), next.length - 1)];
        setActiveTabId(nextActive.id);
        onSelectFile?.(nextActive.id);
      }
    },
    [onClose, onSelectFile, resolvedActiveTabId, tabs, zoomedImageTabId],
  );

  if (tabs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="text-sm text-muted">打开 ActivityRail 中的文件节点以预览内容</div>
      </div>
    );
  }

  const activeContent = !activeTab?.loading && !activeTab?.error ? activeTab?.content : null;
  const hasPreviewContent = activeContent != null;
  const hasEmptyContent = !activeTab?.loading && !activeTab?.error && activeContent == null;
  const highlightedCode =
    hasPreviewContent && !isMarkdown && !isImage ? highlightCode(activeContent, activeTab?.language) : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0D0F12]">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center border-b border-white/[0.06]">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTabId(tab.id);
                setZoomedImageTabId(null);
                onSelectFile?.(tab.id);
              }}
              className={`group flex shrink-0 items-center gap-2 border-r border-white/[0.06] px-3 py-2.5 text-left text-xs transition ${
                tab.id === resolvedActiveTabId
                  ? "bg-white/[0.06] text-white/70"
                  : "text-ink-500 hover:bg-white/[0.03] hover:text-white/90"
              }`}
            >
              <span className="max-w-[160px] truncate font-medium">
                {fileNameFromPath(tab.path)}
              </span>
              {tab.loading && (
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent/60" />
              )}
              <button
                type="button"
                className="ml-1 rounded p-0.5 text-muted opacity-0 transition hover:bg-white/[0.08] hover:text-white/70 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
                aria-label={`关闭 ${fileNameFromPath(tab.path)}`}
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </button>
          ))}
        </div>
        {onClose && (
          <button
            type="button"
            className="shrink-0 px-3 py-2.5 text-muted transition hover:bg-white/[0.06] hover:text-white/70"
            onClick={onClose}
            aria-label="关闭预览面板"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Breadcrumb / mode toggle */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.04] px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted truncate">{activeTab?.path}</span>
        {isMarkdown && (
          <div className="ml-auto flex gap-1">
            {(["preview", "source"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded px-2 py-0.5 text-[11px] transition ${
                  viewMode === mode ? "bg-white/[0.08] text-white/80" : "text-muted hover:text-ink-400"
                }`}
              >
                {mode === "preview" ? "预览" : "源码"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex min-h-0 flex-1 overflow-auto">
        {/* Loading state */}
        {activeTab?.loading && (
          <div className="flex flex-1 items-center justify-center gap-3 p-8">
            <span className="h-3 w-3 animate-pulse rounded-full bg-accent/60" />
            <span className="text-sm text-muted">读取中...</span>
          </div>
        )}

        {/* Error state */}
        {activeTab?.error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
            <div className="rounded-full bg-error/10 px-3 py-1 text-[11px] font-semibold text-error">读取失败</div>
            <div className="text-sm text-muted">{activeTab.error}</div>
          </div>
        )}

        {/* Empty content */}
        {hasEmptyContent && (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
            暂无内容
          </div>
        )}

        {/* Image preview */}
        {hasPreviewContent && isImage && (
          <div
            className={`flex flex-1 items-center justify-center p-4 ${imageZoom ? "cursor-zoom-out" : "cursor-zoom-in"}`}
            onClick={() => setZoomedImageTabId(imageZoom ? null : resolvedActiveTabId)}
          >
            <img
              ref={imgRef}
              src={activeContent ?? ""}
              alt={fileNameFromPath(activeTab?.path ?? "")}
              className={
                imageZoom
                  ? "max-h-none max-w-none rounded-lg"
                  : "max-h-full max-w-full rounded-lg object-contain"
              }
            />
          </div>
        )}

        {/* Markdown preview */}
        {hasPreviewContent && isMarkdown && (
          <>
            {viewMode === "preview" ? (
              <div className="min-w-0 flex-1 overflow-auto px-4 py-3">
                <MDContent text={activeContent ?? ""} />
              </div>
            ) : (
              <pre className="min-w-0 flex-1 overflow-auto p-4 font-mono text-[13px] leading-6 text-white/80 whitespace-pre-wrap">
                {activeContent}
              </pre>
            )}
          </>
        )}

        {/* Code preview (non-markdown, non-image) */}
        {hasPreviewContent && !isMarkdown && !isImage && highlightedCode && (
          <pre className="min-w-0 flex-1 overflow-auto p-4 font-mono text-[13px] leading-6 whitespace-pre-wrap">
            <code
              className={`language-${activeTab?.language ?? "text"}`}
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          </pre>
        )}
      </div>
    </div>
  );
}
