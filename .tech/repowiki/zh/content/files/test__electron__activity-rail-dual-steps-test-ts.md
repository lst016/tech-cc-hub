# test/electron/activity-rail-dual-steps.test.ts

> 模块：`test` · 语言：`typescript` · 行数：230

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `model@7`
- `model@132`
- `model@180`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/shared/activity-rail-model.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
      id: "session-
... (truncated)
```
