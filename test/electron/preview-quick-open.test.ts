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
  { name: "PromptInput.tsx", path: "D:/repo/src/ui/components/PromptInput.tsx", relativePath: "src/ui/components/PromptInput.tsx" },
  { name: "AionWorkspacePreviewPane.tsx", path: "D:/repo/src/ui/components/AionWorkspacePreviewPane.tsx", relativePath: "src/ui/components/AionWorkspacePreviewPane.tsx" },
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

test("quick open supports fuzzy basename queries", () => {
  const result = filterPreviewQuickOpenEntries(entries, "pmi");
  assert.equal(result[0]?.relativePath, "src/ui/components/PromptInput.tsx");
});

test("quick open supports fuzzy multi-token path queries", () => {
  const result = filterPreviewQuickOpenEntries(entries, "aion pane");
  assert.equal(result[0]?.relativePath, "src/ui/components/AionWorkspacePreviewPane.tsx");
});

test("quick open prefers active and recent files when query is empty", () => {
  const result = filterPreviewQuickOpenEntries(entries, "", 10, {
    activePath: "D:/repo/src/ui/components/PromptInput.tsx",
    recentPaths: [
      "D:/repo/README.md",
      "D:/repo/src/pages/main/index.tsx",
    ],
  });

  assert.equal(result[0]?.relativePath, "src/ui/components/PromptInput.tsx");
  assert.equal(result[1]?.relativePath, "README.md");
  assert.equal(result[2]?.relativePath, "src/pages/main/index.tsx");
});

test("quick open gives recent files a ranking boost for matching queries", () => {
  const ranked = filterPreviewQuickOpenEntries(entries, "ui components", 10, {
    recentPaths: ["D:/repo/src/ui/components/AionWorkspacePreviewPane.tsx"],
  });

  const promptInputIndex = ranked.findIndex((item) => item.relativePath === "src/ui/components/PromptInput.tsx");
  const previewPaneIndex = ranked.findIndex((item) => item.relativePath === "src/ui/components/AionWorkspacePreviewPane.tsx");
  assert.notEqual(promptInputIndex, -1);
  assert.notEqual(previewPaneIndex, -1);
  assert.ok(previewPaneIndex <= promptInputIndex);
});
