import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Session } from "../../src/electron/libs/session-store.js";
import type { RunnerHandle, RunnerOptions } from "../../src/electron/libs/runner/runner.js";
import type { ServerEvent, StreamMessage } from "../../src/electron/types.js";
import { BtwRuntimeManager } from "../../src/electron/libs/btw-runtime-manager.js";

type Harness = ReturnType<typeof createHarness>;

function createParentSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "main-1",
    title: "主会话",
    status: "completed",
    cwd: "D:/workspace/project",
    model: "claude-sonnet-4-5",
    reasoningMode: "high",
    permissionMode: "default",
    runSurface: "development",
    allowedTools: "Read,Edit",
    pendingPermissions: new Map(),
    ...overrides,
  };
}

function userMessage(prompt: string): StreamMessage {
  return { type: "user_prompt", prompt, capturedAt: 1 } as StreamMessage;
}

function assistantMessage(sessionId: string, text: string): StreamMessage {
  return {
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text }] },
    parent_tool_use_id: null,
    uuid: `${sessionId}-${text}`,
    session_id: sessionId,
  } as StreamMessage;
}

function createHarness() {
  const events: ServerEvent[] = [];
  const runs: RunnerOptions[] = [];
  const continuationHistories: StreamMessage[][] = [];
  const aborted: string[] = [];
  const appendedPrompts: Array<{ sessionId: string; prompt: string }> = [];
  let id = 0;
  let now = 1000;

  const manager = new BtwRuntimeManager({
    emit: (event) => events.push(event),
    createId: () => `btw-${++id}`,
    now: () => ++now,
    buildContinuation: (messages, prompt) => {
      continuationHistories.push([...messages]);
      return { prompt: `context:${messages.length}\n${prompt}` };
    },
    run: async (options) => {
      runs.push(options);
      return {
        abort: () => aborted.push(options.session.id),
        appendPrompt: async (prompt) => {
          appendedPrompts.push({ sessionId: options.session.id, prompt });
        },
        stopTask: async () => {},
        isClosed: () => false,
      } satisfies RunnerHandle;
    },
  });

  return { manager, events, runs, continuationHistories, aborted, appendedPrompts };
}

async function createAndSend(harness: Harness, prompt = "侧聊问题") {
  const created = harness.manager.createThread({
    parentSession: createParentSession(),
    snapshot: [userMessage("主问题"), assistantMessage("main-1", "主回答")],
  });
  await harness.manager.send({ threadId: created.threadId, prompt });
  return created;
}

describe("BtwRuntimeManager", () => {
  it("creates multiple empty threads with independent ids and full tools", async () => {
    const { manager, events, runs } = createHarness();
    const parentSession = createParentSession();
    const snapshot = [userMessage("主问题")];

    const first = manager.createThread({ parentSession, snapshot });
    const second = manager.createThread({ parentSession, snapshot });

    assert.equal(first.threadId, "btw-1");
    assert.equal(second.threadId, "btw-2");
    assert.equal(first.title, "侧聊 1");
    assert.equal(second.title, "侧聊 2");
    assert.equal(manager.getThreadCount(parentSession.id), 2);
    assert.equal(events.filter((event) => event.type === "btw.thread.created").length, 2);
    assert.equal(events.some((event) => event.type === "btw.stream.message" || event.type === "btw.stream.user_prompt"), false);

    await manager.send({ threadId: first.threadId, prompt: "验证工具" });
    assert.equal(runs[0].session.allowedTools, "*");
  });

  it("keeps the creation snapshot fixed across later sends", async () => {
    const harness = createHarness();
    const snapshot = [userMessage("创建时主问题")];
    const created = harness.manager.createThread({ parentSession: createParentSession(), snapshot });
    snapshot.push(userMessage("创建后主问题"));

    await harness.manager.send({ threadId: created.threadId, prompt: "第一轮" });
    harness.runs[0].onEvent({
      type: "stream.message",
      payload: { sessionId: created.threadId, message: assistantMessage(created.threadId, "第一轮回答") },
    });
    harness.runs[0].onEvent({
      type: "session.status",
      payload: { sessionId: created.threadId, status: "completed", title: "ignored" },
    });
    await harness.manager.send({ threadId: created.threadId, prompt: "第二轮", runtime: { model: "gpt-next" } });

    assert.deepEqual(
      harness.continuationHistories[0].map((message) => message.type),
      ["user_prompt"],
    );
    assert.deepEqual(
      harness.continuationHistories[1].map((message) => message.type),
      ["user_prompt", "user_prompt", "assistant"],
    );
    assert.equal(
      harness.continuationHistories[1].some((message) => message.type === "user_prompt" && message.prompt === "创建后主问题"),
      false,
    );
  });

  it("does not inherit the parent session execution plan", async () => {
    const harness = createHarness();
    const parentSession = createParentSession({
      planSnapshot: {
        sessionId: "main-1",
        updatedAt: 900,
        source: "update_plan",
        plan: [
          { step: "继续执行主任务", status: "in_progress" },
          { step: "核验主任务结果", status: "pending" },
        ],
      },
    });
    const created = harness.manager.createThread({ parentSession, snapshot: [] });

    await harness.manager.send({ threadId: created.threadId, prompt: "只回答侧聊问题" });

    assert.equal(harness.runs[0].session.planSnapshot, undefined);
  });

  it("reuses one live runner for follow-up turns in the same thread", async () => {
    const harness = createHarness();
    const created = await createAndSend(harness, "第一轮问题");
    harness.runs[0].onEvent({
      type: "stream.message",
      payload: { sessionId: created.threadId, message: assistantMessage(created.threadId, "第一轮回答") },
    });
    harness.runs[0].onEvent({
      type: "session.status",
      payload: { sessionId: created.threadId, status: "completed", title: "ignored" },
    });

    await harness.manager.send({ threadId: created.threadId, prompt: "第二轮追问" });

    assert.equal(harness.runs.length, 1);
    assert.deepEqual(harness.appendedPrompts, [{ sessionId: created.threadId, prompt: "第二轮追问" }]);
    assert.equal(harness.continuationHistories.length, 1);
    assert.deepEqual(harness.aborted, []);
  });

  it("rebuilds the same logical thread when its model changes", async () => {
    const harness = createHarness();
    const created = await createAndSend(harness, "第一轮问题");
    harness.runs[0].onEvent({
      type: "stream.message",
      payload: { sessionId: created.threadId, message: assistantMessage(created.threadId, "第一轮回答") },
    });
    harness.runs[0].onEvent({
      type: "session.status",
      payload: { sessionId: created.threadId, status: "completed", title: "ignored" },
    });

    await harness.manager.send({
      threadId: created.threadId,
      prompt: "切换模型后的追问",
      runtime: { model: "gpt-next" },
    });

    assert.equal(harness.runs.length, 2);
    assert.equal(harness.runs[1].runtime?.model, "gpt-next");
    assert.deepEqual(harness.aborted, [created.threadId]);
    assert.deepEqual(harness.appendedPrompts, []);
    assert.equal(
      harness.continuationHistories[1].some((message) => message.type === "assistant" && message.message.content[0]?.type === "text" && message.message.content[0].text === "第一轮回答"),
      true,
    );
  });

  it("routes stream, status, error, and permission events to only their thread", async () => {
    const harness = createHarness();
    const created = await createAndSend(harness);
    const runnerEvent = harness.runs[0].onEvent;

    runnerEvent({
      type: "permission.request",
      payload: { sessionId: created.threadId, toolUseId: "tool-1", toolName: "Edit", input: { path: "a.ts" } },
    });
    runnerEvent({
      type: "runner.error",
      payload: { sessionId: created.threadId, message: "tool failed" },
    });
    runnerEvent({
      type: "session.status",
      payload: { sessionId: created.threadId, status: "error", title: "ignored", error: "tool failed" },
    });

    assert.ok(harness.events.some((event) => event.type === "btw.permission.request" && event.payload.threadId === created.threadId));
    assert.ok(harness.events.some((event) => event.type === "btw.runner.error" && event.payload.threadId === created.threadId));
    assert.ok(harness.events.some((event) => event.type === "btw.thread.status" && event.payload.threadId === created.threadId && event.payload.status === "error"));
    assert.equal(harness.events.some((event) => event.type === "stream.message" || event.type === "session.status"), false);
  });

  it("resolves permissions against the private runtime session", async () => {
    const harness = createHarness();
    const created = await createAndSend(harness);
    let result: unknown;
    harness.runs[0].session.pendingPermissions.set("tool-1", {
      toolUseId: "tool-1",
      toolName: "Edit",
      input: {},
      resolve: (value) => { result = value; },
    });

    harness.manager.respondPermission(created.threadId, "tool-1", { behavior: "allow", updatedInput: { ok: true } });

    assert.deepEqual(result, { behavior: "allow", updatedInput: { ok: true } });
  });

  it("stops and closes only the requested thread", async () => {
    const harness = createHarness();
    const first = await createAndSend(harness, "线程一");
    const second = await createAndSend(harness, "线程二");

    harness.manager.stop(first.threadId);
    assert.deepEqual(harness.aborted, [first.threadId]);
    assert.equal(harness.manager.getThreadCount("main-1"), 2);

    harness.manager.closeThread(first.threadId);
    assert.equal(harness.manager.getThreadCount("main-1"), 1);
    assert.equal(harness.manager.getThreadCount("main-1"), 1);
    assert.ok(harness.events.some((event) => event.type === "btw.thread.created" && event.payload.threadId === second.threadId));
  });

  it("drops late runner events after a thread is closed", async () => {
    const harness = createHarness();
    const created = await createAndSend(harness);
    const runnerEvent = harness.runs[0].onEvent;
    harness.manager.closeThread(created.threadId);
    const eventCountAfterClose = harness.events.length;

    runnerEvent({
      type: "stream.message",
      payload: { sessionId: created.threadId, message: assistantMessage(created.threadId, "迟到回答") },
    });

    assert.equal(harness.events.length, eventCountAfterClose);
  });

  it("closes all threads for one parent without touching another parent", () => {
    const harness = createHarness();
    harness.manager.createThread({ parentSession: createParentSession(), snapshot: [] });
    const other = harness.manager.createThread({ parentSession: createParentSession({ id: "main-2" }), snapshot: [] });

    const closedIds = harness.manager.closeParent("main-1");

    assert.deepEqual(closedIds, ["btw-1"]);
    assert.equal(harness.manager.getThreadCount("main-1"), 0);
    assert.equal(harness.manager.getThreadCount("main-2"), 1);
    assert.ok(harness.events.some((event) => event.type === "btw.thread.created" && event.payload.threadId === other.threadId));
    assert.ok(harness.events.some((event) => event.type === "btw.parent.closed" && event.payload.parentSessionId === "main-1"));
  });
});
