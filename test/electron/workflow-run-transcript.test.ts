import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { findWorkflowRunForTranscript } from "../../src/ui/utils/workflow-run-transcript.js";
import type { WorkflowRunRecord } from "../../src/shared/workflows/workflow-runs.js";

function workflowRun(patch: Partial<WorkflowRunRecord> & Pick<WorkflowRunRecord, "taskId">): WorkflowRunRecord {
  return {
    ...patch,
    id: `session-1:${patch.taskId}`,
    sessionId: "session-1",
    taskId: patch.taskId,
    source: "sdk-workflow-tool",
    status: "running",
    launchedAt: 100,
    updatedAt: 200,
  };
}

describe("workflow run transcript binding", () => {
  it("binds persisted workflow run metadata to the clicked agent transcript by task id", () => {
    const run = workflowRun({ taskId: "task-1", runId: "run-1", scriptPath: ".claude/workflows/demo.md" });

    assert.equal(findWorkflowRunForTranscript({ id: "agent-card-id", taskId: "task-1" }, [run]), run);
  });

  it("falls back to agent id for legacy task cards and does not bind unrelated runs", () => {
    const run = workflowRun({ taskId: "legacy-agent-id", runId: "run-legacy" });

    assert.equal(findWorkflowRunForTranscript({ id: "legacy-agent-id", taskId: "different-task" }, [run]), run);
    assert.equal(findWorkflowRunForTranscript({ id: "agent-2", taskId: "task-2" }, [run]), undefined);
    assert.equal(findWorkflowRunForTranscript(undefined, [run]), undefined);
  });
});
