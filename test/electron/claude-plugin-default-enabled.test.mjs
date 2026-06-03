// test/electron/claude-plugin-default-enabled.test.mjs
// Phase 7 of the Claude Code 2.1.161 compatibility workflow.

import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const mod = await import(pathToFileURL("dist-electron/electron/libs/compat-plugin-default-enabled.js").href);

test("parsePluginManifest: missing defaultEnabled defaults to true", () => {
  const out = mod.parsePluginManifest({ name: "demo" });
  assert.ok(out);
  assert.equal(out.defaultEnabled, true);
  assert.deepEqual(out.dependencies, []);
});

test("parsePluginManifest: defaultEnabled: false is honored", () => {
  const out = mod.parsePluginManifest({ name: "demo", defaultEnabled: false });
  assert.equal(out.defaultEnabled, false);
});

test("parsePluginManifest: rejects manifest without a name", () => {
  assert.equal(mod.parsePluginManifest({ defaultEnabled: true }), null);
  assert.equal(mod.parsePluginManifest(null), null);
  assert.equal(mod.parsePluginManifest("not-an-object"), null);
});

test("parsePluginManifest: filters non-string entries from mcpServers / toolNames / dependencies", () => {
  const out = mod.parsePluginManifest({
    name: "p", mcpServers: ["ok", 42, "", "good"], toolNames: ["t1", null, "t2"], dependencies: [1, "d1"],
  });
  assert.deepEqual(out.mcpServers, ["ok", "good"]);
  assert.deepEqual(out.toolNames, ["t1", "t2"]);
  assert.deepEqual(out.dependencies, ["d1"]);
});

test("resolvePluginEnableState: defaultEnabled = true => enabled regardless of enabled set", () => {
  const p = { name: "p", defaultEnabled: true, mcpServers: [], toolNames: [], dependencies: [] };
  assert.equal(mod.resolvePluginEnableState(p, new Set()), "enabled");
});

test("resolvePluginEnableState: defaultEnabled = false, no dep enabled => default-disabled", () => {
  const p = { name: "p", defaultEnabled: false, mcpServers: [], toolNames: [], dependencies: ["q"] };
  assert.equal(mod.resolvePluginEnableState(p, new Set(["q"])), "auto-from-dep");
  assert.equal(mod.resolvePluginEnableState(p, new Set()), "default-disabled");
});

test("findPluginDuplicates: detects duplicate MCP server names", () => {
  const plugins = [
    { name: "a", defaultEnabled: true, mcpServers: ["shared"], toolNames: [], dependencies: [] },
    { name: "b", defaultEnabled: true, mcpServers: ["shared"], toolNames: [], dependencies: [] },
  ];
  const out = mod.findPluginDuplicates(plugins);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "mcp-server");
  assert.equal(out[0].name, "shared");
  assert.deepEqual(out[0].plugins, ["a", "b"]);
});

test("findPluginDuplicates: detects duplicate tool names", () => {
  const plugins = [
    { name: "a", defaultEnabled: true, mcpServers: [], toolNames: ["x"], dependencies: [] },
    { name: "b", defaultEnabled: true, mcpServers: [], toolNames: ["x", "y"], dependencies: [] },
  ];
  const out = mod.findPluginDuplicates(plugins);
  const tools = out.filter((d) => d.kind === "tool");
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "x");
});

test("findPluginDuplicates: no duplicates returns empty", () => {
  const plugins = [
    { name: "a", defaultEnabled: true, mcpServers: ["s1"], toolNames: ["t1"], dependencies: [] },
    { name: "b", defaultEnabled: true, mcpServers: ["s2"], toolNames: ["t2"], dependencies: [] },
  ];
  assert.equal(mod.findPluginDuplicates(plugins).length, 0);
});

test("recommendAutoEnableDependencies: known deps go to enable, unknown to needsInstall", () => {
  const plugin = { name: "p", defaultEnabled: true, mcpServers: [], toolNames: [], dependencies: ["a", "b", "missing"] };
  const all = [
    { name: "p", defaultEnabled: true, mcpServers: [], toolNames: [], dependencies: [] },
    { name: "a", defaultEnabled: true, mcpServers: [], toolNames: [], dependencies: [] },
    { name: "b", defaultEnabled: true, mcpServers: [], toolNames: [], dependencies: [] },
  ];
  const out = mod.recommendAutoEnableDependencies(plugin, all);
  assert.deepEqual(out.enable, ["a", "b"]);
  assert.deepEqual(out.needsInstall, ["missing"]);
});
