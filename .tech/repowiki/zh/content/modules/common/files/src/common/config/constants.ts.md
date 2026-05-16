# src/common/config/constants.ts

> 模块：`common` · 语言：`typescript` · 行数：3

## 文件职责

应用常量定义

## 关键符号

- `AIONUI_FILES_MARKER@0 - HTML中的文件标记注释文本`
- `AIONUI_TIMESTAMP_REGEX@0 - 时间戳正则表达式，用于匹配ISO格式时间`

## 对外暴露

- `AIONUI_FILES_MARKER`
- `AIONUI_TIMESTAMP_REGEX`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export const AIONUI_FILES_MARKER = '<!-- AIONUI_FILES -->';
export const AIONUI_TIMESTAMP_REGEX = /\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g;

```
