import type { McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";

import {
  BUILTIN_MCP_SERVERS,
  type BuiltinMcpServerName,
} from "../../shared/builtin-mcp-registry.js";
import { ADMIN_TOOL_NAMES, getAdminMcpServer } from "./mcp-tools/admin.js";
import { BROWSER_TOOL_NAMES, getBrowserMcpServer } from "./mcp-tools/browser.js";
import { DESIGN_TOOL_NAMES, getDesignMcpServer } from "./mcp-tools/design.js";
import { CRON_TOOL_NAMES, getCronMcpServer } from "./mcp-tools/cron.js";
import { FIGMA_REST_TOOL_NAMES, getFigmaRestMcpServer, type FigmaRestToolMode } from "./mcp-tools/figma-rest.js";
import { IDEA_TOOL_NAMES, getIdeaMcpServer } from "./mcp-tools/idea.js";
import { KNOWLEDGE_TOOL_NAMES, getKnowledgeMcpServer } from "./mcp-tools/knowledge.js";
import { PLAN_TOOL_NAMES, getPlanMcpServer } from "./mcp-tools/plan.js";
import { IMAGE_GENERATION_TOOL_NAMES, getImageGenerationMcpServer } from "./mcp-tools/image-generation.js";

type BuiltinMcpFactoryContext = {
  sessionId: string;
  cwd?: string;
  figmaToolMode?: FigmaRestToolMode;
};

type BuiltinMcpFactory = (context: BuiltinMcpFactoryContext) => McpSdkServerConfigWithInstance;

// Agent SDK MCP server instances are connection-scoped. Factories must return
// fresh instances for each run; shared state belongs in the tool host modules.
export const BUILTIN_MCP_SERVER_FACTORIES: Record<BuiltinMcpServerName, BuiltinMcpFactory> = {
  "tech-cc-hub-browser": ({ sessionId }) => getBrowserMcpServer(sessionId),
  "tech-cc-hub-admin": () => getAdminMcpServer(),
  "tech-cc-hub-design": ({ sessionId }) => getDesignMcpServer(sessionId),
  "tech-cc-hub-figma": ({ figmaToolMode }) => getFigmaRestMcpServer({ toolMode: figmaToolMode }),
  "tech-cc-hub-cron": () => getCronMcpServer(),
  "tech-cc-hub-idea": () => getIdeaMcpServer(),
  "tech-cc-hub-plan": () => getPlanMcpServer(),
  "tech-cc-hub-knowledge": ({ cwd }) => getKnowledgeMcpServer(cwd),
  "tech-cc-hub-image": () => getImageGenerationMcpServer(),
};

export const BUILTIN_MCP_TOOL_NAMES: Record<BuiltinMcpServerName, readonly string[]> = {
  "tech-cc-hub-browser": BROWSER_TOOL_NAMES,
  "tech-cc-hub-admin": ADMIN_TOOL_NAMES,
  "tech-cc-hub-design": DESIGN_TOOL_NAMES,
  "tech-cc-hub-figma": FIGMA_REST_TOOL_NAMES,
  "tech-cc-hub-cron": CRON_TOOL_NAMES,
  "tech-cc-hub-idea": IDEA_TOOL_NAMES,
  "tech-cc-hub-plan": PLAN_TOOL_NAMES,
  "tech-cc-hub-knowledge": KNOWLEDGE_TOOL_NAMES,
  "tech-cc-hub-image": IMAGE_GENERATION_TOOL_NAMES,
};

export function getBuiltinMcpServers(
  contextOrSessionId: string | BuiltinMcpFactoryContext,
  enabledServerNames?: readonly BuiltinMcpServerName[],
): Record<string, McpSdkServerConfigWithInstance> {
  const context = typeof contextOrSessionId === "string"
    ? { sessionId: contextOrSessionId }
    : contextOrSessionId;
  const enabledNames = enabledServerNames ? new Set(enabledServerNames) : null;
  return Object.fromEntries(
    BUILTIN_MCP_SERVERS.filter((definition) => !enabledNames || enabledNames.has(definition.name)).map((definition) => {
      const server = BUILTIN_MCP_SERVER_FACTORIES[definition.name](context);
      return [server.name, server];
    }),
  );
}

export function listBuiltinMcpToolNames(enabledServerNames?: readonly BuiltinMcpServerName[]): string[] {
  if (!enabledServerNames) {
    return Object.values(BUILTIN_MCP_TOOL_NAMES).flatMap((tools) => [...tools]);
  }

  return enabledServerNames.flatMap((serverName) => [...(BUILTIN_MCP_TOOL_NAMES[serverName] ?? [])]);
}
