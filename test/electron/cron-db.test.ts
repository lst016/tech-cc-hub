// 单测：cron_db schema + Row↔Job roundtrip + cron_job_runs CRUD
// 覆盖 SPEC §7.1 F-06 / §6.3 roundtrip 与 runs 表
// 风格：node:test + better-sqlite3 内存模式
// 注：cron-db.ts 强依赖 electron.app.getPath('userData')，不便直接 import；
//     本测试通过复刻 migration SQL + 同样的 Row↔Job 字段映射来验证数据完整性。
//     真实集成路径由 test:smoke + Electron 窗口 QA 覆盖。

import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import type { CronJob, CronJobRun, CronJobRunStatus, CronJobRunTrigger } from "../../src/electron/libs/cron/cron-types.js";

// ── Schema (mirror of cron-db.ts migrate) ──

const MIGRATION_SQL = `
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

  CREATE TABLE IF NOT EXISTS cron_job_runs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    status TEXT NOT NULL,
    error TEXT,
    duration_ms INTEGER,
    tokens_in INTEGER,
    tokens_out INTEGER,
    conversation_id TEXT,
    trigger_source TEXT,
    FOREIGN KEY (job_id) REFERENCES cron_jobs(id) ON DELETE CASCADE
  );
`;

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(MIGRATION_SQL);
  return db;
}

function jobToRow(job: CronJob) {
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

function rowToJob(row: any): CronJob {
  let schedule: CronJob["schedule"];
  switch (row.schedule_kind) {
    case "at":
      schedule = { kind: "at", atMs: Number(row.schedule_value), description: row.schedule_description };
      break;
    case "every":
      schedule = { kind: "every", everyMs: Number(row.schedule_value), description: row.schedule_description };
      break;
    default:
      schedule = { kind: "cron", expr: row.schedule_value, tz: row.schedule_tz ?? undefined, description: row.schedule_description };
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

function rowToRun(row: any): CronJobRun {
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

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: overrides.id ?? "cron_roundtrip_001",
    name: overrides.name ?? "日报",
    description: overrides.description,
    enabled: overrides.enabled ?? true,
    schedule: overrides.schedule ?? { kind: "cron", expr: "0 9 * * *", tz: "Asia/Shanghai", description: "每天9点" },
    target: overrides.target ?? { payload: { kind: "message", text: "ping" }, executionMode: "existing" },
    metadata: {
      conversationId: "conv_x",
      agentType: "claude",
      createdBy: "user",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      ...overrides.metadata,
    },
    state: {
      runCount: 0,
      retryCount: 0,
      maxRetries: 3,
      ...overrides.state,
    },
  } as CronJob;
}

function insertJob(db: Database.Database, job: CronJob): void {
  const r = jobToRow(job);
  db.prepare(`
    INSERT INTO cron_jobs (
      id, name, description, enabled,
      schedule_kind, schedule_value, schedule_tz, schedule_description,
      payload_message, execution_mode, agent_config,
      conversation_id, conversation_title, agent_type, created_by,
      created_at, updated_at,
      next_run_at, last_run_at, last_status, last_error,
      run_count, retry_count, max_retries
    ) VALUES (
      @id, @name, @description, @enabled,
      @schedule_kind, @schedule_value, @schedule_tz, @schedule_description,
      @payload_message, @execution_mode, @agent_config,
      @conversation_id, @conversation_title, @agent_type, @created_by,
      @created_at, @updated_at,
      @next_run_at, @last_run_at, @last_status, @last_error,
      @run_count, @retry_count, @max_retries
    )
  `).run(r);
}

function listAllJobs(db: Database.Database): CronJob[] {
  const rows = db.prepare("SELECT * FROM cron_jobs ORDER BY created_at DESC").all();
  return rows.map(rowToJob);
}

function insertRun(db: Database.Database, run: CronJobRun): void {
  db.prepare(`
    INSERT INTO cron_job_runs (
      id, job_id, started_at, finished_at, status, error,
      duration_ms, tokens_in, tokens_out, conversation_id, trigger_source
    ) VALUES (
      @id, @job_id, @started_at, @finished_at, @status, @error,
      @duration_ms, @tokens_in, @tokens_out, @conversation_id, @trigger_source
    )
  `).run({
    id: run.id,
    job_id: run.jobId,
    started_at: run.startedAt,
    finished_at: run.finishedAt ?? null,
    status: run.status,
    error: run.error ?? null,
    duration_ms: run.durationMs ?? null,
    tokens_in: run.tokensIn ?? null,
    tokens_out: run.tokensOut ?? null,
    conversation_id: run.conversationId ?? null,
    trigger_source: run.triggerSource,
  });
}

function listRuns(db: Database.Database, jobId: string, limit = 50): CronJobRun[] {
  const rows = db.prepare(`
    SELECT * FROM cron_job_runs WHERE job_id = ?
    ORDER BY started_at DESC LIMIT ?
  `).all(jobId, limit);
  return rows.map(rowToRun);
}

function updateRun(
  db: Database.Database,
  runId: string,
  updates: Partial<{
    finishedAt: number;
    status: CronJobRunStatus;
    error: string;
    durationMs: number;
    tokensIn: number;
    tokensOut: number;
    conversationId: string;
  }>,
): void {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (updates.finishedAt !== undefined) { sets.push("finished_at = ?"); values.push(updates.finishedAt); }
  if (updates.status !== undefined) { sets.push("status = ?"); values.push(updates.status); }
  if (updates.error !== undefined) { sets.push("error = ?"); values.push(updates.error); }
  if (updates.durationMs !== undefined) { sets.push("duration_ms = ?"); values.push(updates.durationMs); }
  if (updates.tokensIn !== undefined) { sets.push("tokens_in = ?"); values.push(updates.tokensIn); }
  if (updates.tokensOut !== undefined) { sets.push("tokens_out = ?"); values.push(updates.tokensOut); }
  if (updates.conversationId !== undefined) { sets.push("conversation_id = ?"); values.push(updates.conversationId); }
  if (sets.length === 0) return;
  values.push(runId);
  db.prepare(`UPDATE cron_job_runs SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

function getStuckRuns(db: Database.Database, cutoffMs: number, triggerSource?: CronJobRunTrigger): CronJobRun[] {
  const rows = triggerSource
    ? db.prepare(`
        SELECT * FROM cron_job_runs
        WHERE status = 'running' AND started_at < ? AND trigger_source = ?
        ORDER BY started_at ASC
      `).all(cutoffMs, triggerSource)
    : db.prepare(`
        SELECT * FROM cron_job_runs
        WHERE status = 'running' AND started_at < ?
        ORDER BY started_at ASC
      `).all(cutoffMs);
  return rows.map(rowToRun);
}

// ── 1. Row ↔ Job roundtrip ──

test("Row↔Job roundtrip: cron 表达式 + tz + agentConfig 完整保留", () => {
  const db = freshDb();
  const job = makeJob({
    schedule: { kind: "cron", expr: "0 9 * * *", tz: "Asia/Shanghai", description: "每天9点" },
    metadata: {
      conversationId: "conv_42",
      conversationTitle: "运维日报",
      agentType: "claude",
      createdBy: "agent",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_001_000,
      agentConfig: { backend: "claude", name: "claude-opus-4-6", mode: "claude-opus-4-6" },
    },
    state: {
      runCount: 5,
      retryCount: 1,
      maxRetries: 3,
      nextRunAtMs: 1_700_000_600_000,
      lastRunAtMs: 1_699_999_000_000,
      lastStatus: "ok",
      lastError: undefined,
    },
  });
  insertJob(db, job);
  const got = listAllJobs(db)[0];
  assert.equal(got.id, job.id);
  assert.equal(got.schedule.kind, "cron");
  assert.equal((got.schedule as { expr: string }).expr, "0 9 * * *");
  assert.equal((got.schedule as { tz?: string }).tz, "Asia/Shanghai");
  assert.equal(got.metadata.agentConfig?.name, "claude-opus-4-6");
  assert.equal(got.state.runCount, 5);
  assert.equal(got.state.lastStatus, "ok");
  assert.equal(got.metadata.conversationTitle, "运维日报");
});

test("Row↔Job roundtrip: every 间隔 + everyMs 数值类型", () => {
  const db = freshDb();
  const job = makeJob({
    schedule: { kind: "every", everyMs: 300_000, description: "每5分钟" },
    enabled: false,
  });
  insertJob(db, job);
  const got = listAllJobs(db)[0];
  assert.equal(got.schedule.kind, "every");
  assert.equal((got.schedule as { everyMs: number }).everyMs, 300_000);
  assert.equal(got.enabled, false);
});

test("Row↔Job roundtrip: at 时间戳 + new_conversation 模式", () => {
  const db = freshDb();
  const job = makeJob({
    schedule: { kind: "at", atMs: 1_800_000_000_000, description: "一次性" },
    target: { payload: { kind: "message", text: "提醒我" }, executionMode: "new_conversation" },
  });
  insertJob(db, job);
  const got = listAllJobs(db)[0];
  assert.equal(got.schedule.kind, "at");
  assert.equal((got.schedule as { atMs: number }).atMs, 1_800_000_000_000);
  assert.equal(got.target.executionMode, "new_conversation");
  assert.equal(got.target.payload.text, "提醒我");
});

// ── 2. cron_job_runs CRUD ──

test("cron_job_runs: insertCronRun + listCronRuns 按 started_at DESC", () => {
  const db = freshDb();
  const job = makeJob({ id: "j1" });
  insertJob(db, job);
  const base = 1_700_000_000_000;
  insertRun(db, { id: "r1", jobId: "j1", startedAt: base, status: "ok", triggerSource: "schedule", durationMs: 120 });
  insertRun(db, { id: "r2", jobId: "j1", startedAt: base + 1000, status: "error", triggerSource: "schedule", error: "boom", durationMs: 50 });
  insertRun(db, { id: "r3", jobId: "j1", startedAt: base + 2000, status: "running", triggerSource: "manual" });
  const runs = listRuns(db, "j1");
  assert.equal(runs.length, 3);
  assert.equal(runs[0].id, "r3");
  assert.equal(runs[1].id, "r2");
  assert.equal(runs[2].id, "r1");
  assert.equal(runs[1].error, "boom");
});

test("cron_job_runs: updateCronRun 局部更新 finished/status/tokens", () => {
  const db = freshDb();
  const job = makeJob({ id: "j1" });
  insertJob(db, job);
  insertRun(db, { id: "r1", jobId: "j1", startedAt: 1, status: "running", triggerSource: "schedule" });
  updateRun(db, "r1", { finishedAt: 1_000, status: "ok", durationMs: 999, tokensIn: 12, tokensOut: 34 });
  const got = listRuns(db, "j1")[0];
  assert.equal(got.finishedAt, 1_000);
  assert.equal(got.status, "ok");
  assert.equal(got.durationMs, 999);
  assert.equal(got.tokensIn, 12);
  assert.equal(got.tokensOut, 34);
});

test("cron_job_runs: getStuckRuns 过滤 cutoffMs 之前 + triggerSource", () => {
  const db = freshDb();
  const job = makeJob({ id: "j1" });
  insertJob(db, job);
  const now = 1_700_001_000_000;
  // 卡死: 11 分钟前，trigger=schedule
  insertRun(db, { id: "stuck1", jobId: "j1", startedAt: now - 11 * 60_000, status: "running", triggerSource: "schedule" });
  // 正常: 1 分钟前 running
  insertRun(db, { id: "fresh", jobId: "j1", startedAt: now - 60_000, status: "running", triggerSource: "schedule" });
  // 卡死但已完成 ok
  insertRun(db, { id: "oldOk", jobId: "j1", startedAt: now - 20 * 60_000, status: "ok", triggerSource: "schedule" });
  // 卡死但是 manual trigger
  insertRun(db, { id: "stuck2", jobId: "j1", startedAt: now - 15 * 60_000, status: "running", triggerSource: "manual" });

  // cutoff = 10 分钟前：应返回 stuck1 和 stuck2
  const all = getStuckRuns(db, now - 10 * 60_000);
  assert.equal(all.length, 2);
  assert.ok(all.some((r) => r.id === "stuck1"));
  assert.ok(all.some((r) => r.id === "stuck2"));

  // 加 triggerSource 过滤：只返回 schedule
  const onlySchedule = getStuckRuns(db, now - 10 * 60_000, "schedule");
  assert.equal(onlySchedule.length, 1);
  assert.equal(onlySchedule[0].id, "stuck1");
});
