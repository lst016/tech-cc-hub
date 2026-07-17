import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { PluginCapabilityGrantRegistry } from "../../src/electron/libs/plugin-platform/plugin-capability-grant-registry.js";
import { authorizePluginSurfaceRequest } from "../../src/electron/libs/plugin-platform/plugin-surface-request-policy.js";
import type {
  CanonicalPluginManifest,
  PluginCapability,
  PluginGrantProfile,
} from "../../src/shared/plugin-platform/types.js";

function manifest(pluginId: string, optional: PluginCapability[]): CanonicalPluginManifest {
  return {
    id: pluginId,
    version: "1.0.0",
    displayName: pluginId,
    runtimeClass: "declarative",
    interfaceCapabilities: [],
    contributions: { surfaces: [], commands: [], hooks: [] },
    capabilities: { required: [], optional },
  };
}

function activate(
  registry: PluginCapabilityGrantRegistry,
  pluginId: string,
  capabilities: PluginCapability[],
  profile: PluginGrantProfile,
): void {
  const result = registry.activate({ manifest: manifest(pluginId, capabilities), profile });
  assert.equal(result.ok, true);
}

test("allows only real local files that remain inside the plugin package", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-request-"));
  const packageRoot = join(tempRoot, "package");
  const entryPath = join(packageRoot, "ui", "index.html");
  const outsidePath = join(tempRoot, "outside.html");
  await mkdir(join(packageRoot, "ui"), { recursive: true });
  await writeFile(entryPath, "<h1>inside</h1>", "utf8");
  await writeFile(outsidePath, "<h1>outside</h1>", "utf8");
  const resolvedRoot = await realpath(packageRoot);
  const registry = new PluginCapabilityGrantRegistry();
  activate(registry, "surface-plugin", [], "standard");

  try {
    assert.deepEqual(await authorizePluginSurfaceRequest({
      registry,
      pluginId: "surface-plugin",
      packageRoot: resolvedRoot,
      requestUrl: pathToFileURL(entryPath).toString(),
    }), {
      ok: true,
      access: "package-file",
      requestUrl: pathToFileURL(await realpath(entryPath)).toString(),
    });
    assert.deepEqual(await authorizePluginSurfaceRequest({
      registry,
      pluginId: "surface-plugin",
      packageRoot: resolvedRoot,
      requestUrl: pathToFileURL(outsidePath).toString(),
    }), {
      ok: false,
      code: "PACKAGE_PATH_ESCAPE",
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("maps HTTP requests to exact normalized origins", async () => {
  const registry = new PluginCapabilityGrantRegistry();
  activate(registry, "network-plugin", ["network.connect:https://api.example.com"], "full-trust");

  assert.deepEqual(await authorizePluginSurfaceRequest({
    registry,
    pluginId: "network-plugin",
    packageRoot: process.cwd(),
    requestUrl: "https://api.example.com/v1/items?limit=10",
  }), {
    ok: true,
    access: "network",
    requestUrl: "https://api.example.com/v1/items?limit=10",
    origin: "https://api.example.com",
    grantedBy: "network.connect:https://api.example.com",
  });
  assert.deepEqual(await authorizePluginSurfaceRequest({
    registry,
    pluginId: "network-plugin",
    packageRoot: process.cwd(),
    requestUrl: "https://cdn.example.com/asset.js",
  }), {
    ok: false,
    code: "NETWORK_NOT_GRANTED",
    origin: "https://cdn.example.com",
  });
});

test("honors an explicit network wildcard but Standard remains offline", async () => {
  const registry = new PluginCapabilityGrantRegistry();
  activate(registry, "full-network", ["network.connect:*"], "full-trust");
  activate(registry, "standard-network", ["network.connect:*"], "standard");

  assert.equal((await authorizePluginSurfaceRequest({
    registry,
    pluginId: "full-network",
    packageRoot: process.cwd(),
    requestUrl: "https://anywhere.example/resource",
  })).ok, true);
  assert.deepEqual(await authorizePluginSurfaceRequest({
    registry,
    pluginId: "standard-network",
    packageRoot: process.cwd(),
    requestUrl: "https://anywhere.example/resource",
  }), {
    ok: false,
    code: "NETWORK_NOT_GRANTED",
    origin: "https://anywhere.example",
  });
});

test("allows inert embedded URLs and rejects executable non-web protocols", async () => {
  const registry = new PluginCapabilityGrantRegistry();
  activate(registry, "offline-plugin", [], "standard");

  for (const requestUrl of ["about:blank", "data:text/plain,hello", "blob:null/asset-id"]) {
    assert.deepEqual(await authorizePluginSurfaceRequest({
      registry,
      pluginId: "offline-plugin",
      packageRoot: process.cwd(),
      requestUrl,
    }), { ok: true, access: "embedded", requestUrl });
  }
  assert.deepEqual(await authorizePluginSurfaceRequest({
    registry,
    pluginId: "offline-plugin",
    packageRoot: process.cwd(),
    requestUrl: "javascript:alert(1)",
  }), {
    ok: false,
    code: "PROTOCOL_NOT_ALLOWED",
  });
});

test("does not serve even inert surface resources to an inactive plugin", async () => {
  const registry = new PluginCapabilityGrantRegistry();

  assert.deepEqual(await authorizePluginSurfaceRequest({
    registry,
    pluginId: "inactive-plugin",
    packageRoot: process.cwd(),
    requestUrl: "data:text/plain,hello",
  }), {
    ok: false,
    code: "PLUGIN_NOT_ACTIVE",
  });
});
