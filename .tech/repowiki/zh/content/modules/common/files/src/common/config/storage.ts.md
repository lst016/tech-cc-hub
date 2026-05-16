# src/common/config/storage.ts

> 模块：`common` · 语言：`typescript` · 行数：22

## 文件职责

本地存储配置管理器，封装localStorage的读写操作

## 关键符号

- `TChatConversation@0 - 聊天会话数据结构，包含id、title、workspace、path等字段`
- `ConfigStorage.get@0 - 异步获取配置，键名前缀config:`
- `ConfigStorage.set@0 - 异步存储配置，JSON序列化后存入localStorage`

## 对外暴露

- `TChatConversation`
- `ConfigStorage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type TChatConversation = {
  id: string;
  title?: string;
  workspace?: string;
  path?: string;
  [key: string]: unknown;
};

export const ConfigStorage = {
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(`config:${key}`);
      return raw == null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  async set<T = unknown>(key: string, value: T): Promise<void> {
    localStorage.setItem(`config:${key}`, JSON.stringify(value));
  },
};

```
