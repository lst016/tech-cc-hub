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

test("GitWorkbenchService resolves absolute diff paths in the owning repository", async () => {
  const cwd = createRepo();
  const externalCwd = createRepo();
  const externalPath = join(externalCwd, "README.md");
  writeFileSync(externalPath, "# demo\n\nexternal change\n");

  const service = new GitWorkbenchService();
  const diff = await service.getDiff({ cwd, path: externalPath });

  assert.equal(diff.success, true);
  if (!diff.success) return;
  assert.equal(diff.data.path, externalPath);
  assert.match(diff.data.diff, /external change/);
});

test("GitWorkbenchService resolves absolute untracked paths in the owning repository", async () => {
  const cwd = createRepo();
  const externalCwd = createRepo();
  const externalPath = join(externalCwd, "notes.txt");
  writeFileSync(externalPath, "outside\n");

  const service = new GitWorkbenchService();
  const diff = await service.getDiff({ cwd, path: externalPath });

  assert.equal(diff.success, true);
  if (!diff.success) return;
  assert.equal(diff.data.path, externalPath);
  assert.match(diff.data.diff, /new file mode 100644/);
  assert.match(diff.data.diff, /b\/notes\.txt/);
  assert.match(diff.data.diff, /\+outside/);
});

test("GitWorkbenchService ignores absolute preview paths without an owning repository", async () => {
  const cwd = createRepo();
  const externalDir = mkdtempSync(join(tmpdir(), "tech-cc-hub-no-git-"));
  const externalPath = join(externalDir, "notes.txt");
  writeFileSync(externalPath, "outside\n");

  const service = new GitWorkbenchService();
  const diff = await service.getDiff({ cwd, path: externalPath });

  assert.equal(diff.success, true);
  if (!diff.success) return;
  assert.equal(diff.data.path, externalPath);
  assert.equal(diff.data.diff, "");
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

test("GitWorkbenchService reads commit detail files and patch", async () => {
  const cwd = createRepo();
  writeFileSync(join(cwd, "notes.txt"), "hello\n");
  git(cwd, ["add", "notes.txt"]);
  git(cwd, ["commit", "-m", "add notes", "-m", "body text"]);

  const service = new GitWorkbenchService();
  const snapshot = await service.getSnapshot(cwd);
  assert.equal(snapshot.success, true);
  if (!snapshot.success) return;

  const detail = await service.getCommitDetail({ cwd, hash: snapshot.data.history[0]!.hash });
  assert.equal(detail.success, true);
  if (!detail.success) return;
  assert.equal(detail.data.message, "add notes");
  assert.match(detail.data.body, /body text/);
  assert.equal(detail.data.files[0]?.path, "notes.txt");
  assert.match(detail.data.diff, /diff --git/);
  assert.match(detail.data.diff, /\+hello/);
});

test("GitWorkbenchService includes all branch history in snapshot", async () => {
  const cwd = createRepo();
  const baseBranch = git(cwd, ["branch", "--show-current"]).trim();
  git(cwd, ["checkout", "-b", "feature/git-ui"]);
  writeFileSync(join(cwd, "feature.txt"), "feature\n");
  git(cwd, ["add", "feature.txt"]);
  git(cwd, ["commit", "-m", "feature work"]);
  git(cwd, ["checkout", baseBranch]);

  const service = new GitWorkbenchService();
  const snapshot = await service.getSnapshot(cwd);
  assert.equal(snapshot.success, true);
  if (!snapshot.success) return;

  assert.equal(snapshot.data.history.some((commit) => commit.message === "feature work"), true);
  const featureCommit = snapshot.data.history.find((commit) => commit.message === "feature work");
  assert.deepEqual(featureCommit?.branches, ["feature/git-ui"]);
});

test("GitWorkbenchService shows staged and unstaged entries for the same file", async () => {
  const cwd = createRepo();
  writeFileSync(join(cwd, "README.md"), "# demo\n\nstaged\n");
  git(cwd, ["add", "README.md"]);
  writeFileSync(join(cwd, "README.md"), "# demo\n\nstaged\nunstaged\n");

  const service = new GitWorkbenchService();
  const snapshot = await service.getSnapshot(cwd);
  assert.equal(snapshot.success, true);
  if (!snapshot.success) return;

  const readmeEntries = snapshot.data.files.filter((file) => file.path === "README.md");
  assert.equal(readmeEntries.length, 2);
  assert.equal(readmeEntries.some((file) => file.staged), true);
  assert.equal(readmeEntries.some((file) => !file.staged), true);

  const stagedDiff = await service.getDiff({ cwd, path: "README.md", staged: true });
  assert.equal(stagedDiff.success, true);
  if (!stagedDiff.success) return;
  assert.match(stagedDiff.data.diff, /\+staged/);
  assert.doesNotMatch(stagedDiff.data.diff, /\+unstaged/);

  const unstagedDiff = await service.getDiff({ cwd, path: "README.md", staged: false });
  assert.equal(unstagedDiff.success, true);
  if (!unstagedDiff.success) return;
  assert.match(unstagedDiff.data.diff, /\+unstaged/);
});

test("GitWorkbenchService returns a synthetic diff for untracked files", async () => {
  const cwd = createRepo();
  writeFileSync(join(cwd, "notes.txt"), "hello\nworld\n");

  const service = new GitWorkbenchService();
  const snapshot = await service.getSnapshot(cwd);
  assert.equal(snapshot.success, true);
  if (!snapshot.success) return;
  assert.equal(snapshot.data.files[0]?.status, "untracked");

  const diff = await service.getDiff({ cwd, path: "notes.txt" });
  assert.equal(diff.success, true);
  if (!diff.success) return;
  assert.match(diff.data.diff, /new file mode 100644/);
  assert.match(diff.data.diff, /--- \/dev\/null/);
  assert.match(diff.data.diff, /\+hello/);
  assert.match(diff.data.diff, /\+world/);
});
