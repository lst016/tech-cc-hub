# test/electron/context-usage-cells.test.ts

> 模块：`test` · 语言：`typescript` · 行数：43

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `cells@8`
- `cells@23`
- `cells@32`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/ui/utils/context-usage-cells.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildSegmentedContextUsageCells } from "../../src/ui/utils/context-usage-cells.js";

describe("context usage cells", () => {
  it("uses separate colors for small non-zero token categories", () => {
    const cells = buildSegmentedContextUsageCells([
      { id: "system", label: "系统提示", tokens: 997, className: "system-color" },
      { id: "tool-definitions", label: "工具定义估算", tokens: 1_560, className: "tool-definition-color" },
      { id: "tool-payload", label: "工具输入/输出", tokens: 485_600, className: "tool-payload-color" },
      { id: "messages", label: "消息内容", tokens: 15_300, className: "message-color" },
    ], 1_000_000);

    assert.equal(cells.length, 40);
    assert.ok(cells.some((cell) => cell.segmentId === "system"));
    assert.ok(cells.some((cell) => cell.segmentId === "tool-definitions"));
    assert.ok(cells.some((cell) => cell.segmentId === "tool-payload"));
    assert.ok(cells.some((cell) => cell.segmentId === "messages"));
  });

  it("leaves unused context cells muted", () => {
    const cells = buildSegmentedContextUsageCells([
      { id: "messages", label: "消息内容", tokens: 250_000, className: "message-color" },
    ], 1_000_000);

    assert.equal(cells.filter((cell) => cell.segmentId === "messages").length, 10);
    assert.equal(cells.filter((cell) => cell.segmentId === "free").length, 30);
  });

  it("keeps tiny non-zero categories visible even below one grid cell", () => {
    const cells = buildSegmentedContextUsageCells([
      { id: "system", label: "系统提示", tokens: 997, className: "system-color" },
      { id: "tool-definitions", label: "工具定义估算", tokens: 1_560, className: "tool-definition-color" },
      { id: "messages", label: "消息内容", tokens: 2_630, className: "message-color" },
    ], 1_000_000);

    assert.ok(cells.some((cell) => cell.segmentId === "system"));
    assert.ok(cells.some((cell) => cell.segmentId === "tool-definitions"));
    assert.ok(cells.some((cell) => cell.segmentId === "messages"));
  });
});

```
