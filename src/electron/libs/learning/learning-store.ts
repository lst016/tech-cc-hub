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
    if (project) {
      return this.db.prepare(
        "SELECT * FROM learnings WHERE project = ? OR project IS NULL ORDER BY created_at DESC LIMIT ?"
      ).all(project, limit) as Learning[];
    }
    return this.db.prepare("SELECT * FROM learnings ORDER BY created_at DESC LIMIT ?").all(limit) as Learning[];
  }

  searchLearnings(
    query: string,
    options: { limit?: number; project?: string; category?: string } = {}
  ): (Learning & { rank: number })[] {
    const { limit = 10, project, category } = options;
    const sanitizedQuery = this.sanitizeQuery(query);
    if (!sanitizedQuery) return [];

    let sql = `
      SELECT
        learnings.*,
        bm25(learnings_fts, 1.0, 2.0, 1.0, 1.0) as rank,
        snippet(learnings_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
      FROM learnings
      JOIN learnings_fts ON learnings.id = learnings_fts.rowid
      WHERE learnings_fts MATCH ?
    `;
    const params: (string | number)[] = [sanitizedQuery];

    if (project) {
      sql += ` AND (learnings.project = ? OR learnings.project IS NULL)`;
      params.push(project);
    }
    if (category) {
      sql += ` AND learnings.category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY rank LIMIT ?`;
    params.push(limit);

    return this.db.prepare(sql).all(...params) as (Learning & { rank: number; snippet?: string })[];
  }

  updateLearning(id: number, updates: Partial<Omit<Learning, "id" | "created_at">>): boolean {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (updates.category !== undefined) {
      fields.push("category = ?");
      values.push(updates.category);
    }
    if (updates.rule !== undefined) {
      fields.push("rule = ?");
      values.push(updates.rule);
    }
    if (updates.mistake !== undefined) {
      fields.push("mistake = ?");
      values.push(updates.mistake);
    }
    if (updates.correction !== undefined) {
      fields.push("correction = ?");
      values.push(updates.correction);
    }
    if (updates.times_applied !== undefined) {
      fields.push("times_applied = ?");
      values.push(updates.times_applied);
    }
    if (fields.length === 0) return false;
    values.push(id);
    const result = this.db.prepare(`UPDATE learnings SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    return result.changes > 0;
  }

  deleteLearning(id: number): boolean {
    const result = this.db.prepare("DELETE FROM learnings WHERE id = ?").run(id);
    return result.changes > 0;
  }

  incrementTimesApplied(id: number): void {
    this.db.prepare("UPDATE learnings SET times_applied = times_applied + 1 WHERE id = ?").run(id);
  }

  getMostAppliedLearnings(limit = 10): Learning[] {
    return this.db.prepare(
      "SELECT * FROM learnings WHERE times_applied > 0 ORDER BY times_applied DESC, created_at DESC LIMIT ?"
    ).all(limit) as Learning[];
  }

  getRelatedLearnings(learningId: number, limit = 5): (Learning & { rank: number })[] {
    const learning = this.getLearning(learningId);
    if (!learning) return [];
    const keywords = this.extractKeywords(learning.rule);
    if (keywords.length === 0) {
      return this.db.prepare(
        "SELECT * FROM learnings WHERE category = ? ORDER BY times_applied DESC, created_at DESC LIMIT ?"
      ).all(learning.category, limit) as (Learning & { rank: number })[];
    }
    const query = keywords.join(" OR ");
    const results = this.searchLearnings(query, { limit: limit + 1 });
    return results.filter(r => r.id !== learningId).slice(0, limit);
  }

  // Session stats (like pro-workflow sessions table)
  startSession(sessionId: string, project?: string): void {
    this.db.prepare(
      "INSERT INTO learnings_sessions (session_id, project) VALUES (?, ?)"
    ).run(sessionId, project ?? null);
  }

  endSession(sessionId: string): void {
    this.db.prepare(
      "UPDATE learnings_sessions SET ended_at = strftime('%s', 'now') WHERE session_id = ?"
    ).run(sessionId);
  }

  updateSessionCounts(sessionId: string, edits = 0, corrections = 0, prompts = 0): void {
    this.db.prepare(
      "UPDATE learnings_sessions SET edit_count = edit_count + ?, corrections_count = corrections_count + ?, prompts_count = prompts_count + ? WHERE session_id = ?"
    ).run(edits, corrections, prompts, sessionId);
  }

  getRecentSessions(limit = 10): Array<{
    id: number;
    session_id: string;
    project: string | null;
    started_at: number;
    ended_at: number | null;
    edit_count: number;
    corrections_count: number;
    prompts_count: number;
  }> {
    return this.db.prepare(
      "SELECT * FROM learnings_sessions ORDER BY started_at DESC LIMIT ?"
    ).all(limit) as any[];
  }

  close(): void {
    this.db.close();
  }

  private sanitizeQuery(query: string): string {
    const STOPWORDS = new Set([
      "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with",
      "is", "it", "this", "that", "be", "as", "at", "by", "are", "was", "were",
      "what", "which", "how", "why", "when", "where", "who", "about",
      "explain", "tell", "show", "find", "do", "does", "use", "using"
    ]);
    const trimmed = query.trim();
    if (!trimmed) return "";
    const tokens = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(t => t.length >= 2 && !STOPWORDS.has(t));
    if (!tokens.length) return "";
    return tokens.map(t => `"${t}"`).join(" ");
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "must", "shall", "can", "need", "to", "of",
      "in", "for", "on", "with", "at", "by", "from", "as", "into", "through",
      "during", "before", "after", "above", "below", "between", "under",
      "again", "further", "then", "once", "here", "there", "when", "where",
      "why", "how", "all", "each", "few", "more", "most", "other", "some",
      "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
      "very", "just", "and", "but", "if", "or", "because", "until", "while",
      "although", "though", "this", "that", "these", "those", "it", "its"
    ]);
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .slice(0, 5);
  }
}