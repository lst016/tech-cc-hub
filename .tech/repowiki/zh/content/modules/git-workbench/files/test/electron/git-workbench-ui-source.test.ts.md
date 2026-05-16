# test/electron/git-workbench-ui-source.test.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：91

## 文件职责

测试UI源码中Git功能的正确接入方式，验证IPC隔离和组件绑定

## 关键符号

- `tabsSource@0 - 验证Git作为activity workspace tab被正确注册`
- `preloadSource@0 - 验证preload暴露了正确的Git IPC方法，不暴露敏感API`
- `boxSource@0 - 验证commit box中AI生成message和refine逻辑`
- `pushButton@0 - 验证暂存文件时push按钮变为commit-and-push模式`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `node:fs`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("git workbench UI source wiring", () => {
  it("adds Git as a first-class activity workspace tab", () => {
    const tabsSource = readFileSync("src/ui/utils/activity-workspace-tabs.ts", "utf8");
    const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");
    const browserSource = readFileSync("src/ui/components/BrowserWorkbenchPage.tsx", "utf8");

    assert.match(tabsSource, /id: "git"/);
    assert.match(railSource, /selectedTab === "git"/);
    assert.match(browserSource, /onOpenGit/);
  });

  it("keeps Git mutations behind preload IPC methods", () => {
    const preloadSource = readFileSync("src/electron/preload.cts", "utf8");
    const panelSource = readFileSync("src/ui/hooks/useGitWorkbench.ts", "utf8");

    assert.match(preloadSource, /getGitSnapshot/);
    assert.match(preloadSource, /gitCommit/);
    assert.match(preloadSource, /getGitCommitDetail/);
    assert.match(preloadSource, /generateGitCommitMessageFast/);
    assert.match(preloadSource, /gitPull/);
    assert.match(panelSource, /window\.electron\.gitCommit/);
    assert.match(panelSource, /window\.electron\.getGitCommitDetail/);
    assert.match(panelSource, /window\.electron\.generateGitCommitMessageFast/);
    assert.doesNotMatch(panelSource, /child_process|simple-git|execFile|spawn/);
  });

  it("fills commit messages immediately and refines them in the background", () => {
    const boxSource = readFileSync("src/ui/components/git/GitCommitBox.tsx", "utf8");
    const hookSource = readFileSync("src/ui/hooks/useGitWorkbench.ts", "utf8");
    const panelSource = readFileSync("src/ui/components/git/GitWorkbenchPanel.tsx", "utf8");

    assert.match(boxSource, /onGenerateMessageRefined/);
    assert.match(boxSource, /setRefiningMessage\(true\)/);
    assert.match(hookSource, /result\.data\.source === "ai"/);
    assert.match(panelSource, /generateCommitMessageRefined/);
  });

  it("turns the bottom push button into commit-and-push when staged files exist", () => {
    const boxSource = readFileSync("src/ui/components/git/GitCommitBox.tsx", "utf8");
    const hookSource = readFileSync("src/ui/hooks/useGitWorkbench.ts", "utf8");

    assert.match(boxSource, /const pushLabel = stagedCount > 0/);
    assert.match(boxSource, /const handlePush = async/);
    assert.match(boxSource, /await onCommit\(message, body\)/);
    assert.match(boxSource, /await onPush\(\)/);
    assert.doesNotMatch(boxSource, /onClick=\{onPush\}/);
    assert.match(readFileSync("src/ui/components/git/GitWorkbenchPanel.tsx", "utf8"), /onPush=\{workbench\.push\}/);
    assert.match(hookSource, /return true/);
    assert.match(hookSource, /return false/);
  });

  it("does not expose destructive history rewriting actions in the renderer", () => {
    const gitSource = [
      readFileSync("src/ui/components/git/GitWorkbenchPanel.tsx", "utf8"),
      readFileSync("src/ui/components/git/GitBranchStashPanel.tsx", "utf8"),
      readFileSync("src/ui/components/git/GitCommitBox.tsx", "utf8"),
    ].join("\n");

    assert.doesNotMatch(gitSource, /reset|rebase|cherry-pick|force push|amend/i);
    assert.match(gitSource, /GitConfirmDialog/);
  });

  it("keeps the Git rail layout tabbed and renders a filtered version graph", () => {
    const panelSource = readFileSync("src/ui/components/git/GitWorkbenchPanel.tsx", "utf8");
    const historySource = readFileSync("src/ui/components/git/GitHistoryPanel.tsx", "utf8");

    assert.doesNotMatch(panelSource, /xl:grid-cols/);
    assert.match(panelSource, /type GitWorkbenchTab/);
    assert.match(panelSource, /setActiveTab/);
    assert.match(panelSource, /GitCommitDetailPanel/);
    assert.match(historySource, /buildBranchOptions/);
    assert.match(historySource, /branchFilter/);
    assert.match(historySource, /buildLaneRanges/);
    assert.match(historySource, /CommitRow/);
  });

  it("does not nest interactive file actions inside another button", () => {
    const changesSource = readFileSync("src/ui/components/git/GitChangesList.tsx", "utf8");

    assert.doesNotMatch(changesSource, /role="b
... (truncated)
```
