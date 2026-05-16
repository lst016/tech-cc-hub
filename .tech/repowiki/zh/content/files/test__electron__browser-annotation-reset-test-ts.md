# test/electron/browser-annotation-reset.test.ts

> 模块：`test` · 语言：`typescript` · 行数：47

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `clearBrowserWorkbenchAnnotations@11`
- `setBrowserWorkbenchAnnotationMode@14`
- `clearBrowserWorkbenchAnnotations@30`
- `setBrowserWorkbenchAnnotationMode@34`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/ui/utils/browser-annotation-reset.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resetBrowserWorkbenchAnnotationState } from "../../src/ui/utils/browser-annotation-reset.js";

describe("browser annotation reset", () => {
  it("clears page annotations and disables annotation mode for the session", async () => {
    const calls: unknown[][] = [];

    await resetBrowserWorkbenchAnnotationState({
      clearBrowserWorkbenchAnnotations: async (sessionId) => {
        calls.push(["clear", sessionId]);
      },
      setBrowserWorkbenchAnnotationMode: async (enabled, sessionId) => {
        calls.push(["mode", enabled, sessionId]);
      },
    }, "session-1");

    assert.deepEqual(calls, [
      ["clear", "session-1"],
      ["mode", false, "session-1"],
    ]);
  });

  it("still disables annotation mode if annotation cleanup fails", async () => {
    const calls: unknown[][] = [];

    await assert.rejects(
      resetBrowserWorkbenchAnnotationState({
        clearBrowserWorkbenchAnnotations: async (sessionId) => {
          calls.push(["clear", sessionId]);
          throw new Error("cleanup failed");
        },
        setBrowserWorkbenchAnnotationMode: async (enabled, sessionId) => {
          calls.push(["mode", enabled, sessionId]);
        },
      }, "session-2"),
      /cleanup failed/,
    );

    assert.deepEqual(calls, [
      ["clear", "session-2"],
      ["mode", false, "session-2"],
    ]);
  });
});

```
