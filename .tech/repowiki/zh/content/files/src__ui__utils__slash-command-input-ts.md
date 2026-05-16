# src/ui/utils/slash-command-input.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：19

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getSlashCommandQuery@1`
- `isDismissedSlashCommandQuery@9`
- `value@2`
- `token@4`
- `slashQuery@16`

## 对外暴露

- `getSlashCommandQuery`
- `isDismissedSlashCommandQuery`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export function getSlashCommandQuery(promptValue: string): string | null {
  const value = promptValue.trimStart();
  if (!value.startsWith("/")) return null;

  const token = value.slice(1).split(/\s+/)[0]?.trim() ?? "";
  if (token.includes("/") || token.includes("\\")) return null;
  return token;
}

export function isDismissedSlashCommandQuery(
  promptValue: string,
  dismissedSlashQuery: string | null,
  showSlashBrowser: boolean,
): boolean {
  if (showSlashBrowser || !dismissedSlashQuery) return false;
  const slashQuery = getSlashCommandQuery(promptValue);
  return slashQuery !== null && slashQuery.toLowerCase() === dismissedSlashQuery;
}

```
