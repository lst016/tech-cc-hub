import type { GitWorkbenchError, GitWorkbenchErrorCode } from "./types.js";

const PATTERNS: Array<[GitWorkbenchErrorCode, RegExp, string]> = [
  ["git_not_found", /not found|ENOENT|spawn git/i, "没有找到 Git，请先安装 Git。"],
  ["not_a_repo", /not a git repository|not a git repo/i, "当前工作区不是 Git 仓库。"],
  ["auth_required", /authentication failed|could not read Username|permission denied|403|401/i, "Git 认证失败，请检查系统凭据或远程仓库权限。"],
  ["dirty_worktree", /local changes.*would be overwritten|Please commit your changes or stash/i, "当前有未提交改动，请先 commit 或 stash。"],
  ["conflict", /CONFLICT|merge conflict|unmerged/i, "Git 操作产生冲突，请先处理冲突文件。"],
  ["no_remote", /No configured push destination|No remote configured|does not appear to be a git repository/i, "当前仓库没有可用 remote。"],
  ["no_upstream", /no upstream branch|set-upstream|has no upstream branch/i, "当前分支没有 upstream。"],
  ["nothing_to_commit", /nothing to commit|no changes added to commit/i, "没有可提交的改动。"],
  ["branch_exists", /already exists/i, "分支已存在。"],
  ["branch_not_found", /not a commit|pathspec .* did not match/i, "分支不存在。"],
  ["stash_not_found", /not a stash reference|unknown revision/i, "stash 不存在。"],
];

export function normalizeGitError(error: unknown): GitWorkbenchError {
  if (isGitWorkbenchError(error)) {
    return error;
  }

  const detail = error instanceof Error ? error.message : String(error);
  const found = PATTERNS.find(([, pattern]) => pattern.test(detail));
  if (found) {
    return { code: found[0], message: found[2], detail };
  }
  return { code: "operation_failed", message: "Git 操作失败。", detail };
}

function isGitWorkbenchError(error: unknown): error is GitWorkbenchError {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}
