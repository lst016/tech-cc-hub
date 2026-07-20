import assert from "node:assert/strict";
import test from "node:test";

import {
  expandPluginCapabilityBundles,
  resolvePluginCapabilityGrant,
} from "../../src/shared/plugin-platform/index.js";

test("expands main-session control into atomic grants while preserving first-seen order", () => {
  assert.deepEqual(expandPluginCapabilityBundles([
    "models.list",
    "session.main.control",
    "session.main.run.start",
    "models.list",
  ]), [
    "models.list",
    "session.main.message.create",
    "session.main.run.start",
    "session.main.run.cancel",
    "session.main.model.set",
  ]);
});

test("standard grants only low-risk active-session capabilities", () => {
  const result = resolvePluginCapabilityGrant({
    requested: {
      required: ["session.context.read"],
      optional: [
        "session.child.create",
        "session.child.read",
        "session.attachments.receive",
        "models.list",
        "tools.list",
        "models.invoke",
        "session.main.control",
        "tools.call:*",
      ],
    },
    profile: "standard",
  });

  assert.deepEqual(result.effectiveCapabilities, [
    "session.context.read",
    "session.child.create",
    "session.child.read",
    "session.attachments.receive",
    "models.list",
    "tools.list",
  ]);
});

test("full trust grants every declared capability and keeps the tool wildcard", () => {
  const result = resolvePluginCapabilityGrant({
    requested: {
      required: ["session.context.read"],
      optional: ["session.main.control", "models.invoke", "tools.call:*"],
    },
    profile: "full-trust",
  });

  assert.deepEqual(result.effectiveCapabilities, [
    "session.context.read",
    "session.main.message.create",
    "session.main.run.start",
    "session.main.run.cancel",
    "session.main.model.set",
    "models.invoke",
    "tools.call:*",
  ]);
  assert.equal(result.canActivate, true);
});

test("custom grants exclude capabilities the plugin did not declare", () => {
  const result = resolvePluginCapabilityGrant({
    requested: {
      required: ["session.context.read"],
      optional: ["models.invoke"],
    },
    profile: "custom",
    customGrants: ["session.context.read", "models.invoke", "desktop.control"],
  });

  assert.deepEqual(result.effectiveCapabilities, ["session.context.read", "models.invoke"]);
});

test("custom grants can narrow a declared tool wildcard to named tools", () => {
  const result = resolvePluginCapabilityGrant({
    requested: {
      required: [],
      optional: ["tools.call:*"],
    },
    profile: "custom",
    customGrants: ["tools.call:image_generate", "tools.call:design_inspect_image"],
  });

  assert.deepEqual(result.effectiveCapabilities, [
    "tools.call:image_generate",
    "tools.call:design_inspect_image",
  ]);
});

test("reports every missing atomic required capability and blocks activation", () => {
  const result = resolvePluginCapabilityGrant({
    requested: {
      required: ["models.invoke", "session.main.control"],
      optional: [],
    },
    profile: "standard",
  });

  assert.deepEqual(result.missingRequiredCapabilities, [
    "models.invoke",
    "session.main.message.create",
    "session.main.run.start",
    "session.main.run.cancel",
    "session.main.model.set",
  ]);
  assert.equal(result.canActivate, false);
});

test("custom grants can narrow any declared scoped wildcard", () => {
  const result = resolvePluginCapabilityGrant({
    requested: {
      required: [],
      optional: [
        "network.connect:*",
        "workspace.read:*",
        "secrets.use:declared-secret",
      ],
    },
    profile: "custom",
    customGrants: [
      "network.connect:https://api.example.com",
      "workspace.read:docs/**",
      "secrets.use:undeclared-secret",
    ],
  });

  assert.deepEqual(result.effectiveCapabilities, [
    "network.connect:https://api.example.com",
    "workspace.read:docs/**",
  ]);
});
