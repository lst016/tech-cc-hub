# src/ui/components/settings/plugin-toast-messages.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：28

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildPluginActionToastMessage@14`
- `details@16`
- `PluginActionToastInput@1`
- `PluginActionToastMessage@8`

## 对外暴露

- `PluginActionToastMessage`
- `buildPluginActionToastMessage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
type PluginActionToastInput = {
  success: boolean;
  message: string;
  version?: string;
  latestVersion?: string;
  error?: string;
};

export type PluginActionToastMessage = {
  kind: "success" | "error";
  title: string;
  description?: string;
};

export function buildPluginActionToastMessage(result: PluginActionToastInput): PluginActionToastMessage {
  const details = [
    result.version ? `当前版本：${result.version}` : "",
    result.latestVersion ? `最新版本：${result.latestVersion}` : "",
    result.error ? `错误详情：${result.error}` : "",
  ].filter(Boolean);

  return {
    kind: result.success ? "success" : "error",
    title: result.message,
    description: details.length > 0 ? details.join(" · ") : undefined,
  };
}

```
