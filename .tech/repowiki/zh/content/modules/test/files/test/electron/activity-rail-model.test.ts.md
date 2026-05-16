# test/electron/activity-rail-model.test.ts

> 模块：`test` · 语言：`typescript` · 行数：707

## 文件职责

测试活动轨道模型和提示账本的构建，验证提示源分离、历史消息分段、工具输入输出统计、记忆源聚合

## 关键符号

- `buildActivityRailModel@0 - 构建活动轨道数据模型`
- `buildPromptLedgerMessage@0 - 构建提示账本消息，分离系统预设/项目规则/技能文档等来源`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/shared/activity-rail-model.js`
- `../../src/shared/prompt-ledger.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { buildActivityRailModel } from "../../src/shared/activity-rail-model.js";
import { buildPromptLedgerMessage } from "../../src/shared/prompt-ledger.js";

test("buildPromptLedgerMessage separates prompt sources for optimization", () => {
  const ledger = buildPromptLedgerMessage({
    phase: "continue",
    model: "GLM-5.1-FP8",
    cwd: "D:/workspace/ligu",
    prompt: "继续修复 OMG 报表",
    attachments: [{ name: "需求截图.png", kind: "image", chars: 4096 }],
    promptSources: [
      { id: "system-preset", label: "Claude Code preset", sourceKind: "system", chars: 0, sample: "SDK preset" },
      { id: "project-agents", label: "项目 AGENTS.md", sourceKind: "project", text: "项目规则：中文 UI" },
      { id: "skill-doc", label: "feishu skill", sourceKind: "skill", text: "飞书表格读取规则" },
    ],
    memorySources: [
      { id: "summary", label: "滚动摘要", sourceKind: "memory", text: "已读取总报表配置并定位 OMG 字段" },
    ],
    historyMessages: [
      {
        type: "assistant",
        uuid: "assistant-history-tool",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool-history-edit",
              name: "Edit",
              input: { file_path: "src/ui/components/ActivityRail.tsx", old_string: "old".repeat(100), new_string: "new" },
            },
          ],
        },
      } as never,
      {
        type: "user",
        message: {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "tool-read", content: "long tool output".repeat(100), is_error: false },
          ],
        },
      } as never,
    ],
  });

  assert.equal(ledger.type, "prompt_ledger");
  assert.equal(ledger.phase, "continue");
  assert.equal(ledger.model, "GLM-5.1-FP8");
  assert.equal(ledger.buckets.find((bucket) => bucket.id === "project-agents")?.sourceKind, "project");
  assert.equal(ledger.buckets.find((bucket) => bucket.id === "skill-doc")?.sourceKind, "skill");
  assert.equal(ledger.buckets.find((bucket) => bucket.id === "current-prompt")?.chars, "继续修复 OMG 报表".length);
  assert.equal(ledger.buckets.find((bucket) => bucket.id === "current-attachments")?.chars, 4096);
  assert.equal(ledger.buckets.find((bucket) => bucket.id === "summary")?.sourceKind, "memory");
  assert.ok((ledger.buckets.find((bucket) => bucket.id === "history-tool-output")?.chars ?? 0) > 1000);
  assert.ok((ledger.buckets.find((bucket) => bucket.id === "history-tool-input")?.chars ?? 0) > 300);
  assert.ok(ledger.segments.some((segment) => segment.segmentKind === "history_tool_input" && segment.toolName === "Edit"));
  assert.ok(ledger.segments.some((segment) => segment.segmentKind === "history_tool_output"));
  assert.ok(ledger.totalChars > 4096);
});

test("buildActivityRailModel exposes prompt analysis from prompt ledger", () => {
  const ledger = buildPromptLedgerMessage({
    phase: "continue",
    model: "GLM-5.1-FP8",
    cwd: "D:/workspace/ligu",
    prompt: "继续处理报表",
    promptSources: [
      { id: "system-preset", label: "Claude Code preset", sourceKind: "system", chars: 0, sample: "SDK preset" },
      { id: "project-agents", label: "项目 CLAUDE.md", sourceKind: "project", text: "项目规则".repeat(20) },
      { id: "skill-doc", label: "表格 skill", sourceKind: "skill", text: "读取表格规则".repeat(20) },
    ],
    memorySources: [
      { id: "summary", label: "本地摘要", sourceKind: "memory", text: "历史摘要".repeat(20) },
    ],
    historyMessages: [
      {
        type: "user_prompt",
        prompt: "先分析报表字段",
      },
      {
        type: "assistant",
        uuid: "assistant-history-plan",
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "已检查字段来源，下一步需要对比输出口径。",
            },
          ],
        },
      } as never,
    ],
  });

  const model = buildActivityRailModel(
    {
      id: "session-prompt-analysis",
      title: "Prompt Analysis",
      status: "running",
      messages: [
        {
          type: "user_prompt",
          prompt: "先分析报表字段",
        },
        {
          type: "assistant",
          uuid: "assi
... (truncated)
```
