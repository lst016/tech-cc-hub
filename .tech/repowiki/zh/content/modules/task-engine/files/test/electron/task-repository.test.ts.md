# test/electron/task-repository.test.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：106

## 文件职责

源码文件。依赖：node:test、node:assert/strict、better-sqlite3、../../src/electron/libs/task/repository.js、../../src/electron/libs/task/types.js

## 关键符号

- `createRepo@7 - `
- `createTask@11 - `
- `repo@29 - `
- `task@30 - `
- `execution@40 - `
- `stored@64 - `
- `bundle@70 - `
- `repo@80 - `
- `task@81 - `
- `retrying@82 - `
- `failed@85 - `
- `recovered@96 - `
- `paused@101 - `

## 依赖输入

- `node:test`
- `node:assert/strict`
- `better-sqlite3`
- `../../src/electron/libs/task/repository.js`
- `../../src/electron/libs/task/types.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";

import { TaskRepository } from "../../src/electron/libs/task/repository.js";
import type { ExternalTask } from "../../src/electron/libs/task/types.js";

function createRepo(): TaskRepository {
  return new TaskRepository(new Database(":memory:"));
}

function createTask(overrides: Partial<ExternalTask> = {}): ExternalTask {
  return {
    id: "",
    externalId: "ext-1",
    provider: "lark",
    title: "测试任务",
    description: "写一个 CRUD",
    status: "pending",
    priority: "medium",
    sourceData: {},
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

test("task repository persists execution controls, usage, subtasks and artifacts", () => {
  const repo = createRepo();
  const task = repo.upsertTask(createTask());

  repo.setExecuting(task.id, "session-1", {
    attempt: 1,
    workspacePath: "/tmp/task-workspace",
    driverId: "claude",
    model: "MiniMax-M2.7",
    reasoningMode: "high",
    maxCostUsd: 1.5,
  });
  const execution = repo.createExecution({
    taskId: task.id,
    sessionId: "session-1",
    status: "running",
    attempt: 1,
    driverId: "claude",
    model: "MiniMax-M2.7",
    reasoningMode: "high",
    maxCostUsd: 1.5,
    startedAt: 2000,
  });

  repo.recordUsage(task.id, execution.id, {
    inputTokens: 1200,
    outputTokens: 300,
    estimatedCostUsd: 0.42,
  });
  repo.replaceSubtasks(task.id, execution.id, [
    { title: "定义数据模型", status: "done", sortOrder: 0 },
    { title: "实现 API", detail: "包含增删改查", status: "pending", sortOrder: 1 },
  ]);
  repo.replaceArtifacts(task.id, execution.id, [
    { path: "/tmp/task-workspace/src/api.ts", kind: "file", summary: "新增" },
  ]);

  const stored = repo.getTask(task.id);
  assert.equal(stored?.localStatus, "executing");
  assert.equal(stored?.model, "MiniMax-M2.7");
  assert.equal(stored?.inputTokens, 1200);
  assert.equal(stored?.estimatedCostUsd, 0.42);

  const bundle = repo.getExecutionBundle(task.id);
  assert.equal(bundle.executions.length, 1);
  assert.equal(bundle.executions[0]?.model, "MiniMax-M2.7");
  assert.equal(bundle.subtasks.length, 2);
  assert.equal(bundle.subtasks[1]?.detail, "包含增删改查");
  assert.equal(bundle.artifacts[0]?.path, "/tmp/task-workspace/src/api.ts");
});

test("task repository handles retry cancellation, pause and interrupted recovery", () => {
  const repo = createRepo();
  const task = repo.upsertTask(createTask({ externalId: "ext-2" }));

  const retrying = repo.scheduleRetry(task.id, 1, Date.now() + 1000, "临时失败");
  assert.equal(retrying?.localStatus, "retrying");
  const failed = repo.cancelRetry(task.id, "用户取消自动重试");
  assert.equal(failed?.localStatus, "failed");

  repo.setExecuting(task.id, "session-2", { attempt: 2 });
  repo.createExecution({
    taskId: task.id,
    sessionId: "session-2",
    status: "running",
    attempt: 2,
    startedAt: 3000,
  });

  const recovered = repo.recoverInterruptedExecutions("应用重启");
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0]?.execution.status, "failed");
  assert.equal(repo.getTask(task.id)?.localStatus, "failed");

  const paused = repo.markPaused(task.id, "用户暂停");
  assert.equal(paused?.localStatus, "paused");
  assert.equal(paused?.lastError, "用户暂停");
});

```
