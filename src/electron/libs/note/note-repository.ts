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
