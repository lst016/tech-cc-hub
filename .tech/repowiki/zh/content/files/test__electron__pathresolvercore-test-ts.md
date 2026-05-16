# test/electron/pathResolverCore.test.ts

> 模块：`test` · 语言：`typescript` · 行数：11

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `resolved@7`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/electron/pathResolverCore.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { resolveAppAssetPath } from "../../src/electron/pathResolverCore.js";

test("resolveAppAssetPath keeps production assets inside the app root", () => {
  const resolved = resolveAppAssetPath("D:\\tool\\tech-cc-hub", "dist-electron/electron/preload.cjs");

  assert.equal(resolved, "D:\\tool\\tech-cc-hub\\dist-electron\\electron\\preload.cjs");
});

```
