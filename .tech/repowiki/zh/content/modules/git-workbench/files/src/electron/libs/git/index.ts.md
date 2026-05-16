# src/electron/libs/git/index.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：4

## 文件职责

模块对外统一出口，导出service、IPC处理器和类型

## 关键符号

- `GitWorkbenchService@0 - 从service.js导出的主服务类`
- `handleGitWorkbenchInvoke@0 - 处理单个Git IPC调用的入口函数`
- `registerGitWorkbenchIpcHandlers@0 - 注册所有git:* IPC处理器到ipcMain`

## 对外暴露

- `GitWorkbenchService`
- `handleGitWorkbenchInvoke`
- `registerGitWorkbenchIpcHandlers`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export { GitWorkbenchService } from "./service.js";
export { handleGitWorkbenchInvoke, registerGitWorkbenchIpcHandlers } from "./ipc.js";
export type * from "./types.js";

```
