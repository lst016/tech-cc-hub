import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { PREVIEW_OPEN_FILE_EVENT, PROMPT_FOCUS_EVENT } from '../events';
import { getCodeReferenceSessionKey, useAppStore, type CodeReferenceDraft } from '../store/useAppStore';
import { copyTextToClipboard } from '../utils/clipboard';
import './AionWorkspacePreviewPane.css';

if (!(self as any).MonacoEnvironment?.getWorker) {
  (self as any).MonacoEnvironment = {
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

type AionWorkspacePreviewPaneProps = {
  workspace?: string;
  conversationId?: string;
  onClose?: () => void;
};

type PreviewEntry = {
  name: string;
  path: string;
  relativePath: string;
  type: 'directory' | 'file';
  size?: number;
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
  contentType: PreviewContentType;
  language?: string;
  loading?: boolean;
  error?: string;
  revealLine?: number;
};

type CodeSelectionInfo = {
  startLine: number;
  endLine: number;
  text: string;
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

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : '';
}

function normalizeMonacoLanguage(language?: string, fileName?: string) {
  const raw = (language || getFileExtension(fileName || '') || 'plaintext').toLowerCase();
  const map: Record<string, string> = {
    bash: 'shell',
    cjs: 'javascript',
    conf: 'ini',
    env: 'ini',
    htm: 'html',
    js: 'javascript',
    jsx: 'javascript',
    md: 'markdown',
    mjs: 'javascript',
    py: 'python',
    rb: 'ruby',
    sh: 'shell',
    ts: 'typescript',
    tsx: 'typescript',
    yml: 'yaml',
    zsh: 'shell',
  };
  return map[raw] || raw || 'plaintext';
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

function NativeExplorer({
  workspace,
  activeFilePath,
  onOpenFile,
}: {
  workspace: string;
  activeFilePath?: string;
  onOpenFile: (path: string, options?: { revealLine?: number }) => Promise<void>;
}) {
  const [directoryCache, setDirectoryCache] = useState<Record<string, DirectoryState>>({});
  const directoryCacheRef = useRef(directoryCache);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set([workspace]));
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    directoryCacheRef.current = directoryCache;
  }, [directoryCache]);

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
    setDirectoryCache({});
    setExpandedPaths(new Set([workspace]));
    void loadDirectory(workspace, true);
  }, [loadDirectory, workspace]);

  const handleToggleDirectory = useCallback((path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path) && path !== workspace) {
        next.delete(path);
      } else {
        next.add(path);
        void loadDirectory(path);
      }
      return next;
    });
  }, [loadDirectory, workspace]);

  const handleRefresh = useCallback(() => {
    void loadDirectory(workspace, true);
  }, [loadDirectory, workspace]);

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
          <button type="button" onClick={handleRefresh} title="刷新根目录">刷新</button>
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

function PreviewSurface({
  file,
  referenceSessionKey,
  openTabs,
  activeTabPath,
  onSwitchTab,
  onCloseTab,
}: {
  file: ActivePreviewFile | null;
  referenceSessionKey: string;
  openTabs: ActivePreviewFile[];
  activeTabPath: string | null;
  onSwitchTab: (path: string) => void;
  onCloseTab: (path: string) => void;
}) {
  const addCodeReference = useAppStore((state) => state.addCodeReference);
  const codeReferences = useAppStore((state) => state.codeReferencesBySessionId[referenceSessionKey] || EMPTY_CODE_REFERENCES);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const selectionListenerRef = useRef<{ dispose: () => void } | null>(null);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const [selectionInfo, setSelectionInfo] = useState<CodeSelectionInfo | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');

  const fileReferences = useMemo(() => {
    if (!file) return [];
    return codeReferences.filter((reference) => reference.filePath === file.path);
  }, [codeReferences, file]);

  const monacoLanguage = normalizeMonacoLanguage(file?.language, file?.fileName);

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

  useEffect(() => {
    setSelectionInfo(null);
    setCommentOpen(false);
    setCommentText('');
  }, [file?.path]);

  useEffect(() => {
    updateReferenceDecorations();
  }, [updateReferenceDecorations]);

  useEffect(() => {
    return () => selectionListenerRef.current?.dispose();
  }, []);

  const revealLine = useCallback(() => {
    if (!file?.revealLine || !editorRef.current) return;
    editorRef.current.revealLineInCenter(file.revealLine);
    editorRef.current.setPosition({ lineNumber: file.revealLine, column: 1 });
    editorRef.current.focus();
  }, [file?.revealLine]);

  useEffect(() => {
    revealLine();
  }, [revealLine]);

  const addSelectionReference = useCallback((kind: 'selection' | 'comment', comment?: string) => {
    if (!file || !selectionInfo) return;
    addCodeReference(referenceSessionKey, {
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
  }, [addCodeReference, file, monacoLanguage, referenceSessionKey, selectionInfo]);

  const handleSubmitComment = useCallback(() => {
    addSelectionReference('comment', commentText);
    setCommentOpen(false);
    setCommentText('');
  }, [addSelectionReference, commentText]);

  const calculateSelectionPosition = useCallback((editor: monaco.editor.IStandaloneCodeEditor, selection: monaco.Selection) => {
    const layout = editor.getLayoutInfo();
    const position = editor.getScrolledVisiblePosition({
      lineNumber: selection.endLineNumber,
      column: Math.max(1, selection.endColumn),
    });
    const top = Math.max(8, Math.min((position?.top ?? 12) + 8, layout.height - 92));
    const left = Math.max(12, Math.min((position?.left ?? layout.width - 260) + 18, layout.width - 252));
    return { top, left };
  }, []);

  const handleEditorMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    decorationsRef.current = editor.createDecorationsCollection([]);
    updateReferenceDecorations();
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
  }, [calculateSelectionPosition, revealLine, updateReferenceDecorations]);

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
        <div className="vscode-preview__tabs">
          {openTabs.map((tab) => {
            const isActive = tab.path === activeTabPath;
            return (
              <div
                key={tab.path}
                className={`vscode-preview__tab ${isActive ? 'vscode-preview__tab--active' : ''}`}
                title={tab.relativePath}
                onClick={() => onSwitchTab(tab.path)}
              >
                <span className="vscode-preview__tab-dot" />
                <span className="vscode-preview__tab-name">{tab.fileName}</span>
                <button
                  type="button"
                  className="vscode-preview__tab-close"
                  onClick={(e) => { e.stopPropagation(); onCloseTab(tab.path); }}
                  title="关闭"
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="vscode-preview__titlebar">
        <div className="vscode-preview__file">
          <span className="vscode-preview__dot" />
          <span className="vscode-preview__name">{file.fileName}</span>
          <span className="vscode-preview__language">{file.contentType === 'code' ? monacoLanguage : file.contentType}</span>
          {fileReferences.length > 0 && <span className="vscode-preview__selection-pill">已引用 {fileReferences.length}</span>}
          {selectionInfo && (
            <span className="vscode-preview__selection-pill">
              L{getLineLabel(selectionInfo)}
            </span>
          )}
        </div>
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
        ) : (
          <Editor
            key={file.path}
            height="100%"
            language={monacoLanguage}
            theme="vs"
            value={file.content}
            onMount={handleEditorMount}
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
            style={{ left: selectionInfo.left, top: selectionInfo.top + 38 }}
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
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function AionWorkspacePreviewPane({ workspace, conversationId, onClose }: AionWorkspacePreviewPaneProps) {
  const [openTabs, setOpenTabs] = useState<ActivePreviewFile[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const openTabsRef = useRef(openTabs);
  openTabsRef.current = openTabs;
  const referenceSessionKey = getCodeReferenceSessionKey(conversationId);

  const activeFile = openTabs.find((t) => t.path === activeTabPath) ?? null;

  const openFile = useCallback(async (path: string, options: { revealLine?: number } = {}) => {
    if (!workspace) return;

    // If already open, just switch to it
    if (openTabsRef.current.some((t) => t.path === path)) {
      setActiveTabPath(path);
      return;
    }

    const fileName = basename(path);
    const relativePath = getRelativePath(workspace, path);
    const loadingTab: ActivePreviewFile = {
      path,
      fileName,
      relativePath,
      content: '',
      contentType: 'code',
      loading: true,
      revealLine: options.revealLine,
    };
    setOpenTabs((prev) => [...prev, loadingTab]);
    setActiveTabPath(path);

    const result = await window.electron.readPreviewFile({ cwd: workspace, path });
    const resolved: ActivePreviewFile = result.success && result.content !== undefined
      ? {
          path: result.path || path,
          fileName: basename(result.path || path),
          relativePath: getRelativePath(workspace, result.path || path),
          content: result.content,
          contentType: inferContentType(result.path || path, result.content),
          language: result.language,
          revealLine: options.revealLine,
        }
      : {
          path,
          fileName,
          relativePath,
          content: '',
          contentType: 'code',
          error: result.error || '文件读取失败。',
          revealLine: options.revealLine,
        };

    setOpenTabs((prev) => prev.map((t) => (t.path === path ? resolved : t)));
  }, [workspace]);

  const closeTab = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      const next = prev.filter((t) => t.path !== path);

      if (path === activeTabPath) {
        // Activate nearest tab: prefer right neighbor, then left
        const newActive = next[Math.min(idx, next.length - 1)] ?? null;
        setActiveTabPath(newActive?.path ?? null);
      }
      return next;
    });
  }, [activeTabPath]);

  useEffect(() => {
    const handleOpenFromPrompt = (event: Event) => {
      const detail = (event as CustomEvent<{ filePath?: string; startLine?: number }>).detail;
      if (!detail?.filePath) return;
      void openFile(detail.filePath, { revealLine: detail.startLine });
    };

    window.addEventListener(PREVIEW_OPEN_FILE_EVENT, handleOpenFromPrompt);
    return () => window.removeEventListener(PREVIEW_OPEN_FILE_EVENT, handleOpenFromPrompt);
  }, [openFile]);

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
        <NativeExplorer workspace={workspace} activeFilePath={activeFile?.path} onOpenFile={openFile} />
        <PreviewSurface
          file={activeFile}
          referenceSessionKey={referenceSessionKey}
          openTabs={openTabs}
          activeTabPath={activeTabPath}
          onSwitchTab={setActiveTabPath}
          onCloseTab={closeTab}
        />
      </div>
    </div>
  );
}
