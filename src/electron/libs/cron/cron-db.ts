// Source: CV from AionUi CronStore.ts (385 lines) + skill-manager/db.ts pattern
// Adapted for tech-cc-hub: standalone cron.db, better-sqlite3 directly, no getDatabase() abstraction

import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import type { CronJob, CronJobRow, CronJobRun, CronJobRunRow, CronJobRunStatus, CronJobRunTrigger } from "./cron-types.js";

let db: Database.Database | null = null;

// H-6: schema 版本号；未来加表/列只需追加 MIGRATIONS 数组元素
//   v1: 初始 (cron_jobs + cron_job_runs + paused 列兼容 ALTER)
const SCHEMA_VERSION = 1;
const MIGRATIONS: Array<(database: Database.Database) => void> = [
  // v1: 初始 schema + paused 列兼容老库
  (d) => {
    d.exec(`
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

    -- 单次执行历史：每次 fire / 手动触发 / 启动追补都写一行
    -- SPEC §4.2；保留 AionUi 适配注释
    CREATE TABLE IF NOT EXISTS cron_job_runs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      status TEXT NOT NULL,            -- 'running' | 'ok' | 'error' | 'skipped' | 'missed'
      error TEXT,
      duration_ms INTEGER,
      tokens_in INTEGER,
      tokens_out INTEGER,
      conversation_id TEXT,            -- 本次执行实际写入的会话 ID
      trigger_source TEXT,             -- 'schedule' | 'manual' | 'catchup'
      FOREIGN KEY (job_id) REFERENCES cron_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_job_runs(job_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cron_runs_status ON cron_job_runs(status, started_at);
  `);
    // paused 列兼容老库
    const cols = d.prepare("PRAGMA table_info(cron_jobs)").all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "paused")) {
      d.exec("ALTER TABLE cron_jobs ADD COLUMN paused INTEGER NOT NULL DEFAULT 0");
    }
  },
  // 未来示例：
  // (d) => d.exec("ALTER TABLE cron_jobs ADD COLUMN ...")
];

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
  const row = database.prepare("PRAGMA user_version").get() as { user_version: number } | undefined;
  const current = row?.user_version ?? 0;
  for (let v = current + 1; v <= SCHEMA_VERSION; v++) {
    const fn = MIGRATIONS[v - 1];
    if (fn) fn(database);
  }
  if (current !== SCHEMA_VERSION) {
    database.prepare(`PRAGMA user_version = ${SCHEMA_VERSION}`).run();
  }
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
    paused: job.state.paused ? 1 : 0,
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
      paused: row.paused === 1,
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
      run_count = ?, retry_count = ?, max_retries = ?, paused = ?
    WHERE id = ?
  `).run(
    row.name, row.description, row.enabled,
    row.schedule_kind, row.schedule_value, row.schedule_tz, row.schedule_description,
    row.payload_message, row.execution_mode, row.agent_config,
    row.conversation_id, row.conversation_title, row.agent_type,
    row.updated_at,
    row.next_run_at, row.last_run_at, row.last_status, row.last_error,
    row.run_count, row.retry_count, row.max_retries, row.paused,
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

// ── cron_job_runs CRUD（CV from AionUi CronStore.ts 模式）──

// 插入一条执行记录（执行开始时 status='running'；结束时由 updateCronRun 补全）
export function insertCronRun(run: CronJobRun): void {
  const database = getCronDb();
  database.prepare(`
    INSERT INTO cron_job_runs (
      id, job_id, started_at, finished_at, status, error,
      duration_ms, tokens_in, tokens_out, conversation_id, trigger_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    run.id,
    run.jobId,
    run.startedAt,
    run.finishedAt ?? null,
    run.status,
    run.error ?? null,
    run.durationMs ?? null,
    run.tokensIn ?? null,
    run.tokensOut ?? null,
    run.conversationId ?? null,
    run.triggerSource,
  );
}

// 列出某 job 的执行历史，按 started_at DESC；limit 默认 50
export function listCronRuns(jobId: string, limit = 50): CronJobRun[] {
  const database = getCronDb();
  const rows = database.prepare(`
    SELECT * FROM cron_job_runs
    WHERE job_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `).all(jobId, limit) as CronJobRunRow[];
  return rows.map(rowToRun);
}

// 局部更新一条执行记录（执行结束时调用，传入 runId + 任意 patch 字段）
export function updateCronRun(
  runId: string,
  updates: {
    finishedAt?: number;
    status?: CronJobRunStatus;
    error?: string;
    durationMs?: number;
    tokensIn?: number;
    tokensOut?: number;
    conversationId?: string;
  },
): void {
  const database = getCronDb();
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.finishedAt !== undefined) {
    sets.push("finished_at = ?");
    values.push(updates.finishedAt);
  }
  if (updates.status !== undefined) {
    sets.push("status = ?");
    values.push(updates.status);
  }
  if (updates.error !== undefined) {
    sets.push("error = ?");
    values.push(updates.error);
  }
  if (updates.durationMs !== undefined) {
    sets.push("duration_ms = ?");
    values.push(updates.durationMs);
  }
  if (updates.tokensIn !== undefined) {
    sets.push("tokens_in = ?");
    values.push(updates.tokensIn);
  }
  if (updates.tokensOut !== undefined) {
    sets.push("tokens_out = ?");
    values.push(updates.tokensOut);
  }
  if (updates.conversationId !== undefined) {
    sets.push("conversation_id = ?");
    values.push(updates.conversationId);
  }

  if (sets.length === 0) return;
  values.push(runId);

  database.prepare(`
    UPDATE cron_job_runs SET ${sets.join(", ")} WHERE id = ?
  `).run(...values);
}

// 列出卡死的执行记录：status='running' 且 started_at 早于 cutoffMs 之前
// 给 SPEC §F-07 stuck job watchdog 用，stuck 阈值默认 10 分钟
export function getStuckRuns(cutoffMs: number, triggerSource?: CronJobRunTrigger): CronJobRun[] {
  const database = getCronDb();
  const rows = triggerSource
    ? database.prepare(`
        SELECT * FROM cron_job_runs
        WHERE status = 'running' AND started_at < ? AND trigger_source = ?
        ORDER BY started_at ASC
      `).all(cutoffMs, triggerSource) as CronJobRunRow[]
    : database.prepare(`
        SELECT * FROM cron_job_runs
        WHERE status = 'running' AND started_at < ?
        ORDER BY started_at ASC
      `).all(cutoffMs) as CronJobRunRow[];
  return rows.map(rowToRun);
}

// ── Row ↔ Run conversion ──

function rowToRun(row: CronJobRunRow): CronJobRun {
  return {
    id: row.id,
    jobId: row.job_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    status: row.status as CronJobRunStatus,
    error: row.error ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    tokensIn: row.tokens_in ?? undefined,
    tokensOut: row.tokens_out ?? undefined,
    conversationId: row.conversation_id ?? undefined,
    triggerSource: row.trigger_source as CronJobRunTrigger,
  };
}
