# src/electron/libs/git/history.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：42

## 文件职责

解析git log输出为GitCommitNode数组

## 关键符号

- `GIT_LOG_FORMAT@0 - git log格式化字符串，使用\x1f和\x1e作为字段和记录分隔符`
- `parseGitLog@0 - 将原始git log输出解析为GitCommitNode数组，调用assignGraphLanes计算图lane`

## 依赖输入

- `./types.js`
- `./graph.js`

## 对外暴露

- `GIT_LOG_FORMAT`
- `parseGitLog`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { GitCommitNode } from "./types.js";
import { assignGraphLanes } from "./graph.js";

const FIELD = "\x1f";
const RECORD = "\x1e";

export const GIT_LOG_FORMAT = `%H${FIELD}%h${FIELD}%P${FIELD}%an${FIELD}%ae${FIELD}%aI${FIELD}%D${FIELD}%s${RECORD}`;

export function parseGitLog(raw: string): GitCommitNode[] {
  const commits = raw
    .split(RECORD)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [
        hash = "",
        shortHash = "",
        parentsRaw = "",
        authorName = "",
        authorEmail = "",
        committedAt = "",
        refsRaw = "",
        message = "",
      ] = record.split(FIELD);

      return {
        hash,
        shortHash,
        parents: parentsRaw.trim() ? parentsRaw.trim().split(/\s+/) : [],
        authorName,
        authorEmail,
        committedAt,
        refs: refsRaw ? refsRaw.split(",").map((ref) => ref.trim()).filter(Boolean) : [],
        branches: [],
        message,
        graphLane: 0,
      } satisfies GitCommitNode;
    });

  return assignGraphLanes(commits);
}

```
