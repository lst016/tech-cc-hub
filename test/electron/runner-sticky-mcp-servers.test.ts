import test from "node:test";
import assert from "node:assert/strict";

import type { BuiltinMcpServerName } from "../../src/shared/builtin-mcp-registry.js";
import { resolveRuntimeEfficiencyProfile } from "../../src/electron/libs/runtime-efficiency.js";
import {
  applyStickyBuiltinMcpServersToProfile,
  mergeStickyBuiltinMcpServerNames,
} from "../../src/electron/libs/runner/sticky-mcp-servers.js";

test("runner keeps active stateful MCP servers when a later profile omits them", () => {
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

  assert.deepEqual(profile.builtinMcpServers, [
    "tech-cc-hub-admin",
    "tech-cc-hub-plan",
    "tech-cc-hub-knowledge",
    "tech-cc-hub-browser",
    "tech-cc-hub-design",
    "tech-cc-hub-figma",
  ]);
  assert.equal(profile.includeBrowserPrompt, true);
  assert.equal(profile.includeDesignPrompt, true);
  assert.equal(profile.includePartialMessages, true);
  assert.equal(profile.includeClaudeCompatPrompt, true);
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

test("runner does not add stateful MCP servers before they have been enabled", () => {
  const leanProfile = resolveRuntimeEfficiencyProfile({
    prompt: "explain this helper",
  });

  assert.deepEqual(applyStickyBuiltinMcpServersToProfile(leanProfile, []).builtinMcpServers, [
    "tech-cc-hub-admin",
    "tech-cc-hub-plan",
    "tech-cc-hub-knowledge",
  ]);
});
