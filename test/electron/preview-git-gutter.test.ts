import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("workspace preview decorates git diff hunks in the Monaco gutter", () => {
  const paneSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.tsx", "utf8");
  const cssSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.css", "utf8");

  assert.match(paneSource, /function parsePreviewGitDiffHunks\(diff: string, maxLineNumber: number\)/);
  assert.match(paneSource, /window\.electron\.getGitDiff\(\{ cwd: currentWorkspace, path: file\.path \}\)/);
  assert.match(paneSource, /gitDecorationsRef\.current = editor\.createDecorationsCollection\(\[\]\)/);
  assert.match(paneSource, /lineDecorationsClassName: `vscode-preview__git-line-decoration vscode-preview__git-line-decoration--\$\{hunk\.type\}`/);
  assert.match(paneSource, /glyphMarginClassName: `vscode-preview__git-gutter-bar vscode-preview__git-gutter-bar--\$\{hunk\.type\}`/);
  assert.match(paneSource, /MouseTargetType\.GUTTER_GLYPH_MARGIN/);
  assert.match(paneSource, /openGitPopover\(hunk\)/);
  assert.match(paneSource, /className="vscode-preview__git-popover"/);

  assert.match(cssSource, /\.vscode-preview__git-line-decoration \{/);
  assert.match(cssSource, /\.vscode-preview__git-gutter-bar::before \{/);
  assert.match(cssSource, /top: 0;/);
  assert.match(cssSource, /bottom: 0;/);
  assert.match(cssSource, /\.vscode-preview__git-gutter-bar--modified::before/);
  assert.match(cssSource, /\.vscode-preview__git-popover/);
});
