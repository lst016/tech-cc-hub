# src/electron/libs/browser-workbench-session.ts

> 模块：`session-engine` · 语言：`typescript` · 行数：20

## 文件职责

浏览器工作台会话的WebPreferences构建器，提供隔离的安全配置

## 关键符号

- `BROWSER_WORKBENCH_PARTITION@0 - 持久化分区ID：persist:tech-cc-hub-browser`
- `BrowserWorkbenchWebPreferences@0 - WebPreferences类型：contextIsolation=true, nodeIntegration=false, sandbox=true`
- `buildBrowserWorkbenchWebPreferences@0 - 构建完整的WebPreferences对象，可选附加preload脚本`

## 对外暴露

- `BROWSER_WORKBENCH_PARTITION`
- `BrowserWorkbenchWebPreferences`
- `buildBrowserWorkbenchWebPreferences`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export const BROWSER_WORKBENCH_PARTITION = "persist:tech-cc-hub-browser";

export type BrowserWorkbenchWebPreferences = {
  contextIsolation: true;
  nodeIntegration: false;
  sandbox: true;
  partition: string;
  preload?: string;
};

export function buildBrowserWorkbenchWebPreferences(preload?: string): BrowserWorkbenchWebPreferences {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    partition: BROWSER_WORKBENCH_PARTITION,
    ...(preload ? { preload } : {}),
  };
}

```
