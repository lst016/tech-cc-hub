import assert from "node:assert/strict";
import test from "node:test";

import {
  createPluginConsentRecord,
  fingerprintPluginCapabilities,
  validatePluginConsentRecord,
} from "../../src/electron/libs/plugin-platform/plugin-consent.js";
import type {
  CanonicalPluginManifest,
  PluginCapability,
} from "../../src/shared/plugin-platform/types.js";

function manifest(
  version: string,
  required: PluginCapability[],
  optional: PluginCapability[],
): CanonicalPluginManifest {
  return {
    id: "consent-plugin",
    version,
    displayName: "Consent Plugin",
    runtimeClass: "declarative",
    interfaceCapabilities: [],
    contributions: { surfaces: [], commands: [], hooks: [] },
    capabilities: { required, optional },
  };
}

test("capability fingerprints are stable across ordering and equivalent bundle expansion", () => {
  const bundled = manifest("1.0.0", ["session.main.control"], [
    "models.list",
    "network.connect:https://api.example.com",
  ]);
  const expanded = manifest("1.0.0", [
    "session.main.run.cancel",
    "session.main.message.create",
    "session.main.model.set",
    "session.main.run.start",
  ], [
    "network.connect:https://api.example.com",
    "models.list",
  ]);

  assert.equal(fingerprintPluginCapabilities(bundled), fingerprintPluginCapabilities(expanded));
  assert.notEqual(
    fingerprintPluginCapabilities(bundled),
    fingerprintPluginCapabilities(manifest("1.0.0", [], [
      "session.main.control",
      "models.list",
      "network.connect:https://api.example.com",
    ])),
  );
});

test("creates and validates a version-bound Custom consent record", () => {
  const pluginManifest = manifest("1.0.0", [], [
    "models.invoke",
    "tools.call:*",
    "network.connect:*",
  ]);
  const created = createPluginConsentRecord({
    manifest: pluginManifest,
    profile: "custom",
    customGrants: [
      "models.invoke",
      "tools.call:image_generate",
      "network.connect:https://api.example.com",
    ],
    grantedAt: 1_700_000_000_000,
  });

  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.deepEqual(created.record, {
    schemaVersion: 1,
    pluginId: "consent-plugin",
    pluginVersion: "1.0.0",
    capabilityFingerprint: fingerprintPluginCapabilities(pluginManifest),
    profile: "custom",
    customGrants: [
      "models.invoke",
      "tools.call:image_generate",
      "network.connect:https://api.example.com",
    ],
    grantedAt: 1_700_000_000_000,
  });
  assert.deepEqual(validatePluginConsentRecord({
    manifest: pluginManifest,
    record: created.record,
  }), {
    ok: true,
    activation: {
      profile: "custom",
      customGrants: created.record.customGrants,
    },
  });
});

test("invalidates consent after plugin version or capability declaration changes", () => {
  const original = manifest("1.0.0", [], ["models.invoke"]);
  const created = createPluginConsentRecord({
    manifest: original,
    profile: "full-trust",
    grantedAt: 100,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  assert.deepEqual(validatePluginConsentRecord({
    manifest: manifest("2.0.0", [], ["models.invoke"]),
    record: created.record,
  }), { ok: false, code: "PLUGIN_VERSION_CHANGED" });
  assert.deepEqual(validatePluginConsentRecord({
    manifest: manifest("1.0.0", [], ["models.invoke", "desktop.control"]),
    record: created.record,
  }), { ok: false, code: "CAPABILITIES_CHANGED" });
});

test("rejects malformed or widened Custom consent instead of silently intersecting it", () => {
  const pluginManifest = manifest("1.0.0", [], ["tools.call:*"]);
  const created = createPluginConsentRecord({
    manifest: pluginManifest,
    profile: "custom",
    customGrants: ["tools.call:image_generate"],
    grantedAt: 100,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  assert.deepEqual(validatePluginConsentRecord({
    manifest: pluginManifest,
    record: {
      ...created.record,
      customGrants: ["tools.call:image_generate", "desktop.control"],
    },
  }), { ok: false, code: "CONSENT_INVALID" });
  assert.deepEqual(validatePluginConsentRecord({
    manifest: pluginManifest,
    record: { schemaVersion: 99 },
  }), { ok: false, code: "CONSENT_INVALID" });
});

test("does not create consent when the chosen profile misses required powers", () => {
  assert.deepEqual(createPluginConsentRecord({
    manifest: manifest("1.0.0", ["models.invoke"], ["models.list"]),
    profile: "standard",
    grantedAt: 100,
  }), {
    ok: false,
    code: "MISSING_REQUIRED_CAPABILITIES",
    missingRequiredCapabilities: ["models.invoke"],
  });
});
