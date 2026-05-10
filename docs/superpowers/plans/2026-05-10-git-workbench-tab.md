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

### Task 1: 增加 `simple-git` 依赖

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `package-lock.json`

- [ ] **Step 1: 安装依赖**

Run:

```bash
bun add simple-git
```

Expected: `package.json` 和 `bun.lock` 更新，`dependencies.simple-git` 存在。

- [ ] **Step 2: 同步 npm lock**

Run:

```bash
npm install --package-lock-only
```

Expected: `package-lock.json` 和 `package.json` 中的 dependency 版本一致。

- [ ] **Step 3: 检查依赖**

Run:

```bash
node -e "import('simple-git').then(() => console.log('simple-git ok'))"
```

Expected: 输出 `simple-git ok`。

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock package-lock.json
git commit -m "chore: add simple-git dependency"
```

### Task 2: 写 Git domain types

**Files:**
- Create: `src/electron/libs/git/types.ts`
- Create: `src/electron/libs/git/index.ts`
- Create: `src/electron/libs/git/README.md`

- [ ] **Step 1: 创建 README**

Write `src/electron/libs/git/README.md`:

```md
# Git Module

右侧 Git 工作台的主进程模块。

## 边界

- `types.ts`: Git 工作台领域类型和 IPC payload/result。
- `errors.ts`: Git 错误归一化。
- `service.ts`: 唯一 Git 操作入口。
- `history.ts`: commit history parser。
- `graph.ts`: lightweight graph lane 生成。
- `operation-log.ts`: 本地高影响操作日志。
- `ipc.ts`: Electron IPC handler 注册。
- `index.ts`: 对外统一出口。

## 第一版允许

- status / diff
- stage / unstage
- commit
- ordinary push
- create / checkout branch
- stash save / apply / drop
- recent history / lightweight graph

## 第一版禁止

- reset
- rebase
- cherry-pick
- force push
- amend
- squash
- interactive rebase
```

- [ ] **Step 2: 创建 types**

Write `src/electron/libs/git/types.ts`:

```ts
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
```

- [ ] **Step 3: 创建 index**

Write `src/electron/libs/git/index.ts`:

```ts
export { GitWorkbenchService } from "./service.js";
export { registerGitIpcHandlers } from "./ipc.js";
export type * from "./types.js";
```

- [ ] **Step 4: Typecheck**

Run:

```bash
npm run transpile:electron
```

Expected: 通过，或者只剩后续尚未创建文件导致的错误。若出错，先保证 `types.ts` 本身无语法问题。

### Task 3: 写错误归一化测试和实现

**Files:**
- Create: `test/electron/git-errors.test.ts`
- Create: `src/electron/libs/git/errors.ts`

- [ ] **Step 1: 写失败测试**

Write `test/electron/git-errors.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { normalizeGitError } from "../../src/electron/libs/git/errors.js";

test("normalizes common git errors", () => {
  assert.equal(normalizeGitError(new Error("not a git repository")).code, "not_a_repo");
  assert.equal(normalizeGitError(new Error("could not read Username for 'https://github.com'")).code, "auth_required");
  assert.equal(normalizeGitError(new Error("Your local changes to the following files would be overwritten by checkout")).code, "dirty_worktree");
  assert.equal(normalizeGitError(new Error("CONFLICT (content): Merge conflict")).code, "conflict");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
tsc --project test/electron/tsconfig.json && node --test dist-test/test/electron/git-errors.test.js
```

Expected: FAIL because `errors.ts` does not exist.

- [ ] **Step 3: 实现错误归一化**

Write `src/electron/libs/git/errors.ts`:

```ts
import type { GitWorkbenchError, GitWorkbenchErrorCode } from "./types.js";

const PATTERNS: Array<[GitWorkbenchErrorCode, RegExp, string]> = [
  ["git_not_found", /not found|ENOENT|spawn git/i, "没有找到 Git，请先安装 Git。"],
  ["not_a_repo", /not a git repository|not a git repo/i, "当前工作区不是 Git 仓库。"],
  ["auth_required", /authentication failed|could not read Username|permission denied|403|401/i, "Git 认证失败，请检查系统凭据或远程仓库权限。"],
  ["dirty_worktree", /local changes.*would be overwritten|Please commit your changes or stash/i, "当前有未提交改动，请先 commit 或 stash。"],
  ["conflict", /CONFLICT|merge conflict|unmerged/i, "Git 操作产生冲突，请先处理冲突文件。"],
  ["no_remote", /No configured push destination|No remote configured|does not appear to be a git repository/i, "当前仓库没有可用 remote。"],
  ["no_upstream", /no upstream branch|set-upstream/i, "当前分支没有 upstream。"],
  ["nothing_to_commit", /nothing to commit/i, "没有可提交的改动。"],
  ["branch_exists", /already exists/i, "分支已存在。"],
  ["branch_not_found", /not a commit|pathspec .* did not match/i, "分支不存在。"],
  ["stash_not_found", /not a stash reference|unknown revision/i, "stash 不存在。"],
];

export function normalizeGitError(error: unknown): GitWorkbenchError {
  const detail = error instanceof Error ? error.message : String(error);
  const found = PATTERNS.find(([, pattern]) => pattern.test(detail));
  if (found) {
    return { code: found[0], message: found[2], detail };
  }
  return { code: "operation_failed", message: "Git 操作失败。", detail };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
tsc --project test/electron/tsconfig.json && node --test dist-test/test/electron/git-errors.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/electron/libs/git test/electron/git-errors.test.ts
git commit -m "feat: add git error normalization"
```

### Task 4: 实现 history 和 graph

**Files:**
- Create: `test/electron/git-graph.test.ts`
- Create: `src/electron/libs/git/history.ts`
- Create: `src/electron/libs/git/graph.ts`

- [ ] **Step 1: 写 graph 测试**

Write `test/electron/git-graph.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { assignGraphLanes } from "../../src/electron/libs/git/graph.js";

test("assignGraphLanes gives stable lanes for linear history", () => {
  const commits = assignGraphLanes([
    { hash: "c3", shortHash: "c3", parents: ["c2"], authorName: "A", message: "third", committedAt: "2026-05-10", refs: [], graphLane: 0 },
    { hash: "c2", shortHash: "c2", parents: ["c1"], authorName: "A", message: "second", committedAt: "2026-05-10", refs: [], graphLane: 0 },
    { hash: "c1", shortHash: "c1", parents: [], authorName: "A", message: "first", committedAt: "2026-05-10", refs: [], graphLane: 0 },
  ]);

  assert.deepEqual(commits.map((commit) => commit.graphLane), [0, 0, 0]);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
tsc --project test/electron/tsconfig.json && node --test dist-test/test/electron/git-graph.test.js
```

Expected: FAIL because `graph.ts` does not exist.

- [ ] **Step 3: 实现 graph helper**

Write `src/electron/libs/git/graph.ts`:

```ts
import type { GitCommitNode } from "./types.js";

export function assignGraphLanes(commits: GitCommitNode[]): GitCommitNode[] {
  const laneByHash = new Map<string, number>();
  let nextLane = 0;

  return commits.map((commit) => {
    const lane = laneByHash.get(commit.hash) ?? 0;
    for (const parent of commit.parents) {
      if (!laneByHash.has(parent)) {
        laneByHash.set(parent, commit.parents.length > 1 ? nextLane++ : lane);
      }
    }
    return { ...commit, graphLane: lane };
  });
}
```

- [ ] **Step 4: 实现 history parser**

Write `src/electron/libs/git/history.ts`:

```ts
import type { GitCommitNode } from "./types.js";
import { assignGraphLanes } from "./graph.js";

const FIELD = "\x1f";
const RECORD = "\x1e";

export const GIT_LOG_FORMAT = `%H${FIELD}%h${FIELD}%P${FIELD}%an${FIELD}%ae${FIELD}%aI${FIELD}%D${FIELD}%s${RECORD}`;

export function parseGitLog(raw: string): GitCommitNode[] {
  const commits = raw
    .split(RECORD)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash = "", shortHash = "", parentsRaw = "", authorName = "", authorEmail = "", committedAt = "", refsRaw = "", message = ""] = record.split(FIELD);
      return {
        hash,
        shortHash,
        parents: parentsRaw.trim() ? parentsRaw.trim().split(/\s+/) : [],
        authorName,
        authorEmail,
        committedAt,
        refs: refsRaw ? refsRaw.split(",").map((ref) => ref.trim()).filter(Boolean) : [],
        message,
        graphLane: 0,
      } satisfies GitCommitNode;
    });

  return assignGraphLanes(commits);
}
```

- [ ] **Step 5: 运行测试**

Run:

```bash
tsc --project test/electron/tsconfig.json && node --test dist-test/test/electron/git-graph.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/electron/libs/git/history.ts src/electron/libs/git/graph.ts test/electron/git-graph.test.ts
git commit -m "feat: add git history graph helpers"
```

### Task 5: 实现 GitWorkbenchService

**Files:**
- Create: `test/electron/git-service.test.ts`
- Create: `src/electron/libs/git/service.ts`
- Create: `src/electron/libs/git/operation-log.ts`

- [ ] **Step 1: 写临时仓库测试 helper**

In `test/electron/git-service.test.ts`, start with:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

import { GitWorkbenchService } from "../../src/electron/libs/git/service.js";

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function createRepo() {
  const cwd = mkdtempSync(join(tmpdir(), "tech-cc-hub-git-"));
  git(cwd, ["init"]);
  git(cwd, ["config", "user.email", "test@example.com"]);
  git(cwd, ["config", "user.name", "Test User"]);
  writeFileSync(join(cwd, "README.md"), "# demo\n");
  git(cwd, ["add", "README.md"]);
  git(cwd, ["commit", "-m", "initial"]);
  return cwd;
}
```

- [ ] **Step 2: 写失败测试**

Add tests:

```ts
test("GitWorkbenchService reads status, diff and commits", async () => {
  const cwd = createRepo();
  writeFileSync(join(cwd, "README.md"), "# demo\n\nchange\n");

  const service = new GitWorkbenchService();
  const snapshot = await service.getSnapshot(cwd);
  assert.equal(snapshot.success, true);
  if (!snapshot.success) return;
  assert.equal(snapshot.data.status.isRepo, true);
  assert.equal(snapshot.data.files.length, 1);
  assert.equal(snapshot.data.files[0]?.path, "README.md");

  const diff = await service.getDiff({ cwd, path: "README.md" });
  assert.equal(diff.success, true);
  if (!diff.success) return;
  assert.match(diff.data.diff, /change/);
});

test("GitWorkbenchService stages and commits files", async () => {
  const cwd = createRepo();
  writeFileSync(join(cwd, "notes.txt"), "hello\n");

  const service = new GitWorkbenchService();
  const staged = await service.stageFiles(cwd, ["notes.txt"]);
  assert.equal(staged.success, true);

  const committed = await service.commit(cwd, { message: "add notes" });
  assert.equal(committed.success, true);
  if (!committed.success) return;
  assert.equal(committed.data.history[0]?.message, "add notes");
});
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
tsc --project test/electron/tsconfig.json && node --test dist-test/test/electron/git-service.test.js
```

Expected: FAIL because service is not implemented.

- [ ] **Step 4: 实现 operation log**

Write `src/electron/libs/git/operation-log.ts`:

```ts
import { randomUUID } from "crypto";
import type { GitOperationLogEntry } from "./types.js";

export class GitOperationLog {
  private entries: GitOperationLogEntry[] = [];

  list(repoRoot: string): GitOperationLogEntry[] {
    return this.entries.filter((entry) => entry.repoRoot === repoRoot).slice(-50).reverse();
  }

  record(entry: Omit<GitOperationLogEntry, "id" | "createdAt">): GitOperationLogEntry {
    const next = { ...entry, id: randomUUID(), createdAt: Date.now() };
    this.entries.push(next);
    if (this.entries.length > 500) {
      this.entries = this.entries.slice(-500);
    }
    return next;
  }
}
```

- [ ] **Step 5: 实现 service**

Implement `src/electron/libs/git/service.ts` with these methods:

```ts
import { access } from "fs/promises";
import { dirname, resolve } from "path";
import simpleGit, { type SimpleGit, type StatusResult } from "simple-git";
import { normalizeGitError } from "./errors.js";
import { GIT_LOG_FORMAT, parseGitLog } from "./history.js";
import { GitOperationLog } from "./operation-log.js";
import type { GitBranch, GitChangedFile, GitDiffRequest, GitDiffResult, GitResult, GitWorkbenchSnapshot } from "./types.js";

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
      const stashes = stashRaw.split("\n").filter(Boolean).map((line) => {
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
            stagedCount: status.files.filter((file) => file.index !== " ").length,
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

  async stageFiles(cwd: string, paths: string[]) {
    return this.mutate(cwd, async (git) => {
      await git.add(paths);
    });
  }

  async unstageFiles(cwd: string, paths: string[]) {
    return this.mutate(cwd, async (git) => {
      await git.reset(["--", ...paths]);
    });
  }

  async commit(cwd: string, input: { message: string; body?: string }) {
    const message = input.message.trim();
    if (!message) {
      return { success: false as const, error: { code: "empty_commit_message" as const, message: "提交信息不能为空。" } };
    }
    return this.mutate(cwd, async (git) => {
      await git.commit([message, input.body?.trim()].filter(Boolean).join("\n\n"));
    }, "commit", message);
  }

  async push(cwd: string) {
    return this.mutate(cwd, async (git) => {
      await git.push();
    }, "push", "push current branch");
  }

  async createBranch(cwd: string, name: string, checkout: boolean) {
    return this.mutate(cwd, async (git) => {
      await git.checkoutLocalBranch(name);
      if (!checkout) {
        await git.checkout("-");
      }
    });
  }

  async checkoutBranch(cwd: string, name: string) {
    return this.mutate(cwd, async (git) => {
      await git.checkout(name);
    }, "checkout", name);
  }

  async stashSave(cwd: string, message?: string) {
    return this.mutate(cwd, async (git) => {
      const args = ["push"];
      if (message?.trim()) args.push("-m", message.trim());
      await git.raw(["stash", ...args]);
    }, "stash-save", message || "stash save");
  }

  async stashApply(cwd: string, ref: string) {
    return this.mutate(cwd, async (git) => {
      await git.raw(["stash", "apply", ref]);
    }, "stash-apply", ref);
  }

  async stashDrop(cwd: string, ref: string) {
    return this.mutate(cwd, async (git) => {
      await git.raw(["stash", "drop", ref]);
    }, "stash-drop", ref);
  }

  private git(cwd: string): SimpleGit {
    return simpleGit({ baseDir: resolve(cwd), binary: "git" });
  }

  private async mutate(cwd: string, fn: (git: SimpleGit) => Promise<void>, operation?: Parameters<GitOperationLog["record"]>[0]["operation"], summary?: string) {
    try {
      const git = this.git(cwd);
      await fn(git);
      const snapshot = await this.getSnapshot(cwd);
      if (operation && snapshot.success) {
        this.operationLog.record({
          repoRoot: snapshot.data.status.repoRoot,
          branch: snapshot.data.status.currentBranch,
          operation,
          summary: summary || operation,
          success: true,
        });
      }
      return snapshot;
    } catch (error) {
      return { success: false as const, error: normalizeGitError(error) };
    }
  }

  private async listBranches(git: SimpleGit): Promise<GitBranch[]> {
    const branches = await git.branch(["--all"]);
    return branches.all.map((name) => ({
      name: name.replace(/^remotes\//, ""),
      current: name === branches.current,
      remote: name.startsWith("remotes/"),
    }));
  }

  private mapChangedFiles(status: StatusResult): GitChangedFile[] {
    return status.files.map((file) => ({
      path: file.path,
      status: mapStatus(file.index, file.working_dir),
      staged: file.index !== " " && file.index !== "?",
    }));
  }
}

function mapStatus(index: string, working: string): GitChangedFile["status"] {
  const code = index !== " " ? index : working;
  if (code === "A" || code === "?") return "added";
  if (code === "D") return "deleted";
  if (code === "R") return "renamed";
  if (code === "C") return "copied";
  if (code === "U") return "conflicted";
  return "modified";
}
```

If TypeScript complains about `simple-git` status types, inspect the installed package types and adapt the helper signatures, keeping the public `GitWorkbenchService` API unchanged.

- [ ] **Step 6: 运行测试**

Run:

```bash
tsc --project test/electron/tsconfig.json && node --test dist-test/test/electron/git-service.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/electron/libs/git test/electron/git-service.test.ts
git commit -m "feat: add git workbench service"
```

---

## Chunk 2: IPC, preload, dev bridge

### Task 6: 注册 Git IPC handlers

**Files:**
- Create: `src/electron/libs/git/ipc.ts`
- Modify: `src/electron/main.ts`

- [ ] **Step 1: 创建 IPC 注册文件**

Write `src/electron/libs/git/ipc.ts`:

```ts
import type { IpcMain } from "electron";
import { GitWorkbenchService } from "./service.js";

export function registerGitIpcHandlers(ipcMain: IpcMain, service = new GitWorkbenchService()): void {
  ipcMain.handle("git:get-snapshot", (_event, cwd: string) => service.getSnapshot(cwd));
  ipcMain.handle("git:get-diff", (_event, request) => service.getDiff(request));
  ipcMain.handle("git:stage-files", (_event, cwd: string, paths: string[]) => service.stageFiles(cwd, paths));
  ipcMain.handle("git:unstage-files", (_event, cwd: string, paths: string[]) => service.unstageFiles(cwd, paths));
  ipcMain.handle("git:commit", (_event, cwd: string, input) => service.commit(cwd, input));
  ipcMain.handle("git:push", (_event, cwd: string) => service.push(cwd));
  ipcMain.handle("git:create-branch", (_event, cwd: string, name: string, checkout: boolean) => service.createBranch(cwd, name, checkout));
  ipcMain.handle("git:checkout-branch", (_event, cwd: string, name: string) => service.checkoutBranch(cwd, name));
  ipcMain.handle("git:stash-save", (_event, cwd: string, message?: string) => service.stashSave(cwd, message));
  ipcMain.handle("git:stash-apply", (_event, cwd: string, ref: string) => service.stashApply(cwd, ref));
  ipcMain.handle("git:stash-drop", (_event, cwd: string, ref: string) => service.stashDrop(cwd, ref));
}
```

- [ ] **Step 2: 在 main 注册**

Modify `src/electron/main.ts`:

```ts
import { registerGitIpcHandlers } from "./libs/git/index.js";
```

Near existing `ipcMain.handle(...)` registrations:

```ts
registerGitIpcHandlers(ipcMain);
```

Expected: app startup registers Git channels once.

- [ ] **Step 3: Typecheck**

Run:

```bash
npm run transpile:electron
```

Expected: PASS.

### Task 7: preload 和 dev bridge 支持 Git API

**Files:**
- Modify: `src/electron/preload.cts`
- Modify: `src/electron/main.ts`
- Modify: `src/ui/dev-electron-shim.ts`

- [ ] **Step 1: preload 暴露 typed helpers**

Modify `src/electron/preload.cts` inside exposed object:

```ts
getGitSnapshot: (cwd: string) => ipcInvoke("git:get-snapshot" as any, cwd),
getGitDiff: (request: any) => ipcInvoke("git:get-diff" as any, request),
gitStageFiles: (cwd: string, paths: string[]) => ipcInvoke("git:stage-files" as any, cwd, paths),
gitUnstageFiles: (cwd: string, paths: string[]) => ipcInvoke("git:unstage-files" as any, cwd, paths),
gitCommit: (cwd: string, input: any) => ipcInvoke("git:commit" as any, cwd, input),
gitPush: (cwd: string) => ipcInvoke("git:push" as any, cwd),
gitCreateBranch: (cwd: string, name: string, checkout: boolean) => ipcInvoke("git:create-branch" as any, cwd, name, checkout),
gitCheckoutBranch: (cwd: string, name: string) => ipcInvoke("git:checkout-branch" as any, cwd, name),
gitStashSave: (cwd: string, message?: string) => ipcInvoke("git:stash-save" as any, cwd, message),
gitStashApply: (cwd: string, ref: string) => ipcInvoke("git:stash-apply" as any, cwd, ref),
gitStashDrop: (cwd: string, ref: string) => ipcInvoke("git:stash-drop" as any, cwd, ref),
```

Note: if the project has a global `EventPayloadMapping` file in generated types, prefer adding real entries there instead of `as any`. If it does not, keep the `as any` local to preload only.

- [ ] **Step 2: dev bridge invoke 支持 Git channels**

In `src/electron/main.ts` dev bridge `invoke`, create one shared `GitWorkbenchService` and add channel branches:

```ts
if (channel === "git:get-snapshot") return await gitWorkbenchService.getSnapshot(args[0] as string);
if (channel === "git:get-diff") return await gitWorkbenchService.getDiff(args[0] as never);
if (channel === "git:stage-files") return await gitWorkbenchService.stageFiles(args[0] as string, args[1] as string[]);
// repeat for unstage, commit, push, branch, stash
```

Expected: Vite browser preview with Dev Bridge can exercise Git tab without Electron preload.

- [ ] **Step 3: fallback shim returns empty unsupported Git result**

In `src/ui/dev-electron-shim.ts`, add fallback methods returning:

```ts
{
  success: false,
  error: {
    code: "operation_failed",
    message: "浏览器预览态未连接 Electron 后端，无法读取 Git 状态。",
  },
}
```

Expected: when Dev Bridge is disconnected, Git tab shows a friendly empty/error state instead of crashing.

- [ ] **Step 4: Typecheck**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/electron/main.ts src/electron/preload.cts src/ui/dev-electron-shim.ts src/electron/libs/git/ipc.ts
git commit -m "feat: expose git workbench ipc"
```

---

## Chunk 3: Git tab wiring

### Task 8: Add Git tab to right workspace tabs

**Files:**
- Modify: `src/ui/utils/activity-workspace-tabs.ts`
- Modify: `src/ui/components/ActivityWorkspaceTabs.tsx`
- Modify: `test/electron/activity-workspace-tabs.test.ts`

- [ ] **Step 1: 写失败测试**

Modify `test/electron/activity-workspace-tabs.test.ts`:

```ts
it("includes the git tab before the optional browser tab", () => {
  const visibleTabs = buildActivityWorkspaceTabs({
    activeTab: "git",
    showBrowserTab: false,
  }).filter((tab) => tab.visible);

  assert.deepEqual(visibleTabs.map((tab) => tab.id), ["preview", "trace", "usage", "git"]);
  assert.equal(visibleTabs.find((tab) => tab.id === "git")?.label, "Git");
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
tsc --project test/electron/tsconfig.json && node --test dist-test/test/electron/activity-workspace-tabs.test.js
```

Expected: FAIL until the tab utility is updated.

- [ ] **Step 3: Update tab utility**

Modify `src/ui/utils/activity-workspace-tabs.ts`:

```ts
export type ActivityRailTab = "trace" | "usage" | "preview" | "git";
```

Add item before browser:

```ts
{
  id: "git",
  label: "Git",
  title: "Git 工作台",
  visible: true,
  active: input.activeTab === "git",
},
```

- [ ] **Step 4: Add Git icon**

Modify `src/ui/components/ActivityWorkspaceTabs.tsx` `iconForTab`:

```tsx
if (tab === "git") {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 7.5 12 3l5 4.5M12 3v18M7 16.5 12 21l5-4.5" />
      <circle cx="12" cy="8" r="1.5" />
      <circle cx="12" cy="16" r="1.5" />
    </svg>
  );
}
```

If the icon feels off during UI polish, replace with a lucide `GitBranch` import, but keep bundle consistency with existing inline SVG style in this component.

- [ ] **Step 5: Run test**

Run:

```bash
tsc --project test/electron/tsconfig.json && node --test dist-test/test/electron/activity-workspace-tabs.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/utils/activity-workspace-tabs.ts src/ui/components/ActivityWorkspaceTabs.tsx test/electron/activity-workspace-tabs.test.ts
git commit -m "feat: add git activity tab"
```

### Task 9: Add UI types and Git hook

**Files:**
- Modify: `src/ui/types.ts`
- Create: `src/ui/hooks/useGitWorkbench.ts`

- [ ] **Step 1: Add UI types**

In `src/ui/types.ts`, add types mirroring `src/electron/libs/git/types.ts`, prefixed with `UiGit`. Keep names stable because components will import them.

Required exports:

```ts
export type UiGitResult<T> = { success: true; data: T } | { success: false; error: UiGitWorkbenchError };
export type UiGitWorkbenchSnapshot = { /* same shape as GitWorkbenchSnapshot */ };
export type UiGitChangedFile = { /* same shape */ };
export type UiGitDiffResult = { path: string; staged: boolean; diff: string };
export type UiGitWorkbenchError = { code: string; message: string; detail?: string };
```

- [ ] **Step 2: Create hook**

Write `src/ui/hooks/useGitWorkbench.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UiGitDiffResult, UiGitResult, UiGitWorkbenchSnapshot } from "../types";

type GitElectron = typeof window.electron & {
  getGitSnapshot?: (cwd: string) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
  getGitDiff?: (request: { cwd: string; path: string; staged?: boolean }) => Promise<UiGitResult<UiGitDiffResult>>;
  gitStageFiles?: (cwd: string, paths: string[]) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
  gitUnstageFiles?: (cwd: string, paths: string[]) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
  gitCommit?: (cwd: string, input: { message: string; body?: string }) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
  gitPush?: (cwd: string) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
  gitCreateBranch?: (cwd: string, name: string, checkout: boolean) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
  gitCheckoutBranch?: (cwd: string, name: string) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
  gitStashSave?: (cwd: string, message?: string) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
  gitStashApply?: (cwd: string, ref: string) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
  gitStashDrop?: (cwd: string, ref: string) => Promise<UiGitResult<UiGitWorkbenchSnapshot>>;
};

export function useGitWorkbench(cwd?: string) {
  const [snapshot, setSnapshot] = useState<UiGitWorkbenchSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const electron = window.electron as GitElectron;

  const applyResult = useCallback((result: UiGitResult<UiGitWorkbenchSnapshot>) => {
    if (result.success) {
      setSnapshot(result.data);
      setError(null);
      return true;
    }
    setError(result.error.message);
    return false;
  }, []);

  const refresh = useCallback(async () => {
    if (!cwd || !electron.getGitSnapshot) return;
    setLoading(true);
    try {
      applyResult(await electron.getGitSnapshot(cwd));
    } finally {
      setLoading(false);
    }
  }, [applyResult, cwd, electron]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { snapshot, error, loading, refresh, applyResult, electron };
}
```

During implementation, extend the hook with specific mutation helpers instead of letting components call `electron` directly.

- [ ] **Step 3: Typecheck**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/types.ts src/ui/hooks/useGitWorkbench.ts
git commit -m "feat: add git workbench ui hook"
```

---

## Chunk 4: Git Workbench UI

### Task 10: Build base panel and render in ActivityRail

**Files:**
- Create: `src/ui/components/git/GitWorkbenchPanel.tsx`
- Create: `src/ui/components/git/GitStatusHeader.tsx`
- Create: `src/ui/components/git/index.ts`
- Modify: `src/ui/components/ActivityRail.tsx`

- [ ] **Step 1: Create status header**

Write `src/ui/components/git/GitStatusHeader.tsx`:

```tsx
import type { UiGitWorkbenchSnapshot } from "../../types";

export function GitStatusHeader({ snapshot }: { snapshot: UiGitWorkbenchSnapshot | null }) {
  const status = snapshot?.status;
  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Git Workbench</p>
          <h2 className="mt-1 truncate text-lg font-semibold text-slate-950">{status?.currentBranch || "No repository"}</h2>
        </div>
        {status?.isRepo && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{status.changedCount} changes</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">+{status.ahead} / -{status.behind}</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create base panel**

Write `src/ui/components/git/GitWorkbenchPanel.tsx`:

```tsx
import { useState } from "react";
import { useGitWorkbench } from "../../hooks/useGitWorkbench";
import type { UiGitChangedFile } from "../../types";
import { GitStatusHeader } from "./GitStatusHeader";

export function GitWorkbenchPanel({ cwd }: { cwd?: string }) {
  const { snapshot, error, loading, refresh } = useGitWorkbench(cwd);
  const [selectedFile, setSelectedFile] = useState<UiGitChangedFile | null>(null);

  if (!cwd) {
    return <div className="p-4 text-sm text-slate-500">当前会话没有工作区，无法显示 Git 状态。</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <GitStatusHeader snapshot={snapshot} />
      {error && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_300px] overflow-hidden">
        <aside className="min-h-0 border-r border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <strong>Changes</strong>
            <button type="button" onClick={refresh} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
              {loading ? "刷新中" : "刷新"}
            </button>
          </div>
          <div className="space-y-1 overflow-y-auto">
            {snapshot?.files.map((file) => (
              <button key={`${file.staged}:${file.path}`} type="button" onClick={() => setSelectedFile(file)} className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white">
                <span className="font-medium">{file.path}</span>
                <span className="ml-2 text-xs text-slate-500">{file.status}</span>
              </button>
            ))}
          </div>
        </aside>
        <main className="min-h-0 overflow-auto p-4">
          <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
            {selectedFile ? selectedFile.path : "选择左侧文件查看 diff"}
          </div>
        </main>
        <aside className="min-h-0 border-l border-slate-200 bg-slate-50 p-3">
          <strong>History</strong>
          <div className="mt-3 space-y-2">
            {snapshot?.history.slice(0, 20).map((commit) => (
              <div key={commit.hash} className="rounded-lg border border-slate-200 bg-white p-2 text-sm">
                <div className="font-medium">{commit.message}</div>
                <div className="text-xs text-slate-500">{commit.shortHash}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Export component**

Write `src/ui/components/git/index.ts`:

```ts
export { GitWorkbenchPanel } from "./GitWorkbenchPanel";
```

- [ ] **Step 4: Render in ActivityRail**

Modify `src/ui/components/ActivityRail.tsx`:

```tsx
import { GitWorkbenchPanel } from "./git";
```

Add branch before preview/trace branch:

```tsx
{selectedTab === "git" ? (
  <div className="min-h-0 flex-1 overflow-hidden">
    <GitWorkbenchPanel cwd={session?.cwd} />
  </div>
) : selectedTab === "usage" ? (
  ...
```

- [ ] **Step 5: Build**

Run:

```bash
npm run build
```

Expected: PASS and Git tab renders a basic shell.

### Task 11: Add Changes, Diff, Commit components

**Files:**
- Create: `src/ui/components/git/GitChangesList.tsx`
- Create: `src/ui/components/git/GitDiffViewer.tsx`
- Create: `src/ui/components/git/GitCommitBox.tsx`
- Modify: `src/ui/components/git/GitWorkbenchPanel.tsx`
- Modify: `src/ui/hooks/useGitWorkbench.ts`

- [ ] **Step 1: Extend hook with mutations and diff**

Add in `useGitWorkbench`:

```ts
const [diff, setDiff] = useState<UiGitDiffResult | null>(null);

const loadDiff = useCallback(async (path: string, staged?: boolean) => {
  if (!cwd || !electron.getGitDiff) return;
  const result = await electron.getGitDiff({ cwd, path, staged });
  if (result.success) setDiff(result.data);
  else setError(result.error.message);
}, [cwd, electron]);

const stageFiles = useCallback(async (paths: string[]) => {
  if (!cwd || !electron.gitStageFiles) return false;
  return applyResult(await electron.gitStageFiles(cwd, paths));
}, [applyResult, cwd, electron]);
```

Add equivalent helpers for unstage, commit, push, branch, stash.

- [ ] **Step 2: Create `GitChangesList`**

Component requirements:

- Search input filters by path.
- Group `unstaged` and `staged`.
- Each row shows status chip, path, staged state.
- Buttons:
  - stage selected file
  - unstage selected file
  - stage all unstaged

- [ ] **Step 3: Create `GitDiffViewer`**

Use `diff2html`:

```tsx
import { Diff2HtmlUI } from "diff2html/lib/ui/js/diff2html-ui-base";
import "diff2html/bundles/css/diff2html.min.css";
```

If direct UI import causes Vite issues, fallback to:

```tsx
import { html } from "diff2html";
```

and render:

```tsx
<div dangerouslySetInnerHTML={{ __html: html(diff, { drawFileList: false, matching: "lines", outputFormat: "side-by-side" }) }} />
```

Sanity guard: only pass git-generated diff from local service, not arbitrary user HTML.

- [ ] **Step 4: Create `GitCommitBox`**

Requirements:

- Message input required.
- Body textarea optional.
- Commit disabled if no staged files or message empty.
- Push button separate and requires confirmation in Task 12.

- [ ] **Step 5: Wire into panel**

`GitWorkbenchPanel` should pass:

- `snapshot.files`
- `selectedFile`
- `diff`
- `stageFiles`
- `unstageFiles`
- `commit`
- `push`

- [ ] **Step 6: Build**

Run:

```bash
npm run build
```

Expected: PASS, no text squeezed vertically at 400px rail width.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/git src/ui/hooks/useGitWorkbench.ts src/ui/components/ActivityRail.tsx
git commit -m "feat: add git changes diff commit ui"
```

### Task 12: Add History, Branch, Stash and confirmations

**Files:**
- Create: `src/ui/components/git/GitHistoryPanel.tsx`
- Create: `src/ui/components/git/GitBranchStashPanel.tsx`
- Create: `src/ui/components/git/GitConfirmDialog.tsx`
- Create: `src/ui/components/git/git-ui-utils.ts`
- Modify: `src/ui/components/git/GitWorkbenchPanel.tsx`

- [ ] **Step 1: Create confirmation dialog**

Implement a lightweight local dialog or reuse an existing settings confirm dialog if it is generic enough. Confirmation required for:

- push
- checkout branch
- stash apply
- stash drop

- [ ] **Step 2: Create history panel**

`GitHistoryPanel` shows:

- commit lane dot based on `graphLane`
- short hash
- message
- refs
- relative date or ISO date

Do not implement checkout/reset from history in v1.

- [ ] **Step 3: Create branch/stash panel**

Branch requirements:

- show local and remote branch lists
- create branch input
- checkout button with confirmation

Stash requirements:

- show stash list
- save stash with optional message
- apply/drop with confirmation

- [ ] **Step 4: Responsive behavior**

In `GitWorkbenchPanel`, use CSS grid classes:

- default wide: `grid-cols-[280px_minmax(0,1fr)_300px]`
- below practical rail width, collapse right panel into a tabbed section or vertical stack.

Avoid layout where title text becomes one-character-per-line. Add `min-w-0`, `truncate`, and switch to stacked layout under narrow width.

- [ ] **Step 5: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/git
git commit -m "feat: add git history branch stash ui"
```

---

## Chunk 5: Verification and hardening

### Task 13: Add UI source tests

**Files:**
- Create: `test/electron/git-workbench-ui-source.test.ts`
- Modify: `test/electron/activity-workspace-tabs.test.ts`

- [ ] **Step 1: Write source assertions**

Write `test/electron/git-workbench-ui-source.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("git workbench is mounted through ActivityRail", () => {
  const source = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");
  assert.match(source, /GitWorkbenchPanel/);
  assert.match(source, /selectedTab === "git"/);
});

test("git workbench does not expose high risk operations in v1", () => {
  const combined = [
    readFileSync("src/electron/libs/git/service.ts", "utf8"),
    readFileSync("src/ui/components/git/GitWorkbenchPanel.tsx", "utf8"),
  ].join("\n");
  assert.doesNotMatch(combined, /force push|--force|rebase|cherry-pick|reset --hard/i);
});
```

- [ ] **Step 2: Run tests**

Run:

```bash
tsc --project test/electron/tsconfig.json && node --test dist-test/test/electron/git-workbench-ui-source.test.js dist-test/test/electron/activity-workspace-tabs.test.js
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add test/electron/git-workbench-ui-source.test.ts test/electron/activity-workspace-tabs.test.ts
git commit -m "test: cover git workbench ui wiring"
```

### Task 14: Run full verification set

**Files:**
- Verify only.

- [ ] **Step 1: Electron transpile**

Run:

```bash
npm run transpile:electron
```

Expected: PASS.

- [ ] **Step 2: Targeted tests**

Run:

```bash
tsc --project test/electron/tsconfig.json
node --test \
  dist-test/test/electron/git-errors.test.js \
  dist-test/test/electron/git-graph.test.js \
  dist-test/test/electron/git-service.test.js \
  dist-test/test/electron/activity-workspace-tabs.test.js \
  dist-test/test/electron/git-workbench-ui-source.test.js
```

Expected: PASS.

- [ ] **Step 3: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Lint**

Run:

```bash
npm run lint
```

Expected: PASS or only pre-existing lint failures unrelated to Git workbench. If pre-existing failures appear, capture exact files and do not silently fix unrelated code.

### Task 15: Manual dogfood

**Files:**
- Verify only.

- [ ] **Step 1: Start app**

Run:

```bash
npm run dev
```

Expected: Vite/Electron starts.

- [ ] **Step 2: Open Git tab in current repo**

Expected:

- Right rail shows `Git` tab.
- Current branch visible.
- Dirty files listed.
- `.superpowers/` is untracked if present but not staged automatically.
- Selecting a file loads diff.

- [ ] **Step 3: Validate local commit flow in a scratch repo**

Use a temporary repo, not `tech-cc-hub`, for actual commit/push/branch/stash testing:

```bash
tmp="$(mktemp -d)"
cd "$tmp"
git init
git config user.email test@example.com
git config user.name "Test User"
echo hello > README.md
git add README.md
git commit -m initial
```

Create a session with that cwd, then verify:

- Modify file -> appears in Git tab.
- Stage -> moves to staged group.
- Commit -> history updates.
- Create branch -> branch list updates.
- Stash save/apply/drop works.
- Push without remote returns `no_remote`.

- [ ] **Step 4: Check responsive UI**

Resize right rail to:

- 420px
- 640px
- 900px

Expected:

- No vertical one-character title rendering.
- No button text overflow.
- History collapses or stacks cleanly at narrow width.

- [ ] **Step 5: Final commit**

```bash
git status -sb
git add package.json bun.lock package-lock.json src/electron/libs/git src/electron/main.ts src/electron/preload.cts src/ui/dev-electron-shim.ts src/ui/types.ts src/ui/hooks/useGitWorkbench.ts src/ui/utils/activity-workspace-tabs.ts src/ui/components/ActivityWorkspaceTabs.tsx src/ui/components/ActivityRail.tsx src/ui/components/git test/electron
git commit -m "feat: add git workbench tab"
```

Before committing, inspect `git diff --cached --stat` and ensure unrelated current worktree changes are not staged.

---

## Execution Notes

- Do not implement high-risk operations hidden behind unused functions. If a method can do `reset/rebase/cherry-pick/force push`, do not add it in v1.
- Keep `src/electron/libs/git/` self-contained. UI should not import `simple-git`.
- Keep Git write operations in main process only.
- Prefer explicit confirmation before `push`, `checkout`, `stash apply`, `stash drop`.
- If `diff2html` import causes bundler issues, use the package's documented `html()` API or fall back to escaped `<pre>` diff for v1, but keep the component boundary.
- If `simple-git` status parsing differs by platform, add tests around the normalized `GitChangedFile` output rather than snapshotting raw simple-git objects.
- If there are unrelated dirty files in the worktree, ignore them and stage only files owned by this plan.

## Ready Criteria

This implementation is ready when:

- `Git` appears in the right tab list.
- Current session `cwd` drives repo detection.
- Real repo status, diff, stage, commit, push, branch, stash, history all work through IPC.
- High-risk operations are absent.
- Narrow rail layout does not break.
- Targeted tests and build pass.
