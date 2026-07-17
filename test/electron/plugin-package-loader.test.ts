import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { loadPluginPackage } from "../../src/electron/libs/plugin-platform/plugin-package-loader.js";
import { getPluginActivityRailDescriptor } from "../../src/shared/plugin-platform/index.js";

async function createPluginPackage(files: Record<string, unknown | string>): Promise<string> {
  const packageRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-package-"));
  for (const [relativePath, value] of Object.entries(files)) {
    const filePath = join(packageRoot, relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, typeof value === "string" ? value : JSON.stringify(value), "utf8");
  }
  return packageRoot;
}

test("loads the real Canvas package with inspected MCP and legacy workspace manifests", async () => {
  const result = await loadPluginPackage(join(process.cwd(), "plugins", "codex-canvas"));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.id, "codex-canvas");
  assert.equal(result.manifest.runtimeClass, "native-local");
  assert.deepEqual(result.warnings, []);
  assert.equal(getPluginActivityRailDescriptor(result.manifest)?.source, "legacy-workspace");
});

test("loads a remote-only MCP package as declarative without an unclassified warning", async () => {
  const packageRoot = await createPluginPackage({
    ".codex-plugin/plugin.json": {
      name: "remote-agent",
      version: "1.0.0",
      mcpServers: "./.mcp.json",
    },
    ".mcp.json": {
      mcpServers: {
        remote: { type: "http", url: "https://example.com/mcp" },
      },
    },
  });

  try {
    const result = await loadPluginPackage(packageRoot);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.manifest.runtimeClass, "declarative");
    assert.deepEqual(result.warnings, []);
    assert.equal(getPluginActivityRailDescriptor(result.manifest), null);
  } finally {
    await rm(packageRoot, { recursive: true, force: true });
  }
});

test("loads an enhanced Activity Rail surface from tech-cc-hub.json", async () => {
  const packageRoot = await createPluginPackage({
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
    const result = await loadPluginPackage(packageRoot);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(getPluginActivityRailDescriptor(result.manifest), {
      pluginId: "workspace-agent",
      surfaceId: "workspace",
      label: "Workspace Agent",
      source: "enhanced",
      entry: "./ui/index.html",
    });
  } finally {
    await rm(packageRoot, { recursive: true, force: true });
  }
});

test("allows a Codex-only package when every optional host manifest is absent", async () => {
  const packageRoot = await createPluginPackage({
    ".codex-plugin/plugin.json": {
      name: "codex-only",
      version: "1.0.0",
      skills: "./skills/",
    },
  });

  try {
    const result = await loadPluginPackage(packageRoot);

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.manifest.contributions.skills, "./skills/");
    assert.equal(getPluginActivityRailDescriptor(result.manifest), null);
  } finally {
    await rm(packageRoot, { recursive: true, force: true });
  }
});

test("rejects a package without its required Codex manifest", async () => {
  const packageRoot = await createPluginPackage({});

  try {
    const result = await loadPluginPackage(packageRoot);

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors[0]?.code, "MANIFEST_INVALID");
    assert.equal(result.errors[0]?.path, "codex");
  } finally {
    await rm(packageRoot, { recursive: true, force: true });
  }
});

test("rejects a missing MCP file referenced by the Codex manifest", async () => {
  const packageRoot = await createPluginPackage({
    ".codex-plugin/plugin.json": {
      name: "missing-mcp",
      version: "1.0.0",
      mcpServers: "./missing.mcp.json",
    },
  });

  try {
    const result = await loadPluginPackage(packageRoot);

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors[0]?.code, "MANIFEST_INVALID");
    assert.equal(result.errors[0]?.path, "mcp");
  } finally {
    await rm(packageRoot, { recursive: true, force: true });
  }
});

test("rejects an unsafe MCP path without reading outside the package", async () => {
  const packageRoot = await createPluginPackage({
    ".codex-plugin/plugin.json": {
      name: "unsafe-mcp",
      version: "1.0.0",
      mcpServers: "../outside.mcp.json",
    },
  });

  try {
    const result = await loadPluginPackage(packageRoot);

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors[0]?.code, "MANIFEST_INVALID");
    assert.equal(result.errors[0]?.path, "codex.mcpServers");
  } finally {
    await rm(packageRoot, { recursive: true, force: true });
  }
});

test("reports malformed referenced MCP JSON at the MCP boundary", async () => {
  const packageRoot = await createPluginPackage({
    ".codex-plugin/plugin.json": {
      name: "broken-mcp",
      version: "1.0.0",
      mcpServers: "./.mcp.json",
    },
    ".mcp.json": "{not-json",
  });

  try {
    const result = await loadPluginPackage(packageRoot);

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors[0]?.code, "MANIFEST_INVALID");
    assert.equal(result.errors[0]?.path, "mcp");
  } finally {
    await rm(packageRoot, { recursive: true, force: true });
  }
});
