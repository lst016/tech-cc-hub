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
        next.confidence,
        now,
        id,
      );
    const row = this.db.prepare("SELECT rowid FROM memories WHERE id = ?").get(id) as { rowid?: number } | undefined;
    const rowid = Number(row?.rowid);
    this.db.prepare("DELETE FROM memories_fts WHERE rowid = ?").run(rowid);
    this.db
      .prepare("INSERT INTO memories_fts(rowid, title, content, tags) VALUES (?, ?, ?, ?)")
      .run(rowid, next.title, next.content, serializeTags(next.tags));
    return this.get(id);
  }

  softDelete(id: string): boolean {
    const now = Date.now();
    const row = this.db.prepare("SELECT rowid FROM memories WHERE id = ?").get(id) as { rowid?: number } | undefined;
    if (!row) {
      return false;
    }
    this.db.prepare("UPDATE memories SET deleted_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
    this.db.prepare("DELETE FROM memories_fts WHERE rowid = ?").run(row.rowid);
    return true;
  }

  get(id: string): MemoryEntry | undefined {
    const row = this.db
      .prepare("SELECT * FROM memories WHERE id = ? AND deleted_at IS NULL")
      .get(id) as Row | undefined;
    return row ? this.rowToMemory(row) : undefined;
  }

  getByTitle(title: string, scope: MemoryScope): MemoryEntry | undefined {
    const row = this.db
      .prepare("SELECT * FROM memories WHERE title = ? AND scope = ? AND deleted_at IS NULL")
      .get(title.trim(), scope) as Row | undefined;
    return row ? this.rowToMemory(row) : undefined;
  }

  search(options: {
    query: string;
    workspaceScope?: MemoryScope;
    categories?: MemoryCategory[];
    mode: MemorySearchMode;
    limit: number;
  }): MemorySearchResult[] {
    const limit = Math.max(1, Math.min(50, Math.floor(options.limit)));
    const scopes = options.workspaceScope ? ["global", options.workspaceScope] : ["global"];
    const categories = options.categories ?? [];

    if (options.mode === "explore") {
      return this.explore(scopes, categories, limit);
    }

    if (options.mode === "fetch") {
      const rows = this.db
        .prepare(
          `SELECT * FROM memories
           WHERE deleted_at IS NULL
             AND scope IN (${scopes.map(() => "?").join(",")})
             ${categories.length > 0 ? `AND category IN (${categories.map(() => "?").join(",")})` : ""}
             AND title = ?
           ORDER BY updated_at DESC
           LIMIT ?`,
        )
        .all(...scopes, ...categories, options.query.trim(), limit) as Row[];
      return rows.map((row) => this.rowToSearchResult(row, true, 1));
    }

    const ftsQuery = options.query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term.replace(/"/g, "\"\"")}"`)
      .join(" OR ");
    if (!ftsQuery) {
      return [];
    }

    const rows = this.db
      .prepare(
        `SELECT m.*, bm25(memories_fts) AS rank
         FROM memories_fts
         JOIN memories m ON m.rowid = memories_fts.rowid
         WHERE memories_fts MATCH ?
           AND m.deleted_at IS NULL
           AND m.scope IN (${scopes.map(() => "?").join(",")})
           ${categories.length > 0 ? `AND m.category IN (${categories.map(() => "?").join(",")})` : ""}
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .all(ftsQuery, ...scopes, ...categories, limit) as Row[];
    return rows.map((row) => this.rowToSearchResult(row, options.mode === "deep", 1 / (1 + Math.abs(Number(row.rank ?? 0)))));
  }

  buildOverview(workspaceScope?: MemoryScope, maxItems = 30): MemoryOverviewEntry[] {
    const scopes = workspaceScope ? ["global", workspaceScope] : ["global"];
    const rows = this.db
      .prepare(
        `SELECT category, title, tags, scope, updated_at
         FROM memories
         WHERE deleted_at IS NULL
           AND scope IN (${scopes.map(() => "?").join(",")})
         ORDER BY access_count DESC, updated_at DESC
         LIMIT ?`,
      )
      .all(...scopes, maxItems) as Row[];
    return rows.map((row) => ({
      category: String(row.category) as MemoryCategory,
      title: String(row.title),
      tags: parseTags(row.tags),
      scope: String(row.scope) as MemoryScope,
      updatedAt: Number(row.updated_at),
    }));
  }

  listAll(workspaceScope?: MemoryScope): MemoryEntry[] {
    const scopes = workspaceScope ? ["global", workspaceScope] : ["global"];
    const rows = this.db
      .prepare(
        `SELECT *
         FROM memories
         WHERE deleted_at IS NULL
           AND scope IN (${scopes.map(() => "?").join(",")})
         ORDER BY updated_at DESC`,
      )
      .all(...scopes) as Row[];
    return rows.map((row) => this.rowToMemory(row));
  }

  recordAccess(id: string): void {
    this.db
      .prepare("UPDATE memories SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?")
      .run(Date.now(), id);
  }

  private explore(scopes: string[], categories: MemoryCategory[], limit: number): MemorySearchResult[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM memories
         WHERE deleted_at IS NULL
           AND scope IN (${scopes.map(() => "?").join(",")})
           ${categories.length > 0 ? `AND category IN (${categories.map(() => "?").join(",")})` : ""}
         ORDER BY category ASC, updated_at DESC
         LIMIT ?`,
      )
      .all(...scopes, ...categories, limit) as Row[];
    return rows.map((row) => this.rowToSearchResult(row, false, 1));
  }

  private rowToMemory(row: Row): MemoryEntry {
    return {
      id: String(row.id),
      title: String(row.title),
      content: String(row.content),
      category: String(row.category) as MemoryCategory,
      scope: String(row.scope) as MemoryScope,
      tags: parseTags(row.tags),
      source: (String(row.source) || "agent") as MemoryEntry["source"],
      confidence: Number(row.confidence),
      accessCount: Number(row.access_count),
      lastAccessedAt: typeof row.last_accessed_at === "number" ? Number(row.last_accessed_at) : undefined,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      deletedAt: typeof row.deleted_at === "number" ? Number(row.deleted_at) : undefined,
    };
  }

  private rowToSearchResult(row: Row, includeContent: boolean, score: number): MemorySearchResult {
    return {
      id: String(row.id),
      title: String(row.title),
      content: includeContent ? String(row.content) : undefined,
      snippet: includeContent ? undefined : compact(String(row.content), 500),
      category: String(row.category) as MemoryCategory,
      scope: String(row.scope) as MemoryScope,
      tags: parseTags(row.tags),
      score,
      updatedAt: Number(row.updated_at),
    };
  }
}
