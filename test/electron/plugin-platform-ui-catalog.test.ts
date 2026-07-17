import assert from "node:assert/strict";
import test from "node:test";

import {
  getLegacyWorkspacePluginsFromCatalog,
  projectPluginActivityRailCatalog,
} from "../../src/ui/utils/plugin-platform-catalog.js";
import type {
  CanonicalPluginManifest,
  PluginActivityRailDescriptor,
} from "../../src/shared/plugin-platform/types.js";

function manifest(
  id: string,
  options: Partial<CanonicalPluginManifest> = {},
): CanonicalPluginManifest {
  return {
    id,
    version: "1.0.0",
    displayName: id,
    runtimeClass: "declarative",
    interfaceCapabilities: [],
    contributions: { surfaces: [], commands: [], hooks: [] },
    capabilities: { required: [], optional: [] },
    ...options,
  };
}

function record(
  pluginManifest: CanonicalPluginManifest,
  activityRail: PluginActivityRailDescriptor | null,
) {
  return { manifest: pluginManifest, activityRail };
}

test("projects only declared Activity Rail surfaces while retaining enhanced entries", () => {
  const catalog = projectPluginActivityRailCatalog([
    record(manifest("headless"), null),
    record(manifest("enhanced", { displayName: "Enhanced Workbench" }), {
      pluginId: "enhanced",
      surfaceId: "workspace",
      label: "Enhanced Workbench",
      source: "enhanced",
      entry: "./ui/index.html",
    }),
    record(manifest("legacy", {
      displayName: "Canonical Legacy Label",
      legacyWorkspace: {
        id: "legacy",
        label: "Old Label",
        surface: "browser-view",
        start: { command: "node", args: ["server.js"] },
        permissions: ["session.snapshot"],
      },
    }), {
      pluginId: "legacy",
      surfaceId: "workspace",
      label: "Canonical Legacy Label",
      source: "legacy-workspace",
    }),
  ]);

  assert.deepEqual(catalog, [
    {
      pluginId: "enhanced",
      surfaceId: "workspace",
      label: "Enhanced Workbench",
      source: "enhanced",
      entry: "./ui/index.html",
    },
    {
      pluginId: "legacy",
      surfaceId: "workspace",
      label: "Canonical Legacy Label",
      source: "legacy-workspace",
      workspace: {
        id: "legacy",
        label: "Canonical Legacy Label",
        surface: "browser-view",
        permissions: ["session.snapshot"],
      },
    },
  ]);
});

test("derives current browser-view launch descriptors without treating enhanced surfaces as legacy", () => {
  const catalog = projectPluginActivityRailCatalog([
    record(manifest("enhanced"), {
      pluginId: "enhanced",
      surfaceId: "workspace",
      label: "Enhanced",
      source: "enhanced",
      entry: "./ui/index.html",
    }),
    record(manifest("legacy", {
      legacyWorkspace: {
        id: "legacy",
        label: "Legacy",
        surface: "browser-view",
        start: { command: "node", args: [] },
        permissions: ["session.send"],
      },
    }), {
      pluginId: "legacy",
      surfaceId: "workspace",
      label: "Legacy",
      source: "legacy-workspace",
    }),
  ]);

  assert.deepEqual(getLegacyWorkspacePluginsFromCatalog(catalog), [{
    id: "legacy",
    label: "Legacy",
    surface: "browser-view",
    permissions: ["session.send"],
  }]);
});

test("rejects inconsistent descriptors at the renderer trust boundary", () => {
  const catalog = projectPluginActivityRailCatalog([
    record(manifest("actual"), {
      pluginId: "different",
      surfaceId: "workspace",
      label: "Wrong package",
      source: "enhanced",
      entry: "./ui/index.html",
    }),
    record(manifest("legacy-without-runtime"), {
      pluginId: "legacy-without-runtime",
      surfaceId: "workspace",
      label: "Missing runtime",
      source: "legacy-workspace",
    }),
  ]);

  assert.deepEqual(catalog, []);
});
