import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILTIN_MCP_SERVERS,
  buildBuiltinMcpPromptHints,
  listBuiltinMcpServerInfos,
  listBuiltinMcpToolNames,
} from "../../src/shared/builtin-mcp-registry.js";

test("built-in MCP registry drives the settings list", () => {
  const serverInfos = listBuiltinMcpServerInfos();
  const registryNames = BUILTIN_MCP_SERVERS.map((server) => server.name);

  assert.deepEqual(serverInfos.map((server) => server.name), registryNames);
  assert.equal(registryNames.includes("tech-cc-hub-idea"), true);
  assert.equal(registryNames.includes("tech-cc-hub-photoshop"), true);
  assert.equal(serverInfos.every((server) => server.type === "builtin" && server.command === "builtin"), true);
});

test("built-in MCP registry contains displayable tool metadata", () => {
  for (const server of BUILTIN_MCP_SERVERS) {
    assert.ok(server.description.trim(), `${server.name} needs a description`);
    assert.ok(server.highlights.length > 0, `${server.name} needs highlights`);
    assert.ok(server.toolGroups.length > 0, `${server.name} needs at least one tool group`);
    assert.ok(server.toolGroups.some((group) => group.tools.length > 0), `${server.name} needs listed tools`);
  }
});

test("built-in MCP registry tool names stay unique", () => {
  const toolNames = listBuiltinMcpToolNames();
  const uniqueToolNames = new Set(toolNames);

  assert.equal(uniqueToolNames.size, toolNames.length);
  assert.equal(toolNames.includes("idea_status"), true);
  assert.equal(toolNames.includes("idea_open"), true);
  assert.equal(toolNames.includes("idea_focus"), true);
  assert.equal(toolNames.includes("idea_wait_ready"), true);
  assert.equal(toolNames.includes("figma_get_design_playbook"), true);
  assert.equal(toolNames.includes("figma_audit_design"), true);
  assert.equal(toolNames.includes("photoshop_check_environment"), true);
  assert.equal(toolNames.includes("psd_generate_web_manifest"), true);
});

test("built-in MCP prompt hints are sourced from the registry", () => {
  const hints = buildBuiltinMcpPromptHints();

  assert.match(hints, /mcp__tech-cc-hub-idea__idea_status/);
  assert.match(hints, /mcp__tech-cc-hub-idea__idea_wait_ready/);
  assert.match(hints, /java -jar/);
});
