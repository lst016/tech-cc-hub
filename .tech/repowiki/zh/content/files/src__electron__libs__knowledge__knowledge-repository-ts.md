# src/electron/libs/knowledge/knowledge-repository.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：421

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 运行信号

- `create table: knowledge_documents`
- `create table: knowledge_chunks`
- `create table: knowledge_index_runs`
- `virtual table: knowledge_chunks_fts`
- `virtual table: knowledge_chunk_vectors`

## 关键符号

- `KnowledgeRepository@25`
- `existing@109`
- `expectedDimensionSql@112`
- `expectedPrimaryKeySql@113`
- `now@128`
- `existing@129`
- `id@132`
- `contentHash@133`
- `tags@134`
- `metadata@135`
- `chunkId@169`
- `result@170`
- `rowid@192`
- `chunkRow@193`
- `chunkRowid@194`
- `rows@207`
- `row@221`
- `row@228`
- `rows@235`
- `limit@259`
- `vectorRows@261`
- `seen@265`
- `ftsRows@266`
- `rows@275`
- `normalizedQuery@307`
- `ftsQuery@311`
- `rows@317`
- `rows@339`
- `distance@356`
- `vector@365`
- `vectorBlob@366`
- `rows@378`
- `Row@19`
- `RepositoryOptions@21`

## 依赖输入

- `better-sqlite3`
- `sqlite-vec`
- `./knowledge-types.js`
- `./knowledge-utils.js`

## 对外暴露

- `KnowledgeRepository`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import Database from "better-sqlite3";
import { load as loadSqliteVec } from "sqlite-vec";
import type {
  KnowledgeDocument,
  KnowledgeOverviewEntry,
  KnowledgeSearchMode,
  KnowledgeSearchResult,
  KnowledgeSourceKind,
  KnowledgeUpsertInput,
} from "./knowledge-types.js";
import {
  compactWhitespace,
  parseJsonObject,
  parseTags,
  serializeTags,
  stableHash,
  stringifyJsonObject,
} from "./knowledge-utils.js";

type Row = Record<string, unknown>;

type RepositoryOptions = {
  embeddingDimension: number;
};

export class KnowledgeRepository {
  private db: Database.Database;
  private vectorAvailable = false;
  private embeddingDimension: number;

  constructor(dbPath: string, options: RepositoryOptions) {
    this.embeddingDimension = Math.max(1, Math.floor(options.embeddingDimension));
    this.db = new Database(dbPath);
    this.initialize();
  }

  close(): void {
    this.db.close();
  }

  isVectorStoreReady(): boolean {
    return this.vectorAvailable;
  }

  private initialize(): void {
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        workspace_scope TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        source_path TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        tags TEXT NOT NULL DEFAULT '',
        metadata TEXT NOT NULL DEFAULT '{}',
        content_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(workspace_scope, source_kind, source_path)
      );

      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        workspace_scope TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        source_path TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        token_estimate INTEGER NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        embedding_model TEXT,
        embedding_dimension INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
        title,
        content,
        source_path,
        tags,
        tokenize='unicode61'
      );

      CREATE TABLE IF NOT EXISTS knowledge_index_runs (
        id TEXT PRIMARY KEY,
        workspace_scope TEXT NOT NULL,
        mode TEXT NOT NULL,
        status TEXT NOT NULL,
        report TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_documents_workspace ON knowledge_documents(workspace_scope);
      CREATE INDEX IF NOT EXISTS idx_knowledge_documents_source ON knowledge_documents(workspace_scope, source_kind, source_path);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_workspace ON knowledge_chunks(workspace_scope, source_kind);
    `);
    this.initializeVectorStore();
  }

  private initializeVectorStore(): void {
    try {
      loadSqliteVec(this.db);
      const existing = this.db
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'knowledge_chunk_vectors'")
        .get() as { sql?: string } | undefined;
      const expectedDimensionSql = `float[${this.embeddingDimension}]`;
      const expectedPrimaryKeySql = "chunk_rowid integer primary key";
      if (existing?.sql && (!existing.sql.includes(expectedDimensionSql) || !existing.sql.includes(expectedPrimaryKeySql))) {
        this.db.exec("DROP TABLE IF EXISTS knowledge_chunk_vectors");
      }
      this.db.exec(
        `CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunk_vectors USING vec0(chunk_rowid integer primary key, embedding float[${this.embeddingDimension}])`,
      );
      this.vectorAvailable = true;
    } catch (error) {
      this.vectorAvailable = false;
      console.warn("[knowledge] sqlite-vec unavailable:", error instanceof Error ? error.message : error);
    }
  }

  upsertD
... (truncated)
```
