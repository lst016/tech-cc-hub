# src/electron/libs/browser-workbench-bounds.ts

> 模块：`electron` · 语言：`typescript` · 行数：20

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `sanitizeBrowserWorkbenchBounds@7`
- `shouldDetachBrowserWorkbenchForBounds@16`
- `BrowserWorkbenchBoundsLike@1`

## 对外暴露

- `BrowserWorkbenchBoundsLike`
- `sanitizeBrowserWorkbenchBounds`
- `shouldDetachBrowserWorkbenchForBounds`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type BrowserWorkbenchBoundsLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function sanitizeBrowserWorkbenchBounds(bounds: BrowserWorkbenchBoundsLike): BrowserWorkbenchBoundsLike {
  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(0, Math.round(bounds.width)),
    height: Math.max(0, Math.round(bounds.height)),
  };
}

export function shouldDetachBrowserWorkbenchForBounds(bounds: Pick<BrowserWorkbenchBoundsLike, "width" | "height">): boolean {
  return Math.round(bounds.width) <= 0 || Math.round(bounds.height) <= 0;
}

```
