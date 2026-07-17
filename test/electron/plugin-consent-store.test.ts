import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createPluginConsentRecord,
  type PluginConsentRecord,
} from "../../src/electron/libs/plugin-platform/plugin-consent.js";
import { PluginConsentStore } from "../../src/electron/libs/plugin-platform/plugin-consent-store.js";
import type { CanonicalPluginManifest } from "../../src/shared/plugin-platform/types.js";

function consent(pluginId: string, version = "1.0.0"): PluginConsentRecord {
  const manifest: CanonicalPluginManifest = {
    id: pluginId,
    version,
    displayName: pluginId,
    runtimeClass: "declarative",
    interfaceCapabilities: [],
    contributions: { surfaces: [], commands: [], hooks: [] },
    capabilities: { required: [], optional: ["models.list"] },
  };
  const created = createPluginConsentRecord({
    manifest,
    profile: "standard",
    grantedAt: version === "1.0.0" ? 100 : 200,
  });
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("consent fixture failed");
  return created.record;
}

test("treats a missing consent file as an empty valid store", async () => {
  const root = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-consents-"));
  const store = new PluginConsentStore({ filePath: join(root, "plugin-consents.json") });

  try {
    assert.deepEqual(await store.list(), { records: [], warnings: [] });
    assert.equal(await store.get("missing-plugin"), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("atomically stores records and replaces consent for the same plugin", async () => {
  const root = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-consents-"));
  const filePath = join(root, "plugin-consents.json");
  const store = new PluginConsentStore({ filePath });

  try {
    await store.set(consent("plugin-a"));
    await store.set(consent("plugin-a", "2.0.0"));
    assert.deepEqual(await store.list(), {
      records: [consent("plugin-a", "2.0.0")],
      warnings: [],
    });
    assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), {
      schemaVersion: 1,
      records: [consent("plugin-a", "2.0.0")],
    });
    assert.deepEqual((await readdir(root)).filter((name) => name.includes(".tmp-")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("serializes concurrent writes without dropping either plugin", async () => {
  const root = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-consents-"));
  const store = new PluginConsentStore({ filePath: join(root, "plugin-consents.json") });

  try {
    await Promise.all([
      store.set(consent("plugin-b")),
      store.set(consent("plugin-a")),
    ]);
    assert.deepEqual(await store.list(), {
      records: [consent("plugin-a"), consent("plugin-b")],
      warnings: [],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fails closed on malformed storage and recovers on an explicit new consent", async () => {
  const root = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-consents-"));
  const filePath = join(root, "plugin-consents.json");
  const store = new PluginConsentStore({ filePath });
  await writeFile(filePath, "{not-json", "utf8");

  try {
    assert.deepEqual(await store.list(), {
      records: [],
      warnings: ["CONSENT_STORE_INVALID"],
    });
    await store.set(consent("recovered-plugin"));
    assert.deepEqual(await store.list(), {
      records: [consent("recovered-plugin")],
      warnings: [],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("deletes persisted consent idempotently", async () => {
  const root = await mkdtemp(join(tmpdir(), "tech-cc-hub-plugin-consents-"));
  const store = new PluginConsentStore({ filePath: join(root, "plugin-consents.json") });
  await store.set(consent("temporary-plugin"));

  try {
    assert.equal(await store.delete("temporary-plugin"), true);
    assert.equal(await store.delete("temporary-plugin"), false);
    assert.equal(await store.get("temporary-plugin"), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
