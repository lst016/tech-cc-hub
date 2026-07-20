import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PluginCapabilityGrantRegistry } from "../../src/electron/libs/plugin-platform/plugin-capability-grant-registry.js";
import {
  PluginConsentCoordinator,
  type PluginConsentConfirmationRequest,
} from "../../src/electron/libs/plugin-platform/plugin-consent-coordinator.js";
import { PluginConsentStore } from "../../src/electron/libs/plugin-platform/plugin-consent-store.js";
import type { PluginCapability } from "../../src/shared/plugin-platform/types.js";

async function writePlugin(
  pluginsRoot: string,
  options: {
    pluginId: string;
    version?: string;
    required?: PluginCapability[];
    optional?: PluginCapability[];
  },
): Promise<void> {
  const packageRoot = join(pluginsRoot, "installed-package");
  await mkdir(join(packageRoot, ".codex-plugin"), { recursive: true });
  await writeFile(
    join(packageRoot, ".codex-plugin", "plugin.json"),
    JSON.stringify({
      name: options.pluginId,
      version: options.version ?? "1.0.0",
      interface: { displayName: "Power Plugin" },
    }),
    "utf8",
  );
  await writeFile(
    join(packageRoot, "tech-cc-hub.json"),
    JSON.stringify({
      schemaVersion: 1,
      capabilities: {
        required: options.required ?? [],
        optional: options.optional ?? [],
      },
    }),
    "utf8",
  );
}

function createHarness(
  pluginsPath: string,
  confirmConsent: (request: PluginConsentConfirmationRequest) => Promise<boolean>,
) {
  const grants = new PluginCapabilityGrantRegistry();
  const store = new PluginConsentStore({ filePath: join(pluginsPath, "..", "plugin-consents.json") });
  const coordinator = new PluginConsentCoordinator({
    pluginsPath,
    grants,
    store,
    confirmConsent,
    now: () => 1_700_000_000_000,
  });
  return { coordinator, grants, store };
}

test("does not persist or activate a renderer-requested grant without main-process confirmation", async () => {
  const root = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-coordinator-"));
  const pluginsRoot = join(root, "plugins");
  await mkdir(pluginsRoot, { recursive: true });
  await writePlugin(pluginsRoot, { pluginId: "power-plugin", optional: ["models.invoke"] });
  const harness = createHarness(pluginsRoot, async () => false);

  try {
    assert.deepEqual(await harness.coordinator.requestActivation({
      pluginId: "power-plugin",
      profile: "full-trust",
    }), { ok: false, code: "CONSENT_DENIED", pluginId: "power-plugin" });
    assert.equal(await harness.store.get("power-plugin"), null);
    assert.equal(harness.grants.isActive("power-plugin"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("confirms the effective powers before persisting and activating", async () => {
  const root = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-coordinator-"));
  const pluginsRoot = join(root, "plugins");
  await mkdir(pluginsRoot, { recursive: true });
  await writePlugin(pluginsRoot, {
    pluginId: "power-plugin",
    optional: ["models.invoke", "tools.call:*"],
  });
  const confirmations: PluginConsentConfirmationRequest[] = [];
  const harness = createHarness(pluginsRoot, async (request) => {
    confirmations.push(request);
    return true;
  });

  try {
    assert.equal((await harness.coordinator.requestActivation({
      pluginId: "power-plugin",
      profile: "custom",
      customGrants: ["models.invoke", "tools.call:image_generate"],
    })).ok, true);
    assert.deepEqual(confirmations, [{
      pluginId: "power-plugin",
      displayName: "Power Plugin",
      pluginVersion: "1.0.0",
      profile: "custom",
      effectiveCapabilities: ["models.invoke", "tools.call:image_generate"],
    }]);
    assert.equal(harness.grants.authorize("power-plugin", "models.invoke").ok, true);
    assert.equal(harness.grants.authorize("power-plugin", "tools.call:image_generate").ok, true);
    assert.ok(await harness.store.get("power-plugin"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restores only consent that still validates against the installed package", async () => {
  const root = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-coordinator-"));
  const pluginsRoot = join(root, "plugins");
  await mkdir(pluginsRoot, { recursive: true });
  await writePlugin(pluginsRoot, { pluginId: "power-plugin", optional: ["models.invoke"] });
  const harness = createHarness(pluginsRoot, async () => true);

  try {
    assert.equal((await harness.coordinator.requestActivation({
      pluginId: "power-plugin",
      profile: "full-trust",
    })).ok, true);
    harness.grants.deactivate("power-plugin");
    assert.equal((await harness.coordinator.restore("power-plugin")).ok, true);

    harness.grants.deactivate("power-plugin");
    await writePlugin(pluginsRoot, {
      pluginId: "power-plugin",
      version: "2.0.0",
      optional: ["models.invoke"],
    });
    assert.deepEqual(await harness.coordinator.restore("power-plugin"), {
      ok: false,
      code: "PLUGIN_VERSION_CHANGED",
      pluginId: "power-plugin",
    });
    assert.equal(await harness.store.get("power-plugin"), null);
    assert.equal(harness.grants.isActive("power-plugin"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("aborts if package authority changes while confirmation is open", async () => {
  const root = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-coordinator-"));
  const pluginsRoot = join(root, "plugins");
  await mkdir(pluginsRoot, { recursive: true });
  await writePlugin(pluginsRoot, { pluginId: "power-plugin", optional: ["models.invoke"] });
  const harness = createHarness(pluginsRoot, async () => {
    await writePlugin(pluginsRoot, {
      pluginId: "power-plugin",
      optional: ["models.invoke", "desktop.control"],
    });
    return true;
  });

  try {
    assert.deepEqual(await harness.coordinator.requestActivation({
      pluginId: "power-plugin",
      profile: "full-trust",
    }), {
      ok: false,
      code: "PACKAGE_CHANGED_DURING_ACTIVATION",
      pluginId: "power-plugin",
    });
    assert.equal(await harness.store.get("power-plugin"), null);
    assert.equal(harness.grants.isActive("power-plugin"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
