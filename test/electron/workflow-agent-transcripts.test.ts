import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildWorkflowAgentSummaries,
  buildWorkflowAgentTranscriptView,
} from "../../src/ui/utils/workflow-agent-transcripts.js";
import type { StreamMessage } from "../../src/ui/types.js";

describe("workflow agent transcripts", () => {
  it("compacts repeated task telemetry into one latest progress summary", () => {
    const view = buildWorkflowAgentTranscriptView({
      id: "figma-prep",
      taskId: "figma-prep",
      title: "并行探查项目文档、知识库与 Figma 节点整理范围",
      role: "figma-node-documentation-prep",
      status: "running",
      latestSummary: "节点文档设计：doc-template",
      messageCount: 5,
      toolCount: 0,
      transcript: [
        {
          type: "system",
          subtype: "task_progress",
          task_id: "figma-prep",
          summary: "并行探查项目文档、知识库与 Figma 节点整理范围",
        } as never,
        {
          type: "system",
          subtype: "task_progress",
          task_id: "figma-prep",
          description: "本地范围探查：repo-scope",
        } as never,
        {
          type: "system",
          subtype: "task_progress",
          task_id: "figma-prep",
          description: "节点文档设计：doc-template",
        } as never,
        {
          type: "assistant",
          task_id: "figma-prep",
          message: { role: "assistant", content: [{ type: "text", text: "已完成文档结构检查。" }] },
        } as never,
        {
          type: "system",
          subtype: "task_updated",
          task_id: "figma-prep",
          patch: { status: "running" },
        } as never,
      ],
    });

    assert.equal(view.statusEventCount, 4);
    assert.equal(view.latestProgress, "节点文档设计：doc-template");
    assert.equal(view.messages.length, 1);
    assert.equal(view.messages[0]?.type, "assistant");
  });

  it("keeps dynamic workflow source prompts out of the visible agent transcript", () => {
    const workflowSource = [
      "const dimensions = [{ key: 'architecture', prompt: String.raw`Review ALL changes` }]",
      "phase('Review')",
      "const reviews = await parallel(dimensions.map((dimension) => agent(dimension.prompt)))",
    ].join("\n");
    const agents = buildWorkflowAgentSummaries([
      {
        type: "system",
        subtype: "task_started",
        task_id: "review-architecture",
        tool_use_id: "tool-review-architecture",
        workflow_name: "ultracode-full-review",
        description: "Review: review:architecture",
        prompt: workflowSource,
      } as never,
      {
        type: "system",
        subtype: "task_progress",
        task_id: "review-architecture",
        summary: "正在审查架构与回归风险",
      } as never,
    ]);

    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.title, "review:architecture");
    assert.equal(agents[0]?.messageCount, 1);
    assert.deepEqual(
      agents[0]?.transcript.map((message) => (message as { subtype?: string }).subtype),
      ["task_progress"],
    );
    assert.equal(JSON.stringify(agents[0]?.transcript).includes(workflowSource), false);
  });

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
    assert.equal(agents[0]?.messageCount, 4);
    assert.equal(agents[0]?.toolCount, 1);
    assert.deepEqual(agents[0]?.transcript.map((message) => message.type), [
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
    assert.equal(agents[0]?.messageCount, 2);
    assert.equal(agents[0]?.transcript[0]?.type, "user");
    assert.equal(agents[0]?.transcript[1]?.type, "system");
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
    assert.equal(agents[0]?.messageCount, 1);
    assert.deepEqual(
      agents[0]?.transcript.map((message) => message.type),
      ["system"],
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
    assert.equal(agents[0]?.messageCount, 1);
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
    assert.equal(agents[0]?.messageCount, 1);
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
    assert.equal(agents[0]?.messageCount, 3);
    assert.deepEqual(
      agents[0]?.transcript.map((message) => (message as { subtype?: string }).subtype),
      ["task_progress", "task_progress", "task_updated"],
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

  it("keeps a detached local workflow running after the parent session completes", () => {
    const agents = buildWorkflowAgentSummaries([
      {
        type: "system",
        subtype: "task_started",
        task_id: "workflow-task-1",
        task_type: "local_workflow",
        workflow_name: "phase2-cancellable-hub-image",
        description: "Design and verify cancellable Hub image generation changes",
      } as never,
      {
        type: "system",
        subtype: "task_progress",
        task_id: "workflow-task-1",
        summary: "Reviewing cancellation behavior",
      } as never,
    ], "completed");

    assert.equal(agents[0]?.status, "running");
  });

  it("marks implicit running tasks stopped when the parent session is idle", () => {
    const agents = buildWorkflowAgentSummaries([
      {
        type: "system",
        subtype: "task_started",
        task_id: "research-loop",
        tool_use_id: "tool-research-loop",
        description: "Research canvas libraries",
      } as never,
      {
        type: "system",
        subtype: "task_progress",
        task_id: "research-loop",
        summary: "Still checking package metadata",
      } as never,
    ], "idle");

    assert.equal(agents[0]?.status, "killed");
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

  it("uses task notifications as terminal edges even without task_started", () => {
    const agents = buildWorkflowAgentSummaries([{
      type: "system",
      subtype: "task_notification",
      task_id: "notification-only",
      status: "failed",
      summary: "Typecheck failed",
      output_file: "output.txt",
    } as never]);

    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.status, "failed");
    assert.equal(agents[0]?.latestSummary, "Typecheck failed");
    assert.equal(agents[0]?.messageCount, 1);
  });

  it("keeps background level snapshots separate from task edge state", () => {
    const agents = buildWorkflowAgentSummaries([
      {
        type: "system",
        subtype: "task_started",
        task_id: "edge-task",
        description: "Edge-owned task",
      } as never,
      {
        type: "system",
        subtype: "background_tasks_changed",
        tasks: [{ task_id: "background-1", task_type: "background_task", description: "Index repository" }],
      } as never,
      {
        type: "system",
        subtype: "background_tasks_changed",
        tasks: [],
      } as never,
    ]);

    assert.equal(agents.length, 1);
    assert.equal(agents[0]?.taskId, "edge-task");
    assert.equal(agents[0]?.status, "running");
  });

  it("distinguishes a user-stopped notification from a killed task", () => {
    const agents = buildWorkflowAgentSummaries([{
      type: "system",
      subtype: "task_notification",
      task_id: "stopped-task",
      status: "stopped",
      summary: "Stopped by user",
    } as never]);

    assert.equal(agents[0]?.status, "stopped");
  });

  it("restores paused tasks to the active window when they resume", () => {
    const agents = buildWorkflowAgentSummaries([
      { type: "system", subtype: "task_started", task_id: "resume-task", description: "Resume me" } as never,
      { type: "system", subtype: "task_updated", task_id: "resume-task", patch: { status: "paused" } } as never,
      { type: "system", subtype: "task_updated", task_id: "resume-task", patch: { status: "running" } } as never,
      {
        type: "user",
        parent_tool_use_id: null,
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "unlinked", content: "resumed output" }] },
      } as never,
    ]);

    assert.equal(agents[0]?.status, "running");
    assert.equal(agents[0]?.transcript.some((message) => message.type === "user"), true);
  });

  it("preserves parent_agent_id and computes depth for nested agents", () => {
    const agents = buildWorkflowAgentSummaries([
      { type: "system", subtype: "task_started", task_id: "parent", description: "Parent" } as never,
      { type: "system", subtype: "task_started", task_id: "child", parent_agent_id: "parent", description: "Child" } as never,
      { type: "system", subtype: "task_started", task_id: "grandchild", parent_agent_id: "child", description: "Grandchild" } as never,
    ]);

    assert.equal(agents.find((agent) => agent.id === "child")?.parentAgentId, "parent");
    assert.equal(agents.find((agent) => agent.id === "child")?.depth, 2);
    assert.equal(agents.find((agent) => agent.id === "grandchild")?.depth, 3);
  });

  it("compacts subagent retry telemetry into the latest agent progress", () => {
    const view = buildWorkflowAgentTranscriptView({
      id: "retry-agent",
      taskId: "retry-agent",
      title: "Retry agent",
      role: "Subagent",
      status: "running",
      latestSummary: "Working",
      messageCount: 1,
      toolCount: 0,
      transcript: [{
        type: "tool_progress",
        tool_use_id: "tool-retry",
        tool_name: "Task",
        task_id: "retry-agent",
        subagent_retry: {
          agent_id: "retry-agent",
          attempt: 2,
          max_retries: 4,
          retry_delay_ms: 1500,
          error_status: 429,
          error_category: "rate_limit",
        },
      } as never],
    });

    assert.equal(view.statusEventCount, 1);
    assert.equal(view.messages.length, 0);
    assert.equal(view.latestProgress, "子智能体重试 2/4，等待 1.5 秒");
  });
});
