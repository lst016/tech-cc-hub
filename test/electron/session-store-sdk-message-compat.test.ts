import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionStore } from "../../src/electron/libs/session-store.js";
import { deriveLatestPlanSnapshot } from "../../src/shared/plan-progress.js";

test("SessionStore retracts refusal frames and clears transcripts on conversation reset", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-sdk-message-compat-"));
  const store = new SessionStore(join(dir, "sessions.db"));

  try {
    const session = store.createSession({ title: "SDK compatibility", cwd: dir });
    store.recordMessage(session.id, {
      type: "assistant",
      uuid: "assistant-refused",
      session_id: "remote-session",
      parent_tool_use_id: null,
      message: {
        id: "assistant-refused",
        type: "message",
        role: "assistant",
        model: "test-model",
        content: [{ type: "text", text: "partial refusal" }],
        stop_reason: "refusal",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    } as never);
    store.recordMessage(session.id, {
      type: "result",
      subtype: "success",
      uuid: "result-1",
      session_id: "remote-session",
      result: "done",
    } as never);

    assert.equal(store.getSessionHistory(session.id)?.messages.length, 2);
    assert.equal(store.retractMessages(session.id, ["assistant-refused"]), 1);
    assert.deepEqual(
      store.getSessionHistory(session.id)?.messages.map((message) => message.historyId),
      ["result-1"],
    );

    assert.equal(store.clearMessages(session.id), 1);
    assert.deepEqual(store.getSessionHistory(session.id)?.messages, []);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SessionStore resets persisted conversation-derived state atomically", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-sdk-reset-"));
  const databasePath = join(dir, "sessions.db");
  const store = new SessionStore(databasePath);

  try {
    const session = store.createSession({ title: "Old title", cwd: dir, prompt: "old prompt" });
    store.updateSession(session.id, {
      claudeSessionId: "old-remote-id",
      continuationSummary: "old summary",
      continuationSummaryMessageCount: 7,
      planSnapshot: {
        sessionId: session.id,
        updatedAt: 1,
        source: "update_plan",
        plan: [{ step: "unfinished", status: "in_progress" }],
      },
      workflowState: { status: "running" } as never,
      workflowError: "old error",
    });
    store.recordMessage(session.id, { type: "user_prompt", prompt: "old prompt" } as never);
    const beforeResetAt = store.getSession(session.id)?.updatedAt ?? 0;

    const reset = store.resetConversation(session.id, { claudeSessionId: "fresh-remote-id" });
    assert.equal(reset?.title, "New Session");
    assert.equal(reset?.claudeSessionId, "fresh-remote-id");
    assert.equal(reset?.lastPrompt, undefined);
    assert.equal(reset?.continuationSummary, undefined);
    assert.equal(reset?.continuationSummaryMessageCount, undefined);
    assert.equal(reset?.planSnapshot, undefined);
    assert.equal(reset?.workflowState, undefined);
    assert.equal(reset?.workflowError, undefined);
    assert.ok((reset?.updatedAt ?? 0) >= beforeResetAt);
    assert.deepEqual(store.getSessionHistory(session.id)?.messages, []);

    store.close();
    const reopened = new SessionStore(databasePath);
    try {
      const persisted = reopened.getSession(session.id);
      assert.equal(persisted?.title, "New Session");
      assert.equal(persisted?.claudeSessionId, "fresh-remote-id");
      assert.equal(persisted?.updatedAt, reset?.updatedAt);
      assert.equal(persisted?.continuationSummary, undefined);
      assert.equal(persisted?.planSnapshot, undefined);
      assert.deepEqual(reopened.getSessionHistory(session.id)?.messages, []);
    } finally {
      reopened.close();
    }
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SessionStore drops pure tool heartbeats but preserves retry state changes", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-sdk-heartbeat-"));
  const store = new SessionStore(join(dir, "sessions.db"));

  try {
    const session = store.createSession({ title: "Heartbeat", cwd: dir });
    store.recordMessage(session.id, {
      type: "tool_progress",
      tool_use_id: "tool-1",
      tool_name: "Bash",
      elapsed_time_seconds: 1,
      heartbeat: true,
    } as never);
    store.recordMessage(session.id, {
      type: "tool_progress",
      tool_use_id: "tool-1",
      tool_name: "Agent",
      elapsed_time_seconds: 2,
      heartbeat: true,
      subagent_retry: { attempt: 2, max_attempts: 3, error: "rate limit" },
    } as never);

    const messages = store.getSessionHistory(session.id)?.messages ?? [];
    assert.equal(messages.length, 1);
    assert.equal((messages[0] as { subagent_retry?: { attempt?: number } }).subagent_retry?.attempt, 2);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SessionStore migrates legacy permission modes to this release's full-access default", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-sdk-permission-mode-"));
  const databasePath = join(dir, "sessions.db");
  const store = new SessionStore(databasePath);

  try {
    const session = store.createSession({ title: "Legacy permission", cwd: dir });
    store.updateSession(session.id, { permissionMode: "manual" as never });
    store.close();

    const reopened = new SessionStore(databasePath);
    try {
      assert.equal(reopened.getSession(session.id)?.permissionMode, "bypassPermissions");
    } finally {
      reopened.close();
    }
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SessionStore preserves arrival order for same-millisecond SDK frames across pages", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-sdk-order-"));
  const store = new SessionStore(join(dir, "sessions.db"));

  try {
    const session = store.createSession({ title: "Stable order", cwd: dir });
    const capturedAt = 1_700_000_000_000;
    for (const historyId of ["zzzz", "aaaa", "mmmm"]) {
      store.recordMessage(session.id, {
        type: "assistant",
        historyId,
        capturedAt,
        message: { role: "assistant", content: [{ type: "text", text: historyId }] },
      } as never);
    }

    assert.deepEqual(
      store.getSessionHistory(session.id)?.messages.map((message) => message.historyId),
      ["zzzz", "aaaa", "mmmm"],
    );
    const latestPage = store.getSessionHistoryPage(session.id, { limit: 2 });
    assert.deepEqual(latestPage?.messages.map((message) => message.historyId), ["aaaa", "mmmm"]);
    assert.equal(typeof latestPage?.nextCursor?.beforeSequence, "number");
    const earlierPage = store.getSessionHistoryPage(session.id, {
      limit: 2,
      before: latestPage?.nextCursor,
    });
    assert.deepEqual(earlierPage?.messages.map((message) => message.historyId), ["zzzz"]);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("plan derivation restores the previous snapshot after the latest frame is retracted", () => {
  const planMessage = (uuid: string, step: string, capturedAt: number) => ({
    type: "assistant",
    uuid,
    capturedAt,
    message: {
      content: [{
        type: "tool_use",
        id: `tool-${uuid}`,
        name: "update_plan",
        input: { plan: [{ step, status: "in_progress" }] },
      }],
    },
  });
  const first = planMessage("plan-first", "first plan", 1);
  const latest = planMessage("plan-latest", "latest plan", 2);

  assert.equal(deriveLatestPlanSnapshot("session", [first, latest])?.turnId, "plan-latest");
  assert.equal(deriveLatestPlanSnapshot("session", [first])?.turnId, "plan-first");

  const ipcSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");
  assert.match(ipcSource, /remainingMessages[\s\S]*deriveLatestPlanSnapshot\(nextEvent\.payload\.sessionId, remainingMessages\)/);
});
