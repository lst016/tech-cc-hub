import Database from "better-sqlite3";
import type {
  StoredTask,
  ExternalTask,
  TaskExecution,
  TaskExecutionLog,
  TaskFilter,
  TaskStats,
  LocalTaskStatus,
  TaskProviderId,
  TaskClaimState,
} from "./task-types.js";

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

      CREATE TABLE IF NOT EXISTS task_dismissals (
        provider TEXT NOT NULL,
        external_id TEXT NOT NULL,
        deleted_at INTEGER NOT NULL,
        PRIMARY KEY(provider, external_id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_provider ON tasks(provider);
      CREATE INDEX IF NOT EXISTS idx_tasks_local_status ON tasks(local_status);
      CREATE INDEX IF NOT EXISTS idx_tasks_external_id ON tasks(external_id, provider);
      CREATE INDEX IF NOT EXISTS idx_task_executions_task ON task_executions(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_execution_logs_exec ON task_execution_logs(execution_id);
    `);
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_retry_due ON tasks(local_status, retry_due_at)");
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
      "last_error",
      "workspace_path",
    ]);
    const hasExecutionColumns = this.hasColumns("task_executions", [
      "attempt",
      "last_event_at",
      "terminal_reason",
    ]);
    if (hasTasksColumns && hasExecutionColumns) return;

    this.db.exec(`
      DROP TABLE IF EXISTS task_execution_logs;
      DROP TABLE IF EXISTS task_executions;
      DROP TABLE IF EXISTS task_dismissals;
      DROP TABLE IF EXISTS tasks;
    `);
  }

  private hasColumns(table: string, columns: string[]): boolean {
    const exists = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table) as { name?: string } | undefined;
    if (!exists) return false;

    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    const present = new Set(rows.map((row) => row.name));
    return columns.every((column) => present.has(column));
  }

  upsertTask(external: ExternalTask): StoredTask {
    const now = Date.now();
    const existing = this.db
      .prepare("SELECT * FROM tasks WHERE external_id = ? AND provider = ?")
      .get(external.externalId, external.provider) as
        | Record<string, unknown>
        | undefined;

    if (existing) {
      const nextLocalStatus =
        existing.local_status === "pending" && (external.status === "done" || external.status === "cancelled")
          ? external.status
          : String(existing.local_status);
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
          existing.id
        );

      return {
        ...external,
        localStatus: nextLocalStatus as LocalTaskStatus,
        claimState: existing.claim_state as TaskClaimState,
        retryAttempt: Number(existing.retry_attempt ?? 0),
        retryDueAt: existing.retry_due_at as number | undefined,
        lastError: existing.last_error as string | undefined,
        workspacePath: existing.workspace_path as string | undefined,
        lastSyncedAt: now,
        lastExecutedAt: existing.last_executed_at as number | undefined,
        executionSessionId: existing.execution_session_id as string | undefined,
      };
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
        now
      );

    return {
      ...external,
      localStatus: external.status,
      claimState: "unclaimed",
      retryAttempt: 0,
      lastSyncedAt: now,
    };
  }

  markProviderTasksMissing(provider: TaskProviderId, activeExternalIds: string[]): StoredTask[] {
    const now = Date.now();
    const active = new Set(activeExternalIds);
    const rows = this.db
      .prepare("SELECT * FROM tasks WHERE provider = ? AND local_status IN ('pending', 'in_progress', 'done')")
      .all(provider) as Record<string, unknown>[];
    const staleRows = rows.filter((row) => !active.has(String(row.external_id)));

    const update = this.db.prepare(
      "UPDATE tasks SET status = 'done', local_status = 'done', last_synced_at = ?, updated_at = ? WHERE id = ?"
    );
    for (const row of staleRows) {
      const sourceUpdatedAt = this.getSourceUpdatedAt(row.source_data);
      update.run(now, sourceUpdatedAt ?? row.updated_at ?? now, row.id);
    }

    return staleRows.map((row) => {
      const sourceUpdatedAt = this.getSourceUpdatedAt(row.source_data);
      return this.rowToTask({
        ...row,
        status: "done",
        local_status: "done",
        last_synced_at: now,
        updated_at: sourceUpdatedAt ?? row.updated_at ?? now,
      });
    });
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
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToTask(row) : undefined;
  }

  getTaskByExternalId(externalId: string, provider: TaskProviderId): StoredTask | undefined {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE external_id = ? AND provider = ?")
      .get(externalId, provider) as Record<string, unknown> | undefined;
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
      sql += " AND (title LIKE ? OR description LIKE ?)";
      params.push(`%${filter.query}%`, `%${filter.query}%`);
    }

    sql += " ORDER BY updated_at DESC";
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((row) => this.rowToTask(row));
  }

  filterDismissedExternalTasks(tasks: ExternalTask[]): ExternalTask[] {
    const dismissed = this.db.prepare("SELECT 1 FROM task_dismissals WHERE provider = ? AND external_id = ? LIMIT 1");
    return tasks.filter((task) => !dismissed.get(task.provider, task.externalId));
  }

  updateLocalStatus(id: string, localStatus: LocalTaskStatus): void {
    const claimState: TaskClaimState =
      localStatus === "executing"
        ? "running"
        : localStatus === "retrying"
          ? "retrying"
          : localStatus === "failed" || localStatus === "completed"
            ? "released"
            : "unclaimed";
    this.db
      .prepare(
        `UPDATE tasks SET
          local_status = ?,
          claim_state = ?,
          execution_session_id = CASE WHEN ? = 'executing' THEN execution_session_id ELSE NULL END,
          retry_due_at = CASE WHEN ? = 'retrying' THEN retry_due_at ELSE NULL END,
          last_error = CASE WHEN ? IN ('failed', 'retrying') THEN last_error ELSE NULL END,
          updated_at = ?
         WHERE id = ?`
      )
      .run(localStatus, claimState, localStatus, localStatus, localStatus, Date.now(), id);
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
      .all() as Record<string, unknown>[];

    if (options.activeTaskIds) {
      const activeTaskIds = new Set(Array.from(options.activeTaskIds, String));
      rows = rows.filter((row) => !activeTaskIds.has(String(row.task_id)));
    }

    if (rows.length === 0) return [];

    const recover = this.db.transaction((executionRows: Record<string, unknown>[]) => {
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
      this.db.prepare("DELETE FROM task_execution_logs WHERE task_id = ?").run(taskId);
      this.db.prepare("DELETE FROM task_executions WHERE task_id = ?").run(taskId);
      this.db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
    });

    remove(id);
    return task;
  }

  setExecuting(id: string, sessionId: string, options: { attempt?: number; workspacePath?: string } = {}): void {
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
          last_executed_at = ?,
          updated_at = ?
         WHERE id = ?`
      )
      .run(sessionId, options.attempt ?? 0, options.workspacePath ?? null, now, now, id);
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

  listDueRetryTasks(now: number, limit: number): StoredTask[] {
    return this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE local_status = 'retrying'
           AND retry_due_at IS NOT NULL
           AND retry_due_at <= ?
         ORDER BY retry_due_at ASC, updated_at ASC
         LIMIT ?`
      )
      .all(now, limit)
      .map((row) => this.rowToTask(row as Record<string, unknown>));
  }

  getStats(): TaskStats {
    const countByStatus = this.db
      .prepare("SELECT local_status, COUNT(*) as cnt FROM tasks GROUP BY local_status")
      .all() as { local_status: string; cnt: number }[];

    const countByProvider = this.db
      .prepare("SELECT provider, COUNT(*) as cnt FROM tasks GROUP BY provider")
      .all() as { provider: string; cnt: number }[];

    const stats: TaskStats = {
      total: 0,
      pending: 0,
      executing: 0,
      retrying: 0,
      completed: 0,
      failed: 0,
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
        case "executing":
          stats.executing += row.cnt;
          break;
        case "retrying":
          stats.retrying += row.cnt;
          break;
        case "completed":
          stats.completed += row.cnt;
          break;
        case "failed":
          stats.failed += row.cnt;
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

  // Execution records
  createExecution(execution: Omit<TaskExecution, "id">): TaskExecution {
    const id = crypto.randomUUID();
    const lastEventAt = execution.lastEventAt ?? execution.startedAt;
    this.db
      .prepare(
        "INSERT INTO task_executions (id, task_id, session_id, status, attempt, started_at, last_event_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(id, execution.taskId, execution.sessionId, execution.status, execution.attempt ?? 0, execution.startedAt, lastEventAt);
    return { ...execution, id, lastEventAt };
  }

  touchExecution(id: string, timestamp = Date.now()): void {
    this.db.prepare("UPDATE task_executions SET last_event_at = ? WHERE id = ? AND status = 'running'").run(timestamp, id);
  }

  completeExecution(id: string, result?: string, error?: string, terminalReason?: string): void {
    const status = error ? "failed" : "completed";
    this.db
      .prepare(
        "UPDATE task_executions SET status = ?, completed_at = ?, result = ?, error = ?, terminal_reason = ? WHERE id = ?"
      )
      .run(status, Date.now(), result ?? null, error ?? null, terminalReason ?? (error ? "error" : "completed"), id);
  }

  getExecutions(taskId: string): TaskExecution[] {
    return this.db
      .prepare("SELECT * FROM task_executions WHERE task_id = ? ORDER BY started_at DESC")
      .all(taskId)
      .map((row) => this.rowToExecution(row as Record<string, unknown>));
  }

  getLatestExecution(taskId: string): TaskExecution | undefined {
    const row = this.db
      .prepare("SELECT * FROM task_executions WHERE task_id = ? ORDER BY started_at DESC LIMIT 1")
      .get(taskId) as Record<string, unknown> | undefined;
    return row ? this.rowToExecution(row) : undefined;
  }

  // Execution logs
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
    return this.db
      .prepare("SELECT * FROM task_execution_logs WHERE task_id = ? ORDER BY timestamp ASC")
      .all(taskId)
      .map((row) => this.rowToLog(row as Record<string, unknown>));
  }

  // Reaper: clean completed tasks older than N days
  reapCompletedTasks(olderThanDays: number): number {
    const cutoff = Date.now() - olderThanDays * 86400000;
    const result = this.db
      .prepare("DELETE FROM tasks WHERE local_status IN ('completed', 'failed') AND updated_at < ?")
      .run(cutoff);
    return result.changes;
  }

  private rowToTask(row: Record<string, unknown>): StoredTask {
    return {
      id: row.id as string,
      externalId: row.external_id as string,
      provider: row.provider as TaskProviderId,
      title: row.title as string,
      description: row.description as string | undefined,
      status: row.status as StoredTask["status"],
      assignee: row.assignee as string | undefined,
      priority: row.priority as StoredTask["priority"],
      dueDate: row.due_date as number | undefined,
      sourceData: JSON.parse((row.source_data as string) || "{}"),
      localStatus: row.local_status as LocalTaskStatus,
      claimState: (row.claim_state as TaskClaimState | undefined) ?? "unclaimed",
      retryAttempt: Number(row.retry_attempt ?? 0),
      retryDueAt: row.retry_due_at as number | undefined,
      lastError: row.last_error as string | undefined,
      workspacePath: row.workspace_path as string | undefined,
      lastSyncedAt: row.last_synced_at as number,
      lastExecutedAt: row.last_executed_at as number | undefined,
      executionSessionId: row.execution_session_id as string | undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  private rowToExecution(row: Record<string, unknown>): TaskExecution {
    return {
      id: row.id as string,
      taskId: row.task_id as string,
      sessionId: row.session_id as string,
      status: row.status as TaskExecution["status"],
      attempt: Number(row.attempt ?? 0),
      startedAt: row.started_at as number,
      completedAt: row.completed_at as number | undefined,
      lastEventAt: row.last_event_at as number | undefined,
      terminalReason: row.terminal_reason as string | undefined,
      result: row.result as string | undefined,
      error: row.error as string | undefined,
    };
  }

  private rowToLog(row: Record<string, unknown>): TaskExecutionLog {
    return {
      id: row.id as string,
      executionId: row.execution_id as string,
      taskId: row.task_id as string,
      level: row.level as TaskExecutionLog["level"],
      message: row.message as string,
      timestamp: row.timestamp as number,
    };
  }
}
