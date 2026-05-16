# src/electron/pathResolver.ts

> 模块：`electron` · 语言：`typescript` · 行数：21

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getPreloadPath@5`
- `getBrowserWorkbenchPreloadPath@9`
- `getUIPath@13`
- `getIconPath@17`

## 依赖输入

- `./util.js`
- `path`
- `electron`
- `./pathResolverCore.js`

## 对外暴露

- `getPreloadPath`
- `getBrowserWorkbenchPreloadPath`
- `getUIPath`
- `getIconPath`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { isDev } from "./util.js"
import path from "path"
import { app } from "electron"
import { resolveAppAssetPath } from "./pathResolverCore.js";

export function getPreloadPath() {
    return resolveAppAssetPath(app.getAppPath(), "dist-electron/electron/preload.cjs")
}

export function getBrowserWorkbenchPreloadPath() {
    return resolveAppAssetPath(app.getAppPath(), "dist-electron/electron/browser-workbench-preload.cjs")
}

export function getUIPath() {
    return path.join(app.getAppPath(), '/dist-react/index.html');
}

export function getIconPath() {
    return resolveAppAssetPath(app.getAppPath(), "build/icon.png")
}

```
