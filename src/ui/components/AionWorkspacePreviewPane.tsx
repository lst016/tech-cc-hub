import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { ChevronLeft, ChevronRight, LocateFixed, RefreshCw } from 'lucide-react';
import { PROMPT_FOCUS_EVENT, PROMPT_SENT_EVENT, PROMPT_SUBMIT_EVENT } from '../events';
import {
  filterPreviewQuickOpenEntries,
  type PreviewQuickOpenEntry,
} from '../../shared/preview-quick-open';
import { getCodeReferenceSessionKey, useAppStore, type CodeReferenceDraft } from '../store/useAppStore';
import { copyTextToClipboard } from '../utils/clipboard';
import {
  collectCompletedPreviewFileChanges,
  normalizePreviewFilePath,
  resolvePreviewFileChangePath,
  type PreviewFileChangeEvent,
} from '../utils/preview-file-refresh';
import {
  buildPreviewMonacoModelPath,
  getFileExtension,
  normalizeMonacoLanguage,
} from '../utils/preview-language';
import { calculateSelectionOverlayPosition } from '../utils/selection-overlay-position';
import {
  getPreviewFileAncestorDirectories,
} from '../utils/preview-file-locator';
import {
  confirmClosePreviewTabs,
  isPreviewTabDirty,
  markPreviewTabContent,
} from '../utils/preview-tab-state';
import MDContent from '../render/markdown';
import './AionWorkspacePreviewPane.css';

type MonacoWorkerEnvironment = typeof self & {
  MonacoEnvironment?: {
    getWorker?: (_: string, label: string) => Worker;
  };
};

type MonacoTypeScriptDefaults = {
  setCompilerOptions: (options: Record<string, unknown>) => void;
  setDiagnosticsOptions: (options: Record<string, unknown>) => void;
};

type MonacoTypeScriptRuntime = {
  JsxEmit?: { Preserve?: number };
  ModuleKind?: { ESNext?: number };
  ModuleResolutionKind?: { NodeJs?: number };
  ScriptTarget?: { ESNext?: number };
  typescriptDefaults?: MonacoTypeScriptDefaults;
  javascriptDefaults?: MonacoTypeScriptDefaults;
};

const monacoGlobal = self as MonacoWorkerEnvironment;
let previewMonacoDefaultsConfigured = false;

if (!monacoGlobal.MonacoEnvironment?.getWorker) {
  monacoGlobal.MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label === 'json') {
        return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url), { type: 'module' });
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url), { type: 'module' });
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new Worker(new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url), { type: 'module' });
      }
      if (label === 'typescript' || label === 'javascript') {
        return new Worker(new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url), { type: 'module' });
      }
      return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), { type: 'module' });
    },
  };
}

loader.config({ monaco });

const ROOT_DEPTH = 0;
const EMPTY_CODE_REFERENCES: CodeReferenceDraft[] = [];
const EMPTY_PREVIEW_RECENT_PATHS: string[] = [];

type AionWorkspacePreviewPaneProps = {
  workspace?: string;
  conversationId?: string;
  messages?: readonly unknown[];
  pendingOpenRequest?: {
    filePath: string;
    startLine?: number;
    endLine?: number;
    nonce: number;
  };
  onConsumePendingOpenRequest?: () => void;
  onClose?: () => void;
};

type PreviewEntry = {
  name: string;
  path: string;
  relativePath: string;
  type: 'directory' | 'file';
  size?: number;
};

type PreviewQuickOpenResponse = {
  success: boolean;
  entries?: PreviewQuickOpenEntry[];
  truncated?: boolean;
  error?: string;
};

type DirectoryState = {
  entries: PreviewEntry[];
  loading: boolean;
  error?: string;
  loadedAt?: number;
};

type PreviewContentType = 'code' | 'html' | 'image';

type ActivePreviewFile = {
  path: string;
  fileName: string;
  relativePath: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  contentType: PreviewContentType;
  language?: string;
  loading?: boolean;
  error?: string;
  revealLine?: number;
};

type TabContextMenuState = {
  path: string;
  x: number;
  y: number;
};

type CodeSelectionInfo = {
  startLine: number;
  endLine: number;
  text: string;
  top: number;
  left: number;
  commentTop: number;
};

type PreviewGitHunkLine = {
  kind: 'context' | 'added' | 'removed';
  text: string;
  oldLine?: number;
  newLine?: number;
};

type PreviewGitChangeHunk = {
  id: string;
  type: 'added' | 'modified' | 'removed';
  startLine: number;
  endLine: number;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: PreviewGitHunkLine[];
};

type PreviewGitPopover = {
  hunk: PreviewGitChangeHunk;
  top: number;
  left: number;
};

function basename(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function getRelativePath(workspace: string, filePath: string) {
  if (filePath === workspace) return basename(workspace);
  if (filePath.startsWith(`${workspace}/`)) return filePath.slice(workspace.length + 1);
  return filePath;
}

function isAbsolutePreviewPath(path: string) {
  return /^[a-z]:[\\/]/i.test(path) || path.startsWith('/') || path.startsWith('\\\\');
}

function dirname(path: string) {
  const trimmedPath = path.replace(/[\\/]+$/, '');
  const index = Math.max(trimmedPath.lastIndexOf('/'), trimmedPath.lastIndexOf('\\'));
  if (index <= 0) return trimmedPath;
  return trimmedPath.slice(0, index);
}

function inferContentType(filePath: string, content?: string): PreviewContentType {
  if (content?.startsWith('data:image/')) return 'image';
  const extension = getFileExtension(filePath);
  if (extension === 'html' || extension === 'htm') {
    if (isRuntimeHtmlShell(content)) return 'code';
    return 'html';
  }
  return 'code';
}

function isRuntimeHtmlShell(content?: string) {
  if (!content) return false;
  return (
    /<div\s+id=["'](?:root|app)["'][^>]*>\s*<\/div>/i.test(content)
    && /<script[^>]+type=["']module["'][^>]+src=["'][^"']*(?:\/src\/|\/assets\/|\.tsx?|\.jsx?)/i.test(content)
  );
}

function formatBytes(size?: number) {
  if (!Number.isFinite(size)) return '';
  if ((size ?? 0) < 1024) return `${size} B`;
  if ((size ?? 0) < 1024 * 1024) return `${Math.round((size ?? 0) / 102.4) / 10} KB`;
  return `${Math.round((size ?? 0) / 1024 / 102.4) / 10} MB`;
}

function getLineLabel(reference: Pick<CodeReferenceDraft, 'startLine' | 'endLine'>) {
  return reference.startLine === reference.endLine
    ? `${reference.startLine}`
    : `${reference.startLine}-${reference.endLine}`;
}

function buildReferenceClipboardText(file: ActivePreviewFile, selectionInfo: CodeSelectionInfo) {
  return `${file.relativePath}:L${getLineLabel(selectionInfo)}\n\n${selectionInfo.text}`;
}

function clampPreviewLine(lineNumber: number, maxLineNumber: number) {
  return Math.min(Math.max(lineNumber, 1), Math.max(maxLineNumber, 1));
}

function getPreviewGitChangeType(hasAddedLine: boolean, hasRemovedLine: boolean): PreviewGitChangeHunk['type'] {
  if (hasAddedLine && !hasRemovedLine) return 'added';
  if (!hasAddedLine && hasRemovedLine) return 'removed';
  return 'modified';
}

function parsePreviewGitDiffHunks(diff: string, maxLineNumber: number): PreviewGitChangeHunk[] {
  const hunks: PreviewGitChangeHunk[] = [];
  const lines = diff.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const header = lines[index] ?? '';
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(header);
    if (!match) {
      index += 1;
      continue;
    }

    const oldStart = Number.parseInt(match[1] ?? '1', 10);
    const oldLines = Number.parseInt(match[2] ?? '1', 10);
    const newStart = Number.parseInt(match[3] ?? '1', 10);
    const newLines = Number.parseInt(match[4] ?? '1', 10);
    const hunkLines: PreviewGitHunkLine[] = [];
    let oldLine = oldStart;
    let newLine = newStart;
    let firstChangedLine: number | null = null;
    let lastChangedLine: number | null = null;
    let hasAddedLine = false;
    let hasRemovedLine = false;

    index += 1;
    while (index < lines.length && !lines[index]?.startsWith('@@ ')) {
      const line = lines[index] ?? '';
      if (line.startsWith('diff --git ') || line.startsWith('--- ') || line.startsWith('+++ ')) break;

      if (line.startsWith('+')) {
        hunkLines.push({ kind: 'added', text: line.slice(1), newLine });
        firstChangedLine ??= newLine;
        lastChangedLine = newLine;
        hasAddedLine = true;
        newLine += 1;
      } else if (line.startsWith('-')) {
        hunkLines.push({ kind: 'removed', text: line.slice(1), oldLine });
        firstChangedLine ??= newLine;
        lastChangedLine ??= newLine;
        hasRemovedLine = true;
        oldLine += 1;
      } else {
        const text = line.startsWith(' ') ? line.slice(1) : line;
        hunkLines.push({ kind: 'context', text, oldLine, newLine });
        oldLine += 1;
        newLine += 1;
      }
      index += 1;
    }

    if (firstChangedLine !== null && lastChangedLine !== null) {
      hunks.push({
        id: `${oldStart}:${newStart}:${hunks.length}`,
        type: getPreviewGitChangeType(hasAddedLine, hasRemovedLine),
        startLine: clampPreviewLine(firstChangedLine, maxLineNumber),
        endLine: clampPreviewLine(Math.max(firstChangedLine, lastChangedLine), maxLineNumber),
        oldStart,
        oldLines,
        newStart,
        newLines,
        lines: hunkLines,
      });
    }
  }

  return hunks;
}

async function readPreviewFileWithFallback(workspace: string, path: string) {
  const result = await window.electron.readPreviewFile({ cwd: workspace, path });
  if (result.success || !isAbsolutePreviewPath(path)) {
    return result;
  }

  const containingDirectory = dirname(path);
  if (!containingDirectory || normalizePreviewFilePath(containingDirectory) === normalizePreviewFilePath(workspace)) {
    return result;
  }

  return await window.electron.readPreviewFile({ cwd: containingDirectory, path });
}

function NativeExplorer({
  workspace,
  activeFilePath,
  refreshEvents = [],
  onOpenFile,
}: {
  workspace: string;
  activeFilePath?: string;
  refreshEvents?: readonly PreviewFileChangeEvent[];
  onOpenFile: (path: string, options?: { revealLine?: number }) => Promise<void>;
}) {
  const persistedExpandedPaths = useAppStore((state) => state.previewExpandedPathsByWorkspace[workspace]);
  const setStoredExpandedPaths = useAppStore((state) => state.setPreviewExpandedPaths);
  const resetStoredExpandedPaths = useAppStore((state) => state.resetPreviewExpandedPaths);
  const [directoryCache, setDirectoryCache] = useState<Record<string, DirectoryState>>({});
  const directoryCacheRef = useRef(directoryCache);
  const refreshedDirectoryOperationIdsRef = useRef(new Set<string>());
  const storedExpandedPaths = useMemo(() => persistedExpandedPaths ?? [workspace], [persistedExpandedPaths, workspace]);
  const expandedPaths = useMemo(() => new Set(storedExpandedPaths), [storedExpandedPaths]);
  const [searchQuery, setSearchQuery] = useState('');
  const [locatingActiveFile, setLocatingActiveFile] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    directoryCacheRef.current = directoryCache;
  }, [directoryCache]);

  const registerRowRef = useCallback((path: string) => (node: HTMLButtonElement | null) => {
    if (node) {
      rowRefs.current.set(path, node);
      return;
    }
    rowRefs.current.delete(path);
  }, []);

  const scrollRowIntoView = useCallback((path: string) => {
    const scroll = () => {
      const row = rowRefs.current.get(path);
      if (!row) return false;
      row.scrollIntoView({ block: 'center', inline: 'nearest' });
      row.focus({ preventScroll: true });
      return true;
    };

    requestAnimationFrame(() => {
      if (!scroll()) {
        requestAnimationFrame(scroll);
      }
    });
  }, []);

  const loadDirectory = useCallback(async (path: string, force = false) => {
    const cached = directoryCacheRef.current[path];
    if (!force && cached?.entries && !cached.error) return cached.entries;

    setDirectoryCache((current) => ({
      ...current,
      [path]: {
        entries: current[path]?.entries ?? [],
        loading: true,
      },
    }));

    const result = await window.electron.listPreviewDirectory({ cwd: workspace, path });
    if (!result.success || !result.entries) {
      setDirectoryCache((current) => ({
        ...current,
        [path]: {
          entries: current[path]?.entries ?? [],
          loading: false,
          error: result.error || '目录读取失败。',
          loadedAt: Date.now(),
        },
      }));
      return [];
    }

    setDirectoryCache((current) => ({
      ...current,
      [path]: {
        entries: result.entries ?? [],
        loading: false,
        loadedAt: Date.now(),
      },
    }));
    return result.entries;
  }, [workspace]);

  useEffect(() => {
    queueMicrotask(() => {
      setDirectoryCache({});
      refreshedDirectoryOperationIdsRef.current = new Set<string>();
      void loadDirectory(workspace, true);
    });
  }, [loadDirectory, workspace]);

  useEffect(() => {
    if (storedExpandedPaths.length === 0) {
      resetStoredExpandedPaths(workspace, workspace);
      return;
    }

    for (const path of storedExpandedPaths) {
      void loadDirectory(path);
    }
  }, [loadDirectory, resetStoredExpandedPaths, storedExpandedPaths, workspace]);

  useEffect(() => {
    const pendingRefreshes = refreshEvents.filter((event) => {
      if (refreshedDirectoryOperationIdsRef.current.has(event.operationId)) return false;
      refreshedDirectoryOperationIdsRef.current.add(event.operationId);
      return true;
    });
    if (!pendingRefreshes.length) return;

    const directoriesToRefresh = new Set<string>();
    for (const event of pendingRefreshes) {
      const ancestorDirectories = getPreviewFileAncestorDirectories(workspace, event.path);
      if (ancestorDirectories.length === 0) {
        directoriesToRefresh.add(workspace);
        continue;
      }
      for (const directoryPath of ancestorDirectories) {
        directoriesToRefresh.add(directoryPath);
      }
    }

    for (const directoryPath of directoriesToRefresh) {
      void loadDirectory(directoryPath, true);
    }
  }, [loadDirectory, refreshEvents, workspace]);

  const handleToggleDirectory = useCallback((path: string) => {
    const next = new Set(expandedPaths);
    if (next.has(path) && path !== workspace) {
      next.delete(path);
    } else {
      next.add(path);
      void loadDirectory(path);
    }
    setStoredExpandedPaths(workspace, [...next]);
  }, [expandedPaths, loadDirectory, setStoredExpandedPaths, workspace]);

  const handleRefresh = useCallback(() => {
    void loadDirectory(workspace, true);
  }, [loadDirectory, workspace]);

  const activeFileAncestorDirectories = useMemo(
    () => (activeFilePath ? getPreviewFileAncestorDirectories(workspace, activeFilePath) : []),
    [activeFilePath, workspace],
  );
  const canLocateActiveFile = Boolean(activeFilePath && activeFileAncestorDirectories.length > 0);

  const handleLocateActiveFile = useCallback(async () => {
    if (!activeFilePath || activeFileAncestorDirectories.length === 0) return;

    setLocatingActiveFile(true);
    setSearchQuery('');
    try {
      for (const directoryPath of activeFileAncestorDirectories) {
        await loadDirectory(directoryPath, true);
      }
      const next = new Set(expandedPaths);
      for (const directoryPath of activeFileAncestorDirectories) {
        next.add(directoryPath);
      }
      setStoredExpandedPaths(workspace, [...next]);
      scrollRowIntoView(activeFilePath);
    } finally {
      setLocatingActiveFile(false);
    }
  }, [activeFileAncestorDirectories, activeFilePath, expandedPaths, loadDirectory, scrollRowIntoView, setStoredExpandedPaths, workspace]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const renderDirectory = (path: string, depth = ROOT_DEPTH): ReactElement[] => {
    const directory = directoryCache[path];
    if (!directory) return [];

    const entries = normalizedSearchQuery
      ? directory.entries.filter((entry) => (
          entry.name.toLowerCase().includes(normalizedSearchQuery)
          || entry.relativePath.toLowerCase().includes(normalizedSearchQuery)
          || entry.type === 'directory'
        ))
      : directory.entries;

    const rows: ReactElement[] = [];
    if (directory.loading && entries.length === 0) {
      rows.push(
        <div key={`${path}:loading`} className="native-explorer__status" style={{ paddingLeft: 14 + depth * 16 }}>
          Loading...
        </div>,
      );
    }
    if (directory.error) {
      rows.push(
        <div key={`${path}:error`} className="native-explorer__error" style={{ paddingLeft: 14 + depth * 16 }}>
          {directory.error}
        </div>,
      );
    }

    for (const entry of entries) {
      const expanded = expandedPaths.has(entry.path);
      const selected = activeFilePath === entry.path;
      if (entry.type === 'directory') {
        rows.push(
          <div key={entry.path}>
            <button
              ref={registerRowRef(entry.path)}
              type="button"
              className="native-explorer__row native-explorer__row--directory"
              style={{ paddingLeft: 10 + depth * 16 }}
              onClick={() => handleToggleDirectory(entry.path)}
              title={entry.relativePath}
            >
              <span className="native-explorer__chevron">{expanded ? '-' : '+'}</span>
              <span className="native-explorer__folder-name">{entry.name}</span>
            </button>
            {expanded && renderDirectory(entry.path, depth + 1)}
          </div>,
        );
        continue;
      }

      rows.push(
        <button
          ref={registerRowRef(entry.path)}
          key={entry.path}
          type="button"
          className={`native-explorer__row native-explorer__row--file ${selected ? 'native-explorer__row--selected' : ''}`}
          style={{ paddingLeft: 14 + depth * 16 }}
          onClick={() => void onOpenFile(entry.path)}
          title={`${entry.relativePath}${entry.size ? ` · ${formatBytes(entry.size)}` : ''}`}
        >
          <span className="native-explorer__file-icon" />
          <span className="native-explorer__file-name">{entry.name}</span>
        </button>,
      );
    }

    return rows;
  };

  return (
    <aside className="native-explorer">
      <div className="native-explorer__toolbar">
        <div className="native-explorer__title">EXPLORER</div>
        <div className="native-explorer__actions">
          <button
            type="button"
            className="native-explorer__icon-button"
            onClick={handleLocateActiveFile}
            title={canLocateActiveFile ? '定位当前文件' : '先打开一个文件'}
            aria-label="定位当前文件"
            disabled={!canLocateActiveFile || locatingActiveFile}
          >
            <LocateFixed size={13} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="native-explorer__icon-button"
            onClick={handleRefresh}
            title="刷新根目录"
            aria-label="刷新根目录"
          >
            <RefreshCw size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
      <label className="native-explorer__search">
        <span>⌕</span>
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="搜索已加载文件"
        />
      </label>
      <div className="native-explorer__tree">
        <button
          ref={registerRowRef(workspace)}
          type="button"
          className="native-explorer__row native-explorer__row--root"
          onClick={() => handleToggleDirectory(workspace)}
          title={workspace}
        >
          <span className="native-explorer__chevron">{expandedPaths.has(workspace) ? '-' : '+'}</span>
          <span className="native-explorer__root-name">{basename(workspace)}</span>
        </button>
        {expandedPaths.has(workspace) && renderDirectory(workspace, 1)}
      </div>
    </aside>
  );
}

function configurePreviewMonacoDefaults(monacoApi: typeof monaco) {
  if (previewMonacoDefaultsConfigured) return;

  const typescript = (monacoApi.languages as unknown as { typescript?: MonacoTypeScriptRuntime }).typescript;
  if (!typescript?.typescriptDefaults || !typescript.javascriptDefaults) return;

  const compilerOptions: Record<string, unknown> = {
    allowJs: true,
    allowNonTsExtensions: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    jsx: typescript.JsxEmit?.Preserve ?? 1,
    module: typescript.ModuleKind?.ESNext ?? 99,
    moduleResolution: typescript.ModuleResolutionKind?.NodeJs ?? 2,
    target: typescript.ScriptTarget?.ESNext ?? 99,
  };
  const diagnosticsOptions: Record<string, unknown> = {
    noSemanticValidation: true,
    noSuggestionDiagnostics: true,
  };

  typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
  typescript.javascriptDefaults.setCompilerOptions({
    ...compilerOptions,
    checkJs: false,
  });
  typescript.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
  typescript.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
  previewMonacoDefaultsConfigured = true;
}

function QuickOpenPalette({
  query,
  entries,
  recentPaths,
  activePath,
  loading,
  error,
  truncated,
  selectedIndex,
  onQueryChange,
  onSelectedIndexChange,
  onOpen,
  onClose,
}: {
  query: string;
  entries: PreviewQuickOpenEntry[];
  recentPaths: readonly string[];
  activePath?: string | null;
  loading: boolean;
  error?: string;
  truncated: boolean;
  selectedIndex: number;
  onQueryChange: (query: string) => void;
  onSelectedIndexChange: (index: number) => void;
  onOpen: (entry: PreviewQuickOpenEntry) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const matches = useMemo(
    () => filterPreviewQuickOpenEntries(entries, query, 50, {
      recentPaths,
      activePath: activePath ?? undefined,
    }),
    [activePath, entries, query, recentPaths],
  );
  const clampedSelectedIndex = Math.min(Math.max(selectedIndex, 0), Math.max(matches.length - 1, 0));

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    onSelectedIndexChange(0);
  }, [onSelectedIndexChange, query]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onSelectedIndexChange(matches.length ? (clampedSelectedIndex + 1) % matches.length : 0);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onSelectedIndexChange(matches.length ? (clampedSelectedIndex - 1 + matches.length) % matches.length : 0);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const match = matches[clampedSelectedIndex];
      if (match) onOpen(match);
    }
  }, [clampedSelectedIndex, matches, onClose, onOpen, onSelectedIndexChange]);

  return (
    <div className="quick-open" role="dialog" aria-modal="true" aria-label="快速打开文件">
      <div className="quick-open__panel">
        <div className="quick-open__input-wrap">
          <span>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入文件名或路径，Enter 打开"
          />
          <kbd>Ctrl P</kbd>
        </div>
        <div className="quick-open__meta">
          {loading ? '正在索引工作区文件...' : error ? error : `${matches.length} / ${entries.length} 个匹配文件${truncated ? '，结果已截断' : ''}`}
        </div>
        <div className="quick-open__list">
          {!loading && !error && matches.length === 0 && (
            <div className="quick-open__empty">没有匹配文件</div>
          )}
          {matches.map((entry, index) => (
            <button
              key={entry.path}
              type="button"
              className={`quick-open__item ${index === clampedSelectedIndex ? 'quick-open__item--selected' : ''}`}
              onMouseEnter={() => onSelectedIndexChange(index)}
              onClick={() => onOpen(entry)}
              title={entry.path}
            >
              <span className="quick-open__item-name">{entry.name}</span>
              <span className="quick-open__item-path">{entry.relativePath}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewSurface({
  file,
  workspace,
  referenceSessionKey,
  openTabs,
  activeTabPath,
  onSwitchTab,
  onUpdateFileContent,
  onSaveFile,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
}: {
  file: ActivePreviewFile | null;
  workspace?: string;
  referenceSessionKey: string;
  openTabs: ActivePreviewFile[];
  activeTabPath: string | null;
  onSwitchTab: (path: string) => void;
  onUpdateFileContent: (path: string, content: string) => void;
  onSaveFile: (file: ActivePreviewFile, content: string) => Promise<void>;
  onCloseTab: (path: string) => void;
  onCloseOtherTabs: (path: string) => void;
  onCloseTabsToRight: (path: string) => void;
  onCloseAllTabs: () => void;
}) {
  const addCodeReference = useAppStore((state) => state.addCodeReference);
  const codeReferences = useAppStore((state) => state.codeReferencesBySessionId[referenceSessionKey] || EMPTY_CODE_REFERENCES);
  const tabScrollerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const gitHunksRef = useRef<PreviewGitChangeHunk[]>([]);
  const selectionListenerRef = useRef<{ dispose: () => void } | null>(null);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const gitDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const gitGutterListenerRef = useRef<{ dispose: () => void } | null>(null);
  const [tabScrollState, setTabScrollState] = useState({ canScrollLeft: false, canScrollRight: false });
  const [tabMenu, setTabMenu] = useState<TabContextMenuState | null>(null);
  const [markdownViewMode, setMarkdownViewMode] = useState<'source' | 'preview'>('source');
  const [selectionInfo, setSelectionInfo] = useState<CodeSelectionInfo | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [saveStatus, setSaveStatus] = useState<{ path: string; state: 'saving' | 'saved' | 'error'; message?: string } | null>(null);
  const [gitDiffText, setGitDiffText] = useState('');
  const [gitDiffLoading, setGitDiffLoading] = useState(false);
  const [gitDiffError, setGitDiffError] = useState<string | null>(null);
  const [gitPopover, setGitPopover] = useState<PreviewGitPopover | null>(null);

  const fileReferences = useMemo(() => {
    if (!file) return [];
    return codeReferences.filter((reference) => reference.filePath === file.path);
  }, [codeReferences, file]);

  const monacoLanguage = normalizeMonacoLanguage(file?.language, file?.fileName);
  const monacoModelPath = buildPreviewMonacoModelPath(file?.path, file?.fileName);
  const isMarkdownFile = file?.contentType === 'code' && monacoLanguage === 'markdown';
  const gitHunks = useMemo(
    () => parsePreviewGitDiffHunks(gitDiffText, file?.content.split(/\r?\n/).length ?? 1),
    [file?.content, gitDiffText],
  );

  useLayoutEffect(() => {
    gitHunksRef.current = gitHunks;
  }, [gitHunks]);

  const updateTabScrollState = useCallback(() => {
    const scroller = tabScrollerRef.current;
    if (!scroller) {
      setTabScrollState({ canScrollLeft: false, canScrollRight: false });
      return;
    }

    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const nextState = {
      canScrollLeft: scroller.scrollLeft > 1,
      canScrollRight: maxScrollLeft - scroller.scrollLeft > 1,
    };

    setTabScrollState((current) => (
      current.canScrollLeft === nextState.canScrollLeft && current.canScrollRight === nextState.canScrollRight
        ? current
        : nextState
    ));
  }, []);

  useLayoutEffect(() => {
    const scroller = tabScrollerRef.current;
    if (!scroller) return;

    const frameId = window.requestAnimationFrame(updateTabScrollState);
    scroller.addEventListener('scroll', updateTabScrollState, { passive: true });
    window.addEventListener('resize', updateTabScrollState);

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateTabScrollState);
    observer?.observe(scroller);

    return () => {
      window.cancelAnimationFrame(frameId);
      scroller.removeEventListener('scroll', updateTabScrollState);
      window.removeEventListener('resize', updateTabScrollState);
      observer?.disconnect();
    };
  }, [openTabs.length, updateTabScrollState]);

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      tabScrollerRef.current
        ?.querySelector<HTMLElement>('.vscode-preview__tab--active')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      updateTabScrollState();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTabPath, updateTabScrollState]);

  useEffect(() => {
    if (!tabMenu) return;

    const closeMenu = () => setTabMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTabMenu(null);
    };

    window.addEventListener('click', closeMenu);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [tabMenu]);

  useEffect(() => {
    const currentWorkspace = workspace?.trim();
    if (!currentWorkspace || !file || file.loading || file.error || file.contentType !== 'code') {
      queueMicrotask(() => {
        setGitDiffText('');
        setGitDiffError(null);
        setGitDiffLoading(false);
        setGitPopover(null);
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setGitDiffLoading(true);
      setGitDiffError(null);
      setGitPopover(null);
    });
    void window.electron.getGitDiff({ cwd: currentWorkspace, path: file.path })
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setGitDiffText(result.data.diff);
          return;
        }
        setGitDiffText('');
        setGitDiffError(result.error.message);
      })
      .catch((error) => {
        if (cancelled) return;
        setGitDiffText('');
        setGitDiffError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setGitDiffLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file, workspace]);

  const scrollTabs = useCallback((direction: -1 | 1) => {
    const scroller = tabScrollerRef.current;
    if (!scroller) return;
    const distance = Math.max(180, Math.round(scroller.clientWidth * 0.72));
    scroller.scrollBy({ left: direction * distance, behavior: 'smooth' });
    window.setTimeout(updateTabScrollState, 260);
  }, [updateTabScrollState]);

  const handleTabContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>, tabPath: string) => {
    event.preventDefault();
    event.stopPropagation();
    onSwitchTab(tabPath);
    setTabMenu({
      path: tabPath,
      x: Math.min(event.clientX, Math.max(12, window.innerWidth - 190)),
      y: Math.min(event.clientY, Math.max(12, window.innerHeight - 178)),
    });
  }, [onSwitchTab]);

  const tabMenuIndex = tabMenu ? openTabs.findIndex((tab) => tab.path === tabMenu.path) : -1;
  const hasTabsToRight = tabMenuIndex >= 0 && tabMenuIndex < openTabs.length - 1;

  const runTabMenuAction = useCallback((action: 'close' | 'close-others' | 'close-right' | 'close-all') => {
    if (!tabMenu) return;
    const tabPath = tabMenu.path;
    setTabMenu(null);
    if (action === 'close') {
      onCloseTab(tabPath);
      return;
    }
    if (action === 'close-others') {
      onCloseOtherTabs(tabPath);
      return;
    }
    if (action === 'close-right') {
      onCloseTabsToRight(tabPath);
      return;
    }
    onCloseAllTabs();
  }, [onCloseAllTabs, onCloseOtherTabs, onCloseTab, onCloseTabsToRight, tabMenu]);

  const updateReferenceDecorations = useCallback(() => {
    if (!decorationsRef.current || !file) return;
    decorationsRef.current.set(fileReferences.map((reference, index) => ({
      range: new monaco.Range(reference.startLine, 1, reference.endLine, 1),
      options: {
        isWholeLine: true,
        className: 'vscode-preview__referenced-line',
        glyphMarginClassName: reference.kind === 'comment' ? 'vscode-preview__comment-glyph' : 'vscode-preview__reference-glyph',
        hoverMessage: {
          value: `${reference.kind === 'comment' ? '评论' : '引用'} ${index + 1}: ${file.relativePath}:L${getLineLabel(reference)}${reference.comment ? `\n\n${reference.comment}` : ''}`,
        },
      },
    })));
  }, [file, fileReferences]);

  const openGitPopover = useCallback((hunk: PreviewGitChangeHunk) => {
    const editor = editorRef.current;
    const layout = editor?.getLayoutInfo();
    const position = editor?.getScrolledVisiblePosition({ lineNumber: hunk.startLine, column: 1 });
    setGitPopover({
      hunk,
      top: Math.max(8, Math.min(position?.top ?? 12, Math.max((layout?.height ?? 360) - 220, 8))),
      left: Math.max(36, (layout?.glyphMarginLeft ?? 0) + (layout?.glyphMarginWidth ?? 0) + 12),
    });
  }, []);

  const updateGitDecorations = useCallback(() => {
    if (!gitDecorationsRef.current || !file) return;
    gitDecorationsRef.current.set(gitHunks.map((hunk) => ({
      range: new monaco.Range(hunk.startLine, 1, hunk.endLine, 1),
      options: {
        isWholeLine: true,
        className: `vscode-preview__git-line vscode-preview__git-line--${hunk.type}`,
        lineDecorationsClassName: `vscode-preview__git-line-decoration vscode-preview__git-line-decoration--${hunk.type}`,
        glyphMarginClassName: `vscode-preview__git-gutter-bar vscode-preview__git-gutter-bar--${hunk.type}`,
        hoverMessage: {
          value: `Git ${hunk.type === 'added' ? '新增' : hunk.type === 'removed' ? '删除' : '修改'}: 点击左侧标记查看差异`,
        },
      },
    })));
  }, [file, gitHunks]);

  useEffect(() => {
    queueMicrotask(() => {
      setSelectionInfo(null);
      setCommentOpen(false);
      setCommentText('');
      setGitPopover(null);
    });
  }, [file?.path]);

  useEffect(() => {
    updateReferenceDecorations();
  }, [updateReferenceDecorations]);

  useEffect(() => {
    updateGitDecorations();
  }, [updateGitDecorations]);

  useEffect(() => {
    return () => {
      selectionListenerRef.current?.dispose();
      gitGutterListenerRef.current?.dispose();
    };
  }, []);

  const revealLine = useCallback(() => {
    if (!file?.revealLine || !editorRef.current) return;
    editorRef.current.revealLineInCenter(file.revealLine);
    editorRef.current.setPosition({ lineNumber: file.revealLine, column: 1 });
    editorRef.current.focus();
  }, [file]);

  useEffect(() => {
    revealLine();
  }, [revealLine]);

  const clearSelectionOverlay = useCallback(() => {
    setSelectionInfo(null);
    setCommentOpen(false);
    setCommentText('');
  }, []);

  const addSelectionReference = useCallback((kind: 'selection' | 'comment', comment?: string) => {
    if (!file || !selectionInfo) return null;
    const reference = addCodeReference(referenceSessionKey, {
      kind,
      filePath: file.path,
      fileName: file.fileName,
      language: monacoLanguage,
      startLine: selectionInfo.startLine,
      endLine: selectionInfo.endLine,
      code: selectionInfo.text,
      comment: comment?.trim() || undefined,
    });
    window.dispatchEvent(new CustomEvent(PROMPT_FOCUS_EVENT));
    return reference;
  }, [addCodeReference, file, monacoLanguage, referenceSessionKey, selectionInfo]);

  const handleSubmitComment = useCallback(() => {
    if (!addSelectionReference('comment', commentText)) return;
    setCommentOpen(false);
    setCommentText('');
  }, [addSelectionReference, commentText]);

  const handleSendComment = useCallback(() => {
    if (!addSelectionReference('comment', commentText)) return;
    clearSelectionOverlay();
    window.setTimeout(() => {
      const submit = () => window.dispatchEvent(new CustomEvent(PROMPT_SUBMIT_EVENT));
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(submit);
        return;
      }
      submit();
    }, 0);
  }, [addSelectionReference, clearSelectionOverlay, commentText]);

  useEffect(() => {
    window.addEventListener(PROMPT_SENT_EVENT, clearSelectionOverlay);
    return () => window.removeEventListener(PROMPT_SENT_EVENT, clearSelectionOverlay);
  }, [clearSelectionOverlay]);

  const saveCurrentFile = useCallback(async () => {
    if (!file || file.loading || file.error || file.contentType !== 'code') return;
    const content = editorRef.current?.getValue() ?? file.content;
    setSaveStatus({ path: file.path, state: 'saving' });
    try {
      await onSaveFile(file, content);
      setSaveStatus({ path: file.path, state: 'saved' });
      window.setTimeout(() => {
        setSaveStatus((current) => (
          current?.path === file.path && current.state === 'saved' ? null : current
        ));
      }, 1400);
    } catch (error) {
      setSaveStatus({
        path: file.path,
        state: 'error',
        message: error instanceof Error ? error.message : 'Save failed.',
      });
    }
  }, [file, onSaveFile]);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 's' || event.altKey || event.shiftKey || (!event.ctrlKey && !event.metaKey)) return;
      if (!file || file.contentType !== 'code') return;
      event.preventDefault();
      event.stopPropagation();
      void saveCurrentFile();
    };

    window.addEventListener('keydown', handleSaveShortcut, { capture: true });
    return () => window.removeEventListener('keydown', handleSaveShortcut, { capture: true });
  }, [file, saveCurrentFile]);

  useEffect(() => {
    const handleCloseShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'w' || event.altKey || event.shiftKey || (!event.ctrlKey && !event.metaKey)) return;
      if (!activeTabPath) return;
      event.preventDefault();
      event.stopPropagation();
      onCloseTab(activeTabPath);
    };

    window.addEventListener('keydown', handleCloseShortcut, { capture: true });
    return () => window.removeEventListener('keydown', handleCloseShortcut, { capture: true });
  }, [activeTabPath, onCloseTab]);

  useEffect(() => {
    const handleTabSwitchShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'tab' || event.altKey || (!event.ctrlKey && !event.metaKey)) return;
      if (openTabs.length < 2) return;
      event.preventDefault();
      event.stopPropagation();

      const currentIndex = openTabs.findIndex((tab) => tab.path === activeTabPath);
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = (baseIndex + direction + openTabs.length) % openTabs.length;
      onSwitchTab(openTabs[nextIndex]!.path);
    };

    window.addEventListener('keydown', handleTabSwitchShortcut, { capture: true });
    return () => window.removeEventListener('keydown', handleTabSwitchShortcut, { capture: true });
  }, [activeTabPath, onSwitchTab, openTabs]);

  const calculateSelectionPosition = useCallback((editor: monaco.editor.IStandaloneCodeEditor, selection: monaco.Selection) => {
    const layout = editor.getLayoutInfo();
    const position = editor.getScrolledVisiblePosition({
      lineNumber: selection.endLineNumber,
      column: Math.max(1, selection.endColumn),
    });
    const editorTop = editor.getDomNode()?.getBoundingClientRect().top ?? 0;
    const composerOffsetValue = window.getComputedStyle(document.documentElement).getPropertyValue('--composer-bottom-offset');
    const composerBottomOffset = Number.parseFloat(composerOffsetValue) || 0;

    return calculateSelectionOverlayPosition({
      editorWidth: layout.width,
      editorHeight: layout.height,
      editorViewportTop: editorTop,
      selectionTop: position?.top ?? 12,
      selectionLeft: position?.left ?? layout.width - 260,
      viewportHeight: window.innerHeight,
      composerBottomOffset,
    });
  }, []);

  const handleEditorMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    decorationsRef.current = editor.createDecorationsCollection([]);
    gitDecorationsRef.current = editor.createDecorationsCollection([]);
    updateReferenceDecorations();
    updateGitDecorations();
    revealLine();

    selectionListenerRef.current?.dispose();
    selectionListenerRef.current = editor.onDidChangeCursorSelection((event) => {
      const model = editor.getModel();
      const selection = event.selection;
      if (!model || !selection || selection.isEmpty()) {
        setSelectionInfo(null);
        setCommentOpen(false);
        return;
      }

      const text = model.getValueInRange(selection);
      if (!text.trim()) {
        setSelectionInfo(null);
        setCommentOpen(false);
        return;
      }

      const position = calculateSelectionPosition(editor, selection);
      setSelectionInfo({
        startLine: Math.min(selection.startLineNumber, selection.endLineNumber),
        endLine: Math.max(selection.startLineNumber, selection.endLineNumber),
        text,
        ...position,
      });
    });

    gitGutterListenerRef.current?.dispose();
    gitGutterListenerRef.current = editor.onMouseDown((event) => {
      const targetType = event.target.type;
      if (
        targetType !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
        && targetType !== monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS
        && targetType !== monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS
      ) {
        return;
      }
      const lineNumber = event.target.position?.lineNumber;
      if (!lineNumber) return;
      const hunk = gitHunksRef.current.find((item) => lineNumber >= item.startLine && lineNumber <= item.endLine);
      if (!hunk) return;
      event.event.preventDefault();
      event.event.stopPropagation();
      openGitPopover(hunk);
    });
  }, [calculateSelectionPosition, openGitPopover, revealLine, updateGitDecorations, updateReferenceDecorations]);

  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || !file || file.contentType !== 'code') return;
    if (model.getValue() === file.content) return;

    const viewState = editor.saveViewState();
    model.setValue(file.content);
    if (viewState) {
      editor.restoreViewState(viewState);
    }
  }, [file]);

  const handleCopySelectionReference = useCallback(() => {
    if (!file || !selectionInfo) return;
    void copyTextToClipboard(buildReferenceClipboardText(file, selectionInfo));
  }, [file, selectionInfo]);

  if (!file) {
    return (
      <section className="vscode-preview vscode-preview--empty">
        <div className="vscode-preview__empty-icon" />
        <div className="vscode-preview__empty-title">选择一个文件开始预览</div>
        <div className="vscode-preview__empty-copy">左侧是当前工作区文件树。选择代码后可以像 Cursor 一样贴到输入框，也可以追加 Codex 评论。</div>
      </section>
    );
  }

  return (
    <section className="vscode-preview">
      {openTabs.length > 0 && (
        <div className="vscode-preview__tabbar">
          <button
            type="button"
            className="vscode-preview__tab-scroll"
            onClick={() => scrollTabs(-1)}
            disabled={!tabScrollState.canScrollLeft}
            title="向左滚动标签"
            aria-label="向左滚动标签"
          >
            <ChevronLeft />
          </button>
          <div ref={tabScrollerRef} className="vscode-preview__tabs">
          {openTabs.map((tab) => {
            const isActive = tab.path === activeTabPath;
            return (
              <div
                key={tab.path}
                className={`vscode-preview__tab ${isActive ? 'vscode-preview__tab--active' : ''}`}
                title={tab.relativePath}
                onClick={() => onSwitchTab(tab.path)}
                onContextMenu={(event) => handleTabContextMenu(event, tab.path)}
              >
                <span className={`vscode-preview__tab-dot ${tab.isDirty ? 'vscode-preview__tab-dot--dirty' : ''}`} />
                <span className="vscode-preview__tab-name">{tab.fileName}{tab.isDirty ? ' *' : ''}</span>
                <button
                  type="button"
                  className="vscode-preview__tab-close"
                  onClick={(e) => { e.stopPropagation(); onCloseTab(tab.path); }}
                  aria-label={`关闭 ${tab.fileName}`}
                  title="关闭"
                />
              </div>
            );
          })}
          </div>
          <button
            type="button"
            className="vscode-preview__tab-scroll"
            onClick={() => scrollTabs(1)}
            disabled={!tabScrollState.canScrollRight}
            title="向右滚动标签"
            aria-label="向右滚动标签"
          >
            <ChevronRight />
          </button>
          {tabMenu && (
            <div
              className="vscode-preview__tab-menu"
              style={{ left: tabMenu.x, top: tabMenu.y }}
              role="menu"
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" role="menuitem" onClick={() => runTabMenuAction('close')}>关闭</button>
              <button type="button" role="menuitem" onClick={() => runTabMenuAction('close-others')} disabled={openTabs.length <= 1}>关闭其他</button>
              <button type="button" role="menuitem" onClick={() => runTabMenuAction('close-right')} disabled={!hasTabsToRight}>关闭右侧</button>
              <button type="button" role="menuitem" onClick={() => runTabMenuAction('close-all')}>关闭全部</button>
            </div>
          )}
        </div>
      )}
      <div className="vscode-preview__titlebar">
        <div className="vscode-preview__file">
          <span className="vscode-preview__dot" />
          <span className="vscode-preview__name">{file.fileName}</span>
          <span className="vscode-preview__language">{file.contentType === 'code' ? monacoLanguage : file.contentType}</span>
          {file.isDirty && (
            <span className="vscode-preview__selection-pill">
              Unsaved
            </span>
          )}
          {saveStatus?.path === file.path && (
            <span className="vscode-preview__selection-pill" title={saveStatus.message}>
              {saveStatus.state === 'saving' ? 'Saving...' : saveStatus.state === 'saved' ? 'Saved' : 'Save failed'}
            </span>
          )}
          {fileReferences.length > 0 && <span className="vscode-preview__selection-pill">已引用 {fileReferences.length}</span>}
          {selectionInfo && (
            <span className="vscode-preview__selection-pill">
              L{getLineLabel(selectionInfo)}
            </span>
          )}
          {gitDiffLoading && <span className="vscode-preview__selection-pill">Git diff...</span>}
          {!gitDiffLoading && gitHunks.length > 0 && (
            <span className="vscode-preview__selection-pill">Git {gitHunks.length}</span>
          )}
          {!gitDiffLoading && gitDiffError && (
            <span className="vscode-preview__selection-pill" title={gitDiffError}>Git diff unavailable</span>
          )}
        </div>
        {isMarkdownFile && (
          <div className="vscode-preview__title-actions" aria-label="Markdown 视图模式">
            <button
              type="button"
              className={markdownViewMode === 'preview' ? 'vscode-preview__title-action--active' : ''}
              onClick={() => setMarkdownViewMode('preview')}
            >
              预览
            </button>
            <button
              type="button"
              className={markdownViewMode === 'source' ? 'vscode-preview__title-action--active' : ''}
              onClick={() => setMarkdownViewMode('source')}
            >
              源码
            </button>
          </div>
        )}
      </div>
      <div className="vscode-preview__path" title={file.path}>
        <span className="vscode-preview__path-text">{file.relativePath}</span>
        <button type="button" onClick={() => void copyTextToClipboard(file.path)}>复制路径</button>
      </div>
      <div className="vscode-preview__content">
        {file.loading ? (
          <div className="vscode-preview__state">Loading...</div>
        ) : file.error ? (
          <div className="vscode-preview__error-state">
            <div className="vscode-preview__error-title">预览失败</div>
            <div className="vscode-preview__error-copy">{file.error}</div>
          </div>
        ) : file.contentType === 'image' ? (
          <div className="vscode-preview__image-wrap">
            <img className="vscode-preview__image" src={file.content} alt={file.fileName} />
          </div>
        ) : file.contentType === 'html' ? (
          <iframe className="vscode-preview__iframe" title={file.fileName} srcDoc={file.content} />
        ) : isMarkdownFile && markdownViewMode === 'preview' ? (
          <div className="vscode-preview__markdown">
            <MDContent text={file.content} />
          </div>
        ) : (
          <Editor
            key={file.path}
            height="100%"
            language={monacoLanguage}
            path={monacoModelPath}
            theme="vs"
            value={file.content}
            beforeMount={configurePreviewMonacoDefaults}
            onMount={handleEditorMount}
            onChange={(value) => onUpdateFileContent(file.path, value ?? '')}
            options={{
              readOnly: false,
              minimap: { enabled: false },
              fontSize: 12,
              lineHeight: 20,
              fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              renderLineHighlight: 'none',
              overviewRulerBorder: false,
              hideCursorInOverviewRuler: true,
              automaticLayout: true,
              glyphMargin: true,
              tabSize: 2,
              padding: { top: 12, bottom: 18 },
              scrollbar: {
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
              },
            }}
          />
        )}
        {selectionInfo && !file.error && !file.loading && file.contentType === 'code' && (
          <div
            className="vscode-preview__selection-actions"
            style={{ left: selectionInfo.left, top: selectionInfo.top }}
          >
            <button type="button" onClick={() => addSelectionReference('selection')}>粘贴到输入框</button>
            <button type="button" onClick={() => setCommentOpen((current) => !current)}>评论</button>
            <button type="button" onClick={handleCopySelectionReference}>复制引用</button>
          </div>
        )}
        {selectionInfo && commentOpen && (
          <div
            className="vscode-preview__comment-box"
            style={{ left: selectionInfo.left, top: selectionInfo.commentTop }}
          >
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="写一句评论，会随代码范围一起发给 Agent..."
              autoFocus
            />
            <div className="vscode-preview__comment-actions">
              <button type="button" onClick={() => setCommentOpen(false)}>取消</button>
              <button type="button" onClick={handleSubmitComment}>加入评论</button>
              <button type="button" onClick={handleSendComment}>直接发送</button>
            </div>
          </div>
        )}
        {gitPopover && (
          <div
            className="vscode-preview__git-popover"
            style={{ left: gitPopover.left, top: gitPopover.top }}
            role="dialog"
            aria-label="Git 差异"
          >
            <div className="vscode-preview__git-popover-title">
              <span>
                Git {gitPopover.hunk.type === 'added' ? '新增' : gitPopover.hunk.type === 'removed' ? '删除' : '修改'}
                {' '}L{gitPopover.hunk.startLine}{gitPopover.hunk.endLine !== gitPopover.hunk.startLine ? `-${gitPopover.hunk.endLine}` : ''}
              </span>
              <button type="button" onClick={() => setGitPopover(null)} aria-label="关闭 Git 差异">×</button>
            </div>
            <div className="vscode-preview__git-popover-body">
              {gitPopover.hunk.lines.map((line, index) => (
                <div
                  key={`${gitPopover.hunk.id}:${index}`}
                  className={`vscode-preview__git-diff-line vscode-preview__git-diff-line--${line.kind}`}
                >
                  <span className="vscode-preview__git-diff-old">{line.oldLine ?? ''}</span>
                  <span className="vscode-preview__git-diff-new">{line.newLine ?? ''}</span>
                  <span className="vscode-preview__git-diff-prefix">{line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}</span>
                  <code>{line.text || ' '}</code>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function AionWorkspacePreviewPane({
  workspace,
  conversationId,
  messages = [],
  pendingOpenRequest,
  onConsumePendingOpenRequest,
  onClose,
}: AionWorkspacePreviewPaneProps) {
  const [quickOpenRecentPathsByWorkspace, setQuickOpenRecentPathsByWorkspace] = useState<Record<string, string[]>>({});
  const [openTabs, setOpenTabs] = useState<ActivePreviewFile[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [previewFileChangeEvents, setPreviewFileChangeEvents] = useState<PreviewFileChangeEvent[]>([]);
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState('');
  const [quickOpenEntries, setQuickOpenEntries] = useState<PreviewQuickOpenEntry[]>([]);
  const [quickOpenLoading, setQuickOpenLoading] = useState(false);
  const [quickOpenError, setQuickOpenError] = useState<string | undefined>();
  const [quickOpenTruncated, setQuickOpenTruncated] = useState(false);
  const [quickOpenSelectedIndex, setQuickOpenSelectedIndex] = useState(0);
  const openTabsRef = useRef(openTabs);
  const quickOpenEntriesRef = useRef<PreviewQuickOpenEntry[]>([]);
  const refreshedOperationIdsRef = useRef(new Set<string>());
  const referenceSessionKey = getCodeReferenceSessionKey(conversationId);
  const quickOpenRecentPaths = workspace
    ? (quickOpenRecentPathsByWorkspace[workspace] ?? EMPTY_PREVIEW_RECENT_PATHS)
    : EMPTY_PREVIEW_RECENT_PATHS;

  const markPreviewQuickOpenRecentPath = useCallback((workspacePath: string, recentPath: string) => {
    const workspaceKey = workspacePath.trim();
    const targetPath = recentPath.trim();
    if (!workspaceKey || !targetPath) return;

    setQuickOpenRecentPathsByWorkspace((current) => {
      const previous = current[workspaceKey] ?? EMPTY_PREVIEW_RECENT_PATHS;
      const next = [
        targetPath,
        ...previous.filter((item) => item !== targetPath),
      ].slice(0, 120);
      if (next.length === previous.length && next.every((item, index) => item === previous[index])) {
        return current;
      }
      return {
        ...current,
        [workspaceKey]: next,
      };
    });
  }, []);

  useLayoutEffect(() => {
    openTabsRef.current = openTabs;
  }, [openTabs]);

  useLayoutEffect(() => {
    quickOpenEntriesRef.current = quickOpenEntries;
  }, [quickOpenEntries]);

  useEffect(() => {
    setOpenTabs([]);
    setActiveTabPath(null);
    setPreviewFileChangeEvents([]);
    setQuickOpenVisible(false);
    setQuickOpenQuery('');
    setQuickOpenEntries([]);
    setQuickOpenError(undefined);
    setQuickOpenTruncated(false);
    setQuickOpenSelectedIndex(0);
    setQuickOpenRecentPathsByWorkspace((current) => {
      if (!workspace?.trim()) return current;
      return current[workspace] ? current : {
        ...current,
        [workspace]: EMPTY_PREVIEW_RECENT_PATHS,
      };
    });
    openTabsRef.current = [];
    quickOpenEntriesRef.current = [];
    refreshedOperationIdsRef.current = new Set<string>();
  }, [conversationId, workspace]);

  const activeFile = openTabs.find((t) => t.path === activeTabPath) ?? null;

  const openFile = useCallback(async (path: string, options: { revealLine?: number; trackRecent?: boolean } = {}) => {
    if (!workspace) return;
    const shouldTrackRecent = options.trackRecent !== false;

    // If already open, switch to it and reread disk so the preview cannot stay stale.
    const existing = openTabsRef.current.find((t) => normalizePreviewFilePath(t.path) === normalizePreviewFilePath(path));
    if (existing) {
      setActiveTabPath(existing.path);
      if (shouldTrackRecent) {
        markPreviewQuickOpenRecentPath(workspace, existing.path);
      }
      if (isPreviewTabDirty(existing)) {
        if (options.revealLine) {
          setOpenTabs((prev) => prev.map((tab) => (
            tab.path === existing.path
              ? { ...tab, revealLine: options.revealLine }
              : tab
          )));
        }
        return;
      }
      const result = await readPreviewFileWithFallback(workspace, existing.path);
      const next: ActivePreviewFile = result.success && result.content !== undefined
        ? {
            ...existing,
            path: result.path || existing.path,
            fileName: basename(result.path || existing.path),
            relativePath: getRelativePath(workspace, result.path || existing.path),
            content: result.content,
            savedContent: result.content,
            isDirty: false,
            contentType: inferContentType(result.path || existing.path, result.content),
            language: result.language,
            loading: false,
            error: undefined,
            revealLine: options.revealLine ?? existing.revealLine,
          }
        : {
            ...existing,
            loading: false,
            error: result.error || '文件读取失败。',
            revealLine: options.revealLine ?? existing.revealLine,
          };
      setOpenTabs((prev) => prev.map((t) => (t.path === existing.path ? next : t)));
      if (shouldTrackRecent && result.success) {
        markPreviewQuickOpenRecentPath(workspace, next.path);
      }
      return;
    }

    const fileName = basename(path);
    const relativePath = getRelativePath(workspace, path);
    const loadingTab: ActivePreviewFile = {
      path,
      fileName,
      relativePath,
      content: '',
      savedContent: '',
      isDirty: false,
      contentType: 'code',
      loading: true,
      revealLine: options.revealLine,
    };
    setOpenTabs((prev) => [...prev, loadingTab]);
    setActiveTabPath(path);

    const result = await readPreviewFileWithFallback(workspace, path);
    const resolved: ActivePreviewFile = result.success && result.content !== undefined
      ? {
          path: result.path || path,
          fileName: basename(result.path || path),
          relativePath: getRelativePath(workspace, result.path || path),
          content: result.content,
          savedContent: result.content,
          isDirty: false,
          contentType: inferContentType(result.path || path, result.content),
          language: result.language,
          revealLine: options.revealLine,
        }
      : {
          path,
          fileName,
          relativePath,
          content: '',
          savedContent: '',
          isDirty: false,
          contentType: 'code',
          error: result.error || '文件读取失败。',
          revealLine: options.revealLine,
        };

    setOpenTabs((prev) => prev.map((t) => (t.path === path ? resolved : t)));
    if (shouldTrackRecent && result.success) {
      markPreviewQuickOpenRecentPath(workspace, resolved.path);
    }
  }, [markPreviewQuickOpenRecentPath, workspace]);

  const updateOpenFileContent = useCallback((path: string, content: string) => {
    const normalizedPath = normalizePreviewFilePath(path);
    setOpenTabs((prev) => prev.map((tab) => (
      normalizePreviewFilePath(tab.path) === normalizedPath
        ? markPreviewTabContent(tab, content)
        : tab
    )));
  }, []);

  const saveOpenFile = useCallback(async (file: ActivePreviewFile, content: string) => {
    if (!workspace) {
      throw new Error('Missing workspace.');
    }
    if (typeof window.electron.writePreviewFile !== 'function') {
      throw new Error('File save is unavailable.');
    }

    const result = await window.electron.writePreviewFile({
      cwd: workspace,
      path: file.path,
      data: content,
    });
    if (!result?.success) {
      throw new Error(result?.error || 'Save failed.');
    }

    const savedPath = result.path || file.path;
    const normalizedPath = normalizePreviewFilePath(file.path);
    setOpenTabs((prev) => prev.map((tab) => (
      normalizePreviewFilePath(tab.path) === normalizedPath
        ? {
            ...tab,
            path: savedPath,
            fileName: basename(savedPath),
            relativePath: getRelativePath(workspace, savedPath),
            content,
            savedContent: content,
            isDirty: false,
            contentType: inferContentType(savedPath, content),
            loading: false,
            error: undefined,
          }
        : tab
    )));
    setActiveTabPath(savedPath);
  }, [workspace]);

  const confirmCloseTabs = useCallback((tabsToClose: ActivePreviewFile[]) => {
    return confirmClosePreviewTabs(tabsToClose, (message) => window.confirm(message));
  }, []);

  const closeTab = useCallback((path: string) => {
    const currentTabs = openTabsRef.current;
    const idx = currentTabs.findIndex((tab) => tab.path === path);
    if (idx < 0) return;
    const tab = currentTabs[idx];
    if (!tab) return;
    if (!confirmCloseTabs([tab])) return;

    const next = currentTabs.filter((item) => item.path !== path);
    setOpenTabs(next);
    if (path === activeTabPath) {
      const newActive = next[Math.min(idx, next.length - 1)] ?? null;
      setActiveTabPath(newActive?.path ?? null);
    }
  }, [activeTabPath, confirmCloseTabs]);

  const closeOtherTabs = useCallback((path: string) => {
    const currentTabs = openTabsRef.current;
    const tabsToClose = currentTabs.filter((tab) => tab.path !== path);
    if (!confirmCloseTabs(tabsToClose)) return;

    const next = currentTabs.filter((tab) => tab.path === path);
    setOpenTabs(next);
    setActiveTabPath(next[0]?.path ?? null);
  }, [confirmCloseTabs]);

  const closeTabsToRight = useCallback((path: string) => {
    const currentTabs = openTabsRef.current;
    const idx = currentTabs.findIndex((tab) => tab.path === path);
    if (idx < 0) return;

    const tabsToClose = currentTabs.slice(idx + 1);
    if (!confirmCloseTabs(tabsToClose)) return;
    const next = currentTabs.slice(0, idx + 1);
    setOpenTabs(next);
    if (!next.some((tab) => tab.path === activeTabPath)) {
      setActiveTabPath(path);
    }
  }, [activeTabPath, confirmCloseTabs]);

  const closeAllTabs = useCallback(() => {
    const currentTabs = openTabsRef.current;
    if (!confirmCloseTabs(currentTabs)) return;
    setOpenTabs([]);
    setActiveTabPath(null);
  }, [confirmCloseTabs]);

  const loadQuickOpenEntries = useCallback(async (force = false) => {
    if (!workspace || (!force && quickOpenEntriesRef.current.length > 0)) return;
    setQuickOpenLoading(true);
    setQuickOpenError(undefined);
    try {
      const result: PreviewQuickOpenResponse = await window.electron.listPreviewFiles({ cwd: workspace, limit: 4_000 });
      if (!result.success) {
        setQuickOpenEntries([]);
        setQuickOpenError(result.error || '文件索引失败。');
        setQuickOpenTruncated(false);
        return;
      }
      setQuickOpenEntries(result.entries ?? []);
      setQuickOpenTruncated(Boolean(result.truncated));
    } catch (error) {
      setQuickOpenEntries([]);
      setQuickOpenError(error instanceof Error ? error.message : '文件索引失败。');
      setQuickOpenTruncated(false);
    } finally {
      setQuickOpenLoading(false);
    }
  }, [workspace]);

  const openQuickOpen = useCallback(() => {
    setQuickOpenVisible(true);
    setQuickOpenQuery('');
    setQuickOpenSelectedIndex(0);
    void loadQuickOpenEntries();
  }, [loadQuickOpenEntries]);

  const handleQuickOpenEntry = useCallback((entry: PreviewQuickOpenEntry) => {
    setQuickOpenVisible(false);
    setQuickOpenQuery('');
    void openFile(entry.path);
  }, [openFile]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== 'p' || event.altKey || event.shiftKey || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      if (quickOpenVisible) {
        setQuickOpenVisible(false);
        return;
      }
      openQuickOpen();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [openQuickOpen, quickOpenVisible]);

  useEffect(() => {
    if (!pendingOpenRequest?.filePath) return;
    void openFile(pendingOpenRequest.filePath, { revealLine: pendingOpenRequest.startLine });
    onConsumePendingOpenRequest?.();
  }, [onConsumePendingOpenRequest, openFile, pendingOpenRequest]);

  useEffect(() => {
    const changes = collectCompletedPreviewFileChanges(messages)
      .filter((change) => !refreshedOperationIdsRef.current.has(change.operationId))
      .map((change) => ({
        ...change,
        path: resolvePreviewFileChangePath(workspace, change.path),
      }));

    if (!changes.length) return;

    const openTabPaths = new Set(openTabsRef.current.map((tab) => normalizePreviewFilePath(tab.path)));
    const changedOpenTabs = changes.filter((change) => openTabPaths.has(normalizePreviewFilePath(change.path)));

    for (const change of changes) {
      refreshedOperationIdsRef.current.add(change.operationId);
    }

    setPreviewFileChangeEvents((current) => [...current.slice(-80), ...changes]);
    if (quickOpenVisible || quickOpenEntriesRef.current.length > 0) {
      void loadQuickOpenEntries(true);
    }

    for (const change of changedOpenTabs) {
      void openFile(change.path, { trackRecent: false });
    }
  }, [loadQuickOpenEntries, messages, openFile, quickOpenVisible, workspace]);

  if (!workspace) {
    return (
      <div className="aion-workbench aion-workbench--empty">
        <div className="aion-workbench__empty-title">还没有工作区路径</div>
        <div className="aion-workbench__empty-copy">
          当前会话没有 cwd，所以完整文件树无法挂载。回到对话里选一个项目目录后，这里会展示 VS Code 风格的 Workspace Preview。
        </div>
        <button type="button" className="aion-workbench__empty-button" onClick={onClose}>回到轨迹</button>
      </div>
    );
  }

  return (
    <div className="aion-workbench">
      <div className="aion-workbench__body">
        <NativeExplorer
          workspace={workspace}
          activeFilePath={activeFile?.path}
          refreshEvents={previewFileChangeEvents}
          onOpenFile={openFile}
        />
        <PreviewSurface
          file={activeFile}
          workspace={workspace}
          referenceSessionKey={referenceSessionKey}
          openTabs={openTabs}
          activeTabPath={activeTabPath}
          onSwitchTab={setActiveTabPath}
          onUpdateFileContent={updateOpenFileContent}
          onSaveFile={saveOpenFile}
          onCloseTab={closeTab}
          onCloseOtherTabs={closeOtherTabs}
          onCloseTabsToRight={closeTabsToRight}
          onCloseAllTabs={closeAllTabs}
        />
      </div>
      {quickOpenVisible && (
        <QuickOpenPalette
          query={quickOpenQuery}
          entries={quickOpenEntries}
          recentPaths={quickOpenRecentPaths}
          activePath={activeTabPath}
          loading={quickOpenLoading}
          error={quickOpenError}
          truncated={quickOpenTruncated}
          selectedIndex={quickOpenSelectedIndex}
          onQueryChange={setQuickOpenQuery}
          onSelectedIndexChange={setQuickOpenSelectedIndex}
          onOpen={handleQuickOpenEntry}
          onClose={() => setQuickOpenVisible(false)}
        />
      )}
    </div>
  );
}
