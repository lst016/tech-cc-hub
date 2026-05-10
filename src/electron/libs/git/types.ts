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
  graphLane: number;
};

export type GitOperationLogEntry = {
  id: string;
  repoRoot: string;
  branch: string | null;
  operation: "push" | "checkout" | "stash-save" | "stash-apply" | "stash-drop" | "commit";
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

export type GitDiffResult = {
  path: string;
  staged: boolean;
  diff: string;
};
