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

test("SessionStore persists renamed titles across reloads", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-session-rename-"));
  const dbPath = join(dir, "sessions.db");
  const store = new SessionStore(dbPath);

  try {
    const session = store.createSession({ title: "Old title", cwd: dir });

    store.updateSession(session.id, { title: "Renamed title" });
    store.close();

    const reopened = new SessionStore(dbPath);
    try {
      assert.equal(reopened.getSession(session.id)?.title, "Renamed title");
      assert.equal(reopened.listSessions()[0]?.title, "Renamed title");
    } finally {
      reopened.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SessionStore skips high-frequency thinking token events", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-thinking-tokens-"));
  const dbPath = join(dir, "sessions.db");
  const store = new SessionStore(dbPath);

  try {
    const session = store.createSession({ title: "Thinking token stream", cwd: dir });

    store.recordMessage(session.id, {
      type: "system",
      subtype: "thinking_tokens",
      estimated_tokens: 100,
      estimated_tokens_delta: 1,
      uuid: "thinking-1",
    } as never);
    store.recordMessage(session.id, {
      type: "assistant",
      message: { content: [{ type: "text", text: "done" }] },
      uuid: "assistant-1",
    } as never);

    const history = store.getSessionHistory(session.id);

    assert.equal(history?.messages.length, 1);
    assert.equal(history?.messages[0]?.type, "assistant");
  } finally {
    store.close();
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

test("SessionStore can return a bounded lightweight session list", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-session-list-summary-"));
  const dbPath = join(dir, "sessions.db");
  const store = new SessionStore(dbPath);

  try {
    const first = store.createSession({ title: "First", cwd: dir });
    const runtimeState = runtimeEfficiencyProfileToState(resolveRuntimeEfficiencyProfile({ prompt: "test" }));
    store.updateSession(first.id, {
      workflowMarkdown: "# Heavy workflow",
      workflowState: {
        workflowId: "heavy",
        sourceLayer: "project",
        sourcePath: join(dir, "workflow.md"),
        status: "idle",
        steps: [],
      },
      runtimeProfileState: runtimeState,
    });
    store.createSession({ title: "Second", cwd: dir });
    store.createSession({ title: "Third", cwd: dir });

    const full = store.listSessions().find((session) => session.id === first.id);
    assert.equal(full?.workflowMarkdown, "# Heavy workflow");
    assert.equal(full?.workflowState?.workflowId, "heavy");
    assert.deepEqual(full?.runtimeProfileState, runtimeState);

    const summary = store.listSessions({ summary: true, limit: 1 });
    assert.equal(summary.length, 1);
    assert.equal(summary[0]?.workflowMarkdown, undefined);
    assert.equal(summary[0]?.workflowState, undefined);
    assert.equal(summary[0]?.runtimeProfileState, undefined);

    const bounded = store.listSessions({ summary: true, limit: 2 });
    assert.equal(bounded.length, 2);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});