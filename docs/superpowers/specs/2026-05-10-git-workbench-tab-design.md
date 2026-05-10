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
- `createBranch(name, checkout?)`
- `checkoutBranch(name)`
- `stashSave(message?)`
- `stashApply(ref)`
- `stashDrop(ref)`

## UI 设计

### 宽屏三栏

右侧 rail 宽度足够时使用三栏：

1. 左栏：Changes
   - 仓库状态
   - 当前分支和 upstream
   - 文件搜索
   - staged / unstaged 分组
   - 批量 stage / unstage

2. 中栏：Diff + Commit
   - 当前文件 diff
   - stage / unstage 当前文件
   - commit message 输入
   - commit 按钮
   - push 按钮

3. 右栏：History + Branch + Stash
   - 轻量 commit graph
   - 最近提交列表
   - 分支列表
   - stash 列表

### 中等宽度

显示左栏 + 中栏，右侧 History 折叠为抽屉入口。

### 窄宽度

顶部用 segmented control 切换：

- Changes
- Diff
- History

这避免标题和按钮被挤成竖排，也符合之前任务系统 UI 的修正方向。

### 视觉原则

- 密度高于聊天 UI，但不做终端风格。
- 少用大圆角卡片，更多使用表格、列表、分割线、状态 chip。
- 状态颜色遵循 Git 语义：
  - added：绿色
  - deleted：红色
  - modified：橙色/蓝色
  - conflicted：红色警告
- 提交区固定在 Changes 栏底部或 Diff 下方，避免滚动后找不到提交按钮。

## 错误处理

所有错误都转换为结构化错误，不直接把 stderr 原样铺满 UI。

建议错误码：

```ts
type GitErrorCode =
  | "git_not_found"
  | "not_a_repo"
  | "no_remote"
  | "no_upstream"
  | "auth_required"
  | "dirty_worktree"
  | "conflict"
  | "nothing_to_commit"
  | "empty_commit_message"
  | "branch_exists"
  | "branch_not_found"
  | "stash_not_found"
  | "operation_failed";
```

UI 处理：

- `git_not_found`：提示安装 Git。
- `not_a_repo`：显示空态，不自动初始化。
- `no_remote` / `no_upstream`：允许 commit，push 给明确提示。
- `auth_required`：提示去系统凭据、终端或 Git provider 处理。
- `dirty_worktree`：checkout 前要求先 commit 或 stash。
- `conflict`：刷新状态，标出 conflicted 文件。
- `nothing_to_commit`：commit 按钮保持禁用。
- `empty_commit_message`：输入框内联提示。

## 安全策略

第一版开放：

- status
- diff
- stage / unstage
- commit
- ordinary push
- create / checkout branch
- stash save / apply / drop

第一版禁止：

- reset
- rebase
- cherry-pick
- force push
- amend
- squash
- interactive rebase

需要二次确认：

- push
- checkout branch
- stash apply
- stash drop

写操作统一进入本地操作日志，至少记录：

- 时间
- 操作类型
- repoRoot
- branch
- 参数摘要
- 成功/失败
- 错误码

## 测试计划

### 单元测试

针对 `src/electron/libs/git/`：

- status parser
- diff 输出
- history parser
- graph lane 生成
- error normalization

### 集成测试

使用临时 Git 仓库覆盖：

1. 初始化仓库并创建初始提交。
2. 修改文件，验证 status / diff。
3. stage 单文件，验证 staged 状态。
4. commit，验证 history 更新。
5. 创建并切换分支。
6. stash save / apply / drop。
7. 无 remote 时 push 返回 `no_remote`。

### UI Smoke

- 打开右侧 `Git` tab。
- 能看到当前仓库状态。
- 切换 changed file 能看到 diff。
- commit message 为空时按钮禁用。
- staged 文件为空时 commit 禁用。
- push / checkout / stash apply 会出现确认。
- 窄宽度下不会出现文字竖排或控件重叠。

### Dogfood

使用当前 `tech-cc-hub` 仓库作为第一 dogfood 仓库：

- 能显示 `main...origin/main` ahead/behind 状态。
- 能列出未跟踪文件，但不默认 stage。
- 能查看当前改动 diff。
- 不误提交 `.superpowers/` 这类临时设计页。

## 迁移与兼容

这是新增 tab，不需要迁移历史数据。

如果当前会话 `cwd` 不是 Git 仓库，Git tab 显示空态；不会影响聊天、任务面板、预览或浏览器 tab。

## 后续扩展

后续可以单独设计：

- AI commit message
- commit template
- task 与 commit 自动关联
- PR 创建入口
- remote/fetch/pull
- conflict resolver
- Git 操作审计面板
- 更完整的 branch graph

## 参考资料

- [GitHub Desktop](https://github.com/desktop/desktop)：Electron、TypeScript、React、MIT，用于参考主流程和架构分层。
- [simple-git](https://github.com/steveukx/git-js)：Node Git wrapper，MIT，用于主进程 Git 操作。
- [diff2html](https://github.com/rtfpessoa/diff2html)：git diff / unified diff 渲染，MIT，项目当前已依赖。
- [SourceGit](https://github.com/sourcegit-scm/sourcegit)：MIT Git GUI，用于参考历史、分支、stash 信息架构。
- [lazygit](https://github.com/jesseduffield/lazygit)：MIT terminal UI，用于参考高密度操作布局。
- [GitButler](https://github.com/gitbutlerapp/gitbutler)：Fair Source，用于参考现代 Git 工作流，不直接复制代码。
