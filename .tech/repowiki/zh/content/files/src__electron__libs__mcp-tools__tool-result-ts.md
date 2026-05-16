# src/electron/libs/mcp-tools/tool-result.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：15

## 文件职责

源码文件。依赖：@modelcontextprotocol/sdk/types.js

## 关键符号

- `toTextToolResult@2 - `
- `toPlainTextToolResult@9 - `

## 依赖输入

- `@modelcontextprotocol/sdk/types.js`

## 对外暴露

- `toTextToolResult`
- `toPlainTextToolResult`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function toTextToolResult(payload: unknown, isError = false): CallToolResult {
  return {
    isError,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function toPlainTextToolResult(text: string, isError = false): CallToolResult {
  return {
    isError,
    content: [{ type: "text" as const, text }],
  };
}
```
