import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("workspace preview lazy-loads Monaco without stale optimized dependencies", () => {
  const paneSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.tsx", "utf8");
  const editorSource = readFileSync("src/ui/components/PreviewMonacoEditor.tsx", "utf8");
  const viteSource = readFileSync("vite.config.ts", "utf8");

  assert.doesNotMatch(paneSource, /from ['"]@monaco-editor\/react['"]/);
  assert.doesNotMatch(paneSource, /from ['"]monaco-editor['"]/);
  assert.match(paneSource, /lazy\(\(\) => import\(['"]\.\/PreviewMonacoEditor['"]\)/);
  assert.match(editorSource, /from '@monaco-editor\/react'/);
  assert.match(editorSource, /from 'monaco-editor'/);
  assert.match(viteSource, /exclude:\s*\[[^\]]*['"]@monaco-editor\/react['"][^\]]*['"]monaco-editor['"][^\]]*\]/s);
});
