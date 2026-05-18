import Database from "better-sqlite3";
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
import { loadSqliteVecExtension } from "./sqlite-vec-loader.js";

type Row = Record<string, unknown>;

type RepositoryOptions = {
  embeddingDimension: number;
};

function overviewPriority(sourcePath: string, title: string): number {
  const normalized = sourcePath.replace(/\\/g, "/").toLowerCase();
  const normalizedTitle = title.toLowerCase();
  if (normalized.includes("/agent-cards/") || normalizedTitle.includes("agent card") || normalizedTitle.includes("agent 问答")) {
    return 12_000;
  }
  const curated: Array<[RegExp, number]> = [
    [/\/content\/index\.md$/, 10_000],
    [/\/content\/agent-playbook\.md$/, 9_800],
    [/\/content\/api-surface\.md$/, 9_700],
    [/\/content\/runtime-flows\.md$/, 9_600],
    [/\/content\/architecture\.md$/, 9_500],
    [/\/content\/reading-guide\.md$/, 9_400],
    [/\/content\/dependencies\.md$/, 9_300],
    [/\/modules\/knowledge-engine\/index\.md$/, 9_000],
    [/\/modules\/mcp-tools\/index\.md$/, 8_900],
    [/\/modules\/electron-runtime\/index\.md$/, 8_800],
    [/\/modules\/task-engine\/index\.md$/, 8_700],
    [/\/modules\/ui-shell\/index\.md$/, 8_600],
    [/\/modules\/session-engine\/index\.md$/, 8_500],
    [/\/modules\/[^/]+\/index\.md$/, 7_500],
  ];
  for (const [pattern, score] of curated) {
    if (pattern.test(normalized)) return score;
  }
  let score = 0;
  if (normalized.includes("/modules/knowledge-engine/files/")) score += 650;
  if (normalized.includes("/modules/mcp-tools/files/")) score += 580;
  if (normalized.includes("/modules/electron-runtime/files/")) score += 520;
  if (/(knowledge-indexer|knowledge-repository|knowledge-overview|knowledge-ui-store|repowiki|mcp-tools|runner|main)/.test(normalizedTitle)) {
    score += 450;
  }
  return score;
}

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
      loadSqliteVecExtension(this.db);
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

  upsertDocument(input: KnowledgeUpsertInput): KnowledgeDocument {
    const now = Date.now();
    const existing = this.db
      .prepare("SELECT * FROM knowledge_documents WHERE workspace_scope = ? AND source_kind = ? AND source_path = ?")
      .get(input.workspaceScope, input.sourceKind, input.sourcePath) as Row | undefined;
    const id = existing?.id ? String(existing.id) : crypto.randomUUID();
    const contentHash = stableHash(input.content);
    const tags = serializeTags(input.tags);
    const metadata = stringifyJsonObject(input.metadata);

    if (existing) {
      this.db
        .prepare(
          `UPDATE knowledge_documents
           SET title = ?, summary = ?, tags = ?, metadata = ?, content_hash = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(input.title, input.summary ?? null, tags, metadata, contentHash, now, id);
      this.deleteChunksForDocument(id);
    } else {
      this.db
        .prepare(
          `INSERT INTO knowledge_documents
            (id, workspace_scope, source_kind, source_path, title, summary, tags, metadata, content_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.workspaceScope,
          input.sourceKind,
          input.sourcePath,
          input.title,
          input.summary ?? null,
          tags,
          metadata,
          contentHash,
          now,
          now,
        );
    }

    for (const chunk of input.chunks) {
      const chunkId = crypto.randomUUID();
      const result = this.db
        .prepare(
          `INSERT INTO knowledge_chunks
            (id, document_id, workspace_scope, source_kind, source_path, title, content, chunk_index, token_estimate, metadata, embedding_model, embedding_dimension, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          chunkId,
          id,
          input.workspaceScope,
          input.sourceKind,
          input.sourcePath,
          input.title,
          chunk.content,
          chunk.chunkIndex,
          chunk.tokenEstimate,
          stringifyJsonObject(chunk.metadata),
          chunk.embeddingModel ?? null,
          chunk.embedding ? chunk.embedding.length : null,
          now,
          now,
        );
      const rowid = Number(result.lastInsertRowid);
      const chunkRow = this.db.prepare("SELECT rowid FROM knowledge_chunks WHERE id = ?").get(chunkId) as { rowid?: number } | undefined;
      const chunkRowid = Number(chunkRow?.rowid ?? rowid);
      this.db
        .prepare("INSERT INTO knowledge_chunks_fts(rowid, title, content, source_path, tags) VALUES (?, ?, ?, ?, ?)")
        .run(chunkRowid, input.title, chunk.content, input.sourcePath, tags);
      if (this.vectorAvailable && chunk.embedding) {
        this.upsertVector(chunkRowid, chunk.embedding);
      }
    }

    return this.getDocument(id)!;
  }

  deleteWorkspaceDocuments(workspaceScope: string, sourceKind?: KnowledgeSourceKind): number {
    const rows = this.db
      .prepare(
        `SELECT id FROM knowledge_documents
         WHERE workspace_scope = ? ${sourceKind ? "AND source_kind = ?" : ""}`,
      )
      .all(...(sourceKind ? [workspaceScope, sourceKind] : [workspaceScope])) as Array<{ id: string }>;

    for (const row of rows) {
      this.deleteDocument(row.id);
    }
    return rows.length;
  }

  listWorkspaceDocuments(workspaceScope: string, sourceKind?: KnowledgeSourceKind): KnowledgeDocument[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM knowledge_documents
         WHERE workspace_scope = ? ${sourceKind ? "AND source_kind = ?" : ""}
         ORDER BY source_path ASC`,
      )
      .all(...(sourceKind ? [workspaceScope, sourceKind] : [workspaceScope])) as Row[];
    return rows.map((row) => this.rowToDocument(row));
  }

  deleteWorkspaceDocumentsNotIn(workspaceScope: string, sourceKind: KnowledgeSourceKind, keepSourcePaths: Set<string>): number {
    const rows = this.db
      .prepare(
        `SELECT id, source_path
         FROM knowledge_documents
         WHERE workspace_scope = ? AND source_kind = ?`,
      )
      .all(workspaceScope, sourceKind) as Array<{ id: string; source_path: string }>;

    let deleted = 0;
    for (const row of rows) {
      if (!keepSourcePaths.has(String(row.source_path))) {
        this.deleteDocument(row.id);
        deleted += 1;
      }
    }
    return deleted;
  }

  getDocument(id: string): KnowledgeDocument | undefined {
    const row = this.db
      .prepare("SELECT * FROM knowledge_documents WHERE id = ?")
      .get(id) as Row | undefined;
    return row ? this.rowToDocument(row) : undefined;
  }

  getDocumentByPath(workspaceScope: string, sourcePath: string): KnowledgeDocument | undefined {
    const row = this.db
      .prepare("SELECT * FROM knowledge_documents WHERE workspace_scope = ? AND source_path = ? ORDER BY updated_at DESC LIMIT 1")
      .get(workspaceScope, sourcePath) as Row | undefined;
    return row ? this.rowToDocument(row) : undefined;
  }

  readDocumentChunks(documentId: string, limit = 20): Array<{ title: string; content: string; chunkIndex: number }> {
    const rows = this.db
      .prepare(
        `SELECT title, content, chunk_index
         FROM knowledge_chunks
         WHERE document_id = ?
         ORDER BY chunk_index ASC
         LIMIT ?`,
      )
      .all(documentId, limit) as Row[];
    return rows.map((row) => ({
      title: String(row.title),
      content: String(row.content),
      chunkIndex: Number(row.chunk_index),
    }));
  }

  search(options: {
    workspaceScope: string;
    query: string;
    mode: KnowledgeSearchMode;
    limit: number;
    sourceKind?: KnowledgeSourceKind;
    queryEmbedding?: number[];
  }): KnowledgeSearchResult[] {
    const limit = Math.max(1, Math.min(50, Math.floor(options.limit)));
    if (options.mode !== "shallow" && this.vectorAvailable && options.queryEmbedding) {
      const vectorRows = this.searchVector(options.workspaceScope, options.queryEmbedding, limit, options.sourceKind);
      if (options.mode === "deep" || vectorRows.length >= limit) {
        return vectorRows;
      }
      const seen = new Set(vectorRows.map((row) => row.chunkId));
      const ftsRows = this.searchFts(options.workspaceScope, options.query, limit, options.sourceKind)
        .filter((row) => !seen.has(row.chunkId));
      return [...vectorRows, ...ftsRows].slice(0, limit);
    }

    return this.searchFts(options.workspaceScope, options.query, limit, options.sourceKind);
  }

  buildOverview(workspaceScope: string, maxItems = 30): KnowledgeOverviewEntry[] {
    const scanLimit = Math.max(maxItems * 100, 5_000);
    const rows = this.db
      .prepare(
        `SELECT source_kind, title, source_path, updated_at
         FROM knowledge_documents
         WHERE workspace_scope = ?
         ORDER BY updated_at DESC
         LIMIT ?`,
      )
      .all(workspaceScope, scanLimit) as Row[];
    return rows
      .map((row) => ({
        category: String(row.source_kind) as KnowledgeSourceKind,
        title: String(row.title),
        sourcePath: String(row.source_path),
        updatedAt: Number(row.updated_at),
      }))
      .sort((left, right) => (
        overviewPriority(right.sourcePath, right.title) - overviewPriority(left.sourcePath, left.title)
        || right.updatedAt - left.updatedAt
        || left.sourcePath.localeCompare(right.sourcePath)
      ))
      .slice(0, maxItems);
  }

  recordIndexRun(workspaceScope: string, mode: string, status: string, report: unknown): void {
    this.db
      .prepare(
        `INSERT INTO knowledge_index_runs (id, workspace_scope, mode, status, report, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(crypto.randomUUID(), workspaceScope, mode, status, JSON.stringify(report), Date.now());
  }

  private searchFts(
    workspaceScope: string,
    query: string,
    limit: number,
    sourceKind?: KnowledgeSourceKind,
  ): KnowledgeSearchResult[] {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }

    const ftsQuery = normalizedQuery
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term.replace(/"/g, "\"\"")}"`)
      .join(" OR ");
    const rows = this.db
      .prepare(
        `SELECT c.id AS chunk_id, c.document_id, c.title, c.source_kind, c.source_path, c.content,
                c.updated_at, bm25(knowledge_chunks_fts) AS rank
         FROM knowledge_chunks_fts
         JOIN knowledge_chunks c ON c.rowid = knowledge_chunks_fts.rowid
         WHERE knowledge_chunks_fts MATCH ?
           AND c.workspace_scope = ?
           ${sourceKind ? "AND c.source_kind = ?" : ""}
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .all(...(sourceKind ? [ftsQuery, workspaceScope, sourceKind, limit] : [ftsQuery, workspaceScope, limit])) as Row[];
    return rows.map((row) => this.rowToSearchResult(row, { score: 1 / (1 + Math.abs(Number(row.rank ?? 0))) }));
  }

  private searchVector(
    workspaceScope: string,
    queryEmbedding: number[],
    limit: number,
    sourceKind?: KnowledgeSourceKind,
  ): KnowledgeSearchResult[] {
    const rows = this.db
      .prepare(
        `SELECT c.id AS chunk_id, c.document_id, c.title, c.source_kind, c.source_path, c.content,
                c.updated_at, v.distance
         FROM knowledge_chunk_vectors v
         JOIN knowledge_chunks c ON c.rowid = v.chunk_rowid
         WHERE v.embedding MATCH ?
           AND k = ?
           AND c.workspace_scope = ?
           ${sourceKind ? "AND c.source_kind = ?" : ""}
         ORDER BY v.distance ASC
         LIMIT ?`,
      )
      .all(...(sourceKind
        ? [JSON.stringify(queryEmbedding), limit, workspaceScope, sourceKind, limit]
        : [JSON.stringify(queryEmbedding), limit, workspaceScope, limit])) as Row[];
    return rows.map((row) => {
      const distance = Number(row.distance ?? 0);
      return this.rowToSearchResult(row, { score: 1 / (1 + distance), vectorDistance: distance });
    });
  }

  private upsertVector(rowid: number, embedding: number[]): void {
    if (embedding.length !== this.embeddingDimension) {
      throw new Error(`embedding dimension mismatch: expected ${this.embeddingDimension}, got ${embedding.length}`);
    }
    const vector = Float32Array.from(embedding);
    const vectorBlob = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
    this.db
      .prepare("INSERT INTO knowledge_chunk_vectors(chunk_rowid, embedding) VALUES (CAST(? AS INTEGER), ?)")
      .run(Math.trunc(rowid), vectorBlob);
  }

  private deleteDocument(documentId: string): void {
    this.deleteChunksForDocument(documentId);
    this.db.prepare("DELETE FROM knowledge_documents WHERE id = ?").run(documentId);
  }

  private deleteChunksForDocument(documentId: string): void {
    const rows = this.db
      .prepare("SELECT rowid FROM knowledge_chunks WHERE document_id = ?")
      .all(documentId) as Array<{ rowid: number }>;
    for (const row of rows) {
      this.db.prepare("DELETE FROM knowledge_chunks_fts WHERE rowid = ?").run(row.rowid);
      if (this.vectorAvailable) {
        this.db.prepare("DELETE FROM knowledge_chunk_vectors WHERE chunk_rowid = ?").run(row.rowid);
      }
    }
    this.db.prepare("DELETE FROM knowledge_chunks WHERE document_id = ?").run(documentId);
  }

  private rowToDocument(row: Row): KnowledgeDocument {
    return {
      id: String(row.id),
      workspaceScope: String(row.workspace_scope),
      sourceKind: String(row.source_kind) as KnowledgeSourceKind,
      sourcePath: String(row.source_path),
      title: String(row.title),
      summary: row.summary ? String(row.summary) : undefined,
      tags: parseTags(row.tags),
      metadata: parseJsonObject(row.metadata),
      contentHash: String(row.content_hash),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  private rowToSearchResult(row: Row, scores: { score: number; vectorDistance?: number }): KnowledgeSearchResult {
    return {
      chunkId: String(row.chunk_id),
      documentId: String(row.document_id),
      title: String(row.title),
      sourceKind: String(row.source_kind) as KnowledgeSourceKind,
      sourcePath: String(row.source_path),
      content: compactWhitespace(String(row.content), 900),
      score: scores.score,
      vectorDistance: scores.vectorDistance,
      rank: typeof row.rank === "number" ? Number(row.rank) : undefined,
      updatedAt: Number(row.updated_at),
    };
  }
}
