import test from "node:test";
import assert from "node:assert/strict";

import type { BuiltinMcpServerName } from "../../src/shared/builtin-mcp-registry.js";
import { resolveRuntimeEfficiencyProfile } from "../../src/electron/libs/runtime-efficiency.js";
import {
  applyStickyBuiltinMcpServersToProfile,
  mergeStickyBuiltinMcpServerNames,
} from "../../src/electron/libs/runner/sticky-mcp-servers.js";

const ALL_BUILTIN_MCP_SERVERS = [
  "tech-cc-hub-admin",
  "tech-cc-hub-plan",
  "tech-cc-hub-knowledge",
  "tech-cc-hub-browser",
  "tech-cc-hub-design",
  "tech-cc-hub-figma",
  "tech-cc-hub-cron",
  "tech-cc-hub-idea",
] as const;

test("runner keeps all built-in MCP servers available without forcing visual prompts", () => {
  const leanProfile = resolveRuntimeEfficiencyProfile({
    prompt: "continue the implementation",
  });
  const activeVisualServers = new Set<BuiltinMcpServerName>([
    "tech-cc-hub-admin",
    "tech-cc-hub-plan",
    "tech-cc-hub-knowledge",
    "tech-cc-hub-browser",
    "tech-cc-hub-design",
    "tech-cc-hub-figma",
  ]);

  const profile = applyStickyBuiltinMcpServersToProfile(leanProfile, [activeVisualServers]);

  assert.deepEqual(profile.builtinMcpServers, ALL_BUILTIN_MCP_SERVERS);
  assert.equal(profile.includeBrowserPrompt, false);
  assert.equal(profile.includeDesignPrompt, false);
  assert.equal(profile.includePartialMessages, false);
  assert.equal(profile.includeClaudeCompatPrompt, false);
});

test("runner does not keep non-stateful MCP servers when the profile omits them", () => {
  const nextServerNames: BuiltinMcpServerName[] = [
    "tech-cc-hub-admin",
    "tech-cc-hub-plan",
    "tech-cc-hub-knowledge",
  ];
  const activeUtilityServers = new Set<BuiltinMcpServerName>([
    "tech-cc-hub-cron",
    "tech-cc-hub-idea",
  ]);

  assert.deepEqual(mergeStickyBuiltinMcpServerNames(nextServerNames, [activeUtilityServers]), nextServerNames);
});

test("runner exposes all built-in MCP servers from the first turn", () => {
  const leanProfile = resolveRuntimeEfficiencyProfile({
    prompt: "explain this helper",
  });

  assert.deepEqual(applyStickyBuiltinMcpServersToProfile(leanProfile, []).builtinMcpServers, ALL_BUILTIN_MCP_SERVERS);
});
