import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getSlashCommandQuery, isDismissedSlashCommandQuery } from "../../src/ui/utils/slash-command-input.js";

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

  it("recognizes in-progress slash tokens at the cursor", () => {
    assert.equal(getSlashCommandQuery("test /", "test /".length), "");
    assert.equal(getSlashCommandQuery("你哈 /agent", "你哈 /agent".length), "agent");
    assert.equal(getSlashCommandQuery("你哈 /agentSuffix", "你哈 /agent".length), "agent");
    assert.equal(getSlashCommandQuery("你哈 /agent 后面", "你哈 /agent 后面".length), null);
  });

  it("does not reopen slash matching at the edge of a completed rich command token", () => {
    assert.equal(getSlashCommandQuery("aaaa /agents ssss test", "aaaa /agents".length), null);
    assert.equal(getSlashCommandQuery("aaaa /agents ssss test", "aaaa /agents ssss test".length), null);
  });

  it("keeps a selected slash command hidden until the query changes or browser is reopened", () => {
    assert.equal(isDismissedSlashCommandQuery("/ad-crawler", "ad-crawler", false), true);
    assert.equal(isDismissedSlashCommandQuery("/ad-crawler analyze this", "ad-crawler", false), true);
    assert.equal(isDismissedSlashCommandQuery("/ad", "ad-crawler", false), false);
    assert.equal(isDismissedSlashCommandQuery("/ad-crawler", "ad-crawler", true), false);
  });
});
