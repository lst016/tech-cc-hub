import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PluginActivationService } from "../../src/electron/libs/plugin-platform/plugin-activation-service.js";
import { PluginCapabilityGrantRegistry } from "../../src/electron/libs/plugin-platform/plugin-capability-grant-registry.js";
import type { PluginCapability } from "../../src/shared/plugin-platform/types.js";

async function writePlugin(
  pluginsRoot: string,
  pluginId: string,
  capabilities: {
    required?: PluginCapability[];
    optional?: PluginCapability[];
  },
): Promise<string> {
  const packageRoot = join(pluginsRoot, "installed-package");
  await mkdir(join(packageRoot, ".codex-plugin"), { recursive: true });
  await writeFile(
    join(packageRoot, ".codex-plugin", "plugin.json"),
    JSON.stringify({ name: pluginId, version: "1.0.0" }),
    "utf8",
  );
  await writeFile(
    join(packageRoot, "tech-cc-hub.json"),
    JSON.stringify({
      schemaVersion: 1,
      capabilities: {
        required: capabilities.required ?? [],
        optional: capabilities.optional ?? [],
      },
    }),
    "utf8",
  );
  return packageRoot;
}

test("activates only capabilities declared by the installed canonical manifest", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-activation-"));
  const grants = new PluginCapabilityGrantRegistry();
  const service = new PluginActivationService({ pluginsPath: pluginsRoot, grants });
  await writePlugin(pluginsRoot, "trusted-plugin", { optional: ["models.list"] });

  try {
    assert.deepEqual(await service.activate({
      pluginId: "trusted-plugin",
      profile: "full-trust",
    }), {
      ok: true,
      pluginId: "trusted-plugin",
      grant: {
        effectiveCapabilities: ["models.list"],
        missingRequiredCapabilities: [],
        canActivate: true,
      },
    });
    assert.equal(grants.authorize("trusted-plugin", "models.list").ok, true);
    assert.deepEqual(grants.authorize("trusted-plugin", "models.invoke"), {
      ok: false,
      code: "CAPABILITY_NOT_GRANTED",
      capability: "models.invoke",
    });
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

test("reloading a downgraded package replaces its previous authority", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-activation-"));
  const grants = new PluginCapabilityGrantRegistry();
  const service = new PluginActivationService({ pluginsPath: pluginsRoot, grants });
  await writePlugin(pluginsRoot, "changing-plugin", { optional: ["models.invoke"] });

  try {
    assert.equal((await service.activate({
      pluginId: "changing-plugin",
      profile: "full-trust",
    })).ok, true);
    assert.equal(grants.authorize("changing-plugin", "models.invoke").ok, true);

    await writePlugin(pluginsRoot, "changing-plugin", { optional: ["models.list"] });
    assert.equal((await service.activate({
      pluginId: "changing-plugin",
      profile: "full-trust",
    })).ok, true);

    assert.deepEqual(grants.authorize("changing-plugin", "models.invoke"), {
      ok: false,
      code: "CAPABILITY_NOT_GRANTED",
      capability: "models.invoke",
    });
    assert.equal(grants.authorize("changing-plugin", "models.list").ok, true);
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

test("a missing installed package revokes stale authority", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-activation-"));
  const grants = new PluginCapabilityGrantRegistry();
  const service = new PluginActivationService({ pluginsPath: pluginsRoot, grants });
  const packageRoot = await writePlugin(pluginsRoot, "removed-plugin", {
    optional: ["tools.call:*"],
  });

  try {
    assert.equal((await service.activate({
      pluginId: "removed-plugin",
      profile: "full-trust",
    })).ok, true);
    assert.equal(grants.authorize("removed-plugin", "tools.call:image_generate").ok, true);

    await rm(packageRoot, { recursive: true, force: true });
    assert.deepEqual(await service.activate({
      pluginId: "removed-plugin",
      profile: "full-trust",
    }), {
      ok: false,
      code: "PLUGIN_NOT_INSTALLED",
      pluginId: "removed-plugin",
    });
    assert.deepEqual(grants.authorize("removed-plugin", "tools.call:image_generate"), {
      ok: false,
      code: "PLUGIN_NOT_ACTIVE",
      capability: "tools.call:image_generate",
    });
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});

test("explicit deactivation closes the trusted activation lifecycle", async () => {
  const pluginsRoot = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-activation-"));
  const grants = new PluginCapabilityGrantRegistry();
  const service = new PluginActivationService({ pluginsPath: pluginsRoot, grants });
  await writePlugin(pluginsRoot, "temporary-plugin", { optional: ["models.list"] });

  try {
    assert.equal((await service.activate({
      pluginId: "temporary-plugin",
      profile: "standard",
    })).ok, true);
    assert.equal(service.deactivate("temporary-plugin"), true);
    assert.equal(service.deactivate("temporary-plugin"), false);
    assert.equal(grants.authorize("temporary-plugin", "models.list").ok, false);
  } finally {
    await rm(pluginsRoot, { recursive: true, force: true });
  }
});
