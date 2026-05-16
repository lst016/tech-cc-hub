# src/common/types/fileSnapshot.ts

> 模块：`common` · 语言：`typescript` · 行数：19

## 文件职责

文件快照和变更追踪的类型定义

## 关键符号

- `FileChangeInfo@0 - 文件变更信息，包含filePath、status、diff、staged、isText`
- `SnapshotInfo@0 - 快照信息，包含id、createdAt、label`
- `CompareResult@0 - 比较结果，包含changes数组和snapshots数组`

## 对外暴露

- `FileChangeInfo`
- `SnapshotInfo`
- `CompareResult`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type FileChangeInfo = {
  filePath: string;
  status?: string;
  diff?: string;
  staged?: boolean;
  isText?: boolean;
};

export type SnapshotInfo = {
  id: string;
  createdAt?: number;
  label?: string;
};

export type CompareResult = {
  changes: FileChangeInfo[];
  snapshots?: SnapshotInfo[];
};

```
