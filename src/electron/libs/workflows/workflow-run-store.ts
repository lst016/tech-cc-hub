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
  const isStalePatch = existing !== undefined
    && patch.updatedAt !== undefined
    && patch.updatedAt < existing.updatedAt;
  const pick = <T>(patched: T | undefined, current: T | undefined): T | undefined => (
    isStalePatch ? current ?? patched : patched ?? current
  );
  const id = patch.id ?? existing?.id ?? createWorkflowRunId(patch.sessionId, patch.taskId);
  const patchedStatus = pick(patch.status, existing?.status) ?? "unknown";
  const status = patch.status === "unknown" && existing?.status && existing.status !== "unknown"
    ? existing.status
    : patchedStatus;
  const updatedAt = isStalePatch ? existing.updatedAt : patch.updatedAt ?? now;
  const completedAt = patch.completedAt
    ?? existing?.completedAt
    ?? (isTerminalWorkflowRunStatus(status) ? updatedAt : undefined);

  return {
    id,
    sessionId: patch.sessionId,
    taskId: pick(patch.taskId, existing?.taskId) ?? patch.taskId,
    taskType: pick(patch.taskType, existing?.taskType),
    workflowName: pick(patch.workflowName, existing?.workflowName),
    runId: pick(patch.runId, existing?.runId),
    source: pick(patch.source, existing?.source) ?? "unknown",
    status,
    summary: pick(patch.summary, existing?.summary),
    scriptPath: pick(patch.scriptPath, existing?.scriptPath),
    transcriptDir: pick(patch.transcriptDir, existing?.transcriptDir),
    sessionUrl: pick(patch.sessionUrl, existing?.sessionUrl),
    warning: pick(patch.warning, existing?.warning),
    error: pick(patch.error, existing?.error),
    failureKind: pick(patch.failureKind, existing?.failureKind),
    launchedAt: pick(patch.launchedAt, existing?.launchedAt) ?? updatedAt,
    updatedAt,
    completedAt,
  };
}

function pickLatestRecord(records: Array<WorkflowRunRecord | undefined>): WorkflowRunRecord | undefined {
  return records
    .filter((record): record is WorkflowRunRecord => Boolean(record))
    .sort((a, b) => b.updatedAt - a.updatedAt || b.launchedAt - a.launchedAt || b.id.localeCompare(a.id))[0];
}

function toPatch(record: WorkflowRunRecord): WorkflowRunPatch {
  return {
    id: record.id,
    sessionId: record.sessionId,
    taskId: record.taskId,
    taskType: record.taskType,
    workflowName: record.workflowName,
    runId: record.runId,
    source: record.source,
    status: record.status,
    summary: record.summary,
    scriptPath: record.scriptPath,
    transcriptDir: record.transcriptDir,
    sessionUrl: record.sessionUrl,
    warning: record.warning,
    error: record.error,
    failureKind: record.failureKind,
    launchedAt: record.launchedAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
  };
}

function collapseWorkflowRunDuplicates(records: WorkflowRunRecord[]): WorkflowRunRecord[] {
  const byStableRunId = new Map<string, WorkflowRunRecord>();
  const collapsed: WorkflowRunRecord[] = [];

  for (const record of records) {
    if (!record.runId) {
      collapsed.push(record);
      continue;
    }

    const key = `${record.sessionId}:${record.runId}`;
    const existing = byStableRunId.get(key);
    if (!existing) {
      byStableRunId.set(key, record);
      collapsed.push(record);
      continue;
    }

    Object.assign(existing, mergeDefined(existing, toPatch(record), existing.updatedAt));
    existing.id = createWorkflowRunId(existing.sessionId, existing.taskId);
  }

  return collapsed;
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
    this.db.exec(
      `create index if not exists idx_workflow_runs_session_run_id
       on workflow_runs(session_id, run_id)
       where run_id is not null`
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
    return collapseWorkflowRunDuplicates(rows.map(mapRow));
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

  getWorkflowRunByRunId(sessionId: string, runId: string): WorkflowRunRecord | undefined {
    const row = this.db
      .prepare(
        `select id, session_id, task_id, task_type, workflow_name, run_id, source, status,
                summary, script_path, transcript_dir, session_url, warning, error,
                failure_kind, launched_at, updated_at, completed_at
         from workflow_runs
         where session_id = ? and run_id = ?
         order by updated_at desc, launched_at desc, id desc
         limit 1`
      )
      .get(sessionId, runId) as WorkflowRunRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  upsertWorkflowRun(patch: WorkflowRunPatch): WorkflowRunRecord {
    const targetId = patch.id ?? createWorkflowRunId(patch.sessionId, patch.taskId);
    const existingById = this.getWorkflowRun(targetId);
    const existingByRunId = patch.runId ? this.getWorkflowRunByRunId(patch.sessionId, patch.runId) : undefined;
    const existing = pickLatestRecord([existingById, existingByRunId]);
    const merged = mergeDefined(existing, { ...patch, id: targetId }, Date.now());
    const record = {
      ...merged,
      id: patch.id ?? createWorkflowRunId(merged.sessionId, merged.taskId),
    };

    if (patch.runId) {
      this.db
        .prepare("delete from workflow_runs where session_id = ? and run_id = ? and id != ?")
        .run(record.sessionId, patch.runId, record.id);
    }

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
