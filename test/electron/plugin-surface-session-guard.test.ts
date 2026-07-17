import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import type { WebContents, WebPreferences } from "electron";

import { PluginCapabilityGrantRegistry } from "../../src/electron/libs/plugin-platform/plugin-capability-grant-registry.js";
import {
  buildPluginSurfaceWebPreferences,
  installPluginSurfaceSessionGuard,
} from "../../src/electron/libs/plugin-platform/plugin-surface-session-guard.js";
import type { CanonicalPluginManifest } from "../../src/shared/plugin-platform/types.js";

function typecheckElectronWebContents(
  webContents: WebContents,
  registry: PluginCapabilityGrantRegistry,
): void {
  installPluginSurfaceSessionGuard({
    webContents,
    registry,
    pluginId: "typecheck-plugin",
    packageRoot: process.cwd(),
  });
  const preferences: WebPreferences = buildPluginSurfaceWebPreferences({
    pluginId: "typecheck-plugin",
    surfaceId: "workbench",
    instanceId: "instance-1",
  });
  void preferences;
}

void typecheckElectronWebContents;

function manifest(pluginId: string): CanonicalPluginManifest {
  return {
    id: pluginId,
    version: "1.0.0",
    displayName: pluginId,
    runtimeClass: "declarative",
    interfaceCapabilities: [],
    contributions: { surfaces: [], commands: [], hooks: [] },
    capabilities: { required: [], optional: ["network.connect:https://api.example.com"] },
  };
}

type RequestCallback = (response: { cancel: boolean }) => void;
type RequestListener = (details: { url: string }, callback: RequestCallback) => void;

class FakeWebRequest {
  filter: { urls: string[] } | null = null;
  listener: RequestListener | null = null;

  onBeforeRequest(filter: { urls: string[] } | null, listener?: RequestListener | null): void {
    this.filter = filter;
    this.listener = listener ?? null;
  }

  async request(url: string): Promise<{ cancel: boolean }> {
    const listener = this.listener;
    assert.ok(listener, "request guard is not installed");
    return await new Promise((resolve) => listener({ url }, resolve));
  }
}

class FakeWebContents {
  readonly session = { webRequest: new FakeWebRequest() };
  popupHandler: (() => { action: "deny" | "allow" }) | null = null;
  readonly eventHandlers = new Map<string, (...args: unknown[]) => void>();

  setWindowOpenHandler(handler: () => { action: "deny" | "allow" }): void {
    this.popupHandler = handler;
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    this.eventHandlers.set(event, handler);
  }

  removeListener(event: string, handler: (...args: unknown[]) => void): void {
    if (this.eventHandlers.get(event) === handler) this.eventHandlers.delete(event);
  }
}

test("builds an ephemeral surface partition with all Node escape hatches disabled", () => {
  assert.deepEqual(buildPluginSurfaceWebPreferences({
    pluginId: "surface-plugin",
    surfaceId: "workbench",
    instanceId: "instance:1",
  }), {
    partition: "plugin-surface:surface-plugin:workbench:instance%3A1",
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    spellcheck: false,
    navigateOnDragDrop: false,
    safeDialogs: true,
  });
});

test("installs fail-closed request, popup, and webview guards", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-guard-"));
  const packageRoot = join(tempRoot, "package");
  const entryPath = join(packageRoot, "ui", "index.html");
  await mkdir(join(packageRoot, "ui"), { recursive: true });
  await writeFile(entryPath, "<h1>inside</h1>", "utf8");
  const registry = new PluginCapabilityGrantRegistry();
  registry.activate({ manifest: manifest("surface-plugin"), profile: "full-trust" });
  const webContents = new FakeWebContents();

  try {
    const dispose = installPluginSurfaceSessionGuard({
      webContents: webContents as unknown as WebContents,
      registry,
      pluginId: "surface-plugin",
      packageRoot: await realpath(packageRoot),
    });

    assert.deepEqual(webContents.session.webRequest.filter, { urls: ["<all_urls>"] });
    assert.deepEqual(await webContents.session.webRequest.request(pathToFileURL(entryPath).toString()), {
      cancel: false,
    });
    assert.deepEqual(await webContents.session.webRequest.request("https://api.example.com/v1/items"), {
      cancel: false,
    });
    assert.deepEqual(await webContents.session.webRequest.request("https://denied.example/resource"), {
      cancel: true,
    });
    assert.deepEqual(webContents.popupHandler?.(), { action: "deny" });

    let webviewPrevented = false;
    webContents.eventHandlers.get("will-attach-webview")?.({
      preventDefault: () => { webviewPrevented = true; },
    });
    assert.equal(webviewPrevented, true);

    let navigationPrevented = false;
    webContents.eventHandlers.get("will-navigate")?.({
      preventDefault: () => { navigationPrevented = true; },
    });
    assert.equal(navigationPrevented, true);

    dispose();
    assert.equal(webContents.session.webRequest.listener, null);
    assert.equal(webContents.eventHandlers.has("will-attach-webview"), false);
    assert.equal(webContents.eventHandlers.has("will-navigate"), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("an already-open surface loses request access immediately after deactivation", async () => {
  const registry = new PluginCapabilityGrantRegistry();
  registry.activate({ manifest: manifest("temporary-surface"), profile: "full-trust" });
  const webContents = new FakeWebContents();
  installPluginSurfaceSessionGuard({
    webContents: webContents as unknown as WebContents,
    registry,
    pluginId: "temporary-surface",
    packageRoot: process.cwd(),
  });

  assert.deepEqual(await webContents.session.webRequest.request("data:text/plain,before"), {
    cancel: false,
  });
  registry.deactivate("temporary-surface");
  assert.deepEqual(await webContents.session.webRequest.request("data:text/plain,after"), {
    cancel: true,
  });
});
