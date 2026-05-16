# package/agentSdkTypes.d.ts

> 模块：`package` · 语言：`typescript` · 行数：2

## 文件职责

类型导出聚合文件，统一从sdk.js重导出所有公共类型

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export * from './sdk.js'

```
