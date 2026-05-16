# src/electron/libs/builtin-mcp-servers.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：68

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getBuiltinMcpServers@44`
- `listBuiltinMcpToolNames@60`
- `context@49`
- `enabledNames@52`
- `server@55`
- `BuiltinMcpServerName@5`
- `BuiltinMcpFactoryContext@15`
- `BuiltinMcpFactory@20`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `../../shared/builtin-mcp-registry.js`
- `./mcp-tools/admin.js`
- `./mcp-tools/browser.js`
- `./mcp-tools/design.js`
- `./mcp-tools/cron.js`
- `./mcp-tools/figma-rest.js`
- `./mcp-tools/idea.js`
- `./mcp-tools/knowledge.js`
- `./mcp-tools/plan.js`

## 对外暴露

- `BUILTIN_MCP_SERVER_FACTORIES`
- `BUILTIN_MCP_TOOL_NAMES`
- `getBuiltinMcpServers`
- `listBuiltinMcpToolNames`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";

import {
  BUILTIN_MCP_SERVERS,
  type BuiltinMcpServerName,
} from "../../shared/builtin-mcp-registry.js";
import { ADMIN_TOOL_NAMES, getAdminMcpServer } from "./mcp-tools/admin.js";
import { BROWSER_TOOL_NAMES, getBrowserMcpServer } from "./mcp-tools/browser.js";
import { DESIGN_TOOL_NAMES, getDesignMcpServer } from "./mcp-tools/design.js";
import { CRON_TOOL_NAMES, getCronMcpServer } from "./mcp-tools/cron.js";
import { FIGMA_REST_TOOL_NAMES, getFigmaRestMcpServer } from "./mcp-tools/figma-rest.js";
import { IDEA_TOOL_NAMES, getIdeaMcpServer } from "./mcp-tools/idea.js";
import { KNOWLEDGE_TOOL_NAMES, getKnowledgeMcpServer } from "./mcp-tools/knowledge.js";
import { PLAN_TOOL_NAMES, getPlanMcpServer } from "./mcp-tools/plan.js";

type BuiltinMcpFactoryContext = {
  sessionId: string;
  cwd?: string;
};

type BuiltinMcpFactory = (context: BuiltinMcpFactoryContext) => McpSdkServerConfigWithInstance;

export const BUILTIN_MCP_SERVER_FACTORIES: Record<BuiltinMcpServerName, BuiltinMcpFactory> = {
  "tech-cc-hub-browser": ({ sessionId }) => getBrowserMcpServer(sessionId),
  "tech-cc-hub-admin": () => getAdminMcpServer(),
  "tech-cc-hub-design": ({ sessionId }) => getDesignMcpServer(sessionId),
  "tech-cc-hub-figma": () => getFigmaRestMcpServer(),
  "tech-cc-hub-cron": () => getCronMcpServer(),
  "tech-cc-hub-idea": () => getIdeaMcpServer(),
  "tech-cc-hub-plan": () => getPlanMcpServer(),
  "tech-cc-hub-knowledge": ({ cwd }) => getKnowledgeMcpServer(cwd),
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

```
