import assert from "node:assert/strict";
import test from "node:test";

import { PluginCapabilityGrantRegistry } from "../../src/electron/libs/plugin-platform/plugin-capability-grant-registry.js";
import { PluginRuntimeService } from "../../src/electron/libs/plugin-platform/plugin-runtime-service.js";
import type {
  CanonicalPluginManifest,
  PluginCapability,
} from "../../src/shared/plugin-platform/types.js";

function manifest(
  id: string,
  optional: PluginCapability[],
): CanonicalPluginManifest {
  return {
    id,
    version: "1.0.0",
    displayName: id,
    runtimeClass: "declarative",
    interfaceCapabilities: [],
    contributions: { surfaces: [], commands: [], hooks: [] },
    capabilities: { required: [], optional },
  };
}

function createHarness() {
  const calls: Array<{ adapter: string; input: unknown }> = [];
  const registry = new PluginCapabilityGrantRegistry();
  const service = new PluginRuntimeService(registry, {
    listModels: (context) => {
      calls.push({ adapter: "listModels", input: context });
      return [{ id: "model-a" }];
    },
    selectModel: (context, selection) => {
      calls.push({ adapter: "selectModel", input: { context, selection } });
      return { selected: selection };
    },
    invokeModel: async (context, request) => {
      calls.push({ adapter: "invokeModel", input: { context, request } });
      return { text: "done" };
    },
    listTools: (context) => {
      calls.push({ adapter: "listTools", input: context });
      return [{ name: "image_generate" }];
    },
    callTool: (context, input) => {
      calls.push({ adapter: "callTool", input: { context, input } });
      return { imageUrl: "image.png" };
    },
  });

  return { calls, registry, service };
}

test("routes Standard enumeration through the runtime adapters", async () => {
  const { calls, registry, service } = createHarness();
  registry.activate({
    manifest: manifest("standard-plugin", ["models.list", "tools.list"]),
    profile: "standard",
  });

  assert.deepEqual(await service.listModels("standard-plugin"), {
    ok: true,
    value: [{ id: "model-a" }],
  });
  assert.deepEqual(await service.listTools("standard-plugin"), {
    ok: true,
    value: [{ name: "image_generate" }],
  });
  assert.deepEqual(calls, [
    { adapter: "listModels", input: { pluginId: "standard-plugin" } },
    { adapter: "listTools", input: { pluginId: "standard-plugin" } },
  ]);
});

test("passes model requests only after their distinct grants authorize", async () => {
  const { calls, registry, service } = createHarness();
  registry.activate({
    manifest: manifest("model-plugin", ["models.select", "models.invoke"]),
    profile: "full-trust",
  });
  const selection = { modelId: "model-b" };
  const request = { modelId: "model-b", messages: [{ role: "user", content: "hello" }] };

  assert.deepEqual(await service.selectModel("model-plugin", selection), {
    ok: true,
    value: { selected: selection },
  });
  assert.deepEqual(await service.invokeModel("model-plugin", request), {
    ok: true,
    value: { text: "done" },
  });
  assert.deepEqual(calls, [
    {
      adapter: "selectModel",
      input: { context: { pluginId: "model-plugin" }, selection },
    },
    {
      adapter: "invokeModel",
      input: { context: { pluginId: "model-plugin" }, request },
    },
  ]);
});

test("passes only the normalized authorized tool name to the adapter", async () => {
  const { calls, registry, service } = createHarness();
  registry.activate({
    manifest: manifest("tool-plugin", ["tools.call:*"]),
    profile: "full-trust",
  });
  const input = { prompt: "draw a lighthouse" };

  assert.deepEqual(await service.callTool("tool-plugin", "  image_generate  ", input), {
    ok: true,
    value: { imageUrl: "image.png" },
  });
  assert.deepEqual(calls, [
    {
      adapter: "callTool",
      input: {
        context: { pluginId: "tool-plugin", toolName: "image_generate" },
        input,
      },
    },
  ]);
});

test("never invokes adapters for denied, invalid, or deactivated operations", async () => {
  const { calls, registry, service } = createHarness();
  registry.activate({
    manifest: manifest("temporary-plugin", ["models.list", "tools.call:*"]),
    profile: "standard",
  });

  assert.deepEqual(await service.invokeModel("temporary-plugin", { prompt: "no" }), {
    ok: false,
    code: "CAPABILITY_NOT_GRANTED",
    capability: "models.invoke",
  });
  assert.deepEqual(await service.callTool("temporary-plugin", "*", {}), {
    ok: false,
    code: "INVALID_TOOL_NAME",
  });
  registry.deactivate("temporary-plugin");
  assert.deepEqual(await service.listModels("temporary-plugin"), {
    ok: false,
    code: "PLUGIN_NOT_ACTIVE",
    capability: "models.list",
  });
  assert.deepEqual(calls, []);
});
