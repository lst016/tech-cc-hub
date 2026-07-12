import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  listPreviewDirectoryForRenderer,
  listPreviewFilesForRenderer,
  renamePreviewEntryForRenderer,
} from "../../src/electron/libs/preview-fs.js";

async function withTempWorkspace<T>(run: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "preview-fs-"));
  try {
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("preview quick-open file scan ignores generated and dependency directories", async () => {
  await withTempWorkspace(async (root) => {
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "dist"), { recursive: true });
    await mkdir(join(root, "dist-test"), { recursive: true });
    await mkdir(join(root, "build"), { recursive: true });
    await mkdir(join(root, "coverage"), { recursive: true });
    await mkdir(join(root, "out"), { recursive: true });
    await mkdir(join(root, "node_modules", "pkg"), { recursive: true });

    await writeFile(join(root, "src", "keep.ts"), "export const keep = true;\n", "utf8");
    await writeFile(join(root, "dist", "skip.ts"), "skip\n", "utf8");
    await writeFile(join(root, "dist-test", "skip.ts"), "skip\n", "utf8");
    await writeFile(join(root, "build", "skip.ts"), "skip\n", "utf8");
    await writeFile(join(root, "coverage", "skip.ts"), "skip\n", "utf8");
    await writeFile(join(root, "out", "skip.ts"), "skip\n", "utf8");
    await writeFile(join(root, "node_modules", "pkg", "skip.ts"), "skip\n", "utf8");

    const result = await listPreviewFilesForRenderer({ cwd: root, limit: 50 });

    assert.equal(result.success, true);
    assert.deepEqual(result.entries?.map((entry) => entry.relativePath), ["src/keep.ts"]);
  });
});

test("preview quick-open file scan respects root gitignore rules", async () => {
  await withTempWorkspace(async (root) => {
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "tmp", "cache"), { recursive: true });
    await mkdir(join(root, "logs"), { recursive: true });

    await writeFile(join(root, ".gitignore"), [
      "tmp/",
      "*.log",
      "logs/*.txt",
      "!logs/keep.txt",
      "",
    ].join("\n"), "utf8");
    await writeFile(join(root, "src", "keep.ts"), "export const keep = true;\n", "utf8");
    await writeFile(join(root, "tmp", "cache", "ignored.ts"), "ignored\n", "utf8");
    await writeFile(join(root, "debug.log"), "ignored\n", "utf8");
    await writeFile(join(root, "logs", "drop.txt"), "ignored\n", "utf8");
    await writeFile(join(root, "logs", "keep.txt"), "keep\n", "utf8");

    const result = await listPreviewFilesForRenderer({ cwd: root, limit: 50 });

    assert.equal(result.success, true);
    assert.deepEqual(result.entries?.map((entry) => entry.relativePath), [
      "logs/keep.txt",
      "src/keep.ts",
    ]);
  });
});

test("preview directory listing sorts before applying the visible-entry cap", async () => {
  await withTempWorkspace(async (root) => {
    await mkdir(join(root, ".config"), { recursive: true });
    await mkdir(join(root, "a-directory"), { recursive: true });
    await mkdir(join(root, "dist-test"), { recursive: true });
    await writeFile(join(root, ".hidden-file"), "hidden\n", "utf8");
    await writeFile(join(root, "b-file.ts"), "b\n", "utf8");
    await writeFile(join(root, "z-file.ts"), "z\n", "utf8");

    const result = await listPreviewDirectoryForRenderer({ cwd: root, path: root }, { maxEntries: 2 });

    assert.equal(result.success, true);
    assert.deepEqual(result.entries?.map((entry) => entry.name), [".config", "a-directory"]);
  });
});

test("preview rename rejects dot path segments that would escape the workspace", async () => {
  await withTempWorkspace(async (root) => {
    const nested = join(root, "src");
    const filePath = join(nested, "keep.ts");
    await mkdir(nested, { recursive: true });
    await writeFile(filePath, "export const keep = true;\n", "utf8");

    const result = await renamePreviewEntryForRenderer({ cwd: root, path: filePath, newName: ".." });

    assert.equal(result.success, false);
    assert.match(result.error ?? "", /合法新名称|当前工作目录/);
  });
});
