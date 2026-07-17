import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";

import { discoverPluginPackages } from "../../src/electron/libs/plugin-platform/plugin-package-registry.js";

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

test("discovers headless and workspace packages without conflating UI presence", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-registry-"));
  await writePackageFiles(pluginsRoot, "a-headless", {
    ".codex-plugin/plugin.json": {
      name: "headless-agent",
      version: "1.0.0",
      skills: "./skills/",
    },
  });
  await writePackageFiles(pluginsRoot, "b-workspace", {
    ".codex-plugin/plugin.json": {
      name: "workspace-agent",
      version: "1.0.0",
      interface: { displayName: "Workspace Agent" },
    },
    "tech-cc-hub.json": {
      schemaVersion: 1,
      contributes: {
        surfaces: [{ id: "workspace", placement: "activity-rail", entry: "./ui/index.html" }],
      },
    },
  });

  try {
    const result = await discoverPluginPackages(pluginsRoot);

    assert.deepEqual(result.records.map((record) => record.manifest.id), ["headless-agent", "workspace-agent"]);
    assert.equal(result.records[0]?.activityRail, null);
    assert.equal(result.records[1]?.activityRail?.source, "enhanced");
    assert.deepEqual(result.failures, []);
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

test("isolates invalid packages and ignores directories without a Codex manifest", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-registry-"));
  await writePackageFiles(pluginsRoot, "a-valid", {
    ".codex-plugin/plugin.json": { name: "valid-agent", version: "1.0.0" },
  });
  await writePackageFiles(pluginsRoot, "b-broken", {
    ".codex-plugin/plugin.json": "{not-json",
  });
  await writePackageFiles(pluginsRoot, "notes", {
    "README.md": "not a plugin package",
  });

  try {
    const result = await discoverPluginPackages(pluginsRoot);

    assert.deepEqual(result.records.map((record) => record.manifest.id), ["valid-agent"]);
    assert.equal(result.failures.length, 1);
    assert.equal(basename(result.failures[0]?.packageRoot ?? ""), "b-broken");
    assert.equal(result.failures[0]?.errors[0]?.path, "codex");
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

test("keeps the first deterministic package and reports later duplicate plugin IDs", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-registry-"));
  await writePackageFiles(pluginsRoot, "a-first", {
    ".codex-plugin/plugin.json": { name: "duplicate-agent", version: "1.0.0" },
  });
  await writePackageFiles(pluginsRoot, "b-second", {
    ".codex-plugin/plugin.json": { name: "duplicate-agent", version: "2.0.0" },
  });

  try {
    const result = await discoverPluginPackages(pluginsRoot);

    assert.equal(result.records.length, 1);
    assert.equal(basename(result.records[0]?.packageRoot ?? ""), "a-first");
    assert.equal(result.records[0]?.manifest.version, "1.0.0");
    assert.equal(result.failures.length, 1);
    assert.equal(basename(result.failures[0]?.packageRoot ?? ""), "b-second");
    assert.equal(result.failures[0]?.errors[0]?.code, "MANIFEST_INVALID");
    assert.equal(result.failures[0]?.errors[0]?.path, "codex.name");
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

test("discovers the real Canvas package as a legacy Activity Rail workspace", async () => {
  const result = await discoverPluginPackages(join(process.cwd(), "plugins"));
  const canvas = result.records.find((record) => record.manifest.id === "codex-canvas");

  assert.ok(canvas);
  assert.equal(canvas.activityRail?.source, "legacy-workspace");
  assert.equal(result.failures.some((failure) => failure.packageRoot.endsWith("codex-canvas")), false);
});
