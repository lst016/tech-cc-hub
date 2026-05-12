import assert from "node:assert/strict";
import test from "node:test";

import {
  isConfiguredExternalMcpTool,
  listExternalMcpServerInfos,
  parseExternalMcpServers,
} from "../../src/electron/libs/external-mcp-servers.js";

test("parses stdio and http external MCP servers", () => {
  const config = {
    mcpServers: {
      "open-computer-use": { type: "stdio", command: "open-computer-use", args: ["mcp"], env: { A: "1" } },
      figma: { type: "http", url: "https://mcp.figma.com/mcp", enabled: true },
    },
  };

  const parsed = parseExternalMcpServers(config);
  assert.equal(Object.keys(parsed).includes("open-computer-use"), true);
  assert.equal(Object.keys(parsed).includes("figma"), true);
  assert.deepEqual(parsed.figma, { type: "http", url: "https://mcp.figma.com/mcp" });

  const infos = listExternalMcpServerInfos(config);
  assert.deepEqual(infos.map((item) => item.name), ["open-computer-use", "figma"]);
  assert.equal(infos.find((item) => item.name === "figma")?.transport, "http");
  assert.equal(infos.find((item) => item.name === "figma")?.url, "https://mcp.figma.com/mcp");
});

test("injects CLAUDE_PROJECT_DIR into stdio external MCP server env", () => {
  const parsed = parseExternalMcpServers(
    {
      mcpServers: {
        local: { type: "stdio", command: "local-mcp", env: { A: "1" } },
        custom: { type: "stdio", command: "custom-mcp", env: { CLAUDE_PROJECT_DIR: "D:\\custom" } },
        remote: { type: "http", url: "https://example.com/mcp" },
      },
    },
    { projectDir: "D:\\workspace\\demo" },
  );

  assert.deepEqual(parsed.local, {
    type: "stdio",
    command: "local-mcp",
    args: [],
    env: { CLAUDE_PROJECT_DIR: "D:\\workspace\\demo", A: "1" },
  });
  assert.equal(parsed.custom?.type, "stdio");
  if (parsed.custom?.type === "stdio") {
    assert.equal(parsed.custom.env?.CLAUDE_PROJECT_DIR, "D:\\custom");
  }
  assert.deepEqual(parsed.remote, { type: "http", url: "https://example.com/mcp" });
});

test("skips disabled and invalid external MCP entries", () => {
  const config = {
    mcpServers: {
      disabled: { type: "http", url: "https://example.com/mcp", enabled: false },
      badHttp: { type: "http" },
      badStdio: { type: "stdio" },
      legacy: { command: "legacy-mcp" },
    },
  };

  const infos = listExternalMcpServerInfos(config);
  assert.deepEqual(infos.map((item) => item.name), ["legacy"]);
  assert.equal(infos[0]?.transport, "stdio");
});

test("allows tools from configured external MCP server names", () => {
  const config = { mcpServers: { figma: { type: "http", url: "https://mcp.figma.com/mcp" } } };

  assert.equal(isConfiguredExternalMcpTool("mcp__figma__get_code", config), true);
  assert.equal(isConfiguredExternalMcpTool("figma__get_code", config), true);
  assert.equal(isConfiguredExternalMcpTool("figma:get_code", config), true);
  assert.equal(isConfiguredExternalMcpTool("other:get_code", config), false);
});
