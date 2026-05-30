import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPreviewUnsavedCloseMessage,
  confirmClosePreviewTabs,
  listDirtyPreviewTabs,
  markPreviewTabContent,
  type PreviewTabDirtyState,
} from "../../src/ui/utils/preview-tab-state.js";

test("marks preview tab as dirty only when content diverges from saved content", () => {
  const base: PreviewTabDirtyState = {
    path: "/repo/src/app.ts",
    fileName: "app.ts",
    content: "const a = 1;\n",
    savedContent: "const a = 1;\n",
    isDirty: false,
  };

  const unchanged = markPreviewTabContent(base, "const a = 1;\n");
  assert.equal(unchanged.isDirty, false);

  const changed = markPreviewTabContent(base, "const a = 2;\n");
  assert.equal(changed.isDirty, true);
});

test("lists dirty tabs by explicit dirty flag and content fallback", () => {
  const tabs: PreviewTabDirtyState[] = [
    {
      path: "/repo/src/a.ts",
      fileName: "a.ts",
      content: "a",
      savedContent: "a",
      isDirty: false,
    },
    {
      path: "/repo/src/b.ts",
      fileName: "b.ts",
      content: "b2",
      savedContent: "b1",
      isDirty: false,
    },
    {
      path: "/repo/src/c.ts",
      fileName: "c.ts",
      content: "c",
      savedContent: "c",
      isDirty: true,
    },
  ];

  const dirty = listDirtyPreviewTabs(tabs);
  assert.deepEqual(
    dirty.map((tab) => tab.fileName),
    ["b.ts", "c.ts"],
  );
});

test("builds precise unsaved confirmation messages", () => {
  const one = buildPreviewUnsavedCloseMessage([
    {
      path: "/repo/src/a.ts",
      fileName: "a.ts",
      content: "changed",
      savedContent: "base",
      isDirty: true,
    },
  ]);
  assert.match(one, /a\.ts/);
  assert.match(one, /未保存/);

  const many = buildPreviewUnsavedCloseMessage([
    {
      path: "/repo/src/a.ts",
      fileName: "a.ts",
      content: "changed",
      savedContent: "base",
      isDirty: true,
    },
    {
      path: "/repo/src/b.ts",
      fileName: "b.ts",
      content: "changed",
      savedContent: "base",
      isDirty: true,
    },
  ]);
  assert.match(many, /2 个标签页/);
});

test("skips confirm when no dirty tabs and blocks close when user cancels", () => {
  let called = false;
  const cleanTabs: PreviewTabDirtyState[] = [
    {
      path: "/repo/src/a.ts",
      fileName: "a.ts",
      content: "a",
      savedContent: "a",
      isDirty: false,
    },
  ];

  const cleanAllowed = confirmClosePreviewTabs(cleanTabs, () => {
    called = true;
    return false;
  });
  assert.equal(cleanAllowed, true);
  assert.equal(called, false);

  const dirtyAllowed = confirmClosePreviewTabs(
    [
      {
        path: "/repo/src/b.ts",
        fileName: "b.ts",
        content: "b2",
        savedContent: "b1",
        isDirty: false,
      },
    ],
    () => false,
  );
  assert.equal(dirtyAllowed, false);
});
