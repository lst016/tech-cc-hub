# src/shared/runner-prompt.ts

> 模块：`electron-runtime` · 语言：`typescript` · 行数：6

## 文件职责

共享的提示词构建模块，负责将prompt和附件转换为Agent SDK所需的格式

## 关键符号

- `buildRunnerPromptContentBlocks@0 - 构建runner提示词内容块，整合用户prompt和附件，返回Anthropic格式的内容数组`

## 依赖输入

- `./attachments.js`

## 对外暴露

- `buildRunnerPromptContentBlocks`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { buildAnthropicPromptContentBlocks, type AttachmentLike } from "./attachments.js";

export function buildRunnerPromptContentBlocks(prompt: string, attachments: AttachmentLike[]): Array<Record<string, unknown>> {
  return buildAnthropicPromptContentBlocks(prompt, attachments);
}

```
