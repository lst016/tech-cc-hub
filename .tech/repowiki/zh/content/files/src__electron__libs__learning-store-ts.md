# src/electron/libs/learning-store.ts

> 模块：`electron` · 语言：`typescript` · 行数：306

## 文件职责

学习纠正数据的SQLite存储，自动记录Agent的规则学习

## 运行信号

- `create table: learnings`
- `create table: learnings_sessions`
- `virtual table: learnings_fts`

## 关键符号

- `LearningStore@0 - 学习存储类，管理learnings表和learnings_sessions会话表`
- `addLearning@0 - 添加新的学习记录（规则、错误、纠正）`
- `getRecentLearnings@0 - 获取最近的学习记录，支持按项目过滤`
- `getApplicableLearnings@0 - 根据关键词获取适用的学习规则`
- `incrementTimesApplied@0 - 增加学习规则的命中次数统计`

## 依赖输入

- `better-sqlite3`

## 对外暴露

- `Learning`
- `LearningStoreOptions`
- `LearningStore`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import Database from "better-sqlite3";

export interface Learning {
  id: number;
  project: string | null;
  category: string;
  rule: string;
  mistake: string | null;
  correction: string | null;
  times_applied: number;
  created_at: number;
}

export interface LearningStoreOptions {
  dbPath: string;
}

export class LearningStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        project TEXT,
        category TEXT NOT NULL,
        rule TEXT NOT NULL,
        mistake TEXT,
        correction TEXT,
        times_applied INTEGER NOT NULL DEFAULT 0
      );
    `);

    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS learnings_fts USING fts5(
        category,
        rule,
        mistake,
        correction,
        content=learnings,
        content_rowid=id
      );
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS learnings_ai AFTER INSERT ON learnings BEGIN
        INSERT INTO learnings_fts(rowid, category, rule, mistake, correction)
        VALUES (new.id, new.category, new.rule, new.mistake, new.correction);
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS learnings_ad AFTER DELETE ON learnings BEGIN
        INSERT INTO learnings_fts(learnings_fts, rowid, category, rule, mistake, correction)
        VALUES ('delete', old.id, old.category, old.rule, old.mistake, old.correction);
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS learnings_au AFTER UPDATE ON learnings BEGIN
        INSERT INTO learnings_fts(learnings_fts, rowid, category, rule, mistake, correction)
        VALUES ('delete', old.id, old.category, old.rule, old.mistake, old.correction);
        INSERT INTO learnings_fts(rowid, category, rule, mistake, correction)
        VALUES (new.id, new.category, new.rule, new.mistake, new.correction);
      END;
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category);
      CREATE INDEX IF NOT EXISTS idx_learnings_project ON learnings(project);
      CREATE INDEX IF NOT EXISTS idx_learnings_created_at ON learnings(created_at);
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learnings_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        project TEXT,
        started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        ended_at INTEGER,
        edit_count INTEGER NOT NULL DEFAULT 0,
        corrections_count INTEGER NOT NULL DEFAULT 0,
        prompts_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_learnings_sessions_project ON learnings_sessions(project);
      CREATE INDEX IF NOT EXISTS idx_learnings_sessions_started_at ON learnings_sessions(started_at);
    `);
  }

  addLearning(learning: Omit<Learning, "id" | "times_applied" | "created_at">): Learning {
    const stmt = this.db.prepare(`
      INSERT INTO learnings (project, category, rule, mistake, correction)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      learning.project ?? null,
      learning.category,
      learning.rule,
      learning.mistake ?? null,
      learning.correction ?? null
    );
    return this.getLearning(Number(result.lastInsertRowid))!;
  }

  getLearning(id: number): Learning | undefined {
    const row = this.db.prepare("SELECT * FROM learnings WHERE id = ?").get(id) as Learning | undefined;
    return row;
  }

  getAllLearnings(project?: string): Learning[] {
    if (project) {
      return this.db.prepare(
        "SELECT * FROM learnings WHERE project = ? OR project IS NULL ORDER BY created_at DESC"
      ).all(project) as Learning[];
    }
    return this.db.prepare("SELECT * FROM learnings ORDER BY created_at DESC").all() as Learning[];
  }

  getRecentLearnings(limit = 5, project?: string): Learning[] {
    if (
... (truncated)
```
