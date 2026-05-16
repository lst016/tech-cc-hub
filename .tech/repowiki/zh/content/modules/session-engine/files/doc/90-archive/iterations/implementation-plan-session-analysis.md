# doc/90-archive/iterations/implementation-plan-session-analysis.md

> 模块：`session-engine` · 语言：`markdown` · 行数：531

## 文件职责

会话执行分析实现计划

## 关键符号

- `目标@0 - 双轨Step（plan steps / execution steps）增强和模型层扩展`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-63"
title: "会话执行分析与右栏增强 Implementation Plan"
doc_type: "delivery"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-20"
owners:
  - "Product"
  - "Engineering"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "delivery"
  - "plan"
  - "analysis"
  - "activity-rail"
---

# 会话执行分析与右栏增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 先完成右侧执行轨迹的双轨 Step 增强与数据对象拆分，为后续单会话分析页、人工标注和 AI 调优记录打好底座。

**Architecture:** 保留 `sessions/messages` 作为唯一事实源，在共享模型层新增 `plan steps` 与 `execution steps` 的双轨投影，再由右侧 UI 消费这些新对象。首批实现只做右栏增强和模型层扩展，不在本轮引入完整数据库表与独立分析页路由。

**Tech Stack:** Electron 39、React 19、TypeScript 5.9、Zustand、Node test、better-sqlite3

---

### Task 1: 扩展共享模型为双轨 Step 投影

**Files:**
- Modify: `src/shared/activity-rail-model.ts`
- Test: `src/electron/activity-rail-model.test.ts`

- [ ] **Step 1: 写失败测试，描述 plan/execution 双轨对象**

```ts
test("buildActivityRailModel exposes plan steps separately from execution steps", () => {
  const model = buildActivityRailModel(
    {
      id: "session-plan-split",
      title: "Trace Session",
      status: "completed",
      messages: [
        {
          type: "user_prompt",
          prompt: "修复右栏并验证",
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
                text: "1. 检查现状\n2. 修改组件\n3. 运行构建验证",
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
          capturedAt: 1400,
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
      ],
    },
    [],
    "",
  );

  assert.equal(model.planSteps.length, 3);
  assert.equal(model.executionSteps.length, 1);
  assert.equal(model.planSteps[0]?.indexLabel, "Step 1");
  assert.equal(model.executionSteps[0]?.title, "检查现状");
  assert.deepEqual(model.executionSteps[0]?.planStepIds, [model.planSteps[0]?.id]);
});
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run: `npm run transpile:electron`

Run: `node --test src/electron/activity-rail-model.test.ts`

Expected: FAIL，报错指出 `planSteps` / `executionSteps` 字段不存在，或断言长度不匹配。

- [ ] **Step 3: 最小实现双轨 Step 类型和投影**

```ts
export type ActivityPlanStepStatus = "pending" | "running" | "completed" | "drifted";

export type ActivityPlanStep = {
  id: string;
  index: number;
  indexLabel: string;
  title: string;
  detail: string;
  round: number;
  status: ActivityPlanStepStatus;
  sourceT
... (truncated)
```
