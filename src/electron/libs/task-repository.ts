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
} from "./task-types.js";

export class TaskRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initialize();
  }

  private initialize(): void {
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
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
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
  }

  upsertTask(external: ExternalTask): StoredTask {
    const now = Date.now();
    const existing = this.db
      .prepare("SELECT id, status, local_status, last_executed_at, execution_session_id FROM tasks WHERE external_id = ? AND provider = ?")
      .get(external.externalId, external.provider) as
        | { id: string; status: string; local_status: string; last_executed_at: number | null; execution_session_id: string | null }
        | undefined;

    if (existing) {
      const nextLocalStatus =
        existing.local_status === "pending" && (external.status === "done" || external.status === "cancelled")
          ? external.status
          : existing.local_status;
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
        lastSyncedAt: now,
        lastExecutedAt: existing.last_executed_at ?? undefined,
        executionSessionId: existing.execution_session_id ?? undefined,
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
    this.db
      .prepare("UPDATE tasks SET local_status = ?, updated_at = ? WHERE id = ?")
      .run(localStatus, Date.now(), id);
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
          .prepare("UPDATE task_executions SET status = 'failed', completed_at = ?, error = ? WHERE id = ? AND status = 'running'")
          .run(now, error, row.id);
        this.db
          .prepare("UPDATE tasks SET local_status = 'failed', execution_session_id = NULL, updated_at = ? WHERE id = ? AND local_status = 'executing'")
          .run(now, row.task_id);
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

  setExecuting(id: string, sessionId: string): void {
    const now = Date.now();
    this.db
      .prepare(
        "UPDATE tasks SET local_status = 'executing', execution_session_id = ?, last_executed_at = ?, updated_at = ? WHERE id = ?"
      )
      .run(sessionId, now, now, id);
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
    this.db
      .prepare(
        "INSERT INTO task_executions (id, task_id, session_id, status, started_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(id, execution.taskId, execution.sessionId, execution.status, execution.startedAt);
    return { ...execution, id };
  }

  completeExecution(id: string, result?: string, error?: string): void {
    const status = error ? "failed" : "completed";
    this.db
      .prepare(
        "UPDATE task_executions SET status = ?, completed_at = ?, result = ?, error = ? WHERE id = ?"
      )
      .run(status, Date.now(), result ?? null, error ?? null, id);
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
      .all(taskId) as TaskExecutionLog[];
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
      startedAt: row.started_at as number,
      completedAt: row.completed_at as number | undefined,
      result: row.result as string | undefined,
      error: row.error as string | undefined,
    };
  }
}
