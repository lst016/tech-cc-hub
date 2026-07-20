import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { listPluginPackageCatalog } from "../../src/electron/libs/plugin-platform/plugin-package-registry.js";

const mainSource = readFileSync("src/electron/main.ts", "utf8");
const preloadSource = readFileSync("src/electron/preload.cts", "utf8");
const devShimSource = readFileSync("src/ui/dev-electron-shim.ts", "utf8");
const typesSource = readFileSync("types.d.ts", "utf8");

async function writePackageFiles(
  pluginsRoot: string,
  directoryName: string,
  files: Record<string, unknown | string>,
): Promise<void> {
  for (const [relativePath, value] of Object.entries(files)) {
    const filePath = join(pluginsRoot, directoryName, relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, typeof value === "string" ? value : JSON.stringify(value), "utf8");
  }
}

test("projects a renderer-safe catalog without dropping headless plugins or failures", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-catalog-"));
  await writePackageFiles(pluginsRoot, "a-headless", {
    ".codex-plugin/plugin.json": { name: "headless-agent", version: "1.0.0" },
  });
  await writePackageFiles(pluginsRoot, "b-broken", {
    ".codex-plugin/plugin.json": "{not-json",
  });

  try {
    const catalog = await listPluginPackageCatalog(pluginsRoot);

    assert.equal(catalog.records.length, 1);
    assert.equal(catalog.records[0]?.manifest.id, "headless-agent");
    assert.equal(catalog.records[0]?.activityRail, null);
    assert.equal("packageRoot" in (catalog.records[0] ?? {}), false);
    assert.equal(catalog.failures.length, 1);
    assert.equal(catalog.failures[0]?.packageName, "b-broken");
    assert.equal("packageRoot" in (catalog.failures[0] ?? {}), false);
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

test("Electron exposes the canonical plugin catalog through read-only IPC", () => {
  assert.match(
    mainSource,
    /import \{ listPluginPackageCatalog \} from "\.\/libs\/plugin-platform\/plugin-package-registry\.js";/,
  );
  assert.match(mainSource, /ipcMainHandle\("plugin-platform:list", async \(\) =>/);
  assert.match(mainSource, /return await listPluginPackageCatalog\(workspacePluginsRoot\(\)\);/);
  assert.match(preloadSource, /pluginPlatform: \{\s*list: \(\) => ipcInvoke\("plugin-platform:list"\),\s*\}/);
  assert.match(
    typesSource,
    /"plugin-platform:list": import\("\.\/src\/electron\/libs\/plugin-platform\/plugin-package-registry"\)\.PluginPackageCatalog;/,
  );
  assert.match(
    typesSource,
    /pluginPlatform: \{\s*list: \(\) => Promise<import\("\.\/src\/electron\/libs\/plugin-platform\/plugin-package-registry"\)\.PluginPackageCatalog>;\s*\};/,
  );
  assert.equal(devShimSource.match(/pluginPlatform: \{/g)?.length, 2);
  assert.equal(devShimSource.match(/list: async \(\) => \(\{ records: \[\], failures: \[\] \}\)/g)?.length, 2);
});
