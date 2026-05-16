# doc/superpowers/plans/2026-04-20-right-context-rail-timeline-first.md

> 模块：`doc` · 语言：`markdown` · 行数：228

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "SP-001"
title: "Right Context Rail Timeline-First Implementation Plan"
doc_type: "delivery"
layer: "L3"
status: "active"
version: "1.0.0"
last_updated: "2026-04-20"
owners:
  - "Engineering"
tags:
  - "claw"
  - "docs"
  - "superpowers"
  - "plan"
  - "activity-rail"
  - "timeline"
---

# Right Context Rail Timeline-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current metric-heavy right rail with a timeline-first execution analysis rail that surfaces live trace, selected-step detail, and compact analysis insights.

**Architecture:** Extract a pure right-rail view-model builder from the current `ActivityRail` message-walking logic so we can test the trace semantics independently from React. Then rebuild the UI around that model with timeline-first sections: summary strip, filters, live timeline, selected-step detail, and compact analysis insights.

**Tech Stack:** React 19, TypeScript, Zustand session state, Claude Agent SDK message types, Node test runner for pure model tests, Electron real-window QA.

---

### Task 1: Lock The Timeline-First View Model

**Files:**
- Create: `src/shared/activity-rail-model.ts`
- Create: `src/electron/activity-rail-model.test.ts`
- Modify: `src/ui/components/ActivityRail.tsx`

- [ ] **Step 1: Write the failing test**

```ts
test("buildActivityRailModel prioritizes trace items and attention signals", () => {
  const model = buildActivityRailModel(
    {
      id: "session-1",
      title: "Trace Session",
      status: "completed",
      cwd: "D:/workspace/demo",
      messages: [
        { type: "user_prompt", prompt: "analyze this image", attachments: [{ id: "img-1", kind: "image", name: "banana.png", mimeType: "image/png", data: "data:image/png;base64,AAAA" }] },
        {
          type: "assistant",
          uuid: "assistant-1",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-1",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              { type: "tool_use", id: "tool-1", name: "Read", input: { file_path: "README.md" } },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: null, cache_read_input_tokens: null },
          },
        } as never,
        {
          type: "user",
          uuid: "user-1",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "tool-1", content: "ENOENT", is_error: true },
            ],
          },
        } as never,
        {
          type: "result",
          uuid: "result-1",
          session_id: "remote-1",
          subtype: "success",
          duration_ms: 3900,
          duration_api_ms: 3200,
          total_cost_usd: 0.0123,
          usage: { input_tokens: 5392, output_tokens: 120, cache_creation_input_tokens: null, cache_read_input_tokens: 0 },
          result: "The image says BANANA.",
        } as never,
      ],
    },
    [{ toolUseId: "perm-1", toolName: "Bash", input: { command: "rm -rf tmp" } }],
    "BANANA",
  );

  assert.equal(model.timeline[0]?.title, "等待人工确认 Bash");
  assert.equal(model.filters.attention, 2);
  assert.equal(model.summary.latestResultLabel, "已完成");
  assert.equal(model.analysisCards[0]?.title, "当前阻塞");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run transpile:electron && node --test dist-electron/electron/activity-rail-model.test.js`
Expected: FAIL because `buildActivityRailModel` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildActivityRailModel(session, permissionRequests, partialMessage) {
  return {
    summary: { latestResultLabel: "已完成" },
    filters: { all: 0, attention: 0, tool: 0, context: 0, resu
... (truncated)
```
