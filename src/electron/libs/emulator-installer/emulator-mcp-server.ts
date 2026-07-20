// src/electron/libs/emulator-installer/emulator-mcp-server.ts
// -----------------------------------------------------------------------------
// Phase 8: convert emulator-plugin install state into an Agent SDK
// mcpServers entry. Caller (src/electron/libs/runner/runner.ts) awaits
// buildEmulatorMcpServers() once per session and spreads the result into
// options.mcpServers. When @mobilenext/mobile-mcp is not yet installed this
// returns an empty object so the SDK does not get a broken server reference.
//
// The iOS remote macOS agent URL (saved via Phase 4's emulator-remote store)
// is forwarded to the server via the MOBILE_MCP_REMOTE_AGENT_URL env so the
// mobile-mcp stdio process can route commands to the right host.
// -----------------------------------------------------------------------------

import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk";

import { getRemoteAgentUrl } from "../emulator-remote/index.js";
import { isPackageInstalledGlobally } from "./install-from-npm.js";
import { buildMobileMcpServerConfig } from "./mobile-mcp-config.js";

const MOBILE_MCP_PACKAGE = "@mobilenext/mobile-mcp";
const MOBILE_MCP_SERVER_NAME = "mobile-mcp";
const IOS_EMULATOR_PLUGIN_ID = "ios-emulator";

export async function buildEmulatorMcpServers(): Promise<Record<string, McpServerConfig>> {
  const state = await isPackageInstalledGlobally(MOBILE_MCP_PACKAGE);
  if (!state.installed) return {};

  const remoteUrl = await getRemoteAgentUrl(IOS_EMULATOR_PLUGIN_ID);

  return {
    [MOBILE_MCP_SERVER_NAME]: buildMobileMcpServerConfig(remoteUrl),
  };
}
