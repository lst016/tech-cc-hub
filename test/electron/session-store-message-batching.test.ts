import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import * as sessionStoreModule from "../../src/electron/libs/session-store.js";
import { SessionStore } from "../../src/electron/libs/session-store.js";
import type { StreamMessage } from "../../src/electron/types.js";

type TimerHandle = {
  id: number;
  callback: () => void;
  dueAt: number;
  unref: () => void;
};

function createFakeMessageTimer() {
  let now = 0;
  let nextId = 1;
  let unrefCount = 0;
  let clearCount = 0;
  const timers = new Map<number, TimerHandle>();

  const setTimeout = (callback: () => void, delayMs: number): TimerHandle => {
    const handle: TimerHandle = {
      id: nextId++,
      callback,
      dueAt: now + delayMs,
      unref: () => {
        unrefCount += 1;
      },
    };
    timers.set(handle.id, handle);
    return handle;
  };

  const clearTimeout = (handle: { unref?: () => void }): void => {
    const timer = handle as TimerHandle;
    if (timers.delete(timer.id)) clearCount += 1;
  };

  const advance = (milliseconds: number): void => {
    const target = now + milliseconds;
    while (true) {
      const next = [...timers.values()]
        .filter((timer) => timer.dueAt <= target)
        .sort((left, right) => left.dueAt - right.dueAt || left.id - right.id)[0];
      if (!next) break;
      timers.delete(next.id);
      now = next.dueAt;
      next.callback();
    }
    now = target;
  };

  return {
    api: { setTimeout, clearTimeout },
    advance,
    pendingCount: () => timers.size,
    unrefCount: () => unrefCount,
    clearCount: () => clearCount,
  };
}

function createStore(options: Record<string, unknown> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-session-message-batching-"));
  const dbPath = join(dir, "sessions.db");
  const SessionStoreWithOptions = SessionStore as unknown as new (
    path: string,
    options?: Record<string, unknown>,
  ) => SessionStore;
  const store = new SessionStoreWithOptions(dbPath, options);
  return { dir, dbPath, store };
}

function cleanupStore(store: SessionStore, dir: string): void {
  try {
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assistantMessage(index: number, historyId = `assistant-${index}`): StreamMessage {
  return {
    type: "assistant",
    uuid: historyId,
    session_id: "sdk-session",
    parent_tool_use_id: null,
    message: {
      role: "assistant",
      content: [{ type: "text", text: `assistant ${index}` }],
    },
    historyId,
    capturedAt: 1_000 + index,
  } as StreamMessage;
}

function userPrompt(historyId = "prompt-1", capturedAt = 2_000): StreamMessage {
  return {
    type: "user_prompt",
    prompt: "continue",
    historyId,
    capturedAt,
  };
}

function resultMessage(historyId = "result-1", capturedAt = 3_000): StreamMessage {
  return {
    type: "result",
    subtype: "success",
    uuid: historyId,
    session_id: "sdk-session",
    is_error: false,
    duration_ms: 1,
    duration_api_ms: 1,
    num_turns: 1,
    result: "done",
    total_cost_usd: 0,
    usage: { input_tokens: 1, output_tokens: 1 },
    historyId,
    capturedAt,
  } as StreamMessage;
}

function getMessageWriteStats(store: SessionStore): Record<string, number> {
  const getter = (store as unknown as { getMessageWriteStats?: () => Record<string, number> }).getMessageWriteStats;
  if (!getter) assert.fail("SessionStore should expose message write diagnostics");
  return getter.call(store);
}

function countRows(store: SessionStore, sessionId?: string): number {
  const db = store.getDatabaseForTest();
  const row = sessionId
    ? db.prepare("select count(*) as count from messages where session_id = ?").get(sessionId)
    : db.prepare("select count(*) as count from messages").get();
  return Number((row as { count: number }).count);
}

describe("SessionStore message batching", () => {
  it("classifies transient, batched, immediate, and explicit error messages", () => {
    const classify = (sessionStoreModule as unknown as {
      classifyMessagePersistence?: (message: StreamMessage) => string;
    }).classifyMessagePersistence;
    if (!classify) assert.fail("session-store should export classifyMessagePersistence");

    assert.equal(classify({ type: "stream_event" } as StreamMessage), "transient");
    assert.equal(classify(assistantMessage(1)), "batched");
    assert.equal(classify(userPrompt()), "immediate");
    assert.equal(classify(resultMessage()), "immediate");
    assert.equal(classify({
      type: "user",
      uuid: "tool-error",
      session_id: "sdk-session",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "tool-1", is_error: true, content: "failed" }],
      },
    } as unknown as StreamMessage), "immediate");
  });

  it("never queues or persists transient stream messages", () => {
    const { dir, store } = createStore();
    try {
      const session = store.createSession({ title: "transient" });
      for (let index = 0; index < 100; index += 1) {
        store.recordMessage(session.id, {
          type: "system",
          subtype: "thinking_tokens",
          estimated_tokens: index,
          estimated_tokens_delta: 1,
          uuid: `thinking-${index}`,
        } as StreamMessage);
      }

      assert.equal(store.getSessionHistory(session.id)?.messages.length, 0);
      const stats = getMessageWriteStats(store);
      assert.equal(stats.pendingRows, 0);
      assert.equal(stats.transactionCount, 0);
    } finally {
      cleanupStore(store, dir);
    }
  });

  it("persists 100 rapid assistant messages in no more than five transactions", () => {
    const timers = createFakeMessageTimer();
    const { dir, store } = createStore({ messageBatchDelayMs: 100, messageTimer: timers.api });
    try {
      const session = store.createSession({ title: "batch" });
      const db = store.getDatabaseForTest();
      for (let index = 0; index < 100; index += 1) {
        store.recordMessage(session.id, assistantMessage(index));
      }

      const beforeFlush = db.prepare("select count(*) as count from messages").get() as { count: number };
      assert.equal(beforeFlush.count, 0);
      timers.advance(100);

      assert.equal(store.getSessionHistory(session.id)?.messages.length, 100);
      const stats = getMessageWriteStats(store);
      assert.ok(stats.transactionCount <= 5, `expected <= 5 transactions, received ${stats.transactionCount}`);
      assert.equal(stats.insertedRows, 100);
    } finally {
      cleanupStore(store, dir);
    }
  });

  it("flushes pending messages before immediate history reads", () => {
    const { dir, store } = createStore();
    try {
      const session = store.createSession({ title: "read-boundary" });
      store.recordMessage(session.id, assistantMessage(1));

      assert.equal(store.getSessionHistory(session.id)?.messages.length, 1);
      store.recordMessage(session.id, assistantMessage(2));
      assert.equal(store.getSessionHistoryPage(session.id)?.messages.length, 2);
    } finally {
      cleanupStore(store, dir);
    }
  });

  it("writes same-session pending rows before a critical message in one transaction", () => {
    const timers = createFakeMessageTimer();
    const { dir, store } = createStore({ messageTimer: timers.api });
    try {
      const session = store.createSession({ title: "critical" });
      const db = store.getDatabaseForTest();
      store.recordMessage(session.id, assistantMessage(1));
      store.recordMessage(session.id, assistantMessage(2));
      store.recordMessage(session.id, resultMessage());

      const rows = db.prepare("select id from messages where session_id = ? order by rowid asc").all(session.id) as Array<{ id: string }>;
      assert.deepEqual(rows.map((row) => row.id), ["assistant-1", "assistant-2", "result-1"]);
      assert.equal(getMessageWriteStats(store).transactionCount, 1);
      assert.equal(timers.pendingCount(), 0);
    } finally {
      cleanupStore(store, dir);
    }
  });

  it("returns stable historyId and capturedAt synchronously for queued writes", () => {
    const { dir, store } = createStore();
    try {
      const session = store.createSession({ title: "sync-api" });
      const input = assistantMessage(1, "stable-id");
      const stored = store.recordMessage(session.id, input);

      assert.equal(stored.historyId, "stable-id");
      assert.equal(stored.capturedAt, input.capturedAt);
    } finally {
      cleanupStore(store, dir);
    }
  });

  it("flushes all pending messages on idempotent close and preserves them after reopen", () => {
    const { dir, dbPath, store } = createStore();
    try {
      const session = store.createSession({ title: "close" });
      for (let index = 0; index < 100; index += 1) {
        store.recordMessage(session.id, assistantMessage(index));
      }
      store.close();
      store.close();

      const reopened = new SessionStore(dbPath);
      try {
        assert.equal(reopened.getSessionHistory(session.id)?.messages.length, 100);
      } finally {
        reopened.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the first row when batched messages reuse a historyId", () => {
    const { dir, store } = createStore();
    try {
      const session = store.createSession({ title: "duplicate" });
      store.recordMessage(session.id, assistantMessage(1, "duplicate-id"));
      store.recordMessage(session.id, {
        ...assistantMessage(2, "duplicate-id"),
        message: { role: "assistant", content: [{ type: "text", text: "second" }] },
      } as StreamMessage);

      const history = store.getSessionHistory(session.id);
      assert.equal(history?.messages.length, 1);
      assert.match(JSON.stringify(history?.messages[0]), /assistant 1/);
      assert.equal(getMessageWriteStats(store).ignoredRows, 1);
    } finally {
      cleanupStore(store, dir);
    }
  });

  it("flushes before replace so pruned pending rows cannot reappear", () => {
    const timers = createFakeMessageTimer();
    const { dir, store } = createStore({ messageTimer: timers.api });
    try {
      const session = store.createSession({ title: "replace" });
      store.recordMessage(session.id, userPrompt("prompt-replace", 1_000));
      store.recordMessage(session.id, assistantMessage(2));

      const replaced = store.replaceUserPromptAndPrune(session.id, "prompt-replace", "revised");
      assert.equal(replaced?.type, "user_prompt");
      timers.advance(500);

      const history = store.getSessionHistory(session.id);
      assert.equal(history?.messages.length, 1);
      assert.equal(history?.messages[0]?.type === "user_prompt" ? history.messages[0].prompt : "", "revised");
    } finally {
      cleanupStore(store, dir);
    }
  });

  it("flushes then deletes a session without timer resurrection", () => {
    const timers = createFakeMessageTimer();
    const { dir, store } = createStore({ messageTimer: timers.api });
    try {
      const session = store.createSession({ title: "delete" });
      store.recordMessage(session.id, assistantMessage(1));
      assert.equal(store.deleteSession(session.id), true);
      const transactionCount = getMessageWriteStats(store).transactionCount;

      timers.advance(500);

      assert.equal(countRows(store, session.id), 0);
      assert.equal(store.getSession(session.id), undefined);
      assert.equal(getMessageWriteStats(store).transactionCount, transactionCount);
    } finally {
      cleanupStore(store, dir);
    }
  });

  it("flushes only the critical message session and leaves other sessions queued", () => {
    const timers = createFakeMessageTimer();
    const { dir, store } = createStore({ messageTimer: timers.api });
    try {
      const first = store.createSession({ title: "first" });
      const second = store.createSession({ title: "second" });
      const db = store.getDatabaseForTest();
      store.recordMessage(first.id, assistantMessage(1, "first-assistant"));
      store.recordMessage(second.id, assistantMessage(2, "second-assistant"));
      store.recordMessage(first.id, resultMessage("first-result"));

      const counts = db.prepare("select session_id, count(*) as count from messages group by session_id").all() as Array<{ session_id: string; count: number }>;
      assert.deepEqual(counts, [{ session_id: first.id, count: 2 }]);
      assert.equal(getMessageWriteStats(store).pendingRows, 1);

      timers.advance(100);
      assert.equal(countRows(store, second.id), 1);
    } finally {
      cleanupStore(store, dir);
    }
  });

  it("unrefs scheduled timers and clears them on close", () => {
    const timers = createFakeMessageTimer();
    const { dir, store } = createStore({ messageTimer: timers.api });
    try {
      const session = store.createSession({ title: "timer" });
      store.recordMessage(session.id, assistantMessage(1));

      assert.equal(timers.pendingCount(), 1);
      assert.equal(timers.unrefCount(), 1);
      store.close();
      assert.equal(timers.pendingCount(), 0);
      assert.equal(timers.clearCount(), 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects recordMessage after close without queuing a write", () => {
    const { dir, store } = createStore();
    try {
      const session = store.createSession({ title: "closed-write" });
      store.close();

      assert.throws(() => store.recordMessage(session.id, assistantMessage(1)), /closed/i);
      assert.equal(getMessageWriteStats(store).pendingRows, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the store open after close flush fails so close can be retried", () => {
    const timers = createFakeMessageTimer();
    const flushErrors: unknown[] = [];
    const { dir, dbPath, store } = createStore({
      messageTimer: timers.api,
      onMessageFlushError: (error: unknown) => flushErrors.push(error),
    });
    const db = store.getDatabaseForTest();
    let closed = false;
    try {
      const session = store.createSession({ title: "recover-close" });
      db.exec("create trigger fail_message_insert before insert on messages begin select raise(abort, 'forced close failure'); end");
      store.recordMessage(session.id, assistantMessage(1));

      assert.throws(() => store.close(), /forced close failure/);
      assert.equal(flushErrors.length, 3);
      assert.equal(getMessageWriteStats(store).pendingRows, 1);
      db.exec("drop trigger fail_message_insert");

      store.close();
      closed = true;
      store.close();

      const reopened = new SessionStore(dbPath);
      try {
        assert.equal(reopened.getSessionHistory(session.id)?.messages.length, 1);
      } finally {
        reopened.close();
      }
    } finally {
      if (!closed) {
        try {
          db.exec("drop trigger if exists fail_message_insert");
          store.close();
        } catch {
          // Preserve the primary assertion failure.
        }
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("retries a transient close flush failure synchronously and reopens complete data", () => {
    const flushErrors: unknown[] = [];
    const { dir, dbPath, store } = createStore({
      onMessageFlushError: (error: unknown) => flushErrors.push(error),
    });
    const db = store.getDatabaseForTest();
    let insertAttempts = 0;
    try {
      const session = store.createSession({ title: "retry-close-once" });
      db.function("fail_message_insert_once", () => {
        insertAttempts += 1;
        if (insertAttempts === 1) throw new Error("transient close failure");
        return 0;
      });
      db.exec("create trigger fail_message_insert_once before insert on messages begin select fail_message_insert_once(); end");
      store.recordMessage(session.id, assistantMessage(1));

      assert.doesNotThrow(() => store.close());
      assert.equal(flushErrors.length, 1);
      assert.equal(insertAttempts, 2);

      const reopened = new SessionStore(dbPath);
      try {
        assert.equal(reopened.getSessionHistory(session.id)?.messages.length, 1);
      } finally {
        reopened.close();
      }
    } finally {
      try {
        store.close();
      } catch {
        // Preserve the primary assertion failure.
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("retains queued rows after a timer transaction failure and retries later", () => {
    const timers = createFakeMessageTimer();
    const flushErrors: unknown[] = [];
    const { dir, store } = createStore({
      messageTimer: timers.api,
      onMessageFlushError: (error: unknown) => flushErrors.push(error),
    });
    try {
      const session = store.createSession({ title: "retry" });
      const db = store.getDatabaseForTest();
      db.exec("create trigger fail_message_insert before insert on messages begin select raise(abort, 'forced failure'); end");

      assert.doesNotThrow(() => store.recordMessage(session.id, assistantMessage(1)));
      timers.advance(100);
      assert.equal(flushErrors.length, 1);
      assert.equal(getMessageWriteStats(store).pendingRows, 1);

      db.exec("drop trigger fail_message_insert");
      timers.advance(100);
      const row = db.prepare("select count(*) as count from messages where session_id = ?").get(session.id) as { count: number };
      assert.equal(row.count, 1);
      assert.equal(getMessageWriteStats(store).pendingRows, 0);
    } finally {
      cleanupStore(store, dir);
    }
  });
});
