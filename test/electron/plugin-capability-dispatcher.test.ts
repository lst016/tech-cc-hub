import assert from "node:assert/strict";
import test from "node:test";

import { PluginCapabilityGrantRegistry } from "../../src/electron/libs/plugin-platform/plugin-capability-grant-registry.js";
import { dispatchPluginCapabilityOperation } from "../../src/electron/libs/plugin-platform/plugin-capability-dispatcher.js";
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

test("does not execute a model adapter for an inactive plugin", async () => {
  const registry = new PluginCapabilityGrantRegistry();
  let calls = 0;

  const result = await dispatchPluginCapabilityOperation({
    registry,
    pluginId: "inactive",
    operation: { kind: "models.list" },
    dispatch: () => {
      calls += 1;
      return ["model-a"];
    },
  });

  assert.equal(calls, 0);
  assert.deepEqual(result, {
    ok: false,
    code: "PLUGIN_NOT_ACTIVE",
    capability: "models.list",
  });
});

test("keeps Standard model and tool enumeration separate from invocation", async () => {
  const registry = new PluginCapabilityGrantRegistry();
  registry.activate({
    manifest: manifest("standard", [], ["models.list", "models.invoke", "tools.list", "tools.call:*"]),
    profile: "standard",
  });
  let calls = 0;

  assert.deepEqual(await dispatchPluginCapabilityOperation({
    registry,
    pluginId: "standard",
    operation: { kind: "models.list" },
    dispatch: () => {
      calls += 1;
      return ["model-a"];
    },
  }), { ok: true, value: ["model-a"] });

  assert.deepEqual(await dispatchPluginCapabilityOperation({
    registry,
    pluginId: "standard",
    operation: { kind: "tools.list" },
    dispatch: () => {
      calls += 1;
      return ["image_generate"];
    },
  }), { ok: true, value: ["image_generate"] });

  assert.deepEqual(await dispatchPluginCapabilityOperation({
    registry,
    pluginId: "standard",
    operation: { kind: "models.invoke" },
    dispatch: () => {
      calls += 1;
      return "should-not-run";
    },
  }), {
    ok: false,
    code: "CAPABILITY_NOT_GRANTED",
    capability: "models.invoke",
  });
  assert.equal(calls, 2);
});

test("maps model selection to its own grant", async () => {
  const registry = new PluginCapabilityGrantRegistry();
  registry.activate({
    manifest: manifest("selector", [], ["models.select"]),
    profile: "custom",
    customGrants: ["models.select"],
  });

  assert.deepEqual(await dispatchPluginCapabilityOperation({
    registry,
    pluginId: "selector",
    operation: { kind: "models.select" },
    dispatch: () => "model-b",
  }), { ok: true, value: "model-b" });
  assert.deepEqual(await dispatchPluginCapabilityOperation({
    registry,
    pluginId: "selector",
    operation: { kind: "models.list" },
    dispatch: () => ["should-not-run"],
  }), {
    ok: false,
    code: "CAPABILITY_NOT_GRANTED",
    capability: "models.list",
  });
});

test("normalizes a named tool target before full-trust dispatch", async () => {
  const registry = new PluginCapabilityGrantRegistry();
  registry.activate({
    manifest: manifest("all-tools", [], ["tools.call:*"]),
    profile: "full-trust",
  });

  const result = await dispatchPluginCapabilityOperation({
    registry,
    pluginId: "all-tools",
    operation: { kind: "tools.call", toolName: "  image_generate  " },
    dispatch: (operation) => operation,
  });

  assert.deepEqual(result, {
    ok: true,
    value: { kind: "tools.call", toolName: "image_generate" },
  });
});

test("rejects wildcard or empty tool targets before adapter execution", async () => {
  const registry = new PluginCapabilityGrantRegistry();
  registry.activate({
    manifest: manifest("all-tools", [], ["tools.call:*"]),
    profile: "full-trust",
  });
  let calls = 0;

  for (const toolName of ["", "   ", "*"]) {
    const result = await dispatchPluginCapabilityOperation({
      registry,
      pluginId: "all-tools",
      operation: { kind: "tools.call", toolName },
      dispatch: () => {
        calls += 1;
      },
    });
    assert.deepEqual(result, { ok: false, code: "INVALID_TOOL_NAME" });
  }
  assert.equal(calls, 0);
});

test("custom named-tool grants cannot dispatch a different tool", async () => {
  const registry = new PluginCapabilityGrantRegistry();
  registry.activate({
    manifest: manifest("one-tool", [], ["tools.call:*"]),
    profile: "custom",
    customGrants: ["tools.call:image_generate"],
  });
  let calls = 0;

  const result = await dispatchPluginCapabilityOperation({
    registry,
    pluginId: "one-tool",
    operation: { kind: "tools.call", toolName: "design_inspect_image" },
    dispatch: () => {
      calls += 1;
    },
  });

  assert.equal(calls, 0);
  assert.deepEqual(result, {
    ok: false,
    code: "CAPABILITY_NOT_GRANTED",
    capability: "tools.call:design_inspect_image",
  });
});

test("keeps main-session message creation separate from run control", async () => {
  const registry = new PluginCapabilityGrantRegistry();
  registry.activate({
    manifest: manifest("session-writer", [], [
      "session.main.message.create",
      "session.main.run.start",
      "session.main.run.cancel",
    ]),
    profile: "custom",
    customGrants: ["session.main.message.create"],
  });
  const dispatched: string[] = [];

  assert.deepEqual(await dispatchPluginCapabilityOperation({
    registry,
    pluginId: "session-writer",
    operation: { kind: "session.main.message.create" },
    dispatch: (operation) => {
      dispatched.push(operation.kind);
      return "created";
    },
  }), { ok: true, value: "created" });

  for (const kind of ["session.main.run.start", "session.main.run.cancel"] as const) {
    assert.deepEqual(await dispatchPluginCapabilityOperation({
      registry,
      pluginId: "session-writer",
      operation: { kind },
      dispatch: (operation) => {
        dispatched.push(operation.kind);
        return "should-not-run";
      },
    }), {
      ok: false,
      code: "CAPABILITY_NOT_GRANTED",
      capability: kind,
    });
  }
  assert.deepEqual(dispatched, ["session.main.message.create"]);
});

test("dispatches Standard session reads, child creation, and attachment delivery", async () => {
  const registry = new PluginCapabilityGrantRegistry();
  registry.activate({
    manifest: manifest("session-observer", [], [
      "session.context.read",
      "session.child.create",
      "session.child.read",
      "session.attachments.receive",
      "session.child.publish",
    ]),
    profile: "standard",
  });

  for (const kind of [
    "session.context.read",
    "session.child.create",
    "session.child.read",
    "session.attachments.receive",
  ] as const) {
    assert.deepEqual(await dispatchPluginCapabilityOperation({
      registry,
      pluginId: "session-observer",
      operation: { kind },
      dispatch: (operation) => operation.kind,
    }), { ok: true, value: kind });
  }

  assert.deepEqual(await dispatchPluginCapabilityOperation({
    registry,
    pluginId: "session-observer",
    operation: { kind: "session.child.publish" },
    dispatch: () => "should-not-run",
  }), {
    ok: false,
    code: "CAPABILITY_NOT_GRANTED",
    capability: "session.child.publish",
  });
});
