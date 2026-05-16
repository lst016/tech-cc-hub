# src/common/config/storageKeys.ts

> 模块：`common` · 语言：`typescript` · 行数：5

## 文件职责

存储键名常量统一管理

## 关键符号

- `STORAGE_KEYS@0 - 包含WORKSPACE_TREE_COLLAPSE（工作区树折叠状态）、PREVIEW_TABS（预览标签页状态）`

## 对外暴露

- `STORAGE_KEYS`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export const STORAGE_KEYS = {
  WORKSPACE_TREE_COLLAPSE: 'tech-cc-hub:workspace-tree-collapse',
  PREVIEW_TABS: 'tech-cc-hub:preview-tabs',
};

```
