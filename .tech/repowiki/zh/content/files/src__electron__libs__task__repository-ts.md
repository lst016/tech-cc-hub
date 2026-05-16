# src/electron/libs/task/repository.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：1008

## 文件职责

源码文件。运行信号：create table: tasks、create table: task_executions、create table: task_execution_logs、create table: task_subtasks、create table: task_artifacts；依赖：better-sqlite3、./types.js

## 运行信号

- `create table: tasks`
- `create table: task_executions`
- `create table: task_execution_logs`
- `create table: task_subtasks`
- `create table: task_artifacts`
- `create table: task_dismissals`

## 关键符号

- `asOptionalString@983 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `asOptionalNumber@987 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `parseJsonObject@996 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `TaskRepository@21 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `tasksTable@139 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `hasTasksColumns@143 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `hasExecutionColumns@159 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `hasChildTables@171 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `exists@185 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `rows@193 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `present@194 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `now@199 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `existing@200 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `currentLocalStatus@205 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `nextLocalStatus@206 - create table: tasks, create table: task_executions, create table: task_execution_logs`
- `id@232 - create table: tasks, create table: task_executions, create table: task_execution_logs`

## 依赖输入

- `better-sqlite3`
- `./types.js`

## 对外暴露

- `TaskRepository`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import Database from "better-sqlite3";
import type {
  ExternalTask,
  LocalTaskStatus,
  StoredTask,
  TaskAgentDriverId,
  TaskArtifact,
  TaskArtifactKind,
  TaskClaimState,
  TaskExecution,
  TaskExecutionLog,
  TaskFilter,
  TaskProviderId,
  TaskReasoningMode,
  TaskStats,
  TaskSubtask,
  TaskSubtaskStatus,
} from "./types.js";

type Row = Record<string, unknown>;

export class TaskRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initialize();
  }

  private initialize(): void {
    this.resetTaskTablesIfOutdated();
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        external_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        assignee TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        due_date INTEGER,
        source_data TEXT NOT NULL DEFAULT '{}',
        local_status TEXT NOT NULL DEFAULT 'pending',
        claim_state TEXT NOT NULL DEFAULT 'unclaimed',
        retry_attempt INTEGER NOT NULL DEFAULT 0,
        retry_due_at INTEGER,
        last_error TEXT,
        workspace_path TEXT,
        driver_id TEXT,
        model TEXT,
        reasoning_mode TEXT,
        max_cost_usd REAL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost_usd REAL NOT NULL DEFAULT 0,
        cancel_requested_at INTEGER,
        paused_at INTEGER,
        last_synced_at INTEGER NOT NULL,
        last_executed_at INTEGER,
        execution_session_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(external_id, provider)
      );

      CREATE TABLE IF NOT EXISTS task_executions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        session_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        attempt INTEGER NOT NULL DEFAULT 0,
        driver_id TEXT,
        model TEXT,
        reasoning_mode TEXT,
        max_cost_usd REAL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost_usd REAL NOT NULL DEFAULT 0,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        last_event_at INTEGER,
        terminal_reason TEXT,
        result TEXT,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS task_execution_logs (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL REFERENCES task_executions(id),
        task_id TEXT NOT NULL REFERENCES tasks(id),
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_subtasks (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        execution_id TEXT REFERENCES task_executions(id),
        title TEXT NOT NULL,
        detail TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_artifacts (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        execution_id TEXT REFERENCES task_executions(id),
        path TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'file',
        summary TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_dismissals (
        provider TEXT NOT NULL,
        external_id TEXT NOT NULL,
        deleted_at INTEGER NOT NULL,
        PRIMARY KEY(provider, external_id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_provider ON tasks(provider);
      CREATE INDEX IF NOT EXISTS idx_tasks_local_status ON tasks(local_status);
      CREATE INDEX IF NOT EXISTS idx_tasks_external_id ON tasks(external_id, provider);
      CREATE INDEX IF NOT EXISTS idx_tasks_retry_due ON tasks(local_status, retry_due_at);
      CREATE INDEX IF NOT EXISTS idx_task_executions_task ON task_executions(task_
... (truncated)
```
