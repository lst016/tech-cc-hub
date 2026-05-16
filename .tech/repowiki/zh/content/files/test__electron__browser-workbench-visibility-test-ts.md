# test/electron/browser-workbench-visibility.test.ts

> 模块：`test` · 语言：`typescript` · 行数：29

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/ui/utils/browser-workbench-visibility.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  hasRenderableBrowserWorkbenchBounds,
  shouldAttachBrowserWorkbench,
} from "../../src/ui/utils/browser-workbench-visibility.js";

describe("browser workbench visibility", () => {
  it("detaches BrowserView while an app modal occludes the workbench", () => {
    assert.equal(
      shouldAttachBrowserWorkbench({ active: true, hasBrowserTab: true, occluded: true }),
      false,
    );
  });

  it("keeps BrowserView attached only when active, tabbed, and unobstructed", () => {
    assert.equal(shouldAttachBrowserWorkbench({ active: true, hasBrowserTab: true, occluded: false }), true);
    assert.equal(shouldAttachBrowserWorkbench({ active: false, hasBrowserTab: true, occluded: false }), false);
    assert.equal(shouldAttachBrowserWorkbench({ active: true, hasBrowserTab: false, occluded: false }), false);
  });

  it("ignores transient zero-sized active browser surfaces", () => {
    assert.equal(hasRenderableBrowserWorkbenchBounds({ width: 0, height: 480 }), false);
    assert.equal(hasRenderableBrowserWorkbenchBounds({ width: 640, height: 0 }), false);
    assert.equal(hasRenderableBrowserWorkbenchBounds({ width: 640, height: 480 }), true);
  });
});

```
