import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("quick open filter supports recency/context options", () => {
  const source = readFileSync("src/shared/preview-quick-open.ts", "utf8");

  assert.match(source, /type PreviewQuickOpenFilterOptions = \{/);
  assert.match(source, /recentPaths\?: readonly string\[]/);
  assert.match(source, /activePath\?: string/);
  assert.match(source, /filterPreviewQuickOpenEntries\([\s\S]*options: PreviewQuickOpenFilterOptions = \{\}/);
  assert.match(source, /tokens\.length === 0/);
  assert.match(source, /recentIndex/);
});

test("preview pane passes recency options and records recently opened files", () => {
  const paneSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.tsx", "utf8");

  assert.match(paneSource, /filterPreviewQuickOpenEntries\([\s\S]*recentPaths[\s\S]*activePath:/);
  assert.match(paneSource, /recentPaths=\{quickOpenRecentPaths\}/);
  assert.match(paneSource, /activePath=\{activeTabPath\}/);
  assert.match(paneSource, /const EMPTY_PREVIEW_RECENT_PATHS: string\[] = \[];/);
  assert.match(paneSource, /const \[quickOpenRecentPathsByWorkspace, setQuickOpenRecentPathsByWorkspace\] = useState<Record<string, string\[]>>\(\{\}\);/);
  assert.match(paneSource, /quickOpenRecentPathsByWorkspace\[workspace\] \?\? EMPTY_PREVIEW_RECENT_PATHS/);
  assert.match(paneSource, /markPreviewQuickOpenRecentPath\(workspace,/);
  assert.match(paneSource, /setQuickOpenRecentPathsByWorkspace\(\(current\) => \{/);
});

test("preview pane supports stronger keyboard workflow for quick open and tab switching", () => {
  const paneSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.tsx", "utf8");

  assert.match(paneSource, /if \(key !== 'p'[\s\S]*if \(quickOpenVisible\) \{/);
  assert.match(paneSource, /event\.key\.toLowerCase\(\) !== 'tab'/);
  assert.match(paneSource, /onSwitchTab\(openTabs\[nextIndex\]!\.path\)/);
});
