import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("workspace preview tree expansion is persisted in app store", () => {
  const paneSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.tsx", "utf8");
  const storeSource = readFileSync("src/ui/store/useAppStore.ts", "utf8");

  assert.match(storeSource, /previewExpandedPathsByWorkspace: Record<string, string\[]>/);
  assert.match(storeSource, /setPreviewExpandedPaths: \(workspace: string, paths: string\[\]\) => void/);
  assert.match(storeSource, /resetPreviewExpandedPaths: \(workspace: string, rootPath\?: string\) => void/);
  assert.match(paneSource, /const persistedExpandedPaths = useAppStore\(\(state\) => state\.previewExpandedPathsByWorkspace\[workspace\]\)/);
  assert.match(paneSource, /const storedExpandedPaths = useMemo\(\(\) => persistedExpandedPaths \?\? \[workspace\], \[persistedExpandedPaths, workspace\]\)/);
  assert.match(paneSource, /setStoredExpandedPaths\(workspace, \[\.\.\.next\]\)/);
  assert.match(paneSource, /if \(storedExpandedPaths\.length === 0\) \{/);
});
