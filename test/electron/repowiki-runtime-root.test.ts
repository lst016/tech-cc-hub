import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveRepoWikiRuntimeRoot } from "../../src/electron/libs/knowledge/repowiki/engine.js";

function makeRepoWikiRuntimeRoot(root: string): void {
  mkdirSync(join(root, "third_party", "repowiki", "src", "repowiki"), { recursive: true });
  mkdirSync(join(root, "scripts", "knowledge"), { recursive: true });
  writeFileSync(join(root, "scripts", "knowledge", "run-repowiki.py"), "", "utf8");
}

test("RepoWiki runtime root resolves from a nested dev module path", () => {
  const root = mkdtempSync(join(tmpdir(), "tech-cc-hub-repowiki-dev-"));
  try {
    makeRepoWikiRuntimeRoot(root);

    const resolved = resolveRepoWikiRuntimeRoot({
      cwd: join(root, "dist-electron", "electron"),
      moduleDir: join(root, "dist-electron", "electron", "libs", "knowledge", "repowiki"),
      resourcesPath: undefined,
      pathExists: existsSync,
    });

    assert.equal(resolved, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("RepoWiki runtime root resolves from Electron packaged resources", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-repowiki-packaged-"));
  try {
    const resourcesPath = join(tempRoot, "resources");
    makeRepoWikiRuntimeRoot(resourcesPath);

    const resolved = resolveRepoWikiRuntimeRoot({
      cwd: join(tempRoot, "Program Files", "tech-cc-hub"),
      moduleDir: join(resourcesPath, "app.asar", "dist-electron", "electron", "libs", "knowledge", "repowiki"),
      resourcesPath,
      pathExists: existsSync,
    });

    assert.equal(resolved, resourcesPath);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
