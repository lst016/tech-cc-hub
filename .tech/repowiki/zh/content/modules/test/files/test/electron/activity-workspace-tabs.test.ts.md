# test/electron/activity-workspace-tabs.test.ts

> 模块：`test` · 语言：`typescript` · 行数：49

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `visibleTabs@12`
- `visibleTabs@22`
- `appSource@34`
- `railSource@35`
- `appSource@42`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `node:fs`
- `../../src/ui/utils/activity-workspace-tabs.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildActivityWorkspaceTabs,
  shouldShowCreateBrowserTab,
} from "../../src/ui/utils/activity-workspace-tabs.js";

describe("activity workspace tabs", () => {
  it("keeps non-browser tabs visible when no browser tab exists", () => {
    const visibleTabs = buildActivityWorkspaceTabs({
      activeTab: "trace",
      showBrowserTab: false,
    }).filter((tab) => tab.visible);

    assert.deepEqual(visibleTabs.map((tab) => tab.id), ["preview", "trace", "usage", "git"]);
    assert.equal(shouldShowCreateBrowserTab(false), true);
  });

  it("keeps preview first when the browser tab is visible", () => {
    const visibleTabs = buildActivityWorkspaceTabs({
      activeTab: "browser",
      showBrowserTab: true,
    }).filter((tab) => tab.visible);

    assert.deepEqual(visibleTabs.map((tab) => tab.id), ["preview", "trace", "usage", "git", "browser"]);
    assert.equal(visibleTabs.find((tab) => tab.id === "browser")?.active, true);
    assert.equal(visibleTabs.find((tab) => tab.id === "preview")?.title, "文件预览");
    assert.equal(shouldShowCreateBrowserTab(true), false);
  });

  it("defaults the activity rail to preview in app state", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");
    const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");

    assert.match(appSource, /activityRailTabBySessionId\[activeSessionId\] \?\? "preview"/);
    assert.match(railSource, /useState<ActivityRailTab>\("preview"\)/);
  });

  it("preserves preview and browser runtime state while switching workspace tabs", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");

    assert.doesNotMatch(appSource, /showActivityRail && workspaceView !== "browser" && \(\s*<ActivityRail/);
    assert.match(appSource, /className=\{workspaceView === "browser" \? "hidden" : "contents"\}/);
    assert.doesNotMatch(appSource, /workspaceView[\s\S]{0,180}closeBrowserWorkbench/);
  });
});

```
