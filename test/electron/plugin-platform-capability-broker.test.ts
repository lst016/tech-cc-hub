import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizePluginCapability,
  resolvePluginCapabilityGrant,
} from "../../src/shared/plugin-platform/index.js";
import type { PluginAtomicCapability } from "../../src/shared/plugin-platform/types.js";

function activeGrant(effectiveCapabilities: PluginAtomicCapability[]) {
  return {
    effectiveCapabilities,
    missingRequiredCapabilities: [],
    canActivate: true,
  };
}

test("keeps model discovery, selection, and invocation as separate grants", () => {
  assert.deepEqual(authorizePluginCapability({
    grant: activeGrant(["models.list", "models.select"]),
    capability: "models.select",
  }), {
    ok: true,
    capability: "models.select",
    grantedBy: "models.select",
  });

  assert.deepEqual(authorizePluginCapability({
    grant: activeGrant(["models.list", "models.select"]),
    capability: "models.invoke",
  }), {
    ok: false,
    code: "CAPABILITY_NOT_GRANTED",
    capability: "models.invoke",
  });
});

test("does not let tool enumeration authorize tool calls", () => {
  assert.deepEqual(authorizePluginCapability({
    grant: activeGrant(["tools.list"]),
    capability: "tools.call:image_generate",
  }), {
    ok: false,
    code: "CAPABILITY_NOT_GRANTED",
    capability: "tools.call:image_generate",
  });
});

test("lets the declared tool wildcard authorize named tools only", () => {
  assert.deepEqual(authorizePluginCapability({
    grant: activeGrant(["tools.call:*"]),
    capability: "tools.call:image_generate",
  }), {
    ok: true,
    capability: "tools.call:image_generate",
    grantedBy: "tools.call:*",
  });

  assert.deepEqual(authorizePluginCapability({
    grant: activeGrant(["tools.call:*"]),
    capability: "models.invoke",
  }), {
    ok: false,
    code: "CAPABILITY_NOT_GRANTED",
    capability: "models.invoke",
  });
});

test("keeps named tool grants exact", () => {
  assert.equal(authorizePluginCapability({
    grant: activeGrant(["tools.call:image_generate"]),
    capability: "tools.call:image_generate",
  }).ok, true);
  assert.equal(authorizePluginCapability({
    grant: activeGrant(["tools.call:image_generate"]),
    capability: "tools.call:image_generate.preview",
  }).ok, false);
});

test("authorizes only capabilities that survived profile resolution", () => {
  const standard = resolvePluginCapabilityGrant({
    requested: {
      required: [],
      optional: ["models.list", "models.select", "models.invoke", "tools.list", "tools.call:*"],
    },
    profile: "standard",
  });

  assert.equal(authorizePluginCapability({
    grant: standard,
    capability: "models.list",
  }).ok, true);
  assert.equal(authorizePluginCapability({
    grant: standard,
    capability: "models.invoke",
  }).ok, false);
  assert.equal(authorizePluginCapability({
    grant: standard,
    capability: "tools.call:image_generate",
  }).ok, false);
});

test("fails closed when required capabilities prevent plugin activation", () => {
  const blocked = resolvePluginCapabilityGrant({
    requested: {
      required: ["models.invoke"],
      optional: ["models.list"],
    },
    profile: "standard",
  });

  assert.deepEqual(authorizePluginCapability({
    grant: blocked,
    capability: "models.list",
  }), {
    ok: false,
    code: "PLUGIN_NOT_ACTIVATABLE",
    capability: "models.list",
  });
});

test("keeps scoped wildcards inside their own capability namespace", () => {
  const grant = activeGrant(["network.connect:*", "workspace.read:*"]);

  assert.deepEqual(authorizePluginCapability({
    grant,
    capability: "network.connect:https://api.example.com",
  }), {
    ok: true,
    capability: "network.connect:https://api.example.com",
    grantedBy: "network.connect:*",
  });
  assert.equal(authorizePluginCapability({
    grant,
    capability: "workspace.read:docs/readme.md",
  }).ok, true);
  assert.equal(authorizePluginCapability({
    grant,
    capability: "secrets.use:api-token",
  }).ok, false);
  assert.equal(authorizePluginCapability({
    grant,
    capability: "tools.call:image_generate",
  }).ok, false);
});
