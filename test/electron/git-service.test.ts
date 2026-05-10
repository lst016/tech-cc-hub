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
