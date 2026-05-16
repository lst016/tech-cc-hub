# src/shared/channel-config.ts

> 模块：`shared` · 语言：`typescript` · 行数：10

## 文件职责

检查 channel 聊天功能是否启用

## 关键符号

- `isChannelChatEnabled@0 - 判断 ChannelChatToggleConfig 是否允许聊天`

## 对外暴露

- `ChannelChatToggleConfig`
- `isChannelChatEnabled`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type ChannelChatToggleConfig = {
  enabled?: boolean;
  chatEnabled?: boolean;
};

export function isChannelChatEnabled(config: ChannelChatToggleConfig | null | undefined): boolean {
  if (!config?.enabled) return false;
  return typeof config.chatEnabled === "boolean" ? config.chatEnabled : true;
}

```
