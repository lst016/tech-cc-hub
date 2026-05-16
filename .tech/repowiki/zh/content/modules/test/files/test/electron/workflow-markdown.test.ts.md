# test/electron/workflow-markdown.test.ts

> 模块：`test` · 语言：`typescript` · 行数：278

## 文件职责

测试工作流Markdown文档解析，验证workflow元数据（id/name/priority/tags/triggers）、步骤配置（depends_on/tools_hint/user_actions）、运行时字段拒绝、非数字优先级拒绝

## 关键符号

- `parseWorkflowMarkdown@0 - 解析工作流Markdown文档，返回document或errors数组`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/shared/workflow-markdown.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { createInitialSessionWorkflowState, parseWorkflowMarkdown } from "../../src/shared/workflow-markdown.js";

test("parseWorkflowMarkdown parses a valid workflow document", () => {
  const markdown = `---
workflow_id: "bugfix-basic"
name: "基础问题修复流程"
version: "1.0.0"
scope: "project"
mode: "single-thread"
entry: "manual"
owner: "user"
auto_advance: true
auto_bind: true
priority: 85
tags:
  - "bugfix"
  - "engineering"
triggers:
  - "按钮失效"
  - "样式异常"
match_tags:
  - "frontend"
  - "react"
applies_to_paths:
  - "src/ui/**"
exclude_tags:
  - "backend"
exclude_paths:
  - "scripts/**"
---

# 基础问题修复流程

## 目标
定位问题并完成修复。

## 使用规则
- 一次只推进一个步骤
- 可以随时重试

## 输入上下文
- 当前项目代码

## 输出产物
- 修复说明

## 步骤

### STEP-1
\`\`\`yaml
id: "STEP-1"
title: "定位问题"
executor: "primary-agent"
intent: "inspect"
user_actions: ["run", "skip", "edit"]
done_when: "找到根因"
\`\`\`
先读代码，不直接修改文件。

### STEP-2
\`\`\`yaml
id: "STEP-2"
title: "实施修复"
executor: "primary-agent"
intent: "implement"
depends_on: ["STEP-1"]
tools_hint:
  - "Read"
  - "Edit"
done_when: "完成必要修改"
\`\`\`
只修改必要文件。`;

  const result = parseWorkflowMarkdown(markdown);

  assert.equal(result.ok, true);
  assert.ok(result.document);
  assert.equal(result.document?.workflowId, "bugfix-basic");
  assert.equal(result.document?.autoAdvance, true);
  assert.equal(result.document?.autoBind, true);
  assert.equal(result.document?.priority, 85);
  assert.deepEqual(result.document?.tags, ["bugfix", "engineering"]);
  assert.deepEqual(result.document?.triggers, ["按钮失效", "样式异常"]);
  assert.deepEqual(result.document?.matchTags, ["frontend", "react"]);
  assert.deepEqual(result.document?.appliesToPaths, ["src/ui/**"]);
  assert.deepEqual(result.document?.excludeTags, ["backend"]);
  assert.deepEqual(result.document?.excludePaths, ["scripts/**"]);
  assert.equal(result.document?.steps.length, 2);
  assert.deepEqual(result.document?.steps[0].userActions, ["run", "skip", "edit"]);
  assert.deepEqual(result.document?.steps[1].dependsOn, ["STEP-1"]);
  assert.deepEqual(result.document?.steps[1].toolsHint, ["Read", "Edit"]);
});

test("parseWorkflowMarkdown rejects non-numeric workflow priority", () => {
  const markdown = `---
workflow_id: "invalid-priority"
name: "非法优先级"
version: "1.0.0"
scope: "project"
mode: "single-thread"
entry: "manual"
owner: "user"
priority: "high"
---

# 非法优先级
## 目标
测试优先级字段。
## 使用规则
- 测试

## 步骤

### STEP-1
\`\`\`yaml
id: "STEP-1"
title: "第一步"
executor: "primary-agent"
intent: "inspect"
done_when: "完成"
\`\`\`
说明。`;

  const result = parseWorkflowMarkdown(markdown);

  assert.equal(result.ok, false);
  assert.match(result.errors.map((item) => item.message).join("\n"), /priority/);
});

test("parseWorkflowMarkdown rejects runtime fields in source markdown", () => {
  const markdown = `---
workflow_id: "runtime-leak"
name: "运行态污染"
version: "1.0.0"
scope: "session"
mode: "single-thread"
entry: "manual"
owner: "user"
current_step: "STEP-1"
---

# 运行态污染

## 目标
测试错误。

## 使用规则
- 不允许把运行态写入源文件

## 步骤

### STEP-1
\`\`\`yaml
id: "STEP-1"
title: "定位问题"
executor: "primary-agent"
intent: "inspect"
status: "pending"
done_when: "完成"
\`\`\`
说明。`;

  const result = parseWorkflowMarkdown(markdown);

  assert.equal(result.ok, false);
  assert.match(result.errors.map((item) => item.message).join("\n"), /current_step/);
  assert.match(result.errors.map((item) => item.message).join("\n"), /status/);
});

test("parseWorkflowMarkdown rejects mismatched step ids and unknown dependencies", () => {
  const markdown = `---
workflow_id: "invalid-steps"
name: "非法步骤"
version: "1.0.0"
scope: "project"
mode: "single-thread"
entry: "manual"
owner: "user"
---

# 非法步骤

## 目标
测试无效步骤。

## 使用规则
- 测试

## 步骤

### STEP-1
\`\`\`yaml
id: "STEP-X"
title: "第一步"
executor: "primary-agent"
intent: "inspect"
done_when: "完成"
\`\`\`
说明。

### STEP-2
\`\`\`yaml
id: "STEP-2"
title: "第二步"
executor: "primary-agent"
intent: "implement"
depends_on: ["STEP-404"]
done_when: "完成"
\`\`\`
说明。`;

  const result = parseWorkflowMarkdown(markdown);

  assert.equal(result.ok, false);
  assert.match(result.errors.map((item) => item.message).join("\n"), /不一致/);
  assert.match(result.errors.map(
... (truncated)
```
