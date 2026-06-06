import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildWorkflowAgentSummaries } from "../../src/ui/utils/workflow-agent-transcripts.js";
import type { StreamMessage } from "../../src/ui/types.js";

describe("workflow agent transcripts", () => {
  it("derives agent cards and child transcripts from task events", () => {
    const messages: StreamMessage[] = [
      {
        type: "system",
        subtype: "task_started",
        task_id: "task-1",
        tool_use_id: "tool-agent-1",
        task_type: "sub_agent",
        description: "Inspect Module 20 config",
        prompt: "Find selected fixes",
        capturedAt: 100,
      } as never,
      {
        type: "assistant",
        parent_tool_use_id: "tool-agent-1",
        capturedAt: 120,
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool-read",
              name: "Read",
              input: { file_path: "src/module20/config.ts" },
            },
          ],
        },
      } as never,
      {
        type: "user",
        parent_tool_use_id: "tool-agent-1",
        capturedAt: 150,
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-read",
              content: "config content",
              is_error: false,
            },
          ],
        },
      } as never,
      {
        type: "system",
        subtype: "task_progress",
        task_id: "task-1",
        summary: "Located config and homepage files",
        capturedAt: 180,
      } as never,
      {
        type: "system",
        subtype: "task_updated",
        task_id: "task-1",
        patch: { status: "completed" },
        capturedAt: 220,
      } as never,
    ];

    const agents = buildWorkflowAgentSummaries(messages);

    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.id, "task-1");
    assert.equal(agents[0]?.title, "Inspect Module 20 config");
    assert.equal(agents[0]?.role, "Subagent");
    assert.equal(agents[0]?.status, "completed");
    assert.equal(agents[0]?.latestSummary, "Located config and homepage files");
    assert.equal(agents[0]?.messageCount, 5);
    assert.equal(agents[0]?.toolCount, 1);
    assert.deepEqual(agents[0]?.transcript.map((message) => message.type), [
      "system",
      "assistant",
      "user",
      "system",
      "system",
    ]);
  });

  it("ignores task events that explicitly skip transcript rendering", () => {
    const agents = buildWorkflowAgentSummaries([
      {
        type: "system",
        subtype: "task_started",
        task_id: "hidden-task",
        tool_use_id: "tool-hidden",
        skip_transcript: true,
      } as never,
    ]);

    assert.deepEqual(agents, []);
  });

  it("uses the single active task window when child messages are not parent-linked", () => {
    const agents = buildWorkflowAgentSummaries([
      {
        type: "system",
        subtype: "task_started",
        task_id: "task-window",
        tool_use_id: "tool-window",
        description: "Write summary",
      } as never,
      {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-output",
              content: "summary saved",
              is_error: false,
            },
          ],
        },
      } as never,
      {
        type: "system",
        subtype: "task_updated",
        task_id: "task-window",
        patch: { status: "completed" },
      } as never,
    ]);

    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.role, "Task");
    assert.equal(agents[0]?.messageCount, 3);
    assert.equal(agents[0]?.transcript[0]?.type, "system");
    assert.equal(agents[0]?.transcript[1]?.type, "user");
  });

  it("does not place main assistant messages into the active agent transcript", () => {
    const agents = buildWorkflowAgentSummaries([
      {
        type: "system",
        subtype: "task_started",
        task_id: "task-active",
        tool_use_id: "tool-active",
        description: "Smoke test the hook script",
      } as never,
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "esbuild does not accept --loader=tsx, so I fixed the script.",
            },
          ],
        },
      } as never,
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "main-edit",
              name: "Edit",
              input: { file_path: ".claude/scripts/post-edit-check.sh" },
            },
          ],
        },
      } as never,
      {
        type: "system",
        subtype: "task_notification",
        task_id: "task-active",
        summary: "Smoke test the hook script",
      } as never,
    ]);

    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.messageCount, 2);
    assert.deepEqual(
      agents[0]?.transcript.map((message) => message.type),
      ["system", "system"],
    );
    assert.equal(agents[0]?.toolCount, 0);
  });

  it("keeps directly task-tagged child messages even without parent metadata", () => {
    const agents = buildWorkflowAgentSummaries([
      {
        type: "system",
        subtype: "task_started",
        task_id: "task-tagged",
        tool_use_id: "tool-tagged",
        description: "Run tagged task",
      } as never,
      {
        type: "assistant",
        task_id: "task-tagged",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tagged-read",
              name: "Read",
              input: { file_path: "src/file.ts" },
            },
          ],
        },
      } as never,
    ]);

    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.messageCount, 2);
    assert.equal(agents[0]?.toolCount, 1);
  });

  it("labels explicit background task types as background tasks", () => {
    const agents = buildWorkflowAgentSummaries([
      {
        type: "system",
        subtype: "task_started",
        task_id: "background-task",
        tool_use_id: "tool-background-task",
        task_type: "background_task",
        description: "Run scheduled follow-up",
      } as never,
    ]);

    assert.equal(agents[0]?.role, "Background task");
  });

  it("links direct tool results by the task tool id when parent metadata is missing", () => {
    const agents = buildWorkflowAgentSummaries([
      {
        type: "system",
        subtype: "task_started",
        task_id: "task-tool-result",
        tool_use_id: "tool-agent-result",
        description: "Run workflow",
      } as never,
      {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-agent-result",
              content: "workflow output",
              is_error: false,
            },
          ],
        },
      } as never,
    ]);

    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.messageCount, 2);
  });

  it("keeps task progress events in the selected agent transcript", () => {
    const agents = buildWorkflowAgentSummaries([
      {
        type: "system",
        subtype: "task_started",
        task_id: "agent-progress",
        tool_use_id: "tool-agent-progress",
        description: "Search backend APIs",
      } as never,
      {
        type: "system",
        subtype: "task_progress",
        task_id: "agent-progress",
        tool_use_id: "tool-agent-progress",
        description: "Searching for getKefuInfo|getQueueCount|getWaitCount",
      } as never,
      {
        type: "system",
        subtype: "task_progress",
        task_id: "agent-progress",
        tool_use_id: "tool-agent-progress",
        description: "Reading ChatListController.java",
      } as never,
      {
        type: "system",
        subtype: "task_updated",
        task_id: "agent-progress",
        patch: { status: "completed" },
      } as never,
    ]);

    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.messageCount, 4);
    assert.deepEqual(
      agents[0]?.transcript.map((message) => (message as { subtype?: string }).subtype),
      ["task_started", "task_progress", "task_progress", "task_updated"],
    );
    assert.equal(agents[0]?.latestSummary, "Reading ChatListController.java");
    assert.equal(agents[0]?.status, "completed");
  });

  it("settles implicit running tasks when the parent session completed", () => {
    const messages: StreamMessage[] = [
      {
        type: "system",
        subtype: "task_started",
        task_id: "typecheck-1",
        tool_use_id: "tool-typecheck-1",
        description: "Typecheck the project for errors",
      } as never,
      {
        type: "system",
        subtype: "task_notification",
        task_id: "typecheck-1",
        summary: "Typecheck the project for errors",
      } as never,
      {
        type: "result",
        subtype: "success",
        is_error: false,
        result: "done",
      } as never,
    ];

    assert.equal(buildWorkflowAgentSummaries(messages, "running")[0]?.status, "running");
    assert.equal(buildWorkflowAgentSummaries(messages, "completed")[0]?.status, "completed");
  });

  it("marks implicit running tasks failed when the parent session errors", () => {
    const agents = buildWorkflowAgentSummaries([
      {
        type: "system",
        subtype: "task_started",
        task_id: "typecheck-error",
        tool_use_id: "tool-typecheck-error",
        description: "Typecheck the project for errors",
      } as never,
    ], "error");

    assert.equal(agents[0]?.status, "failed");
  });
});
