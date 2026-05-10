import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFigmaOfficialMcpConfig,
  buildFigmaOfficialPluginConfig,
  buildNextFigmaOfficialRuntimeConfig,
  getFigmaOfficialPluginStatusFromConfig,
} from "../../src/electron/libs/figma-official-plugin.js";

test("builds official Figma remote MCP config", () => {
  assert.deepEqual(buildFigmaOfficialMcpConfig(), {
    type: "http",
    url: "https://mcp.figma.com/mcp",
    enabled: true,
  });
});

test("preserves unrelated runtime config when adding Figma", () => {
  const next = buildNextFigmaOfficialRuntimeConfig({
    plugins: { "open-computer-use": { id: "open-computer-use" } },
    mcpServers: { "open-computer-use": { type: "stdio", command: "open-computer-use" } },
    other: true,
  }, 1000);

  assert.equal((next.plugins as Record<string, unknown>)["open-computer-use"] != null, true);
  assert.equal((next.mcpServers as Record<string, unknown>)["open-computer-use"] != null, true);
  assert.equal(next.other, true);
  assert.deepEqual((next.mcpServers as Record<string, unknown>).figma, buildFigmaOfficialMcpConfig());
});

test("detects missing, configured, and misconfigured Figma plugin status", () => {
  assert.equal(getFigmaOfficialPluginStatusFromConfig({}).status, "not-configured");

  const configured = {
    plugins: { "figma-official": buildFigmaOfficialPluginConfig(1000) },
    mcpServers: { figma: buildFigmaOfficialMcpConfig() },
  };
  assert.equal(getFigmaOfficialPluginStatusFromConfig(configured).status, "configured");

  const misconfigured = {
    plugins: { "figma-official": buildFigmaOfficialPluginConfig(1000) },
    mcpServers: { figma: { type: "stdio", command: "figma" } },
  };
  assert.equal(getFigmaOfficialPluginStatusFromConfig(misconfigured).status, "misconfigured");
});

test("detects Figma auth expiry hints without marking config broken", () => {
  const status = getFigmaOfficialPluginStatusFromConfig({
    plugins: {
      "figma-official": {
        ...buildFigmaOfficialPluginConfig(1000),
        authStatus: "auth-expired",
        lastAuthError: "401 unauthorized token expired",
      },
    },
    mcpServers: { figma: buildFigmaOfficialMcpConfig() },
  });

  assert.equal(status.status, "auth-expired");
  assert.match(status.authHint ?? "", /重新授权/);
});
