# test/electron/git-service.test.ts

> 模块：`git-workbench` · 语言：`typescript` · 行数：198

## 文件职责

GitWorkbenchService的集成测试，测试status、diff、stage、commit、push等核心功能

## 关键符号

- `git@0 - 测试辅助函数，封装execFileSync调用git命令`
- `createRepo@0 - 创建临时测试仓库`
- `addBareRemote@0 - 为测试仓库添加bare remote用于push测试`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `node:fs`
- `node:os`
- `node:path`
- `node:child_process`
- `../../src/electron/libs/git/service.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

function addBareRemote(cwd: string) {
  const remote = mkdtempSync(join(tmpdir(), "tech-cc-hub-git-remote-"));
  git(remote, ["init", "--bare"]);
  git(cwd, ["remote", "add", "origin", remote]);
  git(cwd, ["push", "-u", "origin", "HEAD"]);
  return remote;
}

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

test("GitWorkbenchService blocks push when local changes are not committed", async () => {
  const cwd = createRepo();
  addBareRemote(cwd);
  writeFileSync(join(cwd, "notes.txt"), "hello\n");
  git(cwd, ["add", "notes.txt"]);

  const service = new GitWorkbenchService();
  const pushed = await service.push(cwd);

  assert.equal(pushed.success, false);
  if (pushed.success) return;
  assert.equal(pushed.error.code, "dirty_worktree");
  assert.match(pushed.error.message, /提交/);

  const snapshot = await service.getSnapshot(cwd);
  assert.equal(snapshot.success, true);
  if (!snapshot.success) return;
  assert.equal(snapshot.data.status.ahead, 0);
  assert.equal(snapshot.data.status.stagedCount, 1);
  assert.equal(snapshot.data.operationLog[0]?.operation, "push");
  assert.equal(snapshot.data.operationLog[0]?.success, false);

  const committed = await service.commit(cwd, { message: "add notes" });
  assert.equal(committed.success, true);
  const pushedAfterCommit = await service.push(cwd);
  assert.equal(pushedAfterCommit.success, true);
  if (!pushedAfterCommit.success) return;
  assert.equal(pushedAfterCommit.data.status.ahead, 0);
  assert.equal(pushedAfterCommit.data.operationLog[0]?.operation, "push");
  assert.equal(pushedAfterCommit.data.operationLog[0]?.success, true);
});

test("GitWorkbenchService returns a fast fallback commit message for staged files", async () => {
  const cwd = createRepo();
  writeFileSync(join(cwd, "notes.txt"), "hello\n");
  git(cwd, ["add", "notes.txt"]);

  const service = new GitWorkbenchService();
  const suggestion = await service.generateFallbackCommitMessage(cwd);

  assert.equal(suggestion.success, true);
  if (!suggestion.success) return;
  assert.equal(suggestion.data.source, "fallback");
  assert.match(suggestion.data.message, /^chore\(repo\):/);
  assert.match(suggestion.data.body ?? "", /notes\.txt/);
});

test("GitWorkbenchService reads commit detail files and patch", async () =>
... (truncated)
```
