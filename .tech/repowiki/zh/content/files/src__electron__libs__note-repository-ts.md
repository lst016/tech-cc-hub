# src/electron/libs/note-repository.ts

> 模块：`electron` · 语言：`typescript` · 行数：82

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 运行信号

- `create table: notes`

## 关键符号

- `NoteRepository@3`
- `rows@26`
- `row@33`
- `now@40`
- `id@41`
- `existing@51`
- `now@53`
- `title@55`
- `content@56`
- `existing@66`

## 依赖输入

- `better-sqlite3`
- `./note-types.js`

## 对外暴露

- `NoteRepository`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import Database from "better-sqlite3";
import type { Note, NoteCreateInput, NoteUpdateInput } from "./note-types.js";

export class NoteRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
    `);
  }

  list(): Note[] {
    const rows = this.db
      .prepare("SELECT * FROM notes ORDER BY updated_at DESC")
      .all() as Record<string, unknown>[];
    return rows.map((r) => this.rowToNote(r));
  }

  get(id: string): Note | undefined {
    const row = this.db
      .prepare("SELECT * FROM notes WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToNote(row) : undefined;
  }

  create(input: NoteCreateInput): Note {
    const now = Date.now();
    const id = crypto.randomUUID();
    this.db
      .prepare(
        "INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(id, input.title, input.content, now, now);
    return { id, title: input.title, content: input.content, createdAt: now, updatedAt: now };
  }

  update(id: string, input: NoteUpdateInput): Note | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;

    const now = Date.now();
    const title = input.title ?? existing.title;
    const content = input.content ?? existing.content;

    this.db
      .prepare("UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?")
      .run(title, content, now, id);

    return { ...existing, title, content, updatedAt: now };
  }

  delete(id: string): Note | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    this.db.prepare("DELETE FROM notes WHERE id = ?").run(id);
    return existing;
  }

  private rowToNote(row: Record<string, unknown>): Note {
    return {
      id: row.id as string,
      title: row.title as string,
      content: row.content as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }
}

```
