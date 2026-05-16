# src/electron/libs/mcp-tools/knowledge.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：361

## 文件职责

源码文件。运行信号：mcp tool: knowledge_search、mcp tool: knowledge_read、mcp tool: knowledge_explore、mcp tool: knowledge_index、mcp tool: memory_update；依赖：electron、fs、@anthropic-ai/claude-agent-sdk、zod、../knowledge/embedding-client.js

## 运行信号

- `mcp tool: knowledge_search`
- `mcp tool: knowledge_read`
- `mcp tool: knowledge_explore`
- `mcp tool: knowledge_index`
- `mcp tool: memory_update`

## 关键符号

- `resolveWorkspaceRoot@69 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `parseMemoryCategories@77 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `parseTags@90 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `resolveMemoryScope@94 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `openKnowledgeRepository@98 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `openMemoryRepository@113 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `mirrorMemoryJson@122 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `getKnowledgeMcpServer@127 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `KNOWLEDGE_TOOL_NAMES@19 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `KNOWLEDGE_MCP_SERVER_NAME@27 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `KNOWLEDGE_MCP_SERVER_VERSION@29 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `knowledgeMcpServers@30 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `SEARCH_SCHEMA@31 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `READ_SCHEMA@40 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `EXPLORE_SCHEMA@48 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`
- `INDEX_SCHEMA@54 - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore`

## 依赖输入

- `electron`
- `fs`
- `@anthropic-ai/claude-agent-sdk`
- `zod`
- `../knowledge/embedding-client.js`
- `../knowledge/knowledge-indexer.js`
- `../knowledge/knowledge-model-settings.js`
- `../knowledge/knowledge-paths.js`
- `../knowledge/knowledge-repository.js`
- `../knowledge/knowledge-types.js`
- `../memory/memory-repository.js`
- `../memory/memory-types.js`
- `./tool-result.js`

## 对外暴露

- `KNOWLEDGE_TOOL_NAMES`
- `getKnowledgeMcpServer`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { app } from "electron";
import { existsSync, writeFileSync } from "fs";
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { embedTexts } from "../knowledge/embedding-client.js";
import { indexKnowledgeWorkspace } from "../knowledge/knowledge-indexer.js";
import { assertEmbeddingConfigured, resolveKnowledgeModelSettings } from "../knowledge/knowledge-model-settings.js";
import { resolveKnowledgeWorkspacePaths, ensureKnowledgeWorkspaceDirectories } from "../knowledge/knowledge-paths.js";
import { KnowledgeRepository } from "../knowledge/knowledge-repository.js";
import type { KnowledgeSearchMode } from "../knowledge/knowledge-types.js";
import { MemoryRepository } from "../memory/memory-repository.js";
import { MEMORY_CATEGORIES, type MemoryCategory, type MemoryScope } from "../memory/memory-types.js";
import { toTextToolResult } from "./tool-result.js";

export const KNOWLEDGE_TOOL_NAMES = [
  "knowledge_search",
  "knowledge_read",
  "knowledge_explore",
  "knowledge_index",
  "memory_update",
] as const;

const KNOWLEDGE_MCP_SERVER_NAME = "tech-cc-hub-knowledge";
const KNOWLEDGE_MCP_SERVER_VERSION = "1.0.0";
const knowledgeMcpServers = new Map<string, McpSdkServerConfigWithInstance>();

const SEARCH_SCHEMA = {
  query: z.string().min(1).describe("Search query, title, path, or natural-language question."),
  mode: z.enum(["shallow", "deep", "hybrid"]).optional().describe("shallow=FTS, deep=vector, hybrid=vector first then FTS. Defaults to hybrid."),
  source: z.enum(["repowiki", "memory", "all"]).optional().describe("Search .tech RepoWiki, Memory, or both. Defaults to all."),
  category: z.string().optional().describe("Memory category filter, comma-separated."),
  limit: z.number().min(1).max(20).optional().describe("Defaults to 6."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
};

const READ_SCHEMA = {
  id: z.string().optional().describe("Knowledge document id or memory id."),
  path: z.string().optional().describe("Workspace-relative .tech RepoWiki path."),
  title: z.string().optional().describe("Memory title or exact document title."),
  source: z.enum(["repowiki", "memory", "all"]).optional().describe("Defaults to all."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
};

const EXPLORE_SCHEMA = {
  source: z.enum(["repowiki", "memory", "all"]).optional().describe("Defaults to all."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
  limit: z.number().min(1).max(80).optional().describe("Defaults to 40."),
};

const INDEX_SCHEMA = {
  mode: z.enum(["scan", "generate", "refresh"]).optional().describe("scan=index existing .tech docs; generate=call wiki model then index; refresh=generate when configured, then reindex. Defaults to refresh."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
};

const MEMORY_UPDATE_SCHEMA = {
  action: z.enum(["add", "update", "delete"]),
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  category: z.enum([...MEMORY_CATEGORIES] as [MemoryCategory, ...MemoryCategory[]]).optional(),
  tags: z.string().optional().describe("Comma-separated tags."),
  scope: z.enum(["global", "workspace"]).optional().describe("Defaults to workspace."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
};

function resolveWorkspaceRoot(input: string | undefined, defaultWorkspaceRoot: string | undefined): string {
  const workspaceRoot = input?.trim() || defaultWorkspaceRoot || process.cwd();
  if (!existsSync(workspaceRoot)) {
    throw new Error(`workspaceRoot does not exist: ${workspaceRoot}`);
  }
  return workspaceRoot;
}

function parseMemoryCategories(value: string | undefined): MemoryCategory[] | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const categories = value.split(",").map((item) => item.trim()).filter(Boolean);
  const valid = new Set<string>(MEMORY_CATEGORIES);
  const invalid = categori
... (truncated)
```
