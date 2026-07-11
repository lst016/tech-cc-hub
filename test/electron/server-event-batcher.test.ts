import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  createServerEventBatcher,
  type ServerEventBatcherTimerHandle,
} from "../../src/electron/libs/server-event-batcher.js";
import type { ServerEvent } from "../../src/electron/types.js";

type ScheduledTimer = ServerEventBatcherTimerHandle & {
  id: number;
  dueAt: number;
  callback: () => void;
  cancelled: boolean;
};

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  let unrefCount = 0;
  const timers = new Map<number, ScheduledTimer>();

  const setTimer = (callback: () => void, delayMs: number): ServerEventBatcherTimerHandle => {
    const timer: ScheduledTimer = {
      id: nextId++,
      dueAt: now + delayMs,
      callback,
      cancelled: false,
      unref: () => {
        unrefCount += 1;
      },
    };
    timers.set(timer.id, timer);
    return timer;
  };

  const clearTimer = (handle: ServerEventBatcherTimerHandle): void => {
    const timer = handle as ScheduledTimer;
    timer.cancelled = true;
    timers.delete(timer.id);
  };

  const advance = (milliseconds: number): void => {
    const target = now + milliseconds;
    while (true) {
      const next = [...timers.values()]
        .filter((timer) => !timer.cancelled && timer.dueAt <= target)
        .sort((left, right) => left.dueAt - right.dueAt || left.id - right.id)[0];
      if (!next) break;
      timers.delete(next.id);
      now = next.dueAt;
      next.callback();
    }
    now = target;
  };

  return {
    setTimer,
    clearTimer,
    advance,
    pendingCount: () => timers.size,
    unrefCount: () => unrefCount,
  };
}

function streamEvent(
  outerSessionId: string,
  rawEvent: Record<string, unknown>,
  options: {
    sdkSessionId?: string;
    parentToolUseId?: string | null;
    capturedAt?: number;
    ttftMs?: number;
    uuid?: string;
  } = {},
): ServerEvent {
  return {
    type: "stream.message",
    payload: {
      sessionId: outerSessionId,
      message: {
        type: "stream_event",
        event: rawEvent,
        parent_tool_use_id: options.parentToolUseId ?? null,
        uuid: options.uuid ?? `uuid-${outerSessionId}-${options.capturedAt ?? 0}`,
        session_id: options.sdkSessionId ?? outerSessionId,
        capturedAt: options.capturedAt,
        ttft_ms: options.ttftMs,
      } as never,
    },
  };
}

function textDelta(
  sessionId: string,
  text: string,
  options: {
    index?: number;
    parentToolUseId?: string | null;
    capturedAt?: number;
    ttftMs?: number;
  } = {},
): ServerEvent {
  return streamEvent(sessionId, {
    type: "content_block_delta",
    index: options.index ?? 0,
    delta: { type: "text_delta", text },
  }, options);
}

function thinkingDelta(sessionId: string, thinking: string, index = 0): ServerEvent {
  return streamEvent(sessionId, {
    type: "content_block_delta",
    index,
    delta: { type: "thinking_delta", thinking },
  });
}

function contentBlockStart(sessionId: string, index = 0): ServerEvent {
  return streamEvent(sessionId, {
    type: "content_block_start",
    index,
    content_block: { type: "text", text: "" },
  });
}

function contentBlockStop(sessionId: string, index = 0): ServerEvent {
  return streamEvent(sessionId, { type: "content_block_stop", index });
}

function unsupportedDelta(sessionId: string, partialJson: string, index = 0): ServerEvent {
  return streamEvent(sessionId, {
    type: "content_block_delta",
    index,
    delta: { type: "input_json_delta", partial_json: partialJson },
  });
}

function finalAssistantMessage(sessionId: string, text: string): ServerEvent {
  return {
    type: "stream.message",
    payload: {
      sessionId,
      message: {
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text }] },
        parent_tool_use_id: null,
        uuid: `final-${sessionId}`,
        session_id: sessionId,
      } as never,
    },
  };
}

function readTextDelta(event: ServerEvent): string | undefined {
  if (event.type !== "stream.message" || event.payload.message.type !== "stream_event") return undefined;
  const rawEvent = event.payload.message.event;
  if (rawEvent.type !== "content_block_delta" || rawEvent.delta.type !== "text_delta") return undefined;
  return rawEvent.delta.text;
}

function readThinkingDelta(event: ServerEvent): string | undefined {
  if (event.type !== "stream.message" || event.payload.message.type !== "stream_event") return undefined;
  const rawEvent = event.payload.message.event;
  if (rawEvent.type !== "content_block_delta" || rawEvent.delta.type !== "thinking_delta") return undefined;
  return rawEvent.delta.thinking;
}

function readPartialEnvelope(event: ServerEvent): Record<string, unknown> | undefined {
  if (event.type !== "stream.message" || event.payload.message.type !== "stream_event") return undefined;
  return event.payload.message as unknown as Record<string, unknown>;
}

function createHarness() {
  const timers = createFakeTimers();
  const sent: ServerEvent[] = [];
  const batcher = createServerEventBatcher({
    send: (event: ServerEvent) => sent.push(event),
    flushMs: 50,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  return { batcher, sent, timers };
}

describe("server event batcher", () => {
  it("combines 100 consecutive text deltas without losing text or first-envelope metadata", () => {
    const { batcher, sent, timers } = createHarness();
    const fragments = Array.from({ length: 100 }, (_, index) => `<${index}>`);

    fragments.forEach((fragment, index) => {
      batcher.enqueue(textDelta("session-a", fragment, {
        capturedAt: 1_000 + index,
        ttftMs: index === 0 ? 123 : undefined,
      }));
    });

    assert.equal(sent.length, 0);
    timers.advance(49);
    assert.equal(sent.length, 0);
    timers.advance(1);

    assert.equal(sent.length, 1);
    assert.equal(readTextDelta(sent[0]!), fragments.join(""));
    assert.equal(sent[0]?.type, "stream.message");
    const envelope = readPartialEnvelope(sent[0]!);
    assert.equal(envelope?.uuid, "uuid-session-a-1000");
    assert.equal(envelope?.ttft_ms, 123);
    assert.equal(envelope?.capturedAt, 1_099);
    assert.deepEqual(JSON.parse(JSON.stringify(sent[0])), sent[0]);
    assert.equal(timers.unrefCount(), 1);
  });

  it("combines consecutive thinking deltas in their original order", () => {
    const { batcher, sent, timers } = createHarness();

    batcher.enqueue(thinkingDelta("session-a", "first "));
    batcher.enqueue(thinkingDelta("session-a", "second"));
    timers.advance(50);

    assert.equal(sent.length, 1);
    assert.equal(readThinkingDelta(sent[0]!), "first second");
  });

  it("does not combine different sessions or parent tool streams and preserves global order", () => {
    const { batcher, sent, timers } = createHarness();
    const first = textDelta("session-a", "a", { parentToolUseId: "parent-1" });
    const second = textDelta("session-b", "b", { parentToolUseId: "parent-1" });
    const third = textDelta("session-b", "c", { parentToolUseId: "parent-2" });

    batcher.enqueue(first);
    batcher.enqueue(second);
    batcher.enqueue(third);

    assert.deepEqual(sent, [first, second]);
    timers.advance(50);
    assert.deepEqual(sent, [first, second, third]);
  });

  it("flushes merged deltas synchronously between content block start and stop", () => {
    const { batcher, sent, timers } = createHarness();
    const start = contentBlockStart("session-a");
    const stop = contentBlockStop("session-a");

    batcher.enqueue(start);
    batcher.enqueue(textDelta("session-a", "hello "));
    batcher.enqueue(textDelta("session-a", "world"));
    batcher.enqueue(stop);

    assert.equal(sent.length, 3);
    assert.equal(sent[0], start);
    assert.equal(readTextDelta(sent[1]!), "hello world");
    assert.equal(sent[2], stop);
    assert.equal(timers.pendingCount(), 0);
  });

  it("flushes pending deltas before final, session status, and permission events", () => {
    for (const barrier of [
      finalAssistantMessage("session-a", "complete"),
      { type: "session.status", payload: { sessionId: "session-a", status: "completed" } } as ServerEvent,
      {
        type: "permission.request",
        payload: { sessionId: "session-a", toolUseId: "tool-1", toolName: "Bash", input: {} },
      } as ServerEvent,
    ]) {
      const { batcher, sent, timers } = createHarness();
      batcher.enqueue(textDelta("session-a", "pending"));
      batcher.enqueue(barrier);

      assert.equal(sent.length, 2);
      assert.equal(readTextDelta(sent[0]!), "pending");
      assert.equal(sent[1], barrier);
      assert.equal(timers.pendingCount(), 0);
    }
  });

  it("treats unsupported content deltas as synchronous barriers", () => {
    const { batcher, sent, timers } = createHarness();
    const inputJson = unsupportedDelta("session-a", "{\"key\":");

    batcher.enqueue(textDelta("session-a", "before"));
    batcher.enqueue(inputJson);

    assert.equal(sent.length, 2);
    assert.equal(readTextDelta(sent[0]!), "before");
    assert.equal(sent[1], inputJson);
    assert.equal(timers.pendingCount(), 0);
  });

  it("starts a new batch after each 50ms time slice", () => {
    const { batcher, sent, timers } = createHarness();

    batcher.enqueue(textDelta("session-a", "slice-1a"));
    timers.advance(25);
    batcher.enqueue(textDelta("session-a", "+slice-1b"));
    timers.advance(25);
    assert.equal(readTextDelta(sent[0]!), "slice-1a+slice-1b");

    batcher.enqueue(textDelta("session-a", "slice-2"));
    timers.advance(50);
    assert.deepEqual(sent.map(readTextDelta), ["slice-1a+slice-1b", "slice-2"]);
  });

  it("dispose flushes once, cancels its timer, and sends later events immediately", () => {
    const { batcher, sent, timers } = createHarness();
    const afterDispose = textDelta("session-a", "after-dispose");

    batcher.enqueue(textDelta("session-a", "pending"));
    batcher.dispose();
    batcher.dispose();

    assert.deepEqual(sent.map(readTextDelta), ["pending"]);
    assert.equal(timers.pendingCount(), 0);
    batcher.enqueue(afterDispose);
    assert.equal(sent[1], afterDispose);
  });
});

describe("server event batcher IPC integration", () => {
  it("batches only renderer sends while listeners receive each original event", () => {
    const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");
    const rendererSendStart = source.indexOf("function sendRendererServerEvent(event: ServerEvent)");
    const broadcastStart = source.indexOf("function broadcast(event: ServerEvent)");
    const broadcastEnd = source.indexOf("function hasLiveSession", broadcastStart);
    const rendererSend = source.slice(rendererSendStart, broadcastStart);
    const broadcast = source.slice(broadcastStart, broadcastEnd);

    assert.ok(rendererSendStart >= 0, "renderer send should be a named integration boundary");
    assert.match(rendererSend, /const payload = JSON\.stringify\(event\)/);
    assert.match(rendererSend, /win\.webContents\.send\("server-event", payload\)/);
    assert.doesNotMatch(rendererSend, /serverEventListeners/);
    assert.match(broadcast, /rendererEventBatcher\.enqueue\(event\)/);
    assert.match(broadcast, /for \(const listener of serverEventListeners\)[\s\S]*listener\(event\)/);
    assert.doesNotMatch(broadcast, /JSON\.stringify/);
  });

  it("flushes the renderer batcher before session cleanup", () => {
    const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");
    const cleanupStart = source.indexOf("export function cleanupAllSessions(): void");
    const cleanupEnd = source.indexOf("export { sessions }", cleanupStart);
    const cleanup = source.slice(cleanupStart, cleanupEnd);

    assert.match(cleanup, /rendererEventBatcher\.dispose\(\)/);
    assert.ok(
      cleanup.indexOf("rendererEventBatcher.dispose()") < cleanup.indexOf("handle.abort()"),
      "pending renderer events should flush before runner shutdown",
    );
  });
});
