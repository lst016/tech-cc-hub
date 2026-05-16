# src/common/index.ts

> 模块：`common` · 语言：`typescript` · 行数：3

## 文件职责

模块主入口文件，统一导出公共模块的功能

## 关键符号

- `ipcBridge@0 - 导出IPC桥接器，用于Electron进程间通信`
- `IBridgeResponse@0 - IPC响应接口`
- `IDirOrFile@0 - 目录或文件结构接口`
- `IFileMetadata@0 - 文件元数据接口`
- `IWorkspaceFlatFile@0 - 工作区扁平文件结构接口`

## 对外暴露

- `ipcBridge`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export { ipcBridge } from './adapter/ipcBridge';
export type { IBridgeResponse, IDirOrFile, IFileMetadata, IWorkspaceFlatFile } from './adapter/ipcBridge';

```
