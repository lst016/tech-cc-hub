import assert from "node:assert/strict";
import test from "node:test";

import { PluginCapabilityGrantRegistry } from "../../src/electron/libs/plugin-platform/plugin-capability-grant-registry.js";
import type {
  CanonicalPluginManifest,
  PluginCapability,
} from "../../src/shared/plugin-platform/types.js";

function manifest(
  id: string,
  required: PluginCapability[] = [],
  optional: PluginCapability[] = [],
): CanonicalPluginManifest {
  return {
    id,
    version: "1.0.0",
    displayName: id,
    runtimeClass: "declarative",
    interfaceCapabilities: [],
    contributions: { surfaces: [], commands: [], hooks: [] },
    capabilities: { required, optional },
  };
}

test("activates a plugin with its resolved grant and rejects undeclared powers", () => {
  const registry = new PluginCapabilityGrantRegistry();
  const activated = registry.activate({
    manifest: manifest("power-plugin", ["models.invoke"], ["models.select", "tools.call:*"]),
    profile: "full-trust",
  });

  assert.equal(activated.ok, true);
  assert.equal(registry.authorize("power-plugin", "models.invoke").ok, true);
  assert.equal(registry.authorize("power-plugin", "tools.call:image_generate").ok, true);
  assert.deepEqual(registry.authorize("power-plugin", "desktop.control"), {
    ok: false,
    code: "CAPABILITY_NOT_GRANTED",
    capability: "desktop.control",
  });
});

test("failed downgrade clears the previous full-trust grant", () => {
  const registry = new PluginCapabilityGrantRegistry();
  const pluginManifest = manifest("downgrade-plugin", ["models.invoke"], ["models.list"]);

  assert.equal(registry.activate({ manifest: pluginManifest, profile: "full-trust" }).ok, true);
  assert.equal(registry.authorize("downgrade-plugin", "models.invoke").ok, true);

  assert.deepEqual(registry.activate({ manifest: pluginManifest, profile: "standard" }), {
    ok: false,
    code: "MISSING_REQUIRED_CAPABILITIES",
    grant: {
      effectiveCapabilities: ["models.list"],
      missingRequiredCapabilities: ["models.invoke"],
      canActivate: false,
    },
  });
  assert.deepEqual(registry.authorize("downgrade-plugin", "models.list"), {
    ok: false,
    code: "PLUGIN_NOT_ACTIVE",
    capability: "models.list",
  });
});

test("custom activation can narrow a declared tool wildcard to named tools", () => {
  const registry = new PluginCapabilityGrantRegistry();
  const activated = registry.activate({
    manifest: manifest("custom-tools", [], ["tools.call:*"]),
    profile: "custom",
    customGrants: ["tools.call:image_generate"],
  });

  assert.equal(activated.ok, true);
  assert.equal(registry.authorize("custom-tools", "tools.call:image_generate").ok, true);
  assert.equal(registry.authorize("custom-tools", "tools.call:design_inspect_image").ok, false);
});

test("deactivation revokes future calls", () => {
  const registry = new PluginCapabilityGrantRegistry();
  registry.activate({
    manifest: manifest("temporary", [], ["models.list"]),
    profile: "standard",
  });

  assert.equal(registry.authorize("temporary", "models.list").ok, true);
  assert.equal(registry.deactivate("temporary"), true);
  assert.equal(registry.deactivate("temporary"), false);
  assert.deepEqual(registry.authorize("temporary", "models.list"), {
    ok: false,
    code: "PLUGIN_NOT_ACTIVE",
    capability: "models.list",
  });
});

test("returned grant snapshots cannot mutate registered authority", () => {
  const registry = new PluginCapabilityGrantRegistry();
  const activated = registry.activate({
    manifest: manifest("immutable", [], ["models.list"]),
    profile: "standard",
  });
  assert.equal(activated.ok, true);
  activated.grant.effectiveCapabilities.push("desktop.control");

  assert.deepEqual(registry.authorize("immutable", "desktop.control"), {
    ok: false,
    code: "CAPABILITY_NOT_GRANTED",
    capability: "desktop.control",
  });
});
