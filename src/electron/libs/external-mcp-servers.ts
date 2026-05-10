import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk";

type ExternalMcpStdioServer = {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

type ExternalMcpHttpServer = {
  type: "http";
  url: string;
  headers?: Record<string, string>;
};

type ExternalMcpServer = ExternalMcpStdioServer | ExternalMcpHttpServer;

export type ExternalMcpServerInfo = {
  name: string;
  type: "external";
  transport: "stdio" | "http";
  command: string;
  args: string[];
  url?: string;
  envKeys: string[];
  enabled: boolean;
};

export function getExternalMcpServers(config: unknown): Record<string, McpServerConfig> {
  return parseExternalMcpServers(config) as Record<string, McpServerConfig>;
}

export function parseExternalMcpServers(config: unknown): Record<string, ExternalMcpServer> {
  const servers: Record<string, ExternalMcpServer> = {};

  for (const [name, value] of Object.entries(getRawMcpServers(config))) {
    const parsed = parseExternalMcpServer(value);
    if (!parsed) {
      continue;
    }
    servers[name] = parsed;
  }

  return servers;
}

export function listExternalMcpServerInfos(config: unknown): ExternalMcpServerInfo[] {
  return Object.entries(getRawMcpServers(config))
    .map((entry): ExternalMcpServerInfo | null => {
      const [name, value] = entry;
      const parsed = parseExternalMcpServer(value);
      if (!parsed) {
        return null;
      }

      if (parsed.type === "http") {
        return {
          name,
          type: "external" as const,
          transport: "http" as const,
          command: "",
          args: [],
          url: parsed.url,
          envKeys: [],
          enabled: true,
        };
      }

      return {
        name,
        type: "external" as const,
        transport: "stdio" as const,
        command: parsed.command,
        args: parsed.args ?? [],
        envKeys: Object.keys(parsed.env ?? {}),
        enabled: true,
      };
    })
    .filter((info): info is ExternalMcpServerInfo => info !== null);
}

export function isConfiguredExternalMcpTool(toolName: string, config: unknown): boolean {
  const serverNames = Object.keys(parseExternalMcpServers(config));
  if (serverNames.length === 0) {
    return false;
  }

  return serverNames.some((serverName) => (
    toolName.startsWith(`mcp__${serverName}__`) ||
    toolName.startsWith(`${serverName}__`) ||
    toolName.startsWith(`${serverName}:`) ||
    toolName.startsWith(`${serverName}/`)
  ));
}

function parseExternalMcpServer(value: unknown): ExternalMcpServer | null {
  if (!isRecord(value) || value.enabled === false) {
    return null;
  }

  const declaredType = typeof value.type === "string" ? value.type.trim().toLowerCase() : "";

  if (declaredType === "http") {
    const url = typeof value.url === "string" ? value.url.trim() : "";
    if (!url) {
      console.warn("[external-mcp] Skipping HTTP MCP server without url.");
      return null;
    }

    const headers = parseStringMap(value.headers);
    return {
      type: "http",
      url,
      ...(headers ? { headers } : {}),
    };
  }

  const command = typeof value.command === "string" ? value.command.trim() : "";
  if (!command) {
    return null;
  }

  return {
    type: "stdio",
    command,
    args: Array.isArray(value.args) ? value.args.filter((arg): arg is string => typeof arg === "string") : [],
    env: parseStringMap(value.env),
  };
}

function getRawMcpServers(config: unknown): Record<string, unknown> {
  if (!isRecord(config) || !isRecord(config.mcpServers)) {
    return {};
  }
  return config.mcpServers;
}

function parseStringMap(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter((entry): entry is [string, string] => (
    typeof entry[1] === "string"
  ));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
