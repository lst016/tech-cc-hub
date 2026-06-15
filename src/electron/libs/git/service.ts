import { readFile, realpath } from "fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "path";
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
      const target = await this.resolveDiffTarget(request);
      if (!target) {
        return { success: true, data: { path: request.path, staged: Boolean(request.staged), diff: "" } };
      }

      const git = this.git(target.cwd);
      if (!request.staged) {
        const status = await git.status();
        const untracked = status.files.some((file) => file.path === target.path && file.index === "?" && file.working_dir === "?");
        if (untracked) {
          const diff = await buildUntrackedFileDiff(target.cwd, target.path);
          return { success: true, data: { path: request.path, staged: false, diff } };
        }
      }

      const args = request.staged ? ["--cached", "--", target.path] : ["--", target.path];
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
        git.raw(["diff-tree", "--no-commit-id", "--name-status", "-r", "--find-renames", hash]),
        git.raw(["show", "--format=", "--patch", "--find-renames", "--no-ext-diff", hash]),
      ]);

      return {
        success: true,
        data: {
          ...commit,
          body: body.trim(),
          files: parseNameStatusFiles(nameStatusRaw),
          diff,
        },
      };
    } catch (error) {
      return { success: false, error: normalizeGitError(error) };
    }
  }

  async stageFiles(cwd: string, paths: string[]): Promise<GitResult<GitWorkbenchSnapshot>> {
    return this.mutate(cwd, async (git) => {
      await stagePaths(git, paths);
    });
  }

  async unstageFiles(cwd: string, paths: string[]): Promise<GitResult<GitWorkbenchSnapshot>> {
    return this.mutate(cwd, async (git) => {
      await git.raw(["restore", "--staged", "--", ...paths]);
    });
  }

  async commit(cwd: string, input: { message: string; body?: string }): Promise<GitResult<GitWorkbenchSnapshot>> {
    const message = input.message.trim();
    if (!message) {
      return { success: false, error: { code: "empty_commit_message", message: "提交信息不能为空。" } };
    }
    return this.mutate(
      cwd,
      async (git) => {
        await git.commit([message, input.body?.trim()].filter(Boolean).join("\n\n"));
      },
      "commit",
      message,
    );
  }

  async generateCommitMessage(cwd: string, language?: string): Promise<GitResult<GitCommitMessageSuggestion>> {
    try {
      const git = this.git(cwd);
      const stagedFiles = await this.readStagedFiles(git);
      if (stagedFiles.length === 0) return nothingToCommitResult();

      const [nameStatus, stat, diff] = await Promise.all([
        git.raw(["diff", "--cached", "--name-status", "--find-renames"]),
        git.raw(["diff", "--cached", "--stat", "--find-renames"]),
        git.diff(["--cached", "--find-renames", "--no-ext-diff", "--unified=1"]),
      ]);

      const suggestion = await generateCommitMessageSuggestion({
        files: stagedFiles,
        nameStatus,
        stat,
        diff,
        language,
      });

      return { success: true, data: suggestion };
    } catch (error) {
      return { success: false, error: normalizeGitError(error) };
    }
  }

  async generateFallbackCommitMessage(cwd: string): Promise<GitResult<GitCommitMessageSuggestion>> {
    try {
      const git = this.git(cwd);
      const stagedFiles = await this.readStagedFiles(git);
      if (stagedFiles.length === 0) return nothingToCommitResult();
      return { success: true, data: generateFallbackCommitMessageSuggestion(stagedFiles) };
    } catch (error) {
      return { success: false, error: normalizeGitError(error) };
    }
  }

  async push(cwd: string): Promise<GitResult<GitWorkbenchSnapshot>> {
    return this.mutate(
      cwd,
      async (git) => {
        const status = await git.status();
        const files = this.mapChangedFiles(status);
        if (status.ahead === 0 && files.length > 0) {
          throw {
            code: "dirty_worktree",
            message: "当前还有未提交改动。Push 只会推送已经提交的 commit，请先点击“提交”生成 commit 后再 Push。",
            detail: `push blocked because branch is not ahead and local changes are still uncommitted: staged=${files.filter((file) => file.staged).length}, unstaged=${files.filter((file) => !file.staged).length}`,
          } satisfies GitWorkbenchError;
        }
        await git.push();
      },
      "push",
      "push current branch",
    );
  }

  async pull(cwd: string): Promise<GitResult<GitWorkbenchSnapshot>> {
    return this.mutate(
      cwd,
      async (git) => {
        await git.pull();
      },
      "pull",
      "pull current branch",
    );
  }

  async createBranch(cwd: string, name: string, checkout: boolean): Promise<GitResult<GitWorkbenchSnapshot>> {
    return this.mutate(cwd, async (git) => {
      if (checkout) {
        await git.checkoutLocalBranch(name);
        return;
      }
      await git.branch([name]);
    });
  }

  async checkoutBranch(cwd: string, name: string): Promise<GitResult<GitWorkbenchSnapshot>> {
    return this.mutate(
      cwd,
      async (git) => {
        await git.checkout(name);
      },
      "checkout",
      name,
    );
  }

  async stashSave(cwd: string, message?: string): Promise<GitResult<GitWorkbenchSnapshot>> {
    return this.mutate(
      cwd,
      async (git) => {
        const args = ["push"];
        if (message?.trim()) args.push("-m", message.trim());
        await git.raw(["stash", ...args]);
      },
      "stash-save",
      message?.trim() || "stash save",
    );
  }

  async stashApply(cwd: string, ref: string): Promise<GitResult<GitWorkbenchSnapshot>> {
    return this.mutate(
      cwd,
      async (git) => {
        await git.raw(["stash", "apply", ref]);
      },
      "stash-apply",
      ref,
    );
  }

  async stashDrop(cwd: string, ref: string): Promise<GitResult<GitWorkbenchSnapshot>> {
    return this.mutate(
      cwd,
      async (git) => {
        await git.raw(["stash", "drop", ref]);
      },
      "stash-drop",
      ref,
    );
  }

  private git(cwd: string): SimpleGit {
    return simpleGit({ baseDir: resolve(cwd), binary: "git" });
  }

  private async resolveDiffTarget(request: GitDiffRequest): Promise<{ cwd: string; path: string } | null> {
    const trimmedPath = request.path.trim();
    if (!isAbsolute(trimmedPath)) {
      const git = this.git(request.cwd);
      const repoRoot = (await git.revparse(["--show-toplevel"])).trim();
      return { cwd: repoRoot, path: normalizeGitPath(trimmedPath) };
    }

    const ownerRepoRoot = await findGitRepoRoot(dirname(trimmedPath));
    if (!ownerRepoRoot) return null;

    const relativePath = await toRepoRelativePath(ownerRepoRoot, trimmedPath);
    return { cwd: ownerRepoRoot, path: normalizeGitPath(relativePath) };
  }

  private async readStagedFiles(git: SimpleGit): Promise<GitChangedFile[]> {
    const status = await git.status();
    return this.mapChangedFiles(status).filter((file) => file.staged);
  }

  private async mutate(
    cwd: string,
    fn: (git: SimpleGit) => Promise<void>,
    operation?: Parameters<GitOperationLog["record"]>[0]["operation"],
    summary?: string,
  ): Promise<GitResult<GitWorkbenchSnapshot>> {
    let repoRoot = "";
    let branch: string | null = null;
    try {
      const git = this.git(cwd);
      repoRoot = (await git.revparse(["--show-toplevel"])).trim();
      const beforeStatus = await git.status();
      branch = beforeStatus.current || null;
      await fn(git);
      if (operation) {
        this.operationLog.record({
          repoRoot,
          branch,
          operation,
          summary: summary || operation,
          success: true,
        });
      }
      return await this.getSnapshot(cwd);
    } catch (error) {
      if (operation && repoRoot) {
        const normalized = normalizeGitError(error);
        this.operationLog.record({
          repoRoot,
          branch,
          operation,
          summary: summary || operation,
          success: false,
          errorCode: normalized.code,
        });
        return { success: false, error: normalized };
      }
      return { success: false, error: normalizeGitError(error) };
    }
  }

  private async listBranches(git: SimpleGit): Promise<GitBranch[]> {
    const branches = await git.branch(["--all"]);
    return branches.all.map((name) => {
      const branch = branches.branches[name];
      return {
        name: name.replace(/^remotes\//, ""),
        current: Boolean(branch?.current),
        remote: name.startsWith("remotes/"),
      };
    });
  }

  private async decorateHistoryBranches(git: SimpleGit, history: GitCommitNode[], branches: GitBranch[]): Promise<GitCommitNode[]> {
    if (history.length === 0 || branches.length === 0) return history;

    const visibleHashes = new Set(history.map((commit) => commit.hash));
    const memberships = new Map<string, Set<string>>();
    const branchNames = Array.from(new Set(branches.map((branch) => branch.name).filter((name) => name !== "origin/HEAD"))).slice(0, 60);

    await Promise.all(branchNames.map(async (branchName) => {
      try {
        const raw = await git.raw(["log", branchName, "--pretty=format:%H", "--max-count=300"]);
        raw
          .split("\n")
          .map((hash) => hash.trim())
          .filter((hash) => visibleHashes.has(hash))
          .forEach((hash) => {
            const set = memberships.get(hash) ?? new Set<string>();
            set.add(branchName);
            memberships.set(hash, set);
          });
      } catch {
        // Ignore branches that disappear during refresh or cannot be resolved locally.
      }
    }));

    return history.map((commit) => ({
      ...commit,
      branches: Array.from(memberships.get(commit.hash) ?? []),
    }));
  }

  private mapChangedFiles(status: StatusResult): GitChangedFile[] {
    return status.files.flatMap((file) => {
      const entries: GitChangedFile[] = [];
      if (file.index !== " " && file.index !== "?") {
        entries.push({
          path: file.path,
          oldPath: file.from,
          status: mapStatusCode(file.index),
          staged: true,
        });
      }

      if (file.working_dir !== " " || file.index === "?") {
        entries.push({
          path: file.path,
          oldPath: file.from,
          status: mapStatusCode(file.working_dir !== " " ? file.working_dir : file.index),
          staged: false,
        });
      }

      return entries;
    });
  }
}

function nothingToCommitResult(): GitResult<GitCommitMessageSuggestion> {
  return {
    success: false,
    error: {
      code: "nothing_to_commit",
      message: "请先暂存要提交的文件。",
    },
  };
}

function mapStatusCode(code: string): GitChangedFile["status"] {
  if (code === "U") return "conflicted";
  if (code === "?") return "untracked";
  if (code === "A") return "added";
  if (code === "D") return "deleted";
  if (code === "R") return "renamed";
  if (code === "C") return "copied";
  return "modified";
}

async function stagePaths(git: SimpleGit, paths: string[]): Promise<void> {
  const uniquePaths = Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)));
  const failures: unknown[] = [];
  let stagedCount = 0;

  for (const path of uniquePaths) {
    try {
      await git.raw(["add", "--", path]);
      stagedCount += 1;
    } catch (error) {
      failures.push(error);
    }
  }

  if (stagedCount === 0 && failures.length > 0) {
    throw failures[0];
  }
}

function parseNameStatusFiles(raw: string): GitChangedFile[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const code = parts[0] ?? "M";
      const status = mapStatusCode(code[0] ?? "M");
      if ((code.startsWith("R") || code.startsWith("C")) && parts.length >= 3) {
        return {
          oldPath: parts[1],
          path: parts[2] ?? parts[1] ?? "",
          status,
          staged: false,
        };
      }
      return {
        path: parts[1] ?? "",
        status,
        staged: false,
      };
    })
    .filter((file) => file.path.length > 0);
}

async function findGitRepoRoot(baseDir: string): Promise<string | null> {
  try {
    const git = simpleGit({ baseDir: resolve(baseDir), binary: "git" });
    return (await git.revparse(["--show-toplevel"])).trim();
  } catch {
    return null;
  }
}

async function toRepoRelativePath(repoRoot: string, filePath: string): Promise<string> {
  const root = await realpath(resolve(repoRoot));
  const absolutePath = await resolveDiffPath(filePath);
  const rel = relative(root, absolutePath);
  if (isRelativePathOutsideRoot(rel)) {
    throw new Error("Git diff path must stay inside the repository.");
  }
  return rel;
}

async function resolveDiffPath(filePath: string): Promise<string> {
  const absolutePath = resolve(filePath);
  try {
    return await realpath(absolutePath);
  } catch {
    const parent = await realpath(dirname(absolutePath));
    return resolve(parent, basename(absolutePath));
  }
}

function isRelativePathOutsideRoot(path: string): boolean {
  return path.startsWith("..") || path === "" || path.split(sep).includes("..");
}

function normalizeGitPath(path: string): string {
  return path.replace(/\\/g, "/");
}

async function buildUntrackedFileDiff(repoRoot: string, filePath: string): Promise<string> {
  const root = resolve(repoRoot);
  const absolutePath = resolve(root, filePath);
  const rel = relative(root, absolutePath);
  if (isRelativePathOutsideRoot(rel)) {
    throw new Error("Git diff path must stay inside the repository.");
  }

  const buffer = await readFile(absolutePath);
  const header = [
    `diff --git a/${filePath} b/${filePath}`,
    "new file mode 100644",
    "index 0000000..0000000",
  ];

  if (buffer.includes(0)) {
    return [
      ...header,
      `Binary files /dev/null and b/${filePath} differ`,
      "",
    ].join("\n");
  }

  const text = buffer.toString("utf8");
  const hasTrailingNewline = text.endsWith("\n");
  const lines = hasTrailingNewline ? text.slice(0, -1).split("\n") : text.split("\n");
  const contentLines = text.length === 0 ? [] : lines;
  const hunk = contentLines.length > 0
    ? [
      `@@ -0,0 +1,${contentLines.length} @@`,
      ...contentLines.map((line) => `+${line}`),
      ...(hasTrailingNewline ? [] : ["\\ No newline at end of file"]),
    ]
    : [];

  return [
    ...header,
    "--- /dev/null",
    `+++ b/${filePath}`,
    ...hunk,
    "",
  ].join("\n");
}
