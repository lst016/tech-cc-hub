import type Database from "better-sqlite3";
import type { Annotation, AnnotationInput } from "../../shared/annotation.js";

/**
 * 聊天消息评论/标注 (annotations) 的 SQLite 存储层。
 *
 * 复用 SessionStore 传入的 db 实例，不独立建库。
 * 用 create table if not exists 保证旧库自然升级（不做显式 migration）。
 */
export class AnnotationStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(
      `create table if not exists annotations (
        id text primary key,
        session_id text not null,
        message_id text not null,
        paragraph_index integer not null,
        start_offset integer not null,
        end_offset integer not null,
        anchor_text text not null,
        body text not null,
        created_at integer not null,
        updated_at integer not null
      )`,
    );
    this.db.exec(
      `create index if not exists annotations_message on annotations(session_id, message_id)`,
    );
    this.db.exec(
      `create index if not exists annotations_session on annotations(session_id, created_at)`,
    );
  }

  create(input: AnnotationInput): Annotation {
    const now = Date.now();
    const annotation: Annotation = {
      id: crypto.randomUUID(),
      sessionId: input.sessionId,
      messageId: input.messageId,
      paragraphIndex: input.paragraphIndex,
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      anchorText: input.anchorText,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `insert into annotations
          (id, session_id, message_id, paragraph_index, start_offset, end_offset, anchor_text, body, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        annotation.id,
        annotation.sessionId,
        annotation.messageId,
        annotation.paragraphIndex,
        annotation.startOffset,
        annotation.endOffset,
        annotation.anchorText,
        annotation.body,
        annotation.createdAt,
        annotation.updatedAt,
      );
    return annotation;
  }

  listByMessage(sessionId: string, messageId: string): Annotation[] {
    const rows = this.db
      .prepare(
        `select id, session_id, message_id, paragraph_index, start_offset, end_offset,
                anchor_text, body, created_at, updated_at
         from annotations
         where session_id = ? and message_id = ?
         order by created_at asc, id asc`,
      )
      .all(sessionId, messageId) as Array<Record<string, unknown>>;
    return rows.map(rowToAnnotation);
  }

  listBySession(sessionId: string): Annotation[] {
    const rows = this.db
      .prepare(
        `select id, session_id, message_id, paragraph_index, start_offset, end_offset,
                anchor_text, body, created_at, updated_at
         from annotations
         where session_id = ?
         order by created_at asc, id asc`,
      )
      .all(sessionId) as Array<Record<string, unknown>>;
    return rows.map(rowToAnnotation);
  }

  update(id: string, body: string): Annotation | null {
    const now = Date.now();
    const result = this.db
      .prepare(`update annotations set body = ?, updated_at = ? where id = ?`)
      .run(body, now, id);
    if (result.changes === 0) return null;
    return this.getById(id);
  }

  remove(id: string): boolean {
    const result = this.db.prepare(`delete from annotations where id = ?`).run(id);
    return result.changes > 0;
  }

  getById(id: string): Annotation | null {
    const row = this.db
      .prepare(
        `select id, session_id, message_id, paragraph_index, start_offset, end_offset,
                anchor_text, body, created_at, updated_at
         from annotations where id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToAnnotation(row) : null;
  }
}

function rowToAnnotation(row: Record<string, unknown>): Annotation {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    messageId: String(row.message_id),
    paragraphIndex: Number(row.paragraph_index),
    startOffset: Number(row.start_offset),
    endOffset: Number(row.end_offset),
    anchorText: String(row.anchor_text ?? ""),
    body: String(row.body ?? ""),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}
