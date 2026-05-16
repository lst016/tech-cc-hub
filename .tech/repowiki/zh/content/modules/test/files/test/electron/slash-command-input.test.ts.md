# test/electron/slash-command-input.test.ts

> 模块：`test` · 语言：`typescript` · 行数：26

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/ui/utils/slash-command-input.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getSlashCommandQuery, isDismissedSlashCommandQuery } from "../../src/ui/utils/slash-command-input.js";

describe("slash command input", () => {
  it("keeps absolute paths out of slash command matching", () => {
    assert.equal(getSlashCommandQuery("/Users/lushengtao/project"), null);
    assert.equal(getSlashCommandQuery("/workspace/app/src/index.ts"), null);
    assert.equal(getSlashCommandQuery("/mnt/c/Users/lushengtao"), null);
  });

  it("still recognizes command-like slash tokens", () => {
    assert.equal(getSlashCommandQuery("/debug current session"), "debug");
    assert.equal(getSlashCommandQuery("  /speckit.specify feature"), "speckit.specify");
    assert.equal(getSlashCommandQuery("/"), "");
  });

  it("keeps a selected slash command hidden until the query changes or browser is reopened", () => {
    assert.equal(isDismissedSlashCommandQuery("/ad-crawler", "ad-crawler", false), true);
    assert.equal(isDismissedSlashCommandQuery("/ad-crawler analyze this", "ad-crawler", false), true);
    assert.equal(isDismissedSlashCommandQuery("/ad", "ad-crawler", false), false);
    assert.equal(isDismissedSlashCommandQuery("/ad-crawler", "ad-crawler", true), false);
  });
});

```
