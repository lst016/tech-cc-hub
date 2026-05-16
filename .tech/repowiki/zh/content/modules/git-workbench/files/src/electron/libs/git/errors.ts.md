# src/electron/libs/git/errors.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：40

## 文件职责

将git stderr和simple-git错误归一化为结构化GitWorkbenchError

## 关键符号

- `PATTERNS@0 - 错误码到错误消息的映射数组，用于模式匹配`
- `normalizeGitError@0 - 主函数，将任意错误转换为标准GitWorkbenchError`
- `isGitWorkbenchError@0 - 类型守卫函数，判断错误是否已是标准化格式`

## 依赖输入

- `./types.js`

## 对外暴露

- `normalizeGitError`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

```
