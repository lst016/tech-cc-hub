# src/electron/libs/external-mcp-servers.ts

> 模块：`electron` · 语言：`typescript` · 行数：171

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getExternalMcpServers@31`
- `parseExternalMcpServers@38`
- `listExternalMcpServerInfos@55`
- `isConfiguredExternalMcpTool@90`
- `parseExternalMcpServer@104`
- `withClaudeProjectDirEnv@139`
- `getRawMcpServers@148`
- `parseStringMap@155`
- `isRecord@167`
- `parsed@46`
- `parsed@60`
- `serverNames@92`
- `declaredType@109`
- `url@113`
- `headers@118`
- `command@126`
- `normalizedProjectDir@144`
- `entries@160`
- `ExternalMcpStdioServer@2`
- `ExternalMcpHttpServer@9`
- `ExternalMcpServer@15`
- `ExternalMcpParseOptions@17`
- `ExternalMcpServerInfo@20`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`

## 对外暴露

- `ExternalMcpServerInfo`
- `getExternalMcpServers`
- `parseExternalMcpServers`
- `listExternalMcpServerInfos`
- `isConfiguredExternalMcpTool`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
type ExternalMcpParseOptions = {
  projectDir?: string;
};

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

export function getExternalMcpServers(
  config: unknown,
  options: ExternalMcpParseOptions = {},
): Record<string, McpServerConfig> {
  return parseExternalMcpServers(config, options) as Record<string, McpServerConfig>;
}

export function parseExternalMcpServers(
  config: unknown,
  options: ExternalMcpParseOptions = {},
): Record<string, ExternalMcpServer> {
  const servers: Record<string, ExternalMcpServer> = {};

  for (const [name, value] of Object.entries(getRawMcpServers(config))) {
    const parsed = parseExternalMcpServer(value, options);
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

function parseExternalMcpServer(value: unknown, options: ExternalMcpParseOptions = {}): ExternalMcpServer | null {
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
    env: withClaudeProjectDirEnv(parseStringMap(value.env), options.projectDir),
  };
}

function withClaudeProjectDirEnv(
  env: Record<string, string> | undefined,
  projectDir: string | undefined,
): Record<string, string> | undefined {
  const normalizedProjectDir = projectDir?.trim();
  if (!normalizedProjectDir) return env;
  return { CLAUDE_PROJECT_DIR: normalizedProjectDir, ...(env ?? {}) };
}

function getRawMcpServers(config: unknown): Record<string, unknown> {
  if (!isRecord(config) || !isRecord(config.mcpServers)) {
    return {};
  }
  return config.mcpServers;
}

function parseSt
... (truncated)
```
