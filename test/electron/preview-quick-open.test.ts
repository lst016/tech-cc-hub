import test from "node:test";
import assert from "node:assert/strict";

import {
  filterPreviewQuickOpenEntries,
  scorePreviewQuickOpenEntry,
  type PreviewQuickOpenEntry,
} from "../../src/shared/preview-quick-open.js";

const entries: PreviewQuickOpenEntry[] = [
  { name: "index.tsx", path: "D:/repo/src/pages/main/index.tsx", relativePath: "src/pages/main/index.tsx" },
  { name: "package.json", path: "D:/repo/package.json", relativePath: "package.json" },
  { name: "config.tsx", path: "D:/repo/src/pages/main/setting/config.tsx", relativePath: "src/pages/main/setting/config.tsx" },
  { name: "README.md", path: "D:/repo/README.md", relativePath: "README.md" },
];

test("quick open ranks basename matches before deep path matches", () => {
  const result = filterPreviewQuickOpenEntries(entries, "config");
  assert.equal(result[0]?.relativePath, "src/pages/main/setting/config.tsx");
});

test("quick open supports path fragment queries", () => {
  const result = filterPreviewQuickOpenEntries(entries, "pages main index");
  assert.equal(result[0]?.relativePath, "src/pages/main/index.tsx");
});

test("quick open excludes entries that do not match every token", () => {
  assert.equal(scorePreviewQuickOpenEntry(entries[1], "src config"), null);
});
