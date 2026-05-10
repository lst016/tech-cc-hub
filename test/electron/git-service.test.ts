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
