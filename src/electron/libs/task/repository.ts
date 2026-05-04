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
      CREATE INDEX IF NOT EXISTS idx_task_executions_task ON task_executions(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_execution_logs_exec ON task_execution_logs(execution_id);
      CREATE INDEX IF NOT EXISTS idx_task_subtasks_task ON task_subtasks(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_artifacts_task ON task_artifacts(task_id);
    `);
  }

  private resetTaskTablesIfOutdated(): void {
    const tasksTable = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'")
      .get() as { name?: string } | undefined;
    if (!tasksTable) return;

    const hasTasksColumns = this.hasColumns("tasks", [
      "claim_state",
      "retry_attempt",
      "retry_due_at",
      "workspace_path",
      "driver_id",
      "model",
      "reasoning_mode",
      "max_cost_usd",
      "input_tokens",
      "output_tokens",
      "estimated_cost_usd",
      "cancel_requested_at",
      "paused_at",
    ]);
    const hasExecutionColumns = this.hasColumns("task_executions", [
      "attempt",
      "last_event_at",
      "terminal_reason",
      "driver_id",
      "model",
      "reasoning_mode",
      "max_cost_usd",
      "input_tokens",
      "output_tokens",
      "estimated_cost_usd",
    ]);
    const hasChildTables = this.hasTable("task_subtasks") && this.hasTable("task_artifacts");
    if (hasTasksColumns && hasExecutionColumns && hasChildTables) return;

    this.db.exec(`
      DROP TABLE IF EXISTS task_artifacts;
      DROP TABLE IF EXISTS task_subtasks;
      DROP TABLE IF EXISTS task_execution_logs;
      DROP TABLE IF EXISTS task_executions;
      DROP TABLE IF EXISTS task_dismissals;
      DROP TABLE IF EXISTS tasks;
    `);
  }

  private hasTable(table: string): boolean {
    const exists = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table) as { name?: string } | undefined;
    return Boolean(exists?.name);
  }

  private hasColumns(table: string, columns: string[]): boolean {
    if (!this.hasTable(table)) return false;
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    const present = new Set(rows.map((row) => row.name));
    return columns.every((column) => present.has(column));
  }

  upsertTask(external: ExternalTask): StoredTask {
    const now = Date.now();
    const existing = this.db
      .prepare("SELECT * FROM tasks WHERE external_id = ? AND provider = ?")
      .get(external.externalId, external.provider) as Row | undefined;

    if (existing) {
      const currentLocalStatus = String(existing.local_status);
      const nextLocalStatus =
        currentLocalStatus === "pending" && (external.status === "done" || external.status === "cancelled")
          ? external.status
          : currentLocalStatus;
      this.db
        .prepare(
          `UPDATE tasks SET
            title = ?, description = ?, status = ?, assignee = ?, priority = ?,
            due_date = ?, source_data = ?, local_status = ?, last_synced_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          external.title,
          external.description ?? null,
          external.status,
          external.assignee ?? null,
          external.priority,
          external.dueDate ?? null,
          JSON.stringify(external.sourceData),
          nextLocalStatus,
          now,
          now,
          existing.id,
        );
      return this.getTask(String(existing.id))!;
    }

    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO tasks
          (id, external_id, provider, title, description, status, assignee, priority, due_date, source_data, local_status, last_synced_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        external.externalId,
        external.provider,
        external.title,
        external.description ?? null,
        external.status,
        external.assignee ?? null,
        external.priority,
        external.dueDate ?? null,
        JSON.stringify(external.sourceData),
        external.status,
        now,
        now,
        now,
      );

    return this.getTask(id)!;
  }

  markProviderTasksMissing(provider: TaskProviderId, activeExternalIds: string[]): StoredTask[] {
    const now = Date.now();
    const active = new Set(activeExternalIds);
    const rows = this.db
      .prepare("SELECT * FROM tasks WHERE provider = ? AND local_status IN ('pending', 'in_progress', 'done')")
      .all(provider) as Row[];
    const staleRows = rows.filter((row) => !active.has(String(row.external_id)));

    const update = this.db.prepare(
      "UPDATE tasks SET status = 'done', local_status = 'done', last_synced_at = ?, updated_at = ? WHERE id = ?"
    );
    for (const row of staleRows) {
      const sourceUpdatedAt = this.getSourceUpdatedAt(row.source_data);
      update.run(now, sourceUpdatedAt ?? row.updated_at ?? now, row.id);
    }

    return staleRows
      .map((row) => this.getTask(String(row.id)))
      .filter((task): task is StoredTask => Boolean(task));
  }

  private getSourceUpdatedAt(sourceData: unknown): number | undefined {
    if (typeof sourceData !== "string" || !sourceData.trim()) return undefined;
    try {
      const parsed = JSON.parse(sourceData) as { updated_at?: unknown };
      const raw = parsed.updated_at;
      if (typeof raw === "number" && Number.isFinite(raw)) return raw;
      if (typeof raw === "string" && raw.trim()) {
        const value = Number(raw);
        return Number.isFinite(value) ? value : undefined;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  getTask(id: string): StoredTask | undefined {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Row | undefined;
    return row ? this.rowToTask(row) : undefined;
  }

  getTaskByExternalId(externalId: string, provider: TaskProviderId): StoredTask | undefined {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE external_id = ? AND provider = ?")
      .get(externalId, provider) as Row | undefined;
    return row ? this.rowToTask(row) : undefined;
  }

  listTasks(filter?: TaskFilter): StoredTask[] {
    let sql = "SELECT * FROM tasks WHERE 1=1";
    const params: unknown[] = [];

    if (filter?.provider) {
      sql += " AND provider = ?";
      params.push(filter.provider);
    }
    if (filter?.status) {
      sql += " AND local_status = ?";
      params.push(filter.status);
    }
    if (filter?.priority) {
      sql += " AND priority = ?";
      params.push(filter.priority);
    }
    if (filter?.query) {
      sql += " AND (title LIKE ? OR description LIKE ? OR external_id LIKE ?)";
      params.push(`%${filter.query}%`, `%${filter.query}%`, `%${filter.query}%`);
    }

    sql += " ORDER BY updated_at DESC";
    return (this.db.prepare(sql).all(...params) as Row[]).map((row) => this.rowToTask(row));
  }

  filterDismissedExternalTasks(tasks: ExternalTask[]): ExternalTask[] {
    const dismissed = this.db.prepare("SELECT 1 FROM task_dismissals WHERE provider = ? AND external_id = ? LIMIT 1");
    return tasks.filter((task) => !dismissed.get(task.provider, task.externalId));
  }

  updateLocalStatus(id: string, localStatus: LocalTaskStatus): void {
    const claimState = this.claimStateFor(localStatus);
    this.db
      .prepare(
        `UPDATE tasks SET
          local_status = ?,
          claim_state = ?,
          execution_session_id = CASE WHEN ? = 'executing' THEN execution_session_id ELSE NULL END,
          retry_due_at = CASE WHEN ? = 'retrying' THEN retry_due_at ELSE NULL END,
          last_error = CASE WHEN ? IN ('failed', 'retrying') THEN last_error ELSE NULL END,
          cancel_requested_at = CASE WHEN ? = 'cancelled' THEN COALESCE(cancel_requested_at, ?) ELSE NULL END,
          paused_at = CASE WHEN ? = 'paused' THEN COALESCE(paused_at, ?) ELSE NULL END,
          updated_at = ?
         WHERE id = ?`
      )
      .run(
        localStatus,
        claimState,
        localStatus,
        localStatus,
        localStatus,
        localStatus,
        Date.now(),
        localStatus,
        Date.now(),
        Date.now(),
        id,
      );
  }

  markFailed(id: string, error: string): StoredTask | undefined {
    this.db
      .prepare(
        `UPDATE tasks SET
          local_status = 'failed',
          claim_state = 'released',
          execution_session_id = NULL,
          retry_due_at = NULL,
          last_error = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .run(error, Date.now(), id);
    return this.getTask(id);
  }

  markPaused(id: string, reason?: string): StoredTask | undefined {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE tasks SET
          local_status = 'paused',
          claim_state = 'released',
          execution_session_id = NULL,
          retry_due_at = NULL,
          last_error = COALESCE(?, last_error),
          paused_at = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .run(reason ?? null, now, now, id);
    return this.getTask(id);
  }

  markCancelled(id: string, reason?: string): StoredTask | undefined {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE tasks SET
          local_status = 'cancelled',
          status = 'cancelled',
          claim_state = 'released',
          execution_session_id = NULL,
          retry_due_at = NULL,
          last_error = COALESCE(?, last_error),
          cancel_requested_at = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .run(reason ?? null, now, now, id);
    return this.getTask(id);
  }

  markQueued(id: string, attempt: number, dueAt: number, reason: string): StoredTask | undefined {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE tasks SET
          local_status = 'queued',
          claim_state = 'queued',
          execution_session_id = NULL,
          retry_attempt = ?,
          retry_due_at = ?,
          last_error = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .run(attempt, dueAt, reason, now, id);
    return this.getTask(id);
  }

  recoverInterruptedExecutions(error: string, options: { activeTaskIds?: Iterable<string> } = {}): Array<{
    task: StoredTask;
    execution: TaskExecution;
    interruptionCount: number;
  }> {
    const now = Date.now();
    let rows = this.db
      .prepare(
        `SELECT e.*
         FROM task_executions e
         INNER JOIN tasks t ON t.id = e.task_id
         WHERE e.status = 'running'
            OR (
              t.local_status = 'executing'
              AND e.id = (
                SELECT latest.id
                FROM task_executions latest
                WHERE latest.task_id = t.id
                ORDER BY latest.started_at DESC
                LIMIT 1
              )
            )
         ORDER BY e.started_at ASC`
      )
      .all() as Row[];

    if (options.activeTaskIds) {
      const activeTaskIds = new Set(Array.from(options.activeTaskIds, String));
      rows = rows.filter((row) => !activeTaskIds.has(String(row.task_id)));
    }
    if (rows.length === 0) return [];

    const recover = this.db.transaction((executionRows: Row[]) => {
      for (const row of executionRows) {
        this.db
          .prepare("UPDATE task_executions SET status = 'failed', completed_at = ?, error = ?, terminal_reason = ? WHERE id = ? AND status = 'running'")
          .run(now, error, "interrupted", row.id);
        this.db
          .prepare("UPDATE tasks SET local_status = 'failed', claim_state = 'released', execution_session_id = NULL, last_error = ?, updated_at = ? WHERE id = ? AND local_status = 'executing'")
          .run(error, now, row.task_id);
      }
    });
    recover(rows);

    const recovered: Array<{ task: StoredTask; execution: TaskExecution; interruptionCount: number }> = [];
    for (const row of rows) {
      const task = this.getTask(String(row.task_id));
      if (!task) continue;
      const interruptionCount = this.countExecutionErrors(task.id, error);
      recovered.push({
        task,
        interruptionCount,
        execution: {
          ...this.rowToExecution(row),
          status: "failed",
          completedAt: now,
          error,
        },
      });
    }
    return recovered;
  }

  private countExecutionErrors(taskId: string, error: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS cnt FROM task_executions WHERE task_id = ? AND error = ?")
      .get(taskId, error) as { cnt?: number } | undefined;
    return Number(row?.cnt ?? 0);
  }

  deleteTask(id: string): StoredTask | undefined {
    const task = this.getTask(id);
    if (!task) return undefined;

    const remove = this.db.transaction((taskId: string) => {
      this.db
        .prepare("INSERT OR REPLACE INTO task_dismissals (provider, external_id, deleted_at) VALUES (?, ?, ?)")
        .run(task.provider, task.externalId, Date.now());
      this.db.prepare("DELETE FROM task_artifacts WHERE task_id = ?").run(taskId);
      this.db.prepare("DELETE FROM task_subtasks WHERE task_id = ?").run(taskId);
      this.db.prepare("DELETE FROM task_execution_logs WHERE task_id = ?").run(taskId);
      this.db.prepare("DELETE FROM task_executions WHERE task_id = ?").run(taskId);
      this.db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
    });
    remove(id);
    return task;
  }

  setExecuting(
    id: string,
    sessionId: string,
    options: {
      attempt?: number;
      workspacePath?: string;
      driverId?: TaskAgentDriverId;
      model?: string;
      reasoningMode?: TaskReasoningMode;
      maxCostUsd?: number;
    } = {},
  ): void {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE tasks SET
          local_status = 'executing',
          claim_state = 'running',
          execution_session_id = ?,
          retry_attempt = ?,
          retry_due_at = NULL,
          last_error = NULL,
          workspace_path = COALESCE(?, workspace_path),
          driver_id = COALESCE(?, driver_id),
          model = COALESCE(?, model),
          reasoning_mode = COALESCE(?, reasoning_mode),
          max_cost_usd = COALESCE(?, max_cost_usd),
          cancel_requested_at = NULL,
          paused_at = NULL,
          last_executed_at = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .run(
        sessionId,
        options.attempt ?? 0,
        options.workspacePath ?? null,
        options.driverId ?? null,
        options.model ?? null,
        options.reasoningMode ?? null,
        options.maxCostUsd ?? null,
        now,
        now,
        id,
      );
  }

  scheduleRetry(id: string, attempt: number, dueAt: number, error: string): StoredTask | undefined {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE tasks SET
          local_status = 'retrying',
          claim_state = 'retrying',
          execution_session_id = NULL,
          retry_attempt = ?,
          retry_due_at = ?,
          last_error = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .run(attempt, dueAt, error, now, id);
    return this.getTask(id);
  }

  clearRetry(id: string): void {
    this.db
      .prepare("UPDATE tasks SET retry_due_at = NULL, last_error = NULL WHERE id = ?")
      .run(id);
  }

  cancelRetry(id: string, reason: string): StoredTask | undefined {
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE tasks SET
          local_status = 'failed',
          claim_state = 'released',
          retry_due_at = NULL,
          last_error = ?,
          updated_at = ?
         WHERE id = ? AND local_status IN ('retrying', 'queued')`
      )
      .run(reason, now, id);
    return this.getTask(id);
  }

  listDueRetryTasks(now: number, limit: number): StoredTask[] {
    return (this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE local_status IN ('retrying', 'queued')
           AND retry_due_at IS NOT NULL
           AND retry_due_at <= ?
         ORDER BY retry_due_at ASC, updated_at ASC
         LIMIT ?`
      )
      .all(now, limit) as Row[]).map((row) => this.rowToTask(row));
  }

  getStats(): TaskStats {
    const countByStatus = this.db
      .prepare("SELECT local_status, COUNT(*) as cnt FROM tasks GROUP BY local_status")
      .all() as { local_status: string; cnt: number }[];

    const countByProvider = this.db
      .prepare("SELECT provider, COUNT(*) as cnt FROM tasks GROUP BY provider")
      .all() as { provider: string; cnt: number }[];

    const usage = this.db
      .prepare("SELECT COALESCE(SUM(estimated_cost_usd), 0) AS cost FROM tasks")
      .get() as { cost?: number } | undefined;

    const stats: TaskStats = {
      total: 0,
      pending: 0,
      queued: 0,
      executing: 0,
      retrying: 0,
      paused: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      estimatedCostUsd: Number(usage?.cost ?? 0),
      byProvider: {} as Record<TaskProviderId, number>,
    };

    for (const row of countByStatus) {
      stats.total += row.cnt;
      switch (row.local_status) {
        case "pending":
        case "in_progress":
        case "done":
          stats.pending += row.cnt;
          break;
        case "queued":
          stats.queued += row.cnt;
          break;
        case "executing":
          stats.executing += row.cnt;
          break;
        case "retrying":
          stats.retrying += row.cnt;
          break;
        case "paused":
          stats.paused += row.cnt;
          break;
        case "completed":
          stats.completed += row.cnt;
          break;
        case "failed":
          stats.failed += row.cnt;
          break;
        case "cancelled":
          stats.cancelled += row.cnt;
          break;
      }
    }

    for (const row of countByProvider) {
      if (row.provider === "lark" || row.provider === "tb") {
        stats.byProvider[row.provider] = row.cnt;
      }
    }
    return stats;
  }

  createExecution(execution: Omit<TaskExecution, "id">): TaskExecution {
    const id = crypto.randomUUID();
    const lastEventAt = execution.lastEventAt ?? execution.startedAt;
    this.db
      .prepare(
        `INSERT INTO task_executions
          (id, task_id, session_id, status, attempt, driver_id, model, reasoning_mode, max_cost_usd, input_tokens, output_tokens, estimated_cost_usd, started_at, last_event_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        execution.taskId,
        execution.sessionId,
        execution.status,
        execution.attempt ?? 0,
        execution.driverId ?? null,
        execution.model ?? null,
        execution.reasoningMode ?? null,
        execution.maxCostUsd ?? null,
        execution.inputTokens ?? 0,
        execution.outputTokens ?? 0,
        execution.estimatedCostUsd ?? 0,
        execution.startedAt,
        lastEventAt,
      );
    return { ...execution, id, lastEventAt };
  }

  touchExecution(id: string, timestamp = Date.now()): void {
    this.db.prepare("UPDATE task_executions SET last_event_at = ? WHERE id = ? AND status = 'running'").run(timestamp, id);
  }

  completeExecution(
    id: string,
    result?: string,
    error?: string,
    terminalReason?: string,
    statusOverride?: TaskExecution["status"],
  ): void {
    const status = statusOverride ?? (error ? "failed" : "completed");
    this.db
      .prepare(
        "UPDATE task_executions SET status = ?, completed_at = ?, result = ?, error = ?, terminal_reason = ? WHERE id = ?"
      )
      .run(status, Date.now(), result ?? null, error ?? null, terminalReason ?? (error ? "error" : "completed"), id);
  }

  recordUsage(taskId: string, executionId: string, usage: {
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
  }): void {
    const inputTokens = Math.max(0, Math.floor(usage.inputTokens ?? 0));
    const outputTokens = Math.max(0, Math.floor(usage.outputTokens ?? 0));
    const estimatedCostUsd = Math.max(0, usage.estimatedCostUsd ?? 0);
    this.db
      .prepare(
        `UPDATE task_executions SET
          input_tokens = ?,
          output_tokens = ?,
          estimated_cost_usd = ?
         WHERE id = ?`
      )
      .run(inputTokens, outputTokens, estimatedCostUsd, executionId);
    this.db
      .prepare(
        `UPDATE tasks SET
          input_tokens = ?,
          output_tokens = ?,
          estimated_cost_usd = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .run(inputTokens, outputTokens, estimatedCostUsd, Date.now(), taskId);
  }

  getExecutions(taskId: string): TaskExecution[] {
    return (this.db
      .prepare("SELECT * FROM task_executions WHERE task_id = ? ORDER BY started_at DESC")
      .all(taskId) as Row[]).map((row) => this.rowToExecution(row));
  }

  getLatestExecution(taskId: string): TaskExecution | undefined {
    const row = this.db
      .prepare("SELECT * FROM task_executions WHERE task_id = ? ORDER BY started_at DESC LIMIT 1")
      .get(taskId) as Row | undefined;
    return row ? this.rowToExecution(row) : undefined;
  }

  appendLog(log: Omit<TaskExecutionLog, "id">): TaskExecutionLog {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        "INSERT INTO task_execution_logs (id, execution_id, task_id, level, message, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(id, log.executionId, log.taskId, log.level, log.message, log.timestamp);
    return { ...log, id };
  }

  getExecutionLogs(taskId: string): TaskExecutionLog[] {
    return (this.db
      .prepare("SELECT * FROM task_execution_logs WHERE task_id = ? ORDER BY timestamp ASC")
      .all(taskId) as Row[]).map((row) => this.rowToLog(row));
  }

  replaceSubtasks(taskId: string, executionId: string, subtasks: Array<Pick<TaskSubtask, "title" | "detail" | "status" | "sortOrder">>): TaskSubtask[] {
    const now = Date.now();
    const write = this.db.transaction(() => {
      this.db.prepare("DELETE FROM task_subtasks WHERE task_id = ?").run(taskId);
      const insert = this.db.prepare(
        `INSERT INTO task_subtasks
          (id, task_id, execution_id, title, detail, status, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const item of subtasks) {
        insert.run(
          crypto.randomUUID(),
          taskId,
          executionId,
          item.title,
          item.detail ?? null,
          item.status,
          item.sortOrder,
          now,
          now,
        );
      }
    });
    write();
    return this.getSubtasks(taskId);
  }

  getSubtasks(taskId: string): TaskSubtask[] {
    return (this.db
      .prepare("SELECT * FROM task_subtasks WHERE task_id = ? ORDER BY sort_order ASC, created_at ASC")
      .all(taskId) as Row[]).map((row) => this.rowToSubtask(row));
  }

  replaceArtifacts(taskId: string, executionId: string, artifacts: Array<Pick<TaskArtifact, "path" | "kind" | "summary">>): TaskArtifact[] {
    const now = Date.now();
    const write = this.db.transaction(() => {
      this.db.prepare("DELETE FROM task_artifacts WHERE task_id = ?").run(taskId);
      const insert = this.db.prepare(
        `INSERT INTO task_artifacts
          (id, task_id, execution_id, path, kind, summary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const item of artifacts) {
        insert.run(crypto.randomUUID(), taskId, executionId, item.path, item.kind, item.summary ?? null, now, now);
      }
    });
    write();
    return this.getArtifacts(taskId);
  }

  getArtifacts(taskId: string): TaskArtifact[] {
    return (this.db
      .prepare("SELECT * FROM task_artifacts WHERE task_id = ? ORDER BY updated_at DESC, path ASC")
      .all(taskId) as Row[]).map((row) => this.rowToArtifact(row));
  }

  getExecutionBundle(taskId: string) {
    return {
      taskId,
      executions: this.getExecutions(taskId),
      logs: this.getExecutionLogs(taskId),
      subtasks: this.getSubtasks(taskId),
      artifacts: this.getArtifacts(taskId),
    };
  }

  reapCompletedTasks(olderThanDays: number): number {
    const cutoff = Date.now() - olderThanDays * 86400000;
    const rows = this.db
      .prepare("SELECT id FROM tasks WHERE local_status IN ('completed', 'failed', 'cancelled') AND updated_at < ?")
      .all(cutoff) as Array<{ id: string }>;
    for (const row of rows) {
      this.deleteTask(row.id);
    }
    return rows.length;
  }

  private claimStateFor(localStatus: LocalTaskStatus): TaskClaimState {
    if (localStatus === "executing") return "running";
    if (localStatus === "retrying") return "retrying";
    if (localStatus === "queued") return "queued";
    if (localStatus === "failed" || localStatus === "completed" || localStatus === "paused" || localStatus === "cancelled") {
      return "released";
    }
    return "unclaimed";
  }

  private rowToTask(row: Row): StoredTask {
    return {
      id: row.id as string,
      externalId: row.external_id as string,
      provider: row.provider as TaskProviderId,
      title: row.title as string,
      description: asOptionalString(row.description),
      status: row.status as StoredTask["status"],
      assignee: asOptionalString(row.assignee),
      priority: row.priority as StoredTask["priority"],
      dueDate: asOptionalNumber(row.due_date),
      sourceData: parseJsonObject(row.source_data),
      localStatus: row.local_status as LocalTaskStatus,
      claimState: (row.claim_state as TaskClaimState | undefined) ?? "unclaimed",
      retryAttempt: Number(row.retry_attempt ?? 0),
      retryDueAt: asOptionalNumber(row.retry_due_at),
      lastError: asOptionalString(row.last_error),
      workspacePath: asOptionalString(row.workspace_path),
      driverId: asOptionalString(row.driver_id) as TaskAgentDriverId | undefined,
      model: asOptionalString(row.model),
      reasoningMode: asOptionalString(row.reasoning_mode) as TaskReasoningMode | undefined,
      maxCostUsd: asOptionalNumber(row.max_cost_usd),
      inputTokens: asOptionalNumber(row.input_tokens),
      outputTokens: asOptionalNumber(row.output_tokens),
      estimatedCostUsd: asOptionalNumber(row.estimated_cost_usd),
      cancelRequestedAt: asOptionalNumber(row.cancel_requested_at),
      pausedAt: asOptionalNumber(row.paused_at),
      lastSyncedAt: Number(row.last_synced_at ?? 0),
      lastExecutedAt: asOptionalNumber(row.last_executed_at),
      executionSessionId: asOptionalString(row.execution_session_id),
      createdAt: Number(row.created_at ?? 0),
      updatedAt: Number(row.updated_at ?? 0),
    };
  }

  private rowToExecution(row: Row): TaskExecution {
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      sessionId: row.session_id as string,
      status: row.status as TaskExecution["status"],
      attempt: Number(row.attempt ?? 0),
      driverId: asOptionalString(row.driver_id) as TaskAgentDriverId | undefined,
      model: asOptionalString(row.model),
      reasoningMode: asOptionalString(row.reasoning_mode) as TaskReasoningMode | undefined,
      maxCostUsd: asOptionalNumber(row.max_cost_usd),
      inputTokens: asOptionalNumber(row.input_tokens),
      outputTokens: asOptionalNumber(row.output_tokens),
      estimatedCostUsd: asOptionalNumber(row.estimated_cost_usd),
      startedAt: Number(row.started_at ?? 0),
      completedAt: asOptionalNumber(row.completed_at),
      lastEventAt: asOptionalNumber(row.last_event_at),
      terminalReason: asOptionalString(row.terminal_reason),
      result: asOptionalString(row.result),
      error: asOptionalString(row.error),
    };
  }

  private rowToLog(row: Row): TaskExecutionLog {
    return {
      id: row.id as string,
      executionId: row.execution_id as string,
      taskId: row.task_id as string,
      level: row.level as TaskExecutionLog["level"],
      message: row.message as string,
      timestamp: Number(row.timestamp ?? 0),
    };
  }

  private rowToSubtask(row: Row): TaskSubtask {
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      executionId: asOptionalString(row.execution_id),
      title: row.title as string,
      detail: asOptionalString(row.detail),
      status: row.status as TaskSubtaskStatus,
      sortOrder: Number(row.sort_order ?? 0),
      createdAt: Number(row.created_at ?? 0),
      updatedAt: Number(row.updated_at ?? 0),
    };
  }

  private rowToArtifact(row: Row): TaskArtifact {
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      executionId: asOptionalString(row.execution_id),
      path: row.path as string,
      kind: row.kind as TaskArtifactKind,
      summary: asOptionalString(row.summary),
      createdAt: Number(row.created_at ?? 0),
      updatedAt: Number(row.updated_at ?? 0),
    };
  }
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}
