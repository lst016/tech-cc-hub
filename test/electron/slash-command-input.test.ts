import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getSlashCommandQuery } from "../../src/ui/utils/slash-command-input.js";

describe("slash command input", () => {
  it("keeps absolute paths out of slash command matching", () => {
    assert.equal(getSlashCommandQuery("/Users/lushengtao/project"), null);
    assert.equal(getSlashCommandQuery("/workspace/app/src/index.ts"), null);
    assert.equal(getSlashCommandQuery("/mnt/c/Users/lushengtao"), null);
  });

  it("still recognizes command-like slash tokens", () => {
    assert.equal(getSlashCommandQuery("/debug current session"), "debug");
    assert.equal(getSlashCommandQuery("  /speckit.specify feature"), "speckit.specify");
    assert.equal(getSlashCommandQuery("/"), "");
  });
});
