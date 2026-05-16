# test/electron/runner-status.test.ts

> 模块：`electron-runtime` · 语言：`typescript` · 行数：17

## 文件职责

测试runner状态判断逻辑

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/shared/runner-status.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import {
  isSuccessfulRunnerResult,
  shouldSuppressRunnerErrorAfterSuccessfulResult,
} from "../../src/shared/runner-status.js";

test("successful runner result is the only terminal state that suppresses late runner errors", () => {
  assert.equal(isSuccessfulRunnerResult({ type: "result", subtype: "success" }), true);
  assert.equal(isSuccessfulRunnerResult({ type: "result", subtype: "error_max_turns" }), false);
  assert.equal(isSuccessfulRunnerResult({ type: "assistant" }), false);

  assert.equal(shouldSuppressRunnerErrorAfterSuccessfulResult(true), true);
  assert.equal(shouldSuppressRunnerErrorAfterSuccessfulResult(false), false);
});

```
