import assert from "node:assert/strict";
import test from "node:test";

import {
  getLegacyWorkspacePluginsFromCatalog,
  getPluginSurfaceCatalogByPlacement,
  projectPluginActivityRailCatalog,
  projectPluginSurfaceCatalog,
} from "../../src/ui/utils/plugin-platform-catalog.js";
import type {
  CanonicalPluginManifest,
  PluginActivityRailDescriptor,
  PluginSurfaceDescriptor,
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
  surfaces: PluginSurfaceDescriptor[] = [],
) {
  return { manifest: pluginManifest, activityRail, surfaces };
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

test("projects plugin-declared UI entry points without forcing headless plugins into chrome", () => {
  const surfaceManifest = manifest("surface-plugin", {
    displayName: "Surface Plugin",
    contributions: {
      surfaces: [
        { id: "quick-action", placement: "composer", entry: "./ui/action.html" },
        { id: "workbench", placement: "activity-rail", entry: "./ui/workbench.html" },
        { id: "preferences", placement: "settings", entry: "./ui/settings.html" },
      ],
      commands: [],
      hooks: [],
    },
  });
  const surfaces: PluginSurfaceDescriptor[] = [
    {
      pluginId: "surface-plugin",
      surfaceId: "quick-action",
      label: "Surface Plugin",
      placement: "composer",
      source: "enhanced",
      entry: "./ui/action.html",
    },
    {
      pluginId: "surface-plugin",
      surfaceId: "workbench",
      label: "Surface Plugin",
      placement: "activity-rail",
      source: "enhanced",
      entry: "./ui/workbench.html",
    },
    {
      pluginId: "surface-plugin",
      surfaceId: "preferences",
      label: "Surface Plugin",
      placement: "settings",
      source: "enhanced",
      entry: "./ui/settings.html",
    },
  ];

  const catalog = projectPluginSurfaceCatalog([
    record(manifest("headless"), null),
    record(surfaceManifest, null, surfaces),
  ]);

  assert.deepEqual(catalog, surfaces);
  assert.deepEqual(getPluginSurfaceCatalogByPlacement(catalog, "composer"), [surfaces[0]]);
  assert.deepEqual(getPluginSurfaceCatalogByPlacement(catalog, "activity-rail"), [surfaces[1]]);
  assert.deepEqual(getPluginSurfaceCatalogByPlacement(catalog, "settings"), [surfaces[2]]);
});

test("rejects forged or stale enhanced surface descriptors in the renderer", () => {
  const pluginManifest = manifest("actual", {
    contributions: {
      surfaces: [{ id: "action", placement: "composer", entry: "./ui/action.html" }],
      commands: [],
      hooks: [],
    },
  });

  assert.deepEqual(projectPluginSurfaceCatalog([
    record(pluginManifest, null, [
      {
        pluginId: "different",
        surfaceId: "action",
        label: "Wrong package",
        placement: "composer",
        source: "enhanced",
        entry: "./ui/action.html",
      },
      {
        pluginId: "actual",
        surfaceId: "action",
        label: "Stale entry",
        placement: "composer",
        source: "enhanced",
        entry: "./ui/stale.html",
      },
    ]),
  ]), []);
});
