# src/electron/libs/cron-db.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：240

## 文件职责

源码文件。运行信号：create table: cron_jobs；依赖：better-sqlite3、electron、path、fs、./cron-types.js

## 运行信号

- `create table: cron_jobs`

## 关键符号

- `getCronDb@11 - create table: cron_jobs`
- `migrate@24 - create table: cron_jobs`
- `jobToRow@60 - create table: cron_jobs`
- `rowToJob@96 - create table: cron_jobs`
- `insertCronJob@145 - create table: cron_jobs`
- `updateCronJob@169 - create table: cron_jobs`
- `deleteCronJob@205 - create table: cron_jobs`
- `getCronJobById@210 - create table: cron_jobs`
- `listAllCronJobs@216 - create table: cron_jobs`
- `listCronJobsByConversation@222 - create table: cron_jobs`
- `listEnabledCronJobs@228 - create table: cron_jobs`
- `deleteCronJobsByConversation@234 - create table: cron_jobs`
- `userDataPath@14 - create table: cron_jobs`
- `dbPath@16 - create table: cron_jobs`
- `database@147 - create table: cron_jobs`
- `row@148 - create table: cron_jobs`

## 依赖输入

- `better-sqlite3`
- `electron`
- `path`
- `fs`
- `./cron-types.js`

## 对外暴露

- `getCronDb`
- `insertCronJob`
- `updateCronJob`
- `deleteCronJob`
- `getCronJobById`
- `listAllCronJobs`
- `listCronJobsByConversation`
- `listEnabledCronJobs`
- `deleteCronJobsByConversation`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
      payload: { kind: "message", text: row.paylo
... (truncated)
```
