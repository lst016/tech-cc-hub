# src/electron/libs/git/graph.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：17

## 文件职责

为提交历史计算轻量级图形的lane索引，用于可视化分支图

## 关键符号

- `assignGraphLanes@0 - 遍历commits数组，为每个commit分配graphLane值，用于前端绘制分支线`

## 依赖输入

- `./types.js`

## 对外暴露

- `assignGraphLanes`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { GitCommitNode } from "./types.js";

export function assignGraphLanes(commits: GitCommitNode[]): GitCommitNode[] {
  const laneByHash = new Map<string, number>();
  let nextLane = 1;

  return commits.map((commit) => {
    const lane = laneByHash.get(commit.hash) ?? 0;
    commit.parents.forEach((parent, index) => {
      if (!laneByHash.has(parent)) {
        laneByHash.set(parent, index === 0 ? lane : nextLane++);
      }
    });
    return { ...commit, graphLane: lane };
  });
}

```
