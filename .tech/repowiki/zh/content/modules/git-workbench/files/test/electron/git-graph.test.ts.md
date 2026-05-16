# test/electron/git-graph.test.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：15

## 文件职责

测试assignGraphLanes函数的lane分配逻辑

## 关键符号

- `assignGraphLanes@0 - 测试线性历史返回稳定lane [0,0,0]`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/electron/libs/git/graph.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { assignGraphLanes } from "../../src/electron/libs/git/graph.js";

test("assignGraphLanes gives stable lanes for linear history", () => {
  const commits = assignGraphLanes([
    { hash: "c3", shortHash: "c3", parents: ["c2"], authorName: "A", message: "third", committedAt: "2026-05-10", refs: [], branches: [], graphLane: 0 },
    { hash: "c2", shortHash: "c2", parents: ["c1"], authorName: "A", message: "second", committedAt: "2026-05-10", refs: [], branches: [], graphLane: 0 },
    { hash: "c1", shortHash: "c1", parents: [], authorName: "A", message: "first", committedAt: "2026-05-10", refs: [], branches: [], graphLane: 0 },
  ]);

  assert.deepEqual(commits.map((commit) => commit.graphLane), [0, 0, 0]);
});

```
