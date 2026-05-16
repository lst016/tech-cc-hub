# docs/superpowers/plans/2026-05-10-git-workbench-tab.md

> 模块：`git-workbench` · 语言：`markdown` · 行数：1680

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Git Workbench 右侧 Tab Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 tech-cc-hub 右侧栏新增一个 Git 工作台 tab，支持查看改动、diff、stage/unstage、commit、push、branch、stash、历史和轻量分支图。

**Architecture:** Electron 主进程新增 `src/electron/libs/git/` 模块，使用 `simple-git` 封装 Git 读写与错误归一化，Renderer 只通过 preload IPC 获取结构化数据。UI 在现有 `ActivityWorkspaceTabs` / `ActivityRail` 体系中新增 `git` tab，独立 `GitWorkbenchPanel` 负责 Changes、Diff、History/Branch/Stash 三块。

**Tech Stack:** Electron main process, React 19, TypeScript, `simple-git`, `diff2html`, Node test runner, Vite.

---

## 参考文档

- Spec: `docs/superpowers/specs/2026-05-10-git-workbench-tab-design.md`
- Existing right tab utility: `src/ui/utils/activity-workspace-tabs.ts`
- Existing right rail shell: `src/ui/components/ActivityRail.tsx`
- Existing Electron IPC pattern: `src/electron/main.ts`, `src/electron/preload.cts`
- Existing task module layout reference: `src/electron/libs/task/README.md`

## 文件结构

- Modify: `package.json`
  - 增加 `simple-git` dependency。
- Modify: `bun.lock`
  - `bun add simple-git` 更新。
- Modify: `package-lock.json`
  - 如果项目继续保留 npm lock，执行 `npm install --package-lock-only` 同步。

- Create: `src/electron/libs/git/README.md`
  - 说明 Git 模块边界、允许操作、禁止操作。
- Create: `src/electron/libs/git/types.ts`
  - Git domain types, IPC payload/result types。
- Create: `src/electron/libs/git/errors.ts`
  - `GitWorkbenchErrorCode` 和 stderr/simple-git error normalization。
- Create: `src/electron/libs/git/service.ts`
  - `GitWorkbenchService`，封装 repo 检测、snapshot、diff、stage、commit、push、branch、stash。
- Create: `src/electron/libs/git/history.ts`
  - 解析 `git log` 输出为 commit nodes。
- Create: `src/electron/libs/git/graph.ts`
  - 生成轻量 commit graph lane。
- Create: `src/electron/libs/git/operation-log.ts`
  - 记录 push、checkout、stash apply/drop 这类高影响操作。
- Create: `src/electron/libs/git/ipc.ts`
  - 注册 `git:*` IPC handlers。
- Create: `src/electron/libs/git/index.ts`
  - 对外统一出口。

- Modify: `src/electron/main.ts`
  - 调用 `registerGitIpcHandlers`。
  - dev bridge `invoke` 支持 `git:*` channel。
- Modify: `src/electron/preload.cts`
  - 暴露 typed Git methods：`getGitSnapshot`、`getGitDiff`、`gitStageFiles` 等。
- Modify: `src/ui/types.ts`
  - 增加 `UiGit*` types，供 Renderer 使用。
- Modify: `src/ui/dev-electron-shim.ts`
  - 浏览器预览 fallback 返回 Git 空态，避免本地 preview 爆错。

- Modify: `src/ui/utils/activity-workspace-tabs.ts`
  - `ActivityRailTab` 增加 `"git"`。
  - `buildActivityWorkspaceTabs` 增加 Git tab。
- Modify: `src/ui/components/ActivityWorkspaceTabs.tsx`
  - 增加 Git icon 和标签。
- Modify: `src/ui/components/ActivityRail.tsx`
  - `selectedTab === "git"` 时渲染 `GitWorkbenchPanel`。
- Create: `src/ui/components/git/GitWorkbenchPanel.tsx`
  - Git 工作台容器，负责布局、加载、选中状态和操作回调。
- Create: `src/ui/components/git/GitStatusHeader.tsx`
  - 仓库、分支、ahead/behind、stash、dirty summary。
- Create: `src/ui/components/git/GitChangesList.tsx`
  - staged/unstaged 文件列表、搜索、批量 stage/unstage。
- Create: `src/ui/components/git/GitDiffViewer.tsx`
  - 使用 `diff2html` 渲染 unified diff。
- Create: `src/ui/components/git/GitCommitBox.tsx`
  - commit message/body、commit/push 按钮和禁用逻辑。
- Create: `src/ui/components/git/GitHistoryPanel.tsx`
  - 最近 commits 和轻量 graph。
- Create: `src/ui/components/git/GitBranchStashPanel.tsx`
  - branch create/checkout 和 stash save/apply/drop。
- Create: `src/ui/components/git/GitConfirmDialog.tsx`
  - push、checkout、stash apply/drop 的确认弹窗。
- Create: `src/ui/components/git/git-ui-utils.ts`
  - 状态标签、路径截断、diff summary 等纯 UI helper。
- Create: `src/ui/components/git/index.ts`
  - UI 组件统一出口。
- Create: `src/ui/hooks/useGitWorkbench.ts`
  - Git IPC hook，封装 refresh、mutations、error state。

- Create: `test/electron/git-service.test.ts`
  - 临时仓库集成测试。
- Create: `test/electron/git-errors.test.ts`
  - 错误归一化测试。
- Create: `test/electron/git-graph.test.ts`
  - commit graph lane 测试。
- Modify: `test/electron/activity-workspace-tabs.test.ts`
  - 断言 Git tab 显示和默认 tab 不变。
- Create: `test/electron/git-workbench-ui-source.test.ts`
  - 轻量源码断言，覆盖 UI 关键入口与危险操作禁用。

---

## Chunk 1: Git 领域模块与依赖

### Task 1: 增加 `simp
... (truncated)
```
