# pro-workflow/src/db/schema.sql

> 模块：`pro-workflow` · 语言：`sql` · 行数：169

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```sql
-- Pro-Workflow Database Schema
-- SQLite with FTS5 for searchable learnings

-- Main learnings table
CREATE TABLE IF NOT EXISTS learnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now')),
  project TEXT,
  category TEXT NOT NULL,
  rule TEXT NOT NULL,
  mistake TEXT,
  correction TEXT,
  times_applied INTEGER DEFAULT 0
);

-- Full-text search index using FTS5 with BM25
CREATE VIRTUAL TABLE IF NOT EXISTS learnings_fts USING fts5(
  category,
  rule,
  mistake,
  correction,
  content=learnings,
  content_rowid=id
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS learnings_ai AFTER INSERT ON learnings BEGIN
  INSERT INTO learnings_fts(rowid, category, rule, mistake, correction)
  VALUES (new.id, new.category, new.rule, new.mistake, new.correction);
END;

CREATE TRIGGER IF NOT EXISTS learnings_ad AFTER DELETE ON learnings BEGIN
  INSERT INTO learnings_fts(learnings_fts, rowid, category, rule, mistake, correction)
  VALUES ('delete', old.id, old.category, old.rule, old.mistake, old.correction);
END;

CREATE TRIGGER IF NOT EXISTS learnings_au AFTER UPDATE ON learnings BEGIN
  INSERT INTO learnings_fts(learnings_fts, rowid, category, rule, mistake, correction)
  VALUES ('delete', old.id, old.category, old.rule, old.mistake, old.correction);
  INSERT INTO learnings_fts(rowid, category, rule, mistake, correction)
  VALUES (new.id, new.category, new.rule, new.mistake, new.correction);
END;

-- Sessions table for analytics
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT,
  edit_count INTEGER DEFAULT 0,
  corrections_count INTEGER DEFAULT 0,
  prompts_count INTEGER DEFAULT 0
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category);
CREATE INDEX IF NOT EXISTS idx_learnings_project ON learnings(project);
CREATE INDEX IF NOT EXISTS idx_learnings_created_at ON learnings(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);

-- Wiki knowledge base (Phase 3.3.0)
-- slug is the natural id used everywhere (FKs, CLI, hooks). To avoid silent
-- overwrites when two wikis share a slug across different (scope, root_path)
-- locations, upsertWiki() guards on those columns at the application layer
-- and refuses to overwrite a registration that points at a different location.
CREATE TABLE IF NOT EXISTS wikis (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  flavor TEXT NOT NULL DEFAULT 'research',
  root_path TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global',
  auto_research INTEGER NOT NULL DEFAULT 0,
  private INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wiki_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wiki_slug TEXT NOT NULL REFERENCES wikis(slug) ON DELETE CASCADE,
  rel_path TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  page_type TEXT,
  content_hash TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(wiki_slug, rel_path)
);

CREATE TABLE IF NOT EXISTS wiki_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wiki_slug TEXT NOT NULL REFERENCES wikis(slug) ON DELETE CASCADE,
  url TEXT,
  title TEXT,
  fetched_at TEXT DEFAULT (datetime('now')),
  content_hash TEXT,
  fetcher TEXT,
  UNIQUE(wiki_slug, content_hash)
);

CREATE TABLE IF NOT EXISTS wiki_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES wiki_sources(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  confidence REAL DEFAULT 0.8,
  last_verified_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wiki_seeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wiki_slug TEXT NOT NULL REFERENCES wikis(slug) ON DELETE CASCADE,
  query TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  parent_id INTEGER REFERENCES wiki_seeds(id) ON DELETE SET NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREAT
... (truncated)
```
