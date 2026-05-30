import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

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

export type PreviewMonaco = typeof monaco;
export type PreviewEditor = monaco.editor.IStandaloneCodeEditor;
export type PreviewSelection = monaco.Selection;
export type PreviewDecorationCollection = monaco.editor.IEditorDecorationsCollection;

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

function configurePreviewMonacoDefaults(monacoApi: PreviewMonaco) {
  if (previewMonacoDefaultsConfigured) return;

  const typescript = (monacoApi.languages as unknown as { typescript?: MonacoTypeScriptRuntime }).typescript;
  const compilerOptions = {
    allowJs: true,
    allowNonTsExtensions: true,
    checkJs: false,
    jsx: typescript?.JsxEmit?.Preserve,
    module: typescript?.ModuleKind?.ESNext,
    moduleResolution: typescript?.ModuleResolutionKind?.NodeJs,
    noEmit: true,
    target: typescript?.ScriptTarget?.ESNext,
  };

  typescript?.typescriptDefaults?.setCompilerOptions(compilerOptions);
  typescript?.javascriptDefaults?.setCompilerOptions(compilerOptions);
  typescript?.typescriptDefaults?.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  });
  typescript?.javascriptDefaults?.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  });
  previewMonacoDefaultsConfigured = true;
}

export function PreviewMonacoEditor({
  value,
  language,
  path,
  onChange,
  onMount,
}: {
  value: string;
  language: string;
  path: string;
  onChange: (value: string) => void;
  onMount: (editor: PreviewEditor, monacoApi: PreviewMonaco) => void;
}) {
  return (
    <Editor
      height="100%"
      language={language}
      path={path}
      theme="vs"
      value={value}
      beforeMount={configurePreviewMonacoDefaults}
      onMount={onMount}
      onChange={(nextValue) => onChange(nextValue ?? '')}
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
  );
}
