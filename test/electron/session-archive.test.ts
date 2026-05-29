import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SessionStore } from "../../src/electron/libs/session-store.js";
import {
  resolveRuntimeEfficiencyProfile,
  runtimeEfficiencyProfileToState,
} from "../../src/electron/libs/runtime-efficiency.js";

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

test("SessionStore persists runtime profile state across reloads", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-session-profile-"));
  const dbPath = join(dir, "sessions.db");
  const store = new SessionStore(dbPath);

  try {
    const session = store.createSession({ title: "Sticky profile", cwd: dir });
    const state = runtimeEfficiencyProfileToState(resolveRuntimeEfficiencyProfile({
      prompt: "fix UI from screenshot",
      attachments: [{
        id: "image-1",
        kind: "image",
        data: "tech-cc-hub://prompt-attachments/session/image.png",
        mimeType: "image/png",
        name: "reference.png",
      }],
    }));

    store.updateSession(session.id, { runtimeProfileState: state });
    store.close();

    const reopened = new SessionStore(dbPath);
    try {
      assert.deepEqual(reopened.getSession(session.id)?.runtimeProfileState, state);
      assert.deepEqual(reopened.listSessions()[0]?.runtimeProfileState, state);
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SessionStore persists execution mode and runtime controls across reloads", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-session-semantics-"));
  const dbPath = join(dir, "sessions.db");
  const store = new SessionStore(dbPath);

  try {
    const session = store.createSession({
      title: "Background session",
      cwd: dir,
      executionMode: "background",
      model: "gpt-5.5",
      reasoningMode: "xhigh",
      permissionMode: "plan",
    });

    store.close();

    const reopened = new SessionStore(dbPath);
    try {
      const restored = reopened.getSession(session.id);
      assert.equal(restored?.executionMode, "background");
      assert.equal(restored?.model, "gpt-5.5");
      assert.equal(restored?.reasoningMode, "xhigh");
      assert.equal(restored?.permissionMode, "plan");
      assert.equal(reopened.listSessions()[0]?.executionMode, "background");
      assert.equal(reopened.listSessions()[0]?.reasoningMode, "xhigh");
      assert.equal(reopened.listSessions()[0]?.permissionMode, "plan");
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
