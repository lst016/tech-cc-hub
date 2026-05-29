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
    assert.equal(agents[0]?.messageCount, 3);
    assert.equal(agents[0]?.transcript[0]?.type, "system");
    assert.equal(agents[0]?.transcript[1]?.type, "user");
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
});
