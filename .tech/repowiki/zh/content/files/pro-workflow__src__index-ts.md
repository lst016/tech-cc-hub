# pro-workflow/src/index.ts

> 模块：`pro-workflow` · 语言：`typescript` · 行数：12

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 对外暴露

- `initializeDatabase`
- `getDefaultDbPath`
- `ensureDbDir`
- `createStore`
- `Learning`
- `Session`
- `Store`
- `searchLearnings`
- `searchByCategory`
- `getRelatedLearnings`
- `getMostAppliedLearnings`
- `getRecentLearnings`
- `SearchResult`
- `SearchOptions`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export { initializeDatabase, getDefaultDbPath, ensureDbDir } from './db/index';
export { createStore, Learning, Session, Store } from './db/store';
export {
  searchLearnings,
  searchByCategory,
  getRelatedLearnings,
  getMostAppliedLearnings,
  getRecentLearnings,
  SearchResult,
  SearchOptions,
} from './search/fts';

```
