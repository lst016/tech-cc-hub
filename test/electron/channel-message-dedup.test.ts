import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { SessionStore } from "../../src/electron/libs/session-store.js";

test("channel message claims persist across restarts and failed claims can be released", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-channel-dedup-"));
  const dbPath = join(dir, "sessions.db");
  try {
    const first = new SessionStore(dbPath);
    assert.equal(first.claimChannelMessage("om_once", "lark"), true);
    assert.equal(first.claimChannelMessage("om_once", "lark"), false);
    assert.equal(first.releaseChannelMessage("om_once", "lark"), true);
    assert.equal(first.claimChannelMessage("om_once", "lark"), true);
    first.close();

    const second = new SessionStore(dbPath);
    assert.equal(second.claimChannelMessage("om_once", "lark"), false);
    assert.equal(second.claimChannelMessage("om_once", "telegram"), true);
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("channel reply deduplication is scoped to each inbound message", () => {
  const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");

  assert.match(source, /target\.externalMessageId \?\? target\.rawConversationId/);
  assert.match(source, /channelLatestAssistantText\.delete\(sessionId\)/);
  assert.doesNotMatch(source, /channelLastSentAssistantText/);
});
