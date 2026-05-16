# src/electron/libs/memory/memory-repository.ts

> 模块：`electron` · 语言：`typescript` · 行数：322

## 文件职责

记忆/笔记的SQLite仓库，提供全文搜索支持（FTS5）

## 运行信号

- `create table: memories`
- `virtual table: memories_fts`

## 关键符号

- `MemoryRepository@0 - 记忆仓储类，管理memories表和memories_fts虚拟表`
- `create@0 - 创建新记忆条目，同时写入主表和FTS表`
- `upsertByTitle@0 - 按标题存在性判断插入或更新`
- `search@0 - 使用FTS5全文搜索记忆内容`
- `serializeTags@0 - 序列化标签数组为逗号分隔字符串`
- `compact@0 - 截断文本到指定长度并添加省略号`

## 依赖输入

- `better-sqlite3`
- `./memory-types.js`

## 对外暴露

- `MemoryRepository`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import Database from "better-sqlite3";
import type {
  MemoryCategory,
  MemoryCreateInput,
  MemoryEntry,
  MemoryOverviewEntry,
  MemoryScope,
  MemorySearchMode,
  MemorySearchResult,
  MemoryUpdateInput,
} from "./memory-types.js";

type Row = Record<string, unknown>;

function serializeTags(tags: string[] | undefined): string {
  return Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))).join(",");
}

function parseTags(value: unknown): string[] {
  return typeof value === "string"
    ? value.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];
}

function compact(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

export class MemoryRepository {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initialize();
  }

  close(): void {
    this.db.close();
  }

  private initialize(): void {
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'global',
        tags TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'agent',
        confidence REAL NOT NULL DEFAULT 1.0,
        access_count INTEGER NOT NULL DEFAULT 0,
        last_accessed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        UNIQUE(title, scope)
      );

      CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
      CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at DESC);

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        title,
        content,
        tags,
        tokenize='unicode61'
      );
    `);
  }

  create(input: MemoryCreateInput): MemoryEntry {
    const now = Date.now();
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO memories
          (id, title, content, category, scope, tags, source, confidence, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.title.trim(),
        input.content,
        input.category,
        input.scope,
        serializeTags(input.tags),
        input.source ?? "agent",
        input.confidence ?? 1,
        now,
        now,
      );
    const row = this.db.prepare("SELECT rowid FROM memories WHERE id = ?").get(id) as { rowid?: number } | undefined;
    const rowid = Number(row?.rowid);
    this.db
      .prepare("INSERT INTO memories_fts(rowid, title, content, tags) VALUES (?, ?, ?, ?)")
      .run(rowid, input.title.trim(), input.content, serializeTags(input.tags));
    return this.get(id)!;
  }

  upsertByTitle(input: MemoryCreateInput): MemoryEntry {
    const existing = this.getByTitle(input.title, input.scope);
    if (!existing) {
      return this.create(input);
    }
    return this.update(existing.id, input)!;
  }

  update(id: string, input: MemoryUpdateInput): MemoryEntry | undefined {
    const existing = this.get(id);
    if (!existing) {
      return undefined;
    }

    const next = {
      title: input.title?.trim() || existing.title,
      content: input.content ?? existing.content,
      category: input.category ?? existing.category,
      scope: input.scope ?? existing.scope,
      tags: input.tags ?? existing.tags,
      source: input.source ?? existing.source,
      confidence: input.confidence ?? existing.confidence,
    };
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE memories
         SET title = ?, content = ?, category = ?, scope = ?, tags = ?, source = ?, confidence = ?, updated_at = ?, deleted_at = NULL
         WHERE id = ?`,
      )
      .run(
        next.title,
        next.content,
        next.category,
        next.scope,
        serializeTags(next.tags),
        next.source,
        next.c
... (truncated)
```
