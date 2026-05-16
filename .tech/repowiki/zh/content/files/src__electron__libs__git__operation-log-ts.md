# src/electron/libs/git/operation-log.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：20

## 文件职责

记录高影响Git操作的本地日志，用于审计和undo支持

## 关键符号

- `GitOperationLog@0 - 内存中的操作日志类，最多保留500条记录`
- `list@0 - 获取指定仓库的最新50条操作记录`
- `record@0 - 记录一条操作，生成唯一id和timestamp`

## 依赖输入

- `crypto`
- `./types.js`

## 对外暴露

- `GitOperationLog`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { randomUUID } from "crypto";
import type { GitOperationLogEntry } from "./types.js";

export class GitOperationLog {
  private entries: GitOperationLogEntry[] = [];

  list(repoRoot: string): GitOperationLogEntry[] {
    return this.entries.filter((entry) => entry.repoRoot === repoRoot).slice(-50).reverse();
  }

  record(entry: Omit<GitOperationLogEntry, "id" | "createdAt">): GitOperationLogEntry {
    const next = { ...entry, id: randomUUID(), createdAt: Date.now() };
    this.entries.push(next);
    if (this.entries.length > 500) {
      this.entries = this.entries.slice(-500);
    }
    return next;
  }
}

```
