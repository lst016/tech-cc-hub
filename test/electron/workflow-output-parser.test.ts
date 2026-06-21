import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  collectWorkflowToolUseNames,
  extractWorkflowRunPatchesFromMessage,
} from "../../src/electron/libs/workflows/workflow-output-parser.js";

describe("workflow output parser", () => {
  it("extracts WorkflowOutput from string JSON tool results", () => {
    const toolNames = new Map<string, string>();
    collectWorkflowToolUseNames({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "tool-workflow-1",
            name: "Workflow",
            input: { scriptPath: "/repo/.claude/workflows/inspect.js" },
          },
        ],
      },
    } as never, toolNames);

    const patches = extractWorkflowRunPatchesFromMessage({
      sessionId: "session-1",
      message: {
        type: "user",
        capturedAt: 1_000,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-workflow-1",
              content: JSON.stringify({
                status: "async_launched",
                taskId: "task-1",
                taskType: "local_workflow",
                workflowName: "Repository inspection",
                runId: "run-1",
                summary: "Started repository inspection",
                transcriptDir: "/tmp/workflow-transcripts/run-1",
                scriptPath: "/repo/.claude/workflows/inspect.js",
              }),
            },
          ],
        },
      } as never,
      toolUseNames: toolNames,
    });

    assert.equal(patches.length, 1);
    assert.deepEqual(patches[0], {
      sessionId: "session-1",
      taskId: "task-1",
      taskType: "local_workflow",
      workflowName: "Repository inspection",
      runId: "run-1",
      source: "sdk-workflow-tool",
      status: "running",
      summary: "Started repository inspection",
      transcriptDir: "/tmp/workflow-transcripts/run-1",
      scriptPath: "/repo/.claude/workflows/inspect.js",
      launchedAt: 1_000,
      updatedAt: 1_000,
    });
  });

  it("extracts WorkflowOutput from structured tool result content", () => {
    const patches = extractWorkflowRunPatchesFromMessage({
      sessionId: "session-2",
      message: {
        type: "user",
        capturedAt: 2_000,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-workflow-2",
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    status: "remote_launched",
                    taskId: "task-remote",
                    taskType: "remote_agent",
                    workflowName: "Remote audit",
                    sessionUrl: "https://claude.ai/session/remote",
                    warning: "Launched remotely",
                  }),
                },
              ],
            },
          ],
        },
      } as never,
      toolUseNames: new Map([["tool-workflow-2", "mcp__claude__Workflow"]]),
    });

    assert.equal(patches.length, 1);
    assert.equal(patches[0]?.taskId, "task-remote");
    assert.equal(patches[0]?.status, "running");
    assert.equal(patches[0]?.taskType, "remote_agent");
    assert.equal(patches[0]?.sessionUrl, "https://claude.ai/session/remote");
    assert.equal(patches[0]?.warning, "Launched remotely");
  });

  it("turns workflow task system events into run updates", () => {
    const started = extractWorkflowRunPatchesFromMessage({
      sessionId: "session-3",
      message: {
        type: "system",
        subtype: "task_started",
        task_id: "task-local",
        task_type: "local_workflow",
        workflow_name: "Local plan",
        description: "Running local dynamic workflow",
        capturedAt: 3_000,
      } as never,
      toolUseNames: new Map(),
    });
    const completed = extractWorkflowRunPatchesFromMessage({
      sessionId: "session-3",
      message: {
        type: "system",
        subtype: "task_updated",
        task_id: "task-local",
        patch: { status: "completed" },
        summary: "Done",
        capturedAt: 4_000,
      } as never,
      toolUseNames: new Map(),
    });

    assert.equal(started[0]?.status, "running");
    assert.equal(started[0]?.workflowName, "Local plan");
    assert.equal(started[0]?.summary, "Running local dynamic workflow");
    assert.equal(completed[0]?.status, "completed");
    assert.equal(completed[0]?.completedAt, 4_000);
    assert.equal(completed[0]?.summary, "Done");
  });
});
