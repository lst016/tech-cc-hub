import Database from "better-sqlite3";
import {
  createWorkflowRunId,
  isTerminalWorkflowRunStatus,
  type WorkflowRunPatch,
  type WorkflowRunRecord,
  type WorkflowRunSource,
  type WorkflowRunStatus,
  type WorkflowRunTaskType,
  type WorkflowRunFailureKind,
} from "../../../shared/workflows/workflow-runs.js";

type WorkflowRunRow = {
  id: string;
  session_id: string;
  task_id: string;
  task_type: string | null;
  workflow_name: string | null;
  run_id: string | null;
  source: string;
  status: string;
  summary: string | null;
  script_path: string | null;
  transcript_dir: string | null;
  session_url: string | null;
  warning: string | null;
  error: string | null;
  failure_kind: string | null;
  launched_at: number;
  updated_at: number;
  completed_at: number | null;
};

function nullable(value: string | number | undefined): string | number | null {
  return value ?? null;
}

function mapRow(row: WorkflowRunRow): WorkflowRunRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    taskId: row.task_id,
    taskType: row.task_type ? (row.task_type as WorkflowRunTaskType) : undefined,
    workflowName: row.workflow_name ?? undefined,
    runId: row.run_id ?? undefined,
    source: row.source as WorkflowRunSource,
    status: row.status as WorkflowRunStatus,
    summary: row.summary ?? undefined,
    scriptPath: row.script_path ?? undefined,
    transcriptDir: row.transcript_dir ?? undefined,
    sessionUrl: row.session_url ?? undefined,
    warning: row.warning ?? undefined,
    error: row.error ?? undefined,
    failureKind: row.failure_kind ? (row.failure_kind as WorkflowRunFailureKind) : undefined,
    launchedAt: Number(row.launched_at),
    updatedAt: Number(row.updated_at),
    completedAt: row.completed_at === null ? undefined : Number(row.completed_at),
  };
}

function mergeDefined(
  existing: WorkflowRunRecord | undefined,
  patch: WorkflowRunPatch,
  now: number,
): WorkflowRunRecord {
  const id = patch.id ?? existing?.id ?? createWorkflowRunId(patch.sessionId, patch.taskId);
  const status = patch.status ?? existing?.status ?? "unknown";
  const updatedAt = patch.updatedAt ?? now;
  const completedAt = patch.completedAt
    ?? existing?.completedAt
    ?? (isTerminalWorkflowRunStatus(status) ? updatedAt : undefined);

  return {
    id,
    sessionId: patch.sessionId,
    taskId: patch.taskId,
    taskType: patch.taskType ?? existing?.taskType,
    workflowName: patch.workflowName ?? existing?.workflowName,
    runId: patch.runId ?? existing?.runId,
    source: patch.source ?? existing?.source ?? "unknown",
    status,
    summary: patch.summary ?? existing?.summary,
    scriptPath: patch.scriptPath ?? existing?.scriptPath,
    transcriptDir: patch.transcriptDir ?? existing?.transcriptDir,
    sessionUrl: patch.sessionUrl ?? existing?.sessionUrl,
    warning: patch.warning ?? existing?.warning,
    error: patch.error ?? existing?.error,
    failureKind: patch.failureKind ?? existing?.failureKind,
    launchedAt: patch.launchedAt ?? existing?.launchedAt ?? updatedAt,
    updatedAt,
    completedAt,
  };
}

export class WorkflowRunRepository {
  private db: Database.Database;
  private ownsDb: boolean;

  constructor(dbOrPath: Database.Database | string) {
    if (typeof dbOrPath === "string") {
      this.db = new Database(dbOrPath);
      this.ownsDb = true;
    } else {
      this.db = dbOrPath;
      this.ownsDb = false;
    }
    this.initialize();
  }

  initialize(): void {
    this.db.exec(
      `create table if not exists workflow_runs (
        id text primary key,
        session_id text not null,
        task_id text not null,
        task_type text,
        workflow_name text,
        run_id text,
        source text not null,
        status text not null,
        summary text,
        script_path text,
        transcript_dir text,
        session_url text,
        warning text,
        error text,
        failure_kind text,
        launched_at integer not null,
        updated_at integer not null,
        completed_at integer
      )`
    );
    this.db.exec(
      `create index if not exists idx_workflow_runs_session_updated
       on workflow_runs(session_id, updated_at desc)`
    );
  }

  listWorkflowRuns(sessionId: string): WorkflowRunRecord[] {
    const rows = this.db
      .prepare(
        `select id, session_id, task_id, task_type, workflow_name, run_id, source, status,
                summary, script_path, transcript_dir, session_url, warning, error,
                failure_kind, launched_at, updated_at, completed_at
         from workflow_runs
         where session_id = ?
         order by updated_at desc, launched_at desc, id desc`
      )
      .all(sessionId) as WorkflowRunRow[];
    return rows.map(mapRow);
  }

  getWorkflowRun(id: string): WorkflowRunRecord | undefined {
    const row = this.db
      .prepare(
        `select id, session_id, task_id, task_type, workflow_name, run_id, source, status,
                summary, script_path, transcript_dir, session_url, warning, error,
                failure_kind, launched_at, updated_at, completed_at
         from workflow_runs
         where id = ?`
      )
      .get(id) as WorkflowRunRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  getWorkflowRunByTask(sessionId: string, taskId: string): WorkflowRunRecord | undefined {
    return this.getWorkflowRun(createWorkflowRunId(sessionId, taskId));
  }

  upsertWorkflowRun(patch: WorkflowRunPatch): WorkflowRunRecord {
    const id = patch.id ?? createWorkflowRunId(patch.sessionId, patch.taskId);
    const record = mergeDefined(this.getWorkflowRun(id), { ...patch, id }, Date.now());
    this.db
      .prepare(
        `insert into workflow_runs
          (id, session_id, task_id, task_type, workflow_name, run_id, source, status,
           summary, script_path, transcript_dir, session_url, warning, error, failure_kind,
           launched_at, updated_at, completed_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict(id) do update set
           task_type = excluded.task_type,
           workflow_name = excluded.workflow_name,
           run_id = excluded.run_id,
           source = excluded.source,
           status = excluded.status,
           summary = excluded.summary,
           script_path = excluded.script_path,
           transcript_dir = excluded.transcript_dir,
           session_url = excluded.session_url,
           warning = excluded.warning,
           error = excluded.error,
           failure_kind = excluded.failure_kind,
           launched_at = excluded.launched_at,
           updated_at = excluded.updated_at,
           completed_at = excluded.completed_at`
      )
      .run(
        record.id,
        record.sessionId,
        record.taskId,
        nullable(record.taskType),
        nullable(record.workflowName),
        nullable(record.runId),
        record.source,
        record.status,
        nullable(record.summary),
        nullable(record.scriptPath),
        nullable(record.transcriptDir),
        nullable(record.sessionUrl),
        nullable(record.warning),
        nullable(record.error),
        nullable(record.failureKind),
        record.launchedAt,
        record.updatedAt,
        nullable(record.completedAt),
      );
    return record;
  }

  deleteWorkflowRunsForSession(sessionId: string): void {
    this.db.prepare("delete from workflow_runs where session_id = ?").run(sessionId);
  }

  close(): void {
    if (this.ownsDb) {
      this.db.close();
    }
  }
}
