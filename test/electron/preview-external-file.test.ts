import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  listPreviewDirectoryForRenderer,
  readPreviewFileForRenderer,
} from "../../src/electron/libs/preview-fs.js";

async function withTempRoots<T>(run: (workspace: string, externalRoot: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "preview-external-"));
  const workspace = join(root, "workspace");
  const externalRoot = join(root, "external");
  await mkdir(workspace, { recursive: true });
  await mkdir(externalRoot, { recursive: true });
  try {
    return await run(workspace, externalRoot);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("preview read allows absolute files outside the active workspace without widening tree browsing", async () => {
  await withTempRoots(async (workspace, externalRoot) => {
    const externalFile = join(externalRoot, "note.md");
    await writeFile(externalFile, "# external\n", "utf8");

    const readResult = await readPreviewFileForRenderer({ cwd: workspace, path: externalFile });
    const listResult = await listPreviewDirectoryForRenderer({ cwd: workspace, path: externalRoot });

    assert.equal(readResult.success, true);
    assert.equal(readResult.content, "# external\n");
    assert.equal(listResult.success, false);
  });
});

test("preview pane retries external absolute files from their containing directory", () => {
  const paneSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.tsx", "utf8");

  assert.match(paneSource, /function isAbsolutePreviewPath\(path: string\)/);
  assert.match(paneSource, /async function readPreviewFileWithFallback\(workspace: string, path: string\)/);
  assert.match(paneSource, /window\.electron\.readPreviewFile\(\{ cwd: containingDirectory, path \}\)/);
  assert.match(paneSource, /readPreviewFileWithFallback\(workspace, existing\.path\)/);
  assert.match(paneSource, /readPreviewFileWithFallback\(workspace, path\)/);
});
