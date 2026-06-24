import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  collectWorkflowToolUseNames,
  extractWorkflowRunPatchesFromMessage,
} from "../../src/electron/libs/workflows/workflow-output-parser.js";
import { WorkflowRunRepository } from "../../src/electron/libs/workflows/workflow-run-store.js";

describe("workflow run events", () => {
  it("merges SDK WorkflowOutput and task status events into one run record", () => {
    const repository = new WorkflowRunRepository(":memory:");
    const toolUseNames = new Map<string, string>();

    collectWorkflowToolUseNames({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "tool-1", name: "Workflow", input: {} }],
      },
    } as never, toolUseNames);

    for (const patch of extractWorkflowRunPatchesFromMessage({
      sessionId: "session-1",
      message: {
        type: "user",
        capturedAt: 1_000,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-1",
              content: JSON.stringify({
                status: "async_launched",
                taskId: "task-1",
                workflowName: "Repo audit",
                runId: "run-1",
                scriptPath: "/repo/audit.js",
              }),
            },
          ],
        },
      } as never,
      toolUseNames,
    })) {
      repository.upsertWorkflowRun(patch);
    }

    for (const patch of extractWorkflowRunPatchesFromMessage({
      sessionId: "session-1",
      message: {
        type: "system",
        subtype: "task_updated",
        task_id: "task-1",
        patch: { status: "failed" },
        summary: "Script failed",
        capturedAt: 2_000,
      } as never,
      toolUseNames,
    })) {
      repository.upsertWorkflowRun(patch);
    }

    const runs = repository.listWorkflowRuns("session-1");
    repository.close();

    assert.equal(runs.length, 1);
    assert.equal(runs[0]?.workflowName, "Repo audit");
    assert.equal(runs[0]?.scriptPath, "/repo/audit.js");
    assert.equal(runs[0]?.status, "failed");
    assert.equal(runs[0]?.summary, "Script failed");
    assert.equal(runs[0]?.completedAt, 2_000);
  });
});
