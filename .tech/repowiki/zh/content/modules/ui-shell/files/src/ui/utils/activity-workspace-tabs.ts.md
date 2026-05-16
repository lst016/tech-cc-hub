# src/ui/utils/activity-workspace-tabs.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：58

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildActivityWorkspaceTabs@11`
- `shouldShowCreateBrowserTab@54`
- `ActivityRailTab@1`
- `ActivityWorkspaceTab@2`
- `ActivityWorkspaceTabItem@3`

## 对外暴露

- `ActivityRailTab`
- `ActivityWorkspaceTab`
- `ActivityWorkspaceTabItem`
- `buildActivityWorkspaceTabs`
- `shouldShowCreateBrowserTab`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type ActivityRailTab = "trace" | "usage" | "preview" | "git";
export type ActivityWorkspaceTab = "browser" | ActivityRailTab;

export type ActivityWorkspaceTabItem = {
  id: ActivityWorkspaceTab;
  label: string;
  title: string;
  visible: boolean;
  active: boolean;
};

export function buildActivityWorkspaceTabs(input: {
  activeTab: ActivityWorkspaceTab;
  showBrowserTab: boolean;
}): ActivityWorkspaceTabItem[] {
  return [
    {
      id: "preview",
      label: "预览",
      title: "文件预览",
      visible: true,
      active: input.activeTab === "preview",
    },
    {
      id: "trace",
      label: "执行轨迹",
      title: "执行轨迹",
      visible: true,
      active: input.activeTab === "trace",
    },
    {
      id: "usage",
      label: "Usage",
      title: "Usage",
      visible: true,
      active: input.activeTab === "usage",
    },
    {
      id: "git",
      label: "Git",
      title: "Git 工作台",
      visible: true,
      active: input.activeTab === "git",
    },
    {
      id: "browser",
      label: "浏览器",
      title: "浏览器",
      visible: input.showBrowserTab,
      active: input.activeTab === "browser",
    },
  ];
}

export function shouldShowCreateBrowserTab(showBrowserTab: boolean): boolean {
  return !showBrowserTab;
}

```
