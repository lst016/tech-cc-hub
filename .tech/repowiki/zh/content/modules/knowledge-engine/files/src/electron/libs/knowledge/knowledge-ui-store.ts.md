# src/electron/libs/knowledge/knowledge-ui-store.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：611

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 运行信号

- `create table: knowledge_ui_workspaces`
- `create table: knowledge_ui_generation`
- `create table: knowledge_ui_documents`

## 关键符号

- `createKnowledgeUiStore@290`
- `handleKnowledgeUiInvoke@294`
- `normalizeKey@345`
- `workspaceName@349`
- `readObject@355`
- `readWorkspaceInputs@359`
- `readSystemWorkspace@371`
- `runKnowledgeGeneration@376`
- `collectGeneratedMarkdownDocuments@452`
- `walk@460`
- `uniqueDocumentId@495`
- `extractMarkdownTitle@512`
- `inferSectionFromPath@516`
- `slugifyDocumentId@533`
- `readGeneration@542`
- `normalizeGeneration@557`
- `rowToWorkspace@574`
- `rowToGeneration@585`
- `rowToDocument@599`
- `KnowledgeUiStore@69`
- `dir@74`
- `workspaces@129`
- `generationRows@132`
- `generations@133`
- `rows@138`
- `countDocs@142`
- `update@143`
- `now@148`
- `tx@149`
- `result@151`
- `total@152`
- `now@162`
- `systemKey@163`
- `insert@164`
- `updateSeen@168`
- `tx@173`
- `key@175`
- `name@177`
- `key@187`
- `now@189`

## 依赖输入

- `better-sqlite3`
- `fs`
- `path`
- `./knowledge-indexer.js`
- `./knowledge-overview.js`
- `./knowledge-paths.js`
- `./knowledge-types.js`
- `./knowledge-utils.js`

## 对外暴露

- `KnowledgeUiWorkspace`
- `KnowledgeUiGeneration`
- `KnowledgeUiDocument`
- `KnowledgeUiStore`
- `createKnowledgeUiStore`
- `handleKnowledgeUiInvoke`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "fs";
import { basename, dirname, extname, join, relative, resolve } from "path";
import { indexKnowledgeWorkspace } from "./knowledge-indexer.js";
import { buildKnowledgeOverviewPromptAppend } from "./knowledge-overview.js";
import { resolveKnowledgeWorkspacePaths } from "./knowledge-paths.js";
import type { KnowledgeIndexReport } from "./knowledge-types.js";
import { stableHash } from "./knowledge-utils.js";

export type KnowledgeUiWorkspace = {
  key: string;
  cwd: string;
  name: string;
  source: "session" | "manual";
  hidden: boolean;
  updatedAt: number;
};

export type KnowledgeUiGeneration = {
  status: "idle" | "generating" | "paused" | "completed";
  completed: number;
  total: number;
  processing: number;
  failed: number;
  commitId?: string;
  commitShortHash?: string;
  branch?: string | null;
  updatedAt: number;
};

export type KnowledgeUiDocument = {
  id: string;
  workspaceKey: string;
  section: string;
  title: string;
  content: string;
  sortOrder: number;
  updatedAt: number;
};

type Row = Record<string, unknown>;

type GeneratedMarkdownDocument = {
  id: string;
  section: string;
  title: string;
  content: string;
  sortOrder: number;
};

const DEFAULT_DOCUMENTS: Array<{ id: string; section: string; title: string; sortOrder: number }> = [
  { id: "project-introduction", section: "项目概述", title: "项目介绍", sortOrder: 10 },
  { id: "target-users", section: "项目概述", title: "目标用户", sortOrder: 20 },
  { id: "core-features", section: "项目概述", title: "核心功能", sortOrder: 30 },
  { id: "tech-stack", section: "项目概述", title: "技术栈", sortOrder: 40 },
  { id: "quick-start", section: "项目概述", title: "快速开始", sortOrder: 50 },
  { id: "architecture-overview", section: "架构设计", title: "整体架构概览", sortOrder: 110 },
  { id: "frontend-architecture", section: "架构设计", title: "前端架构设计", sortOrder: 120 },
  { id: "state-management", section: "架构设计", title: "状态管理架构", sortOrder: 130 },
  { id: "routing-navigation", section: "架构设计", title: "路由与导航设计", sortOrder: 140 },
  { id: "frontend-performance", section: "架构设计", title: "前端性能优化", sortOrder: 150 },
  { id: "ipc", section: "后端架构设计", title: "IPC 通信机制", sortOrder: 210 },
  { id: "backend-modules", section: "后端架构设计", title: "业务模块组织", sortOrder: 220 },
  { id: "config-management", section: "后端架构设计", title: "配置管理模块", sortOrder: 230 },
  { id: "session-management", section: "后端架构设计", title: "会话管理模块", sortOrder: 240 },
  { id: "mcp-tools", section: "后端架构设计", title: "MCP 工具系统", sortOrder: 250 },
  { id: "knowledge-module", section: "后端架构设计", title: "知识库模块", sortOrder: 260 },
];

export class KnowledgeUiStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.initialize();
  }

  close(): void {
    this.db.close();
  }

  private initialize(): void {
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_ui_workspaces (
        key TEXT PRIMARY KEY,
        cwd TEXT NOT NULL,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        hidden INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_ui_generation (
        workspace_key TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        completed INTEGER NOT NULL,
        total INTEGER NOT NULL,
        processing INTEGER NOT NULL,
        failed INTEGER NOT NULL,
        commit_id TEXT,
        commit_short_hash TEXT,
        branch TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_ui_documents (
        id TEXT NOT NULL,
        workspace_key TEXT NOT NULL,
        section TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (workspace_key, id)
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_ui_workspaces_hidden ON
... (truncated)
```
