import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getPluginActivityRailDescriptor,
  getPluginSurfaceDescriptors,
  normalizePluginPackageManifests,
} from "../../src/shared/plugin-platform/index.js";

const codexCanvasManifest = JSON.parse(
  readFileSync("plugins/codex-canvas/.codex-plugin/plugin.json", "utf8"),
) as unknown;

const codexCanvasMcpManifest = JSON.parse(
  readFileSync("plugins/codex-canvas/.mcp.json", "utf8"),
) as unknown;

const legacyCanvasManifest = JSON.parse(
  readFileSync("plugins/codex-canvas/tech-cc-hub.plugin.json", "utf8"),
) as unknown;

test("keeps a native headless plugin out of the Activity Rail without dropping its contributions", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: {
      name: "headless-agent",
      version: "1.0.0",
      skills: "./skills/",
      mcpServers: "./.mcp.json",
    },
    mcpManifest: {
      mcpServers: {
        local: { command: "node", args: ["./server.mjs"] },
      },
    },
    extensionManifest: {
      schemaVersion: 1,
      capabilities: { required: ["models.invoke"] },
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.runtimeClass, "native-local");
  assert.equal(result.manifest.contributions.skills, "./skills/");
  assert.deepEqual(result.manifest.capabilities.required, ["models.invoke"]);
  assert.equal(getPluginActivityRailDescriptor(result.manifest), null);
});

test("projects one declared Activity Rail surface into a closed workspace option", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: {
      name: "workspace-agent",
      version: "1.0.0",
      interface: { displayName: "Workspace Agent" },
    },
    extensionManifest: {
      schemaVersion: 1,
      contributes: {
        surfaces: [{ id: "workspace", placement: "activity-rail", entry: "./ui/index.html" }],
      },
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(getPluginActivityRailDescriptor(result.manifest), {
    pluginId: "workspace-agent",
    surfaceId: "workspace",
    label: "Workspace Agent",
    source: "enhanced",
    entry: "./ui/index.html",
  });
});

test("does not project settings-only surfaces into the Activity Rail", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: { name: "settings-agent", version: "1.0.0" },
    extensionManifest: {
      schemaVersion: 1,
      contributes: {
        surfaces: [{ id: "settings", placement: "settings", entry: "./ui/settings.html" }],
      },
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(getPluginActivityRailDescriptor(result.manifest), null);
});

test("projects a legacy Workspace plugin without treating its loopback URL as a package entry", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: codexCanvasManifest,
    mcpManifest: codexCanvasMcpManifest,
    legacyWorkspaceManifest: legacyCanvasManifest,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(getPluginActivityRailDescriptor(result.manifest), {
    pluginId: "codex-canvas",
    surfaceId: "workspace",
    label: "Codex Canvas",
    source: "legacy-workspace",
  });
});

test("rejects a second Activity Rail surface because tabs are keyed by plugin ID", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: { name: "ambiguous-workspace", version: "1.0.0" },
    extensionManifest: {
      schemaVersion: 1,
      contributes: {
        surfaces: [
          { id: "primary", placement: "activity-rail", entry: "./ui/primary.html" },
          { id: "secondary", placement: "activity-rail", entry: "./ui/secondary.html" },
        ],
      },
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errors[0]?.code, "MANIFEST_INVALID");
  assert.equal(result.errors[0]?.path, "extension.contributes.surfaces[1].placement");
});

test("projects composer, Activity Rail, and settings surfaces independently", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: {
      name: "multi-surface",
      version: "1.0.0",
      interface: { displayName: "Multi Surface" },
    },
    extensionManifest: {
      schemaVersion: 1,
      contributes: {
        surfaces: [
          { id: "quick-action", placement: "composer", entry: "./ui/quick-action.html" },
          { id: "workbench", placement: "activity-rail", entry: "./ui/workbench.html" },
          { id: "preferences", placement: "settings", entry: "./ui/preferences.html" },
        ],
      },
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(getPluginSurfaceDescriptors(result.manifest), [
    {
      pluginId: "multi-surface",
      surfaceId: "quick-action",
      label: "Multi Surface",
      placement: "composer",
      source: "enhanced",
      entry: "./ui/quick-action.html",
    },
    {
      pluginId: "multi-surface",
      surfaceId: "workbench",
      label: "Multi Surface",
      placement: "activity-rail",
      source: "enhanced",
      entry: "./ui/workbench.html",
    },
    {
      pluginId: "multi-surface",
      surfaceId: "preferences",
      label: "Multi Surface",
      placement: "settings",
      source: "enhanced",
      entry: "./ui/preferences.html",
    },
  ]);
});

test("adds a legacy workspace only when no enhanced Activity Rail surface replaces it", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: codexCanvasManifest,
    mcpManifest: codexCanvasMcpManifest,
    extensionManifest: {
      schemaVersion: 1,
      contributes: {
        surfaces: [{ id: "quick-action", placement: "composer", entry: "./ui/action.html" }],
      },
    },
    legacyWorkspaceManifest: legacyCanvasManifest,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(getPluginSurfaceDescriptors(result.manifest), [
    {
      pluginId: "codex-canvas",
      surfaceId: "quick-action",
      label: "Codex Canvas",
      placement: "composer",
      source: "enhanced",
      entry: "./ui/action.html",
    },
    {
      pluginId: "codex-canvas",
      surfaceId: "workspace",
      label: "Codex Canvas",
      placement: "activity-rail",
      source: "legacy-workspace",
    },
  ]);
});
