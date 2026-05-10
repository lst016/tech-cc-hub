import test from "node:test";
import assert from "node:assert/strict";

import { normalizeGitError } from "../../src/electron/libs/git/errors.js";

test("normalizes common git errors", () => {
  assert.equal(normalizeGitError(new Error("not a git repository")).code, "not_a_repo");
  assert.equal(normalizeGitError(new Error("could not read Username for 'https://github.com'")).code, "auth_required");
  assert.equal(normalizeGitError(new Error("Your local changes to the following files would be overwritten by checkout")).code, "dirty_worktree");
  assert.equal(normalizeGitError(new Error("CONFLICT (content): Merge conflict")).code, "conflict");
});
