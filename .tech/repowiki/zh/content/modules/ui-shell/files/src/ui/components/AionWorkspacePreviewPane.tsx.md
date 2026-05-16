# src/ui/components/AionWorkspacePreviewPane.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：1407

## 文件职责

工作区文件预览面板，使用Monaco Editor渲染代码和markdown文件

## 关键符号

- `getRelativePath@0 - 计算相对路径`
- `inferContentType@0 - 推断内容类型`
- `formatBytes@0 - 格式化字节数为人类可读格式`
- `configurePreviewMonacoDefaults@0 - 配置Monaco Editor的TypeScript默认选项`
- `NativeExplorer@0 - 原生文件浏览器组件`
- `QuickOpenPalette@0 - 快速打开文件面板(Ctrl+P)`
- `PreviewSurface@0 - 文件预览表面组件`
- `AionWorkspacePreviewPane@0 - 工作区预览面板主组件`

## 依赖输入

- `react`
- `@monaco-editor/react`
- `monaco-editor`
- `lucide-react`
- `../events`
- `../../shared/preview-quick-open`
- `../store/useAppStore`
- `../utils/clipboard`
- `../utils/preview-file-refresh`
- `../utils/preview-language`
- `../utils/preview-file-locator`
- `../render/markdown`
- `./AionWorkspacePreviewPane.css`

## 对外暴露

- `AionWorkspacePreviewPane`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { ChevronLeft, ChevronRight, LocateFixed, RefreshCw } from 'lucide-react';
import { PREVIEW_OPEN_FILE_EVENT, PROMPT_FOCUS_EVENT, PROMPT_SENT_EVENT, PROMPT_SUBMIT_EVENT } from '../events';
import {
  filterPreviewQuickOpenEntries,
  type PreviewQuickOpenEntry,
} from '../../shared/preview-quick-open';
import { getCodeReferenceSessionKey, useAppStore, type CodeReferenceDraft } from '../store/useAppStore';
import { copyTextToClipboard } from '../utils/clipboard';
import {
  collectCompletedPreviewFileChanges,
  normalizePreviewFilePath,
} from '../utils/preview-file-refresh';
import {
  buildPreviewMonacoModelPath,
  getFileExtension,
  normalizeMonacoLanguage,
} from '../utils/preview-language';
import {
  getPreviewFileAncestorDirectories,
} from '../utils/preview-file-locator';
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

type AionWorkspacePreviewPaneProps = {
  workspace?: string;
  conversationId?: string;
  messages?: readonly unknown[];
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
};

function basename(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function getRelativePath(workspace: string, filePath: string) {
  if (filePath === workspace) return basename(workspace);
  if (file
... (truncated)
```
