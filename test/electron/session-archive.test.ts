import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SessionStore } from "../../src/electron/libs/session-store.js";

test("SessionStore archives sessions outside the default list and restores them", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-session-archive-"));
  const store = new SessionStore(join(dir, "sessions.db"));

  try {
    const active = store.createSession({ title: "Active session", cwd: dir });
    const archived = store.createSession({ title: "Archived session", cwd: dir });

    const archivedSession = store.archiveSession(archived.id);

    assert.equal(archivedSession?.id, archived.id);
    assert.equal(typeof archivedSession?.archivedAt, "number");
    assert.deepEqual(store.listSessions().map((session) => session.id), [active.id]);
    assert.deepEqual(store.listSessions({ archived: true }).map((session) => session.id), [archived.id]);

    const restoredSession = store.unarchiveSession(archived.id);

    assert.equal(restoredSession?.id, archived.id);
    assert.equal(restoredSession?.archivedAt, undefined);
    assert.deepEqual(new Set(store.listSessions().map((session) => session.id)), new Set([active.id, archived.id]));
    assert.deepEqual(store.listSessions({ archived: true }), []);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
