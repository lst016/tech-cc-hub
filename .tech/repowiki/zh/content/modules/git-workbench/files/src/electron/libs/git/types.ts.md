# src/electron/libs/git/types.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：142

## 文件职责

定义Git工作台领域的所有TypeScript类型和接口

## 关键符号

- `GitWorkbenchErrorCode@0 - 错误码联合类型，包含git_not_found、not_a_repo、auth_required、dirty_worktree等`
- `GitWorkbenchError@0 - 标准化错误对象结构`
- `GitResult@0 - Git操作结果包装类型，success为true返回data，否则返回error`
- `GitChangedFile@0 - 单个变更文件，包含path、status、staged、additions/deletions`
- `GitRepoStatus@0 - 仓库状态信息`
- `GitCommitNode@0 - 提交图节点，包含hash、parents、author、message、graphLane等`
- `GitWorkbenchSnapshot@0 - 仓库完整快照，聚合所有状态数据`
- `GitDiffRequest/GitDiffResult@0 - diff操作请求和响应类型`
- `GitCommitMessageSuggestion@0 - AI生成的commit message建议`

## 对外暴露

- `GitWorkbenchErrorCode`
- `GitWorkbenchError`
- `GitResult`
- `GitFileStatus`
- `GitChangedFile`
- `GitRepoStatus`
- `GitBranch`
- `GitStashEntry`
- `GitCommitNode`
- `GitCommitChangedFile`
- `GitCommitDetail`
- `GitOperationLogEntry`
- `GitWorkbenchSnapshot`
- `GitDiffRequest`
- `GitCommitDetailRequest`
- `GitDiffResult`
- `GitCommitMessageSuggestion`
- `GitCommitMessageSuggestionRequest`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type GitWorkbenchErrorCode =
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

export type GitWorkbenchError = {
  code: GitWorkbenchErrorCode;
  message: string;
  detail?: string;
};

export type GitResult<T> =
  | { success: true; data: T }
  | { success: false; error: GitWorkbenchError };

export type GitFileStatus =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflicted";

export type GitChangedFile = {
  path: string;
  oldPath?: string;
  status: GitFileStatus;
  staged: boolean;
  additions?: number;
  deletions?: number;
};

export type GitRepoStatus = {
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

export type GitBranch = {
  name: string;
  current: boolean;
  remote: boolean;
  upstream?: string;
};

export type GitStashEntry = {
  ref: string;
  message: string;
  branch?: string;
  hash?: string;
};

export type GitCommitNode = {
  hash: string;
  shortHash: string;
  parents: string[];
  authorName: string;
  authorEmail?: string;
  message: string;
  committedAt: string;
  refs: string[];
  branches: string[];
  graphLane: number;
};

export type GitCommitChangedFile = GitChangedFile;

export type GitCommitDetail = GitCommitNode & {
  body: string;
  files: GitCommitChangedFile[];
  diff: string;
};

export type GitOperationLogEntry = {
  id: string;
  repoRoot: string;
  branch: string | null;
  operation: "pull" | "push" | "checkout" | "stash-save" | "stash-apply" | "stash-drop" | "commit";
  summary: string;
  success: boolean;
  errorCode?: GitWorkbenchErrorCode;
  createdAt: number;
};

export type GitWorkbenchSnapshot = {
  status: GitRepoStatus;
  files: GitChangedFile[];
  branches: GitBranch[];
  stashes: GitStashEntry[];
  history: GitCommitNode[];
  operationLog: GitOperationLogEntry[];
};

export type GitDiffRequest = {
  cwd: string;
  path: string;
  staged?: boolean;
};

export type GitCommitDetailRequest = {
  cwd: string;
  hash: string;
};

export type GitDiffResult = {
  path: string;
  staged: boolean;
  diff: string;
};

export type GitCommitMessageSuggestion = {
  message: string;
  body?: string;
  source: "ai" | "fallback";
  model?: string;
};

export type GitCommitMessageSuggestionRequest = {
  cwd: string;
  language?: string;
};

```
