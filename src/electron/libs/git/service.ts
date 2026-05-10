import { resolve } from "path";
import { simpleGit, type SimpleGit, type StatusResult } from "simple-git";
import { normalizeGitError } from "./errors.js";
import { GIT_LOG_FORMAT, parseGitLog } from "./history.js";
import { GitOperationLog } from "./operation-log.js";
import type {
  GitBranch,
  GitChangedFile,
  GitDiffRequest,
  GitDiffResult,
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
      const logRaw = await git.raw(["log", "--date=iso-strict", `--pretty=format:${GIT_LOG_FORMAT}`, "--max-count=80", "--decorate=short"]);
      const branches = await this.listBranches(git);
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
            changedCount: status.files.length,
            stagedCount: status.files.filter((file) => file.index !== " " && file.index !== "?").length,
            unstagedCount: status.files.filter((file) => file.working_dir !== " ").length,
            untrackedCount: status.not_added.length,
            stashCount: stashes.length,
            hasGit: true,
          },
          files: this.mapChangedFiles(status),
          branches,
          stashes,
          history: parseGitLog(logRaw),
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
      const args = request.staged ? ["--cached", "--", request.path] : ["--", request.path];
      const diff = await git.diff(args);
      return { success: true, data: { path: request.path, staged: Boolean(request.staged), diff } };
    } catch (error) {
      return { success: false, error: normalizeGitError(error) };
    }
  }

  async stageFiles(cwd: string, paths: string[]): Promise<GitResult<GitWorkbenchSnapshot>> {
    return this.mutate(cwd, async (git) => {
      await git.add(paths);
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

  async push(cwd: string): Promise<GitResult<GitWorkbenchSnapshot>> {
    return this.mutate(
      cwd,
      async (git) => {
        await git.push();
      },
      "push",
      "push current branch",
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

  private mapChangedFiles(status: StatusResult): GitChangedFile[] {
    return status.files.map((file) => ({
      path: file.path,
      oldPath: file.from,
      status: mapStatus(file.index, file.working_dir),
      staged: file.index !== " " && file.index !== "?",
    }));
  }
}

function mapStatus(index: string, working: string): GitChangedFile["status"] {
  if (index === "U" || working === "U") return "conflicted";
  const code = index !== " " ? index : working;
  if (code === "A" || code === "?") return "added";
  if (code === "D") return "deleted";
  if (code === "R") return "renamed";
  if (code === "C") return "copied";
  return "modified";
}
