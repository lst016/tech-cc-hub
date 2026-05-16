# test/electron/browser-workbench-session.test.ts

> 模块：`session-engine` · 语言：`typescript` · 行数：33

## 文件职责

测试browser workbench session的partition和webPreferences构建

## 关键符号

- `describe/it@0 - 验证BROWSER_WORKBENCH_PARTITION以persist:开头，buildBrowserWorkbenchWebPreferences正确合并preload`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/electron/libs/browser-workbench-session.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BROWSER_WORKBENCH_PARTITION,
  buildBrowserWorkbenchWebPreferences,
} from "../../src/electron/libs/browser-workbench-session.js";

describe("browser workbench session", () => {
  it("uses a persistent partition for login state", () => {
    assert.equal(BROWSER_WORKBENCH_PARTITION.startsWith("persist:"), true);
  });

  it("builds BrowserView webPreferences with the persistent partition", () => {
    assert.deepEqual(buildBrowserWorkbenchWebPreferences(), {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: BROWSER_WORKBENCH_PARTITION,
    });
  });

  it("adds the BrowserWorkbench preload only when provided", () => {
    assert.deepEqual(buildBrowserWorkbenchWebPreferences("browser-workbench-preload.cjs"), {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: BROWSER_WORKBENCH_PARTITION,
      preload: "browser-workbench-preload.cjs",
    });
  });
});

```
