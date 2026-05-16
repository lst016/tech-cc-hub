# test/electron/git-errors.test.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：12

## 文件职责

测试normalizeGitError错误归一化功能

## 关键符号

- `normalizeGitError@0 - 测试各种git错误消息能正确映射到对应error code`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/electron/libs/git/errors.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { normalizeGitError } from "../../src/electron/libs/git/errors.js";

test("normalizes common git errors", () => {
  assert.equal(normalizeGitError(new Error("not a git repository")).code, "not_a_repo");
  assert.equal(normalizeGitError(new Error("could not read Username for 'https://github.com'")).code, "auth_required");
  assert.equal(normalizeGitError(new Error("Your local changes to the following files would be overwritten by checkout")).code, "dirty_worktree");
  assert.equal(normalizeGitError(new Error("CONFLICT (content): Merge conflict")).code, "conflict");
});

```
