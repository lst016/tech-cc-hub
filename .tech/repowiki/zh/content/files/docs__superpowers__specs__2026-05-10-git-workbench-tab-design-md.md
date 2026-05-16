# docs/superpowers/specs/2026-05-10-git-workbench-tab-design.md

> 模块：`git-workbench` · 语言：`markdown` · 行数：412

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Git Workbench 右侧 Tab 设计

日期：2026-05-10
状态：待用户审阅
范围：在 tech-cc-hub 右侧 tab 中增加 Git 查看、提交与安全操作工作台

## 背景

tech-cc-hub 的右侧区域已经承担预览、执行轨迹、Usage 和本地浏览器工作台。用户希望继续把 Git 查看与提交能力放到右侧 tab 中，形成一个不离开当前会话上下文的 Git 工作台。

本设计经过一轮开源调研与可视化对齐，最终选择：

- 工程路线：GitHub Desktop 式的 Electron + React 分层，但不整搬大应用。
- UI 目标：吸收 SourceGit / GitButler 这类完整 Git GUI 的专业感。
- 第一版边界：主流程 + 历史/轻量分支图，并支持 commit、push、branch、stash。
- 安全边界：第一版不开放 `reset`、`rebase`、`cherry-pick`、`force push` 等高风险历史改写操作。

## 开源参考结论

### 可直接采用

- `simple-git`
  - 作为 Electron 主进程里的 Git 命令包装层。
  - 适合当前项目，因为它运行在 Node 环境，接口比手写 shell parser 稳定。
  - 仍然依赖系统安装 `git`，因此需要显式检测和错误提示。

- `diff2html`
  - 项目当前已经依赖 `diff2html`。
  - 第一版可以用于渲染 `git diff` / unified diff，降低 diff UI 的实现风险。
  - 后续如果需要更强交互，可再切到 Monaco diff 或自研虚拟滚动 diff。

### 可借鉴结构

- GitHub Desktop
  - 适合参考 changes / diff / commit 的主流程。
  - 它也是 Electron + TypeScript + React，技术形态与 tech-cc-hub 接近。
  - 不建议整搬，因为它的窗口模型、账户体系、dispatcher、repository model 体量较大。

### 可借鉴 GUI 感

- SourceGit
  - 适合参考完整 Git GUI 的信息架构：commit graph、branch、stash、remote、tag 等。
  - 代码主栈是 C# / Avalonia，不适合直接复制进当前 React/Electron 项目。

- lazygit
  - 适合参考高密度操作区、快捷操作和 Git 面板布局。
  - 代码主栈是 Go/TUI，不能作为 React 模块直接搬。

- GitButler
  - 适合参考现代 Git 工作流和 branch/changes 的产品体验。
  - 当前是 Fair Source，不按开源模块直接复制代码；只参考交互思路。

## 目标

新增一个 `Git` 右侧 tab，让用户在当前会话工作区里完成常见 Git 工作：

1. 查看当前仓库状态、分支、upstream、ahead/behind、dirty 文件数。
2. 查看 changed files，区分 staged / unstaged。
3. 查看选中文件 diff。
4. stage / unstage 单文件或批量文件。
5. 编写 commit message 并提交。
6. 普通 push，并在 push 前二次确认。
7. 查看分支列表，创建分支，切换分支。
8. 查看 stash 列表，执行 stash save / apply / drop。
9. 查看最近提交历史和轻量 commit graph。

## 非目标

第一版明确不做：

- `reset`
- `rebase`
- `cherry-pick`
- `force push`
- interactive rebase
- merge conflict 的图形化三方编辑器
- 自动 `git init`
- 自动修改 remote / credential
- AI 自动生成 commit message
- 独立全屏 Git 客户端

这些能力可以在后续版本按风险和使用频率逐步打开。

## 架构

### 右侧 tab 接入

扩展现有右侧 tab：

- 当前：`preview`、`trace`、`usage`、可选 `browser`
- 新增：`git`

`Git` tab 和现有 tab 平级，由 `ActivityWorkspaceTabs` 管理显示与切换。它不打开新的主页面，也不改变聊天主区布局。

### Electron Git 模块

新增目录：

```text
src/electron/libs/git/
```

建议拆分：

```text
src/electron/libs/git/
  git-types.ts
  git-errors.ts
  git-service.ts
  git-diff.ts
  git-history.ts
  git-graph.ts
  git-operation-log.ts
```

职责：

- `git-service.ts`：封装 repo 检测、status、stage、commit、push、branch、stash。
- `git-diff.ts`：输出统一 diff 文本或 diff view model。
- `git-history.ts`：解析最近提交、parent、author、message、time。
- `git-graph.ts`：把 commits 转为轻量 graph 节点，供前端渲染。
- `git-errors.ts`：把 git stderr / simple-git error 归一成结构化错误。
- `git-operation-log.ts`：记录高影响操作，如 push、checkout、stash apply/drop。

Renderer 不直接执行 git，也不直接访问文件系统。所有操作通过 preload IPC 调主进程。

## 数据模型

### GitRepoStatus

```ts
type GitRepoStatus = {
  repoRoot: string;
  isRepo: boolean;
  currentBranch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  changedCount: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  stashCount: number;
  hasGit: boolean;
};
```

### GitChangedFile

```ts
type GitChangedFile = {
  path: string;
  oldPath?: string;
  status: "modified" | "added" | "deleted" | "renamed" | "copied" | "untracked" | "conflicted";
  staged: boolean;
  additions?: number;
  deletions?: number;
};
```

### GitCommitNode

```ts
type GitCommitNode = {
  hash: string;
  shortHash: string;
  parents: string[];
  authorName: string;
  authorEmail?: string;
  message: string;
  committedAt: string;
  refs: string[];
  graphLane: number;
};
```

### GitWorkbenchSnapshot

```ts
type GitWorkbenchSnapshot = {
  status: GitRepoStatus;
  files: GitChangedFile[];
  history: GitCommitNode[];
  branches: GitBranch[];
  stashes: GitStashEntry[];
  operationLog: GitOperationLogEntry[];
};
```

## 数据流

1. 用户切到 `Git` tab。
2. Renderer 用当前会话 `session.cwd` 请求 `git.getSnapshot(cwd)`。
3. 主进程执行：
   - 检测 `git` 是否可用。
   - `rev-parse --show-toplevel` 判断仓库。
   - 获取 status、branch、stash、history。
4. Renderer 渲染状态栏、文件列表、diff、history。
5. 用户选择文件时，请求 `git.getDiff(cwd, path, staged?)`。
6. 用户执行写操作后：
   - 主进程执行操作。
   - 记录必要操作日志。
   - 返回新的 `GitWorkbenchSnapshot`。
7. Renderer 全量刷新快照，并保留尽可能多的 UI 选择状态。

写操作包括：

- `stageFiles(paths)`
- `unstageFiles(paths)`
- `commit(message, body?)`
- `push()`
- `createBranc
... (truncated)
```
