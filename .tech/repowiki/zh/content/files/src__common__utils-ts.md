# src/common/utils.ts

> 模块：`common` · 语言：`typescript` · 行数：7

## 文件职责

通用工具函数，提供UUID生成器

## 关键符号

- `uuid@0 - 生成指定长度的随机字母数字字符串，默认16位`

## 对外暴露

- `uuid`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export const uuid = (size = 16) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let output = '';
  for (let i = 0; i < size; i += 1) output += chars[Math.floor(Math.random() * chars.length)];
  return output;
};

```
