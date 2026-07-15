import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionStore } from "../../src/electron/libs/session-store.js";

test("session history strips legacy inline previews when a stored image file exists", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-attachment-read-"));
  const dbPath = join(dir, "sessions.db");
  const store = new SessionStore(dbPath);

  try {
    const session = store.createSession({ title: "Legacy image" });
    store.recordMessage(session.id, {
      type: "user_prompt",
      prompt: "inspect",
      attachments: [{
        id: "image-1",
        kind: "image",
        name: "large.png",
        mimeType: "image/png",
        data: "file:///D:/tmp/large.png",
        preview: `data:image/png;base64,${"A".repeat(1_000_000)}`,
        storagePath: "D:\\tmp\\large.png",
        storageUri: "file:///D:/tmp/large.png",
      }],
    });

    const history = store.getSessionHistoryPage(session.id, { limit: 10 });
    const prompt = history?.messages[0];
    assert.equal(prompt?.type, "user_prompt");
    if (prompt?.type !== "user_prompt") return;
    assert.equal(prompt.attachments?.[0]?.preview, undefined);
    assert.ok(JSON.stringify(prompt).length < 1_000);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
