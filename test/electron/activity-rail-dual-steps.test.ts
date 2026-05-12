import test from "node:test";
import assert from "node:assert/strict";

import { buildActivityRailModel } from "../../src/shared/activity-rail-model.js";

test("buildActivityRailModel exposes plan steps separately from execution steps", () => {
  const model = buildActivityRailModel(
    {
      id: "session-plan-split",
      title: "Trace Session",
      status: "completed",
      messages: [
        {
          type: "user_prompt",
          prompt: "split plan and execution steps",
        },
        {
          type: "assistant",
          capturedAt: 1000,
          uuid: "assistant-plan",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-plan",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              {
                type: "text",
                text: "1. Inspect current panel\n2. Update component structure\n3. Run build verification",
              },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        {
          type: "assistant",
          capturedAt: 1100,
          uuid: "assistant-read",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-read",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              { type: "tool_use", id: "tool-read", name: "Read", input: { file_path: "src/ui/components/ActivityRail.tsx" } },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        {
          type: "user",
          capturedAt: 1200,
          uuid: "user-read",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "tool-read", content: "file content", is_error: false },
            ],
          },
        } as never,
        {
          type: "assistant",
          capturedAt: 1300,
          uuid: "assistant-edit",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-edit",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              { type: "tool_use", id: "tool-edit", name: "Edit", input: { file_path: "src/ui/components/ActivityRail.tsx" } },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        {
          type: "user",
          capturedAt: 1400,
          uuid: "user-edit",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "tool-edit", content: "edit applied", is_error: false },
            ],
          },
        } as never,
      ],
    },
    [],
    "",
  );

  assert.equal(model.planSteps.length, 3);
  assert.equal(model.executionSteps.length, 3);
  assert.equal(model.planSteps[0]?.indexLabel, "Step 1");
  assert.equal(model.executionSteps[0]?.title, "Inspect current panel");
  assert.deepEqual(model.executionSteps[0]?.planStepIds, [model.planSteps[0]?.id]);
});

test("buildActivityRailModel exposes labels for plan and execution sections", () => {
  const model = buildActivityRailModel(
    {
      id: "session-plan-sections",
      title: "Trace Session",
      status: "completed",
      messages: [
        {
          type: "user_prompt",
          prompt: "split plan and execution sections",
        },
        {
          type: "assistant",
          capturedAt: 1000,
          uuid: "assistant-plan",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-plan",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              {
                type: "text",
                text: "1. Inspect current panel\n2. Update component structure\n3. Run build verification",
              },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
      ],
    },
    [],
    "",
  );

  assert.equal(model.taskSectionTitle, "任务步骤");
  assert.equal(model.executionSectionTitle, "步骤汇总");
});

test("buildActivityRailModel keeps pending plan-driven execution steps without actionable metrics", () => {
  const model = buildActivityRailModel(
    {
      id: "session-hollow-execution-step",
      title: "Trace Session",
      status: "running",
      messages: [
        {
          type: "user_prompt",
          prompt: "decide whether to keep some content",
        },
        {
          type: "assistant",
          capturedAt: 1000,
          uuid: "assistant-plan",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-plan",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              {
                type: "text",
                text: "1. Decide whether to keep some special content\n2. Return the recommendation",
              },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
      ],
    },
    [],
    "",
  );

  assert.equal(model.executionSteps.length, 2);
  assert.equal(model.planSteps.length, 2);
  assert.equal(model.planSteps[0]?.status, "pending");
  assert.equal(model.planSteps[1]?.status, "pending");
  assert.equal(model.executionSteps[0]?.status, "pending");
  assert.equal(model.executionSteps[1]?.status, "pending");
});
