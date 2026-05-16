# src/electron/libs/git/service.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：501

## 文件职责

核心服务类，封装所有Git操作逻辑，是唯一的Git操作入口

## 关键符号

- `GitWorkbenchService@0 - 主服务类，封装repo检测、snapshot、diff、stage、commit、push、branch、stash等操作`
- `getSnapshot@0 - 获取仓库快照，包含status、files、branches、stashes、history和operationLog`
- `getDiff@0 - 获取指定文件的diff内容，区分staged和unstaged`
- `stageFiles@0 - 暂存指定文件`
- `unstageFiles@0 - 取消暂存指定文件`
- `commit@0 - 提交暂存的文件改动`
- `push@0 - 普通push，会检查工作区是否干净`
- `getCommitDetail@0 - 获取某个commit的详细信息，包括body、files和diff`
- `listBranches@0 - 列出本地和远程分支`
- `createBranch@0 - 创建新分支`
- `checkoutBranch@0 - 切换到指定分支`
- `stashSave@0 - 保存当前工作区到stash`
- `stashApply@0 - 应用指定stash`
- `stashDrop@0 - 删除指定stash`

## 依赖输入

- `fs/promises`
- `path`
- `simple-git`
- `./errors.js`
- `./commit-message.js`
- `./history.js`
- `./operation-log.js`
- `./types.js`

## 对外暴露

- `GitWorkbenchService`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { readFile } from "fs/promises";
import { relative, resolve, sep } from "path";
import { simpleGit, type SimpleGit, type StatusResult } from "simple-git";
import { normalizeGitError } from "./errors.js";
import { generateCommitMessageSuggestion, generateFallbackCommitMessageSuggestion } from "./commit-message.js";
import { GIT_LOG_FORMAT, parseGitLog } from "./history.js";
import { GitOperationLog } from "./operation-log.js";
import type {
  GitBranch,
  GitChangedFile,
  GitCommitDetail,
  GitCommitDetailRequest,
  GitCommitMessageSuggestion,
  GitCommitNode,
  GitDiffRequest,
  GitDiffResult,
  GitWorkbenchError,
  GitResult,
  GitWorkbenchSnapshot,
} from "./types.js";

export class GitWorkbenchService {
  private readonly operationLog = new GitOperationLog();

  async getSnapshot(cwd: string): Promise<GitResult<GitWorkbenchSnapshot>> {
    try {
      const git = this.git(cwd);
      const repoRoot = (await git.revparse(["--show-toplevel"])).trim();
      const status = await git.status();
      const stashRaw = await git.raw(["stash", "list", "--format=%gd%x1f%H%x1f%gs"]);
      const logRaw = await git.raw(["log", "--all", "--date=iso-strict", `--pretty=format:${GIT_LOG_FORMAT}`, "--max-count=120", "--decorate=short"]);
      const branches = await this.listBranches(git);
      const files = this.mapChangedFiles(status);
      const history = await this.decorateHistoryBranches(git, parseGitLog(logRaw), branches);
      const stashes = stashRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [ref = "", hash = "", message = ""] = line.split("\x1f");
          return { ref, hash, message };
        });

      return {
        success: true,
        data: {
          status: {
            repoRoot,
            isRepo: true,
            currentBranch: status.current || null,
            upstream: status.tracking || null,
            ahead: status.ahead,
            behind: status.behind,
            changedCount: files.length,
            stagedCount: files.filter((file) => file.staged).length,
            unstagedCount: files.filter((file) => !file.staged).length,
            untrackedCount: status.not_added.length,
            stashCount: stashes.length,
            hasGit: true,
          },
          files,
          branches,
          stashes,
          history,
          operationLog: this.operationLog.list(repoRoot),
        },
      };
    } catch (error) {
      return { success: false, error: normalizeGitError(error) };
    }
  }

  async getDiff(request: GitDiffRequest): Promise<GitResult<GitDiffResult>> {
    try {
      const git = this.git(request.cwd);
      if (!request.staged) {
        const status = await git.status();
        const untracked = status.files.some((file) => file.path === request.path && file.index === "?" && file.working_dir === "?");
        if (untracked) {
          const repoRoot = (await git.revparse(["--show-toplevel"])).trim();
          const diff = await buildUntrackedFileDiff(repoRoot, request.path);
          return { success: true, data: { path: request.path, staged: false, diff } };
        }
      }

      const args = request.staged ? ["--cached", "--", request.path] : ["--", request.path];
      const diff = await git.diff(args);
      return { success: true, data: { path: request.path, staged: Boolean(request.staged), diff } };
    } catch (error) {
      return { success: false, error: normalizeGitError(error) };
    }
  }

  async getCommitDetail(request: GitCommitDetailRequest): Promise<GitResult<GitCommitDetail>> {
    try {
      const git = this.git(request.cwd);
      const hash = request.hash.trim();
      const metaRaw = await git.raw(["show", "--quiet", "--date=iso-strict", `--pretty=format:${GIT_LOG_FORMAT}`, hash]);
      const [commit] = parseGitLog(metaRaw);
      if (!commit) {
        return { success: false, error: { code: "operation_failed", message: "没有找到这次提交。" } };
      }

      const [body, nameStatusRaw, diff] = await Promise.all([
        git.raw(["show", "--quiet", "--pretty=format:%B", hash]),
        git.raw(["diff-tree", "--no-commit-id", "--name-status", "-r", "
... (truncated)
```
