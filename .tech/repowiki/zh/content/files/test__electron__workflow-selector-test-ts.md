# test/electron/workflow-selector.test.ts

> 模块：`test` · 语言：`typescript` · 行数：125

## 文件职责

测试工作流候选筛选逻辑，验证路径和标签匹配优先、排除标签/路径过滤、autoBind自动选中

## 关键符号

- `selectWorkflowCandidates@0 - 根据prompt/cwd/activePaths/tags选择最合适的工作流候选`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/shared/workflow-markdown.js`
- `../../src/shared/workflow-selector.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import type { WorkflowSpecDocument } from "../../src/shared/workflow-markdown.js";
import { selectWorkflowCandidates } from "../../src/shared/workflow-selector.js";

function createWorkflowDocument(overrides: Partial<WorkflowSpecDocument>): WorkflowSpecDocument {
  return {
    workflowId: "base-workflow",
    name: "Base Workflow",
    version: "1.0.0",
    scope: "user",
    mode: "single-thread",
    entry: "manual",
    owner: "user",
    autoAdvance: false,
    autoBind: false,
    title: "Base Workflow",
    sections: {
      goal: "Goal",
      rules: "Rules",
    },
    steps: [
      {
        id: "STEP-1",
        title: "Inspect",
        executor: "primary-agent",
        intent: "inspect",
        doneWhen: "Done",
        body: "Inspect the project.",
      },
    ],
    rawMarkdown: "",
    ...overrides,
  };
}

test("selectWorkflowCandidates prefers path and tag matched project workflows", () => {
  const genericWorkflow = createWorkflowDocument({
    workflowId: "generic-bugfix",
    name: "Generic Bugfix",
    autoBind: true,
    priority: 40,
    triggers: ["fix"],
  });
  const reactWorkflow = createWorkflowDocument({
    workflowId: "react-bugfix",
    name: "React Bugfix",
    scope: "project",
    autoBind: true,
    priority: 80,
    triggers: ["button broken", "style issue"],
    matchTags: ["frontend", "react"],
    appliesToPaths: ["src/ui/**"],
  });

  const result = selectWorkflowCandidates([genericWorkflow, reactWorkflow], {
    prompt: "This React page has a button broken and a style issue.",
    cwd: "D:/tool/tech-cc-hub",
    activePaths: ["D:/tool/tech-cc-hub/src/ui/components/Button.tsx"],
    tags: ["frontend", "react"],
  });

  assert.equal(result.recommendedWorkflowId, "react-bugfix");
  assert.equal(result.autoSelectedWorkflowId, "react-bugfix");
  assert.equal(result.candidates[0]?.document.workflowId, "react-bugfix");
  assert.deepEqual(result.candidates[0]?.matchedPaths, ["src/ui/**"]);
});

test("selectWorkflowCandidates filters out workflows excluded by tags or paths", () => {
  const frontendWorkflow = createWorkflowDocument({
    workflowId: "frontend-bugfix",
    scope: "project",
    autoBind: true,
    priority: 75,
    appliesToPaths: ["src/ui/**"],
  });
  const backendWorkflow = createWorkflowDocument({
    workflowId: "backend-bugfix",
    scope: "project",
    autoBind: true,
    priority: 90,
    excludeTags: ["frontend"],
  });
  const scriptsWorkflow = createWorkflowDocument({
    workflowId: "scripts-maintenance",
    scope: "project",
    autoBind: true,
    priority: 95,
    excludePaths: ["src/ui/**"],
  });

  const result = selectWorkflowCandidates([frontendWorkflow, backendWorkflow, scriptsWorkflow], {
    activePaths: ["D:/tool/tech-cc-hub/src/ui/App.tsx"],
    tags: ["frontend"],
  });

  assert.deepEqual(
    result.candidates.map((candidate) => candidate.document.workflowId),
    ["frontend-bugfix"],
  );
});

test("selectWorkflowCandidates keeps recommendation but avoids auto-bind when candidates are too close", () => {
  const workflowA = createWorkflowDocument({
    workflowId: "bugfix-a",
    autoBind: true,
    priority: 60,
    triggers: ["fix"],
  });
  const workflowB = createWorkflowDocument({
    workflowId: "bugfix-b",
    autoBind: true,
    priority: 58,
    triggers: ["fix"],
  });

  const result = selectWorkflowCandidates([workflowA, workflowB], {
    prompt: "Please help me fix this issue.",
  });

  assert.equal(result.recommendedWorkflowId, "bugfix-a");
  assert.equal(result.autoSelectedWorkflowId, undefined);
});

```
