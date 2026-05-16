# src/ui/components/PreviewPanel.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：275

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `isImageFile@26`
- `detectLanguage@31`
- `fileNameFromPath@43`
- `highlightCode@47`
- `PreviewPanel@55`
- `IMAGE_EXTENSIONS@24`
- `ext@28`
- `ext@33`
- `result@52`
- `imgRef@61`
- `tabs@62`
- `resolvedActiveTabId@75`
- `activeTab@81`
- `isMarkdown@82`
- `isImage@83`
- `imageZoom@84`
- `handleCloseTab@85`
- `removedIndex@88`
- `next@89`
- `updated@91`
- `nextActive@104`
- `activeContent@119`
- `hasPreviewContent@121`
- `hasEmptyContent@122`
- `highlightedCode@123`
- `PreviewFile@4`
- `PreviewTab@11`
- `PreviewPanelProps@17`

## 依赖输入

- `react`
- `highlight.js`
- `../render/markdown`

## 对外暴露

- `PreviewPanel`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
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
  const hasEmptyC
... (truncated)
```
