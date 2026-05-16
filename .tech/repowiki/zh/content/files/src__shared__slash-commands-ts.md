# src/shared/slash-commands.ts

> 模块：`shared` · 语言：`typescript` · 行数：58

## 文件职责

从消息中提取斜杠命令并合并去重

## 关键符号

- `extractSlashCommandsFromMessages@0 - 遍历消息列表，提取 type=system subtype=init 中的 slash_commands`
- `mergeSlashCommandLists@0 - 合并多个命令列表并按小写 key 去重`

## 对外暴露

- `extractSlashCommandsFromMessages`
- `mergeSlashCommandLists`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
type SlashCommandLikeMessage = {
  type?: unknown;
  subtype?: unknown;
  slash_commands?: unknown;
};

export function extractSlashCommandsFromMessages(messages?: SlashCommandLikeMessage[]): string[] | undefined {
  if (!messages?.length) {
    return undefined;
  }

  for (const message of messages) {
    if (
      message?.type === "system" &&
      message.subtype === "init" &&
      Array.isArray(message.slash_commands)
    ) {
      return mergeSlashCommandLists(message.slash_commands);
    }
  }

  return undefined;
}

export function mergeSlashCommandLists(...lists: Array<readonly unknown[] | undefined>): string[] | undefined {
  const merged = new Map<string, string>();

  for (const list of lists) {
    if (!list?.length) {
      continue;
    }

    for (const value of list) {
      if (typeof value !== "string") {
        continue;
      }

      const normalized = normalizeSlashCommandName(value);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (!merged.has(key)) {
        merged.set(key, normalized);
      }
    }
  }

  const commands = Array.from(merged.values()).sort((left, right) => left.localeCompare(right));
  return commands.length > 0 ? commands : undefined;
}

function normalizeSlashCommandName(value: string): string | null {
  const normalized = value.trim().replace(/^\/+/, "").replace(/\.+/g, ".").replace(/^\.+|\.+$/g, "");
  return normalized || null;
}

```
