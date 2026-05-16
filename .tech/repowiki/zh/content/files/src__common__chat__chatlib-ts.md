# src/common/chat/chatLib.ts

> 模块：`common` · 语言：`typescript` · 行数：15

## 文件职责

聊天相关的类型定义和路径工具函数

## 关键符号

- `TMessage@0 - 聊天消息结构，包含id、role、content、createdAt等字段`
- `joinPath@0 - 路径拼接函数，过滤空值并规范化多斜杠`

## 对外暴露

- `TMessage`
- `joinPath`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type TMessage = {
  id?: string;
  role?: string;
  content?: string;
  createdAt?: number;
  [key: string]: unknown;
};

export const joinPath = (...parts: Array<string | undefined | null>) =>
  parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/:\//, '://');

```
