# test/electron/browser-workbench-bounds.test.ts

> 模块：`test` · 语言：`typescript` · 行数：21

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 依赖输入

- `node:assert/strict`
- `node:test`
- `../../src/electron/libs/browser-workbench-bounds.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeBrowserWorkbenchBounds,
  shouldDetachBrowserWorkbenchForBounds,
} from "../../src/electron/libs/browser-workbench-bounds.js";

test("sanitizes browser workbench bounds before applying them to Electron", () => {
  assert.deepEqual(
    sanitizeBrowserWorkbenchBounds({ x: -4.4, y: 12.6, width: 640.4, height: -1 }),
    { x: 0, y: 13, width: 640, height: 0 },
  );
});

test("zero-sized bounds detach the BrowserView instead of representing a renderable surface", () => {
  assert.equal(shouldDetachBrowserWorkbenchForBounds({ width: 0, height: 480 }), true);
  assert.equal(shouldDetachBrowserWorkbenchForBounds({ width: 640, height: 0 }), true);
  assert.equal(shouldDetachBrowserWorkbenchForBounds({ width: 640, height: 480 }), false);
});

```
