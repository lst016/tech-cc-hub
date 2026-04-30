import { useCallback, useEffect, useMemo, useState } from "react";

type PreviewFile = {
  path: string;
  content?: string;
  language?: string;
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
const CODE_EXTENSIONS: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
  ".py": "python", ".rb": "ruby", ".go": "go", ".rs": "rust", ".java": "java",
  ".css": "css", ".html": "html", ".json": "json", ".yaml": "yaml", ".yml": "yaml",
  ".xml": "xml", ".sql": "sql", ".sh": "bash", ".bash": "bash", ".md": "markdown",
  ".markdown": "markdown",
};

function detectLanguage(filePath: string): string | undefined {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return CODE_EXTENSIONS[ext];
}

function isImageFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function fileNameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

export function PreviewPanel({ files, activeFileId, onClose, onSelectFile }: PreviewPanelProps) {
  const [tabs, setTabs] = useState<PreviewTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"preview" | "source">("preview");

  useEffect(() => {
    setTabs((current) => {
      const next: PreviewTab[] = [];
      const existingMap = new Map(current.map((t) => [t.path, t]));

      for (const file of files) {
        const existing = existingMap.get(file.path);
        if (existing) {
          next.push(existing);
          continue;
        }
        const tab: PreviewTab = {
          ...file,
          id: file.path,
          loading: false,
          language: file.language ?? detectLanguage(file.path),
        };
        next.push(tab);
      }

      return next;
    });
  }, [files]);

  useEffect(() => {
    const targetId = activeFileId ?? tabs[0]?.id;
    if (targetId && targetId !== activeTabId) {
      setActiveTabId(targetId);
    }
  }, [activeFileId, tabs, activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isMarkdown = activeTab?.language === "markdown";
  const isImage = activeTab ? isImageFile(activeTab.path) : false;

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setTabs((current) => {
        const next = current.filter((t) => t.id !== tabId);
        if (tabId === activeTabId && next.length > 0) {
          const removedIndex = current.findIndex((t) => t.id === tabId);
          const nextActive = next[Math.min(removedIndex, next.length - 1)];
          setActiveTabId(nextActive.id);
          onSelectFile?.(nextActive.id);
        }
        if (next.length === 0) {
          onClose?.();
        }
        return next;
      });
    },
    [activeTabId, onClose, onSelectFile],
  );

  const renderedMarkdown = useMemo(() => {
    if (!isMarkdown || !activeTab?.content) return null;
    let html = activeTab.content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/^\- (.+)$/gm, "<li>$1</li>")
      .replace(/^(\d+)\. (.+)$/gm, "<li>$1. $2</li>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>");
    html = `<p>${html}</p>`;
    return html;
  }, [isMarkdown, activeTab?.content]);

  if (tabs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="text-sm text-muted">打开 ActivityRail 中的文件节点以预览内容</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-950">
      <div className="flex shrink-0 items-center border-b border-white/[0.06]">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTabId(tab.id);
                onSelectFile?.(tab.id);
              }}
              className={`group flex shrink-0 items-center gap-2 border-r border-white/[0.06] px-3 py-2.5 text-left text-xs transition ${
                tab.id === activeTabId
                  ? "bg-white/[0.06] text-ink-100"
                  : "text-ink-500 hover:bg-white/[0.03] hover:text-ink-300"
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
                className="ml-1 rounded p-0.5 text-muted opacity-0 transition hover:bg-white/[0.08] hover:text-ink-300 group-hover:opacity-100"
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
            className="shrink-0 px-3 py-2.5 text-muted transition hover:bg-white/[0.06] hover:text-ink-300"
            onClick={onClose}
            aria-label="关闭预览面板"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

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
                  viewMode === mode ? "bg-white/[0.08] text-ink-200" : "text-muted hover:text-ink-400"
                }`}
              >
                {mode === "preview" ? "预览" : "源码"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 overflow-auto">
        {activeTab?.loading && (
          <div className="flex flex-1 items-center justify-center gap-3 p-8">
            <span className="h-3 w-3 animate-pulse rounded-full bg-accent/60" />
            <span className="text-sm text-muted">读取中...</span>
          </div>
        )}

        {activeTab?.error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
            <div className="rounded-full bg-error/10 px-3 py-1 text-[11px] font-semibold text-error">读取失败</div>
            <div className="text-sm text-muted">{activeTab.error}</div>
          </div>
        )}

        {!activeTab?.loading && !activeTab?.error && activeTab?.content != null && (
          <>
            {isImage ? (
              <div className="flex flex-1 items-center justify-center p-4">
                <img
                  src={activeTab.content}
                  alt={fileNameFromPath(activeTab.path)}
                  className="max-h-full max-w-full rounded-lg object-contain"
                />
              </div>
            ) : isMarkdown && viewMode === "preview" && renderedMarkdown ? (
              <div
                className="min-w-0 flex-1 overflow-auto px-4 py-3 text-sm leading-7 text-ink-200 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-ink-100 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink-100 [&_h3]:text-sm [&_h3]:font-semibold [&_code]:rounded [&_code]:bg-white/[0.06] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:text-accent [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2"
                dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
              />
            ) : (
              <pre className="min-w-0 flex-1 overflow-auto p-4 font-mono text-[13px] leading-6 text-ink-200 whitespace-pre-wrap">
                {activeTab.content}
              </pre>
            )}
          </>
        )}

        {!activeTab?.loading && !activeTab?.error && activeTab?.content == null && (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
            暂无内容
          </div>
        )}
      </div>
    </div>
  );
}
