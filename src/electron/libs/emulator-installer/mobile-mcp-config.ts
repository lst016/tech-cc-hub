import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk";

import { buildExternalCliStringEnv, resolveExternalCliCommand } from "../external-cli.js";

const MOBILE_MCP_BIN = "mobile-mcp";
const REMOTE_AGENT_ENV_KEY = "MOBILE_MCP_REMOTE_AGENT_URL";

export function buildMobileMcpServerConfig(
  remoteUrl?: string | null,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): McpServerConfig {
  const stdioEnv = buildExternalCliStringEnv(env, platform);
  if (remoteUrl) stdioEnv[REMOTE_AGENT_ENV_KEY] = remoteUrl;

  return {
    type: "stdio",
    command: resolveExternalCliCommand(MOBILE_MCP_BIN, stdioEnv),
    env: stdioEnv,
  };
}
