import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SessionStore } from "../../src/electron/libs/session-store.js";

describe("workflow run store", () => {
  it("inserts, updates, lists, and deletes workflow runs by session", () => {
    const dir = mkdtempSync(join(tmpdir(), "workflow-runs-"));
    const dbPath = join(dir, "sessions.db");
    const store = new SessionStore(dbPath);

    try {
      const session = store.createSession({ title: "Workflow session" });
      const inserted = store.upsertWorkflowRun({
        sessionId: session.id,
        taskId: "task-1",
        taskType: "local_workflow",
        workflowName: "Repository inspection",
        runId: "run-1",
        source: "sdk-workflow-tool",
        status: "running",
        summary: "Started",
        scriptPath: "/repo/workflow.js",
        transcriptDir: "/tmp/transcripts/run-1",
        launchedAt: 1_000,
        updatedAt: 1_000,
      });

      assert.equal(inserted.id, `${session.id}:task-1`);
      assert.equal(store.listWorkflowRuns(session.id).length, 1);

      const updated = store.upsertWorkflowRun({
        sessionId: session.id,
        taskId: "task-1",
        status: "completed",
        summary: "Completed",
        completedAt: 2_000,
        updatedAt: 2_000,
      });

      assert.equal(updated.scriptPath, "/repo/workflow.js");
      assert.equal(updated.status, "completed");
      assert.equal(updated.summary, "Completed");
      assert.equal(updated.completedAt, 2_000);
      assert.deepEqual(store.listWorkflowRuns(session.id).map((run) => run.id), [inserted.id]);

      store.deleteSession(session.id);
      assert.deepEqual(store.listWorkflowRuns(session.id), []);
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges relaunched workflow tasks by stable run id", () => {
    const dir = mkdtempSync(join(tmpdir(), "workflow-runs-run-id-"));
    const dbPath = join(dir, "sessions.db");
    const store = new SessionStore(dbPath);

    try {
      const session = store.createSession({ title: "Workflow session" });
      const first = store.upsertWorkflowRun({
        sessionId: session.id,
        taskId: "task-old",
        taskType: "local_workflow",
        workflowName: "Repository inspection",
        runId: "wf_123",
        source: "sdk-workflow-tool",
        status: "unknown",
        summary: "No completion record was found for background workflow",
        scriptPath: "/repo/workflow.js",
        launchedAt: 1_000,
        updatedAt: 1_000,
      });

      const relaunched = store.upsertWorkflowRun({
        sessionId: session.id,
        taskId: "task-new",
        taskType: "local_workflow",
        workflowName: "Repository inspection",
        runId: "wf_123",
        source: "sdk-workflow-tool",
        status: "running",
        summary: "Relaunched",
        launchedAt: 2_000,
        updatedAt: 2_000,
      });

      const runs = store.listWorkflowRuns(session.id);
      assert.equal(first.id, `${session.id}:task-old`);
      assert.equal(relaunched.id, `${session.id}:task-new`);
      assert.equal(runs.length, 1);
      assert.equal(runs[0]?.id, relaunched.id);
      assert.equal(runs[0]?.taskId, "task-new");
      assert.equal(runs[0]?.runId, "wf_123");
      assert.equal(runs[0]?.status, "running");
      assert.equal(runs[0]?.summary, "Relaunched");
      assert.equal(runs[0]?.scriptPath, "/repo/workflow.js");
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not let stale unknown workflow patches overwrite newer status", () => {
    const dir = mkdtempSync(join(tmpdir(), "workflow-runs-stale-"));
    const dbPath = join(dir, "sessions.db");
    const store = new SessionStore(dbPath);

    try {
      const session = store.createSession({ title: "Workflow session" });
      store.upsertWorkflowRun({
        sessionId: session.id,
        taskId: "task-new",
        taskType: "local_workflow",
        workflowName: "Repository inspection",
        runId: "wf_123",
        source: "sdk-workflow-tool",
        status: "running",
        summary: "Running",
        launchedAt: 2_000,
        updatedAt: 2_000,
      });

      store.upsertWorkflowRun({
        sessionId: session.id,
        taskId: "task-old",
        taskType: "local_workflow",
        workflowName: "Repository inspection",
        runId: "wf_123",
        source: "sdk-workflow-tool",
        status: "unknown",
        summary: "No completion record was found for background workflow",
        launchedAt: 1_000,
        updatedAt: 1_000,
      });

      const runs = store.listWorkflowRuns(session.id);
      assert.equal(runs.length, 1);
      assert.equal(runs[0]?.id, `${session.id}:task-new`);
      assert.equal(runs[0]?.taskId, "task-new");
      assert.equal(runs[0]?.status, "running");
      assert.equal(runs[0]?.summary, "Running");
      assert.equal(runs[0]?.updatedAt, 2_000);
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("collapses duplicate persisted workflow rows by stable run id when listing", () => {
    const dir = mkdtempSync(join(tmpdir(), "workflow-runs-list-collapse-"));
    const dbPath = join(dir, "sessions.db");
    const store = new SessionStore(dbPath);

    try {
      const session = store.createSession({ title: "Workflow session" });
      const db = store.getDatabaseForTest();
      db.prepare(
        `insert into workflow_runs
          (id, session_id, task_id, task_type, workflow_name, run_id, source, status,
           summary, script_path, transcript_dir, session_url, warning, error, failure_kind,
           launched_at, updated_at, completed_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `${session.id}:task-old`,
        session.id,
        "task-old",
        "local_workflow",
        "Repository inspection",
        "wf_123",
        "sdk-workflow-tool",
        "unknown",
        "No completion record was found for background workflow",
        "/repo/workflow.js",
        "/tmp/transcripts/wf_123",
        null,
        null,
        null,
        null,
        1_000,
        1_000,
        null,
      );
      db.prepare(
        `insert into workflow_runs
          (id, session_id, task_id, task_type, workflow_name, run_id, source, status,
           summary, script_path, transcript_dir, session_url, warning, error, failure_kind,
           launched_at, updated_at, completed_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `${session.id}:task-new`,
        session.id,
        "task-new",
        "local_workflow",
        "Repository inspection",
        "wf_123",
        "sdk-workflow-tool",
        "running",
        "Running",
        null,
        null,
        null,
        null,
        null,
        null,
        2_000,
        2_000,
        null,
      );

      const runs = store.listWorkflowRuns(session.id);
      assert.equal(runs.length, 1);
      assert.equal(runs[0]?.id, `${session.id}:task-new`);
      assert.equal(runs[0]?.taskId, "task-new");
      assert.equal(runs[0]?.status, "running");
      assert.equal(runs[0]?.summary, "Running");
      assert.equal(runs[0]?.scriptPath, "/repo/workflow.js");
      assert.equal(runs[0]?.transcriptDir, "/tmp/transcripts/wf_123");
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates the workflow_runs table for an existing database", () => {
    const dir = mkdtempSync(join(tmpdir(), "workflow-runs-migrate-"));
    const dbPath = join(dir, "sessions.db");
    const store = new SessionStore(dbPath);

    try {
      const table = store
        .getDatabaseForTest()
        .prepare("select name from sqlite_master where type = 'table' and name = 'workflow_runs'")
        .get() as { name?: string } | undefined;
      assert.equal(table?.name, "workflow_runs");
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
