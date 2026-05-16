# test/electron/runner-error.test.ts

> 模块：`electron-runtime` · 语言：`typescript` · 行数：31

## 文件职责

测试错误规范化功能

## 关键符号

- `message@0 - 测试变量，验证normalizeRunnerError对模型缺失、Figma认证等错误的处理`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/electron/libs/runner-error.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { normalizeRunnerError } from "../../src/electron/libs/runner-error.js";

test("normalizeRunnerError translates missing model failures into a clear message", () => {
  const message = normalizeRunnerError(
    new Error('Request failed with status code 404: {"error":{"type":"not_found_error","message":"model claude-3-7-sonnet does not exist"}}'),
    "claude-3-7-sonnet",
  );

  assert.match(message, /请求模型「claude-3-7-sonnet」失败/);
  assert.match(message, /不可用|已下线|服务端没有找到/);
});

test("normalizeRunnerError keeps generic runtime errors readable", () => {
  const message = normalizeRunnerError(new Error("socket hang up"), "claude-sonnet-4-5");

  assert.equal(message, "socket hang up");
});

test("normalizeRunnerError adds Figma reauthorization guidance for auth failures", () => {
  const message = normalizeRunnerError(
    new Error("mcp__figma__get_code failed: 401 unauthorized token expired"),
    "claude-sonnet-4-5",
  );

  assert.match(message, /Figma OAuth 授权可能已过期/);
  assert.match(message, /重新走 OAuth 授权/);
});

```
