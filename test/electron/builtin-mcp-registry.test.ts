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
  assert.equal(toolNames.includes("idea_run"), true);
  assert.equal(toolNames.includes("idea_restart"), true);
  assert.equal(toolNames.includes("idea_focus"), true);
  assert.equal(toolNames.includes("idea_wait_ready"), true);
  assert.equal(toolNames.includes("figma_get_design_playbook"), true);
  assert.equal(toolNames.includes("figma_audit_design"), true);
  assert.equal(toolNames.includes("figma_match_ui_nodes"), true);
  assert.equal(toolNames.includes("browser_fetch_logs"), true);
  assert.equal(toolNames.includes("design_lint_visual_parity"), false);
});

test("built-in MCP prompt hints are sourced from the registry", () => {
  const hints = buildBuiltinMcpPromptHints();

  assert.match(hints, /mcp__tech-cc-hub-idea__idea_status/);
  assert.match(hints, /mcp__tech-cc-hub-idea__idea_wait_ready/);
  assert.match(hints, /java -jar/);
});

test("built-in Figma MCP hints include the child component development workflow", () => {
  const hints = buildBuiltinMcpPromptHints(["tech-cc-hub-figma"]);

  assert.match(hints, /Figma component workflow rule/);
  assert.match(hints, /Figma genericity rule/);
  assert.match(hints, /component backlog/);
  assert.match(hints, /exactly one component in_progress/);
  assert.match(hints, /reference tuple/);
  assert.match(hints, /design_compare_element_to_reference/);
});

test("knowledge MCP hints prioritize retrieval over reindexing", () => {
  const knowledgeServer = BUILTIN_MCP_SERVERS.find((server) => server.name === "tech-cc-hub-knowledge");
  assert.ok(knowledgeServer);

  const toolNames = knowledgeServer.toolGroups.flatMap((group) => group.tools.map((tool) => tool.name));
  assert.equal(toolNames.includes("knowledge_search"), false);
  assert.equal(toolNames.includes("knowledge_index"), false);
  assert.ok(toolNames.indexOf("codegraph_status") < toolNames.indexOf("memory_update"));
  assert.ok(toolNames.includes("codegraph_sync"));
  assert.ok(toolNames.includes("codegraph_search"));
  assert.ok(toolNames.includes("codegraph_context"));
  assert.ok(toolNames.includes("codegraph_impact"));
  assert.ok(toolNames.includes("memory_update"));

  const hints = (knowledgeServer.promptHints ?? []).join("\n");
  assert.match(hints, /codegraph_search.*codegraph_context/s);
  assert.match(hints, /\.tech\/codegraph/);
  assert.match(hints, /fast-path only/);
  assert.match(hints, /do not auto-initialize.*incremental sync/s);
  assert.match(hints, /before broad `Read`\/`Grep`\/`Glob`\/`Task`/);
  assert.match(hints, /codegraph_sync mode=index only for explicit refresh\/indexing requests/);
});
