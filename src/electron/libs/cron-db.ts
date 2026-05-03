// Source: CV from AionUi CronStore.ts (385 lines) + skill-manager/db.ts pattern
// Adapted for tech-cc-hub: standalone cron.db, better-sqlite3 directly, no getDatabase() abstraction

import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import type { CronJob, CronJobRow } from "./cron-types.js";

let db: Database.Database | null = null;

export function getCronDb(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath("userData");
    if (!existsSync(userDataPath)) mkdirSync(userDataPath, { recursive: true });
    const dbPath = join(userDataPath, "cron.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  }
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS cron_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      schedule_kind TEXT NOT NULL,
      schedule_value TEXT NOT NULL,
      schedule_tz TEXT,
      schedule_description TEXT NOT NULL DEFAULT '',
      payload_message TEXT NOT NULL DEFAULT '',
      execution_mode TEXT DEFAULT 'existing',
      agent_config TEXT,
      conversation_id TEXT NOT NULL DEFAULT '',
      conversation_title TEXT,
      agent_type TEXT NOT NULL DEFAULT 'claude',
      created_by TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      next_run_at INTEGER,
      last_run_at INTEGER,
      last_status TEXT,
      last_error TEXT,
      run_count INTEGER NOT NULL DEFAULT 0,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3
    );

    CREATE INDEX IF NOT EXISTS idx_cron_jobs_conversation ON cron_jobs(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run ON cron_jobs(next_run_at);
  `);
}

// ── Row ↔ Job conversion (CV from AionUi CronStore.ts) ──

function jobToRow(job: CronJob): CronJobRow {
  const { kind } = job.schedule;
  let scheduleValue: string;

  if (kind === "at") scheduleValue = String(job.schedule.atMs);
  else if (kind === "every") scheduleValue = String(job.schedule.everyMs);
  else scheduleValue = job.schedule.expr;

  return {
    id: job.id,
    name: job.name,
    description: job.description ?? null,
    enabled: job.enabled ? 1 : 0,
    schedule_kind: kind,
    schedule_value: scheduleValue,
    schedule_tz: kind === "cron" ? (job.schedule.tz ?? null) : null,
    schedule_description: job.schedule.description,
    payload_message: job.target.payload.text,
    execution_mode: job.target.executionMode ?? "existing",
    agent_config: job.metadata.agentConfig ? JSON.stringify(job.metadata.agentConfig) : null,
    conversation_id: job.metadata.conversationId,
    conversation_title: job.metadata.conversationTitle ?? null,
    agent_type: job.metadata.agentType,
    created_by: job.metadata.createdBy,
    created_at: job.metadata.createdAt,
    updated_at: job.metadata.updatedAt,
    next_run_at: job.state.nextRunAtMs ?? null,
    last_run_at: job.state.lastRunAtMs ?? null,
    last_status: job.state.lastStatus ?? null,
    last_error: job.state.lastError ?? null,
    run_count: job.state.runCount,
    retry_count: job.state.retryCount,
    max_retries: job.state.maxRetries,
  };
}

function rowToJob(row: CronJobRow): CronJob {
  let schedule: CronJob["schedule"];

  switch (row.schedule_kind) {
    case "at":
      schedule = { kind: "at", atMs: Number(row.schedule_value), description: row.schedule_description };
      break;
    case "every":
      schedule = { kind: "every", everyMs: Number(row.schedule_value), description: row.schedule_description };
      break;
    case "cron":
    default:
      schedule = { kind: "cron", expr: row.schedule_value, tz: row.schedule_tz ?? undefined, description: row.schedule_description };
      break;
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    enabled: row.enabled === 1,
    schedule,
    target: {
      payload: { kind: "message", text: row.payload_message },
      executionMode: (row.execution_mode as "existing" | "new_conversation") ?? "existing",
    },
    metadata: {
      conversationId: row.conversation_id,
      conversationTitle: row.conversation_title ?? undefined,
      agentType: row.agent_type,
      createdBy: row.created_by as "user" | "agent",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      agentConfig: row.agent_config ? JSON.parse(row.agent_config) : undefined,
    },
    state: {
      nextRunAtMs: row.next_run_at ?? undefined,
      lastRunAtMs: row.last_run_at ?? undefined,
      lastStatus: (row.last_status as "ok" | "error" | "skipped" | "missed") ?? undefined,
      lastError: row.last_error ?? undefined,
      runCount: row.run_count,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
    },
  };
}

// ── CRUD operations (CV from AionUi CronStore.ts) ──

export function insertCronJob(job: CronJob): void {
  const database = getCronDb();
  const row = jobToRow(job);
  database.prepare(`
    INSERT INTO cron_jobs (
      id, name, description, enabled,
      schedule_kind, schedule_value, schedule_tz, schedule_description,
      payload_message, execution_mode, agent_config,
      conversation_id, conversation_title, agent_type, created_by,
      created_at, updated_at,
      next_run_at, last_run_at, last_status, last_error,
      run_count, retry_count, max_retries
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.id, row.name, row.description, row.enabled,
    row.schedule_kind, row.schedule_value, row.schedule_tz, row.schedule_description,
    row.payload_message, row.execution_mode, row.agent_config,
    row.conversation_id, row.conversation_title, row.agent_type, row.created_by,
    row.created_at, row.updated_at,
    row.next_run_at, row.last_run_at, row.last_status, row.last_error,
    row.run_count, row.retry_count, row.max_retries,
  );
}

export function updateCronJob(jobId: string, updates: Partial<CronJob>): void {
  const existing = getCronJobById(jobId);
  if (!existing) return;

  const updated: CronJob = {
    ...existing,
    ...updates,
    metadata: { ...existing.metadata, ...updates.metadata, updatedAt: Date.now() },
    state: { ...existing.state, ...updates.state },
  };
  if (updates.schedule) updated.schedule = updates.schedule;

  const row = jobToRow(updated);
  const database = getCronDb();
  database.prepare(`
    UPDATE cron_jobs SET
      name = ?, description = ?, enabled = ?,
      schedule_kind = ?, schedule_value = ?, schedule_tz = ?, schedule_description = ?,
      payload_message = ?, execution_mode = ?, agent_config = ?,
      conversation_id = ?, conversation_title = ?, agent_type = ?,
      updated_at = ?,
      next_run_at = ?, last_run_at = ?, last_status = ?, last_error = ?,
      run_count = ?, retry_count = ?, max_retries = ?
    WHERE id = ?
  `).run(
    row.name, row.description, row.enabled,
    row.schedule_kind, row.schedule_value, row.schedule_tz, row.schedule_description,
    row.payload_message, row.execution_mode, row.agent_config,
    row.conversation_id, row.conversation_title, row.agent_type,
    row.updated_at,
    row.next_run_at, row.last_run_at, row.last_status, row.last_error,
    row.run_count, row.retry_count, row.max_retries,
    jobId,
  );
}

export function deleteCronJob(jobId: string): void {
  const database = getCronDb();
  database.prepare("DELETE FROM cron_jobs WHERE id = ?").run(jobId);
}

export function getCronJobById(jobId: string): CronJob | null {
  const database = getCronDb();
  const row = database.prepare("SELECT * FROM cron_jobs WHERE id = ?").get(jobId) as CronJobRow | undefined;
  return row ? rowToJob(row) : null;
}

export function listAllCronJobs(): CronJob[] {
  const database = getCronDb();
  const rows = database.prepare("SELECT * FROM cron_jobs ORDER BY created_at DESC").all() as CronJobRow[];
  return rows.map(rowToJob);
}

export function listCronJobsByConversation(conversationId: string): CronJob[] {
  const database = getCronDb();
  const rows = database.prepare("SELECT * FROM cron_jobs WHERE conversation_id = ? ORDER BY created_at DESC").all(conversationId) as CronJobRow[];
  return rows.map(rowToJob);
}

export function listEnabledCronJobs(): CronJob[] {
  const database = getCronDb();
  const rows = database.prepare("SELECT * FROM cron_jobs WHERE enabled = 1 ORDER BY next_run_at ASC").all() as CronJobRow[];
  return rows.map(rowToJob);
}

export function deleteCronJobsByConversation(conversationId: string): number {
  const database = getCronDb();
  const result = database.prepare("DELETE FROM cron_jobs WHERE conversation_id = ?").run(conversationId);
  return result.changes;
}
