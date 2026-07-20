import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import type { BrowserView, Rectangle, WebContents, WebPreferences } from "electron";

import { PluginCapabilityGrantRegistry } from "../../src/electron/libs/plugin-platform/plugin-capability-grant-registry.js";
import {
  PluginSurfaceViewHost,
  type PluginSurfaceViewLike,
} from "../../src/electron/libs/plugin-platform/plugin-surface-view-host.js";
import type { CanonicalPluginManifest } from "../../src/shared/plugin-platform/types.js";

async function writeSurfacePlugin(
  pluginsRoot: string,
  pluginId: string,
  placement: "composer" | "activity-rail" = "activity-rail",
): Promise<{ packageRoot: string; entryPath: string }> {
  const packageRoot = join(pluginsRoot, "installed-package");
  const entryPath = join(packageRoot, "ui", "index.html");
  await mkdir(join(packageRoot, ".codex-plugin"), { recursive: true });
  await mkdir(join(packageRoot, "ui"), { recursive: true });
  await writeFile(
    join(packageRoot, ".codex-plugin", "plugin.json"),
    JSON.stringify({ name: pluginId, version: "1.0.0" }),
    "utf8",
  );
  await writeFile(
    join(packageRoot, "tech-cc-hub.json"),
    JSON.stringify({
      schemaVersion: 1,
      contributes: {
        surfaces: [{ id: "workspace", placement, entry: "./ui/index.html" }],
      },
    }),
    "utf8",
  );
  await writeFile(entryPath, "<!doctype html><title>Plugin</title>", "utf8");
  return { packageRoot, entryPath };
}

function manifest(pluginId: string): CanonicalPluginManifest {
  return {
    id: pluginId,
    version: "1.0.0",
    displayName: pluginId,
    runtimeClass: "declarative",
    interfaceCapabilities: [],
    contributions: { surfaces: [], commands: [], hooks: [] },
    capabilities: { required: [], optional: [] },
  };
}

type RequestCallback = (response: { cancel: boolean }) => void;
type RequestListener = (details: { url: string }, callback: RequestCallback) => void;

class FakeWebRequest {
  listener: RequestListener | null = null;

  onBeforeRequest(
    filterOrListener: { urls: string[] } | RequestListener | null,
    listener?: RequestListener | null,
  ): void {
    this.listener = typeof filterOrListener === "function"
      ? filterOrListener
      : listener ?? null;
  }
}

class FakeWebContents {
  readonly session = { webRequest: new FakeWebRequest() };
  readonly events = new Map<string, (...args: unknown[]) => void>();
  loadedUrls: string[] = [];
  failLoad = false;

  setWindowOpenHandler(): void {}
  on(event: string, handler: (...args: unknown[]) => void): void {
    this.events.set(event, handler);
  }
  removeListener(event: string, handler: (...args: unknown[]) => void): void {
    if (this.events.get(event) === handler) this.events.delete(event);
  }
  async loadURL(url: string): Promise<void> {
    assert.ok(this.session.webRequest.listener, "guard must be installed before loadURL");
    this.loadedUrls.push(url);
    if (this.failLoad) throw new Error("load failed");
  }
}

class FakeView {
  readonly webContents: WebContents;
  readonly bounds: Rectangle[] = [];

  constructor(readonly fakeWebContents: FakeWebContents) {
    this.webContents = fakeWebContents as unknown as WebContents;
  }

  setBounds(bounds: Rectangle): void {
    this.bounds.push(bounds);
  }
}

function createHarness(pluginsPath: string, grants: PluginCapabilityGrantRegistry) {
  const created: Array<{ preferences: WebPreferences; view: FakeView }> = [];
  const attached: FakeView[] = [];
  const detached: FakeView[] = [];
  const destroyed: FakeView[] = [];
  let failNextLoad = false;
  const host = new PluginSurfaceViewHost({
    pluginsPath,
    grants,
    createInstanceId: () => `instance-${created.length + 1}`,
    createView: (preferences) => {
      const webContents = new FakeWebContents();
      webContents.failLoad = failNextLoad;
      failNextLoad = false;
      const view = new FakeView(webContents);
      created.push({ preferences, view });
      return view;
    },
    attachView: (view) => attached.push(view as FakeView),
    detachView: (view) => detached.push(view as FakeView),
    destroyView: (view) => destroyed.push(view as FakeView),
  });

  return {
    host,
    created,
    attached,
    detached,
    destroyed,
    failNextLoad: () => { failNextLoad = true; },
  };
}

test("refuses to create a view for an inactive plugin", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-view-"));
  await writeSurfacePlugin(pluginsRoot, "inactive-plugin");
  const harness = createHarness(pluginsRoot, new PluginCapabilityGrantRegistry());

  try {
    assert.deepEqual(await harness.host.open({
      pluginId: "inactive-plugin",
      surfaceId: "workspace",
      bounds: { x: 0, y: 0, width: 400, height: 500 },
    }), {
      ok: false,
      code: "PLUGIN_NOT_ACTIVE",
      pluginId: "inactive-plugin",
      surfaceId: "workspace",
    });
    assert.equal(harness.created.length, 0);
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

test("resolves, guards, loads, and attaches an active declared surface", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-view-"));
  const { entryPath } = await writeSurfacePlugin(pluginsRoot, "surface-plugin", "composer");
  const grants = new PluginCapabilityGrantRegistry();
  grants.activate({ manifest: manifest("surface-plugin"), profile: "standard" });
  const harness = createHarness(pluginsRoot, grants);
  const bounds = { x: 12, y: 24, width: 420, height: 360 };

  try {
    assert.deepEqual(await harness.host.open({
      pluginId: "surface-plugin",
      surfaceId: "workspace",
      bounds,
    }), {
      ok: true,
      pluginId: "surface-plugin",
      surfaceId: "workspace",
      placement: "composer",
    });
    assert.equal(harness.created.length, 1);
    assert.equal(harness.created[0]?.preferences.partition, "plugin-surface:surface-plugin:workspace:instance-1");
    assert.equal(harness.created[0]?.preferences.sandbox, true);
    assert.deepEqual(harness.created[0]?.view.bounds, [bounds]);
    assert.deepEqual(harness.created[0]?.view.fakeWebContents.loadedUrls, [
      pathToFileURL(await realpath(entryPath)).toString(),
    ]);
    assert.equal(harness.attached.length, 1);
    assert.equal(harness.host.isOpen("surface-plugin", "workspace"), true);
    harness.host.closeAll();
    assert.equal(harness.detached.length, 1);
    assert.equal(harness.destroyed.length, 1);
    assert.equal(harness.created[0]?.view.fakeWebContents.session.webRequest.listener, null);
    assert.equal(harness.host.isOpen("surface-plugin", "workspace"), false);
  } finally {
    harness.host.closeAll();
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

test("cleans up a guarded view when loading fails", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-view-"));
  await writeSurfacePlugin(pluginsRoot, "broken-surface");
  const grants = new PluginCapabilityGrantRegistry();
  grants.activate({ manifest: manifest("broken-surface"), profile: "standard" });
  const harness = createHarness(pluginsRoot, grants);
  harness.failNextLoad();

  try {
    assert.deepEqual(await harness.host.open({
      pluginId: "broken-surface",
      surfaceId: "workspace",
      bounds: { x: 0, y: 0, width: 400, height: 500 },
    }), {
      ok: false,
      code: "SURFACE_LOAD_FAILED",
      pluginId: "broken-surface",
      surfaceId: "workspace",
    });
    assert.equal(harness.attached.length, 0);
    assert.equal(harness.destroyed.length, 1);
    assert.equal(harness.created[0]?.view.fakeWebContents.session.webRequest.listener, null);
    assert.equal(harness.host.isOpen("broken-surface", "workspace"), false);
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

test("showing a deactivated surface destroys its retained view", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-view-"));
  await writeSurfacePlugin(pluginsRoot, "temporary-surface");
  const grants = new PluginCapabilityGrantRegistry();
  grants.activate({ manifest: manifest("temporary-surface"), profile: "standard" });
  const harness = createHarness(pluginsRoot, grants);

  try {
    assert.equal((await harness.host.open({
      pluginId: "temporary-surface",
      surfaceId: "workspace",
      bounds: { x: 0, y: 0, width: 400, height: 500 },
    })).ok, true);
    assert.equal(harness.host.hide("temporary-surface", "workspace"), true);
    assert.equal(harness.detached.length, 1);

    grants.deactivate("temporary-surface");
    assert.equal(harness.host.show("temporary-surface", "workspace"), false);
    assert.equal(harness.destroyed.length, 1);
    assert.equal(harness.host.isOpen("temporary-surface", "workspace"), false);
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

function typecheckRealView(view: BrowserView): PluginSurfaceViewLike {
  return view;
}

void typecheckRealView;
