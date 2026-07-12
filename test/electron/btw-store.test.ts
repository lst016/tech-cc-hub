import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PromptAttachment, ServerEvent, StreamMessage } from "../../src/ui/types.js";
import { createBtwStore } from "../../src/ui/store/useBtwStore.js";

function created(threadId: string, parentSessionId = "main-1", title = threadId): ServerEvent {
  return {
    type: "btw.thread.created",
    payload: {
      threadId,
      parentSessionId,
      title,
      status: "idle",
      cwd: "D:/workspace/project",
      model: "claude-sonnet-4-5",
      reasoningMode: "high",
      permissionMode: "default",
      createdAt: 1,
      updatedAt: 1,
    },
  };
}

function assistantMessage(threadId: string, text: string): StreamMessage {
  return {
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text }] },
    parent_tool_use_id: null,
    uuid: `${threadId}-${text}`,
    session_id: threadId,
  } as StreamMessage;
}

function imageAttachment(id: string): PromptAttachment {
  return { id, kind: "image", name: `${id}.png`, mimeType: "image/png", data: id };
}

describe("useBtwStore", () => {
  it("adds empty threads per parent and selects the newest thread", () => {
    const store = createBtwStore();

    store.getState().handleServerEvent(created("a", "main-1", "侧聊 1"));
    store.getState().handleServerEvent(created("b", "main-1", "侧聊 2"));
    store.getState().handleServerEvent(created("c", "main-2", "侧聊 1"));

    assert.deepEqual(store.getState().threadIdsByParent["main-1"], ["a", "b"]);
    assert.deepEqual(store.getState().threadIdsByParent["main-2"], ["c"]);
    assert.equal(store.getState().activeThreadIdByParent["main-1"], "b");
    assert.deepEqual(store.getState().threads.a.messages, []);
  });

  it("keeps drafts attachments models and errors isolated by thread", () => {
    const store = createBtwStore();
    store.getState().handleServerEvent(created("a"));
    store.getState().handleServerEvent(created("b"));

    store.getState().setDraft("a", "only-a");
    store.getState().setAttachments("a", [imageAttachment("a")]);
    store.getState().setModel("a", "model-a");
    store.getState().setReasoningMode("a", "low");
    store.getState().setThreadError("a", "error-a");

    assert.equal(store.getState().threads.a.draft, "only-a");
    assert.equal(store.getState().threads.a.attachments[0].id, "a");
    assert.equal(store.getState().threads.a.model, "model-a");
    assert.equal(store.getState().threads.a.reasoningMode, "low");
    assert.equal(store.getState().threads.a.error, "error-a");
    assert.equal(store.getState().threads.b.draft, "");
    assert.deepEqual(store.getState().threads.b.attachments, []);
    assert.equal(store.getState().threads.b.error, undefined);
  });

  it("routes user assistant and permission events to one thread", () => {
    const store = createBtwStore();
    store.getState().handleServerEvent(created("a"));
    store.getState().handleServerEvent(created("b"));

    store.getState().handleServerEvent({
      type: "btw.stream.user_prompt",
      payload: { threadId: "a", prompt: "问题 A", capturedAt: 2 },
    });
    store.getState().handleServerEvent({
      type: "btw.stream.message",
      payload: { threadId: "a", message: assistantMessage("a", "回答 A") },
    });
    store.getState().handleServerEvent({
      type: "btw.permission.request",
      payload: { threadId: "a", toolUseId: "tool-a", toolName: "Edit", input: { path: "a.ts" } },
    });

    assert.deepEqual(store.getState().threads.a.messages.map((message) => message.type), ["user_prompt", "assistant"]);
    assert.deepEqual(store.getState().threads.a.permissionRequests.map((request) => request.toolUseId), ["tool-a"]);
    assert.deepEqual(store.getState().threads.b.messages, []);
    assert.deepEqual(store.getState().threads.b.permissionRequests, []);
  });

  it("builds partial text from stream deltas without storing transient messages", () => {
    const store = createBtwStore();
    store.getState().handleServerEvent(created("a"));

    for (const event of [
      { type: "content_block_start" },
      { type: "content_block_delta", delta: { type: "text_delta", text: "临时" } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "回答" } },
    ]) {
      store.getState().handleServerEvent({
        type: "btw.stream.message",
        payload: { threadId: "a", message: { type: "stream_event", event } as StreamMessage },
      });
    }

    assert.equal(store.getState().threads.a.partialMessage, "临时回答");
    assert.equal(store.getState().threads.a.partialVisible, true);
    assert.deepEqual(store.getState().threads.a.messages, []);

    store.getState().handleServerEvent({
      type: "btw.stream.message",
      payload: { threadId: "a", message: { type: "stream_event", event: { type: "content_block_stop" } } as StreamMessage },
    });
    assert.equal(store.getState().threads.a.partialVisible, false);
    assert.equal(store.getState().threads.a.partialMessage, "");
  });

  it("closes one thread and selects its nearest remaining neighbor", () => {
    const store = createBtwStore();
    for (const id of ["a", "b", "c"]) store.getState().handleServerEvent(created(id));
    store.getState().setActiveThread("main-1", "b");
    store.getState().setDraft("b", "must disappear");

    store.getState().handleServerEvent({ type: "btw.thread.closed", payload: { threadId: "b", parentSessionId: "main-1" } });

    assert.equal(store.getState().threads.b, undefined);
    assert.deepEqual(store.getState().threadIdsByParent["main-1"], ["a", "c"]);
    assert.equal(store.getState().activeThreadIdByParent["main-1"], "c");
  });

  it("clears a thread optimistically before a server acknowledgement", () => {
    const store = createBtwStore();
    store.getState().handleServerEvent(created("a"));
    store.getState().setDraft("a", "must disappear immediately");

    store.getState().clearThread("a");

    assert.equal(store.getState().threads.a, undefined);
    assert.equal(store.getState().threadIdsByParent["main-1"], undefined);
  });

  it("clears every field for one parent and ignores late or ordinary events", () => {
    const store = createBtwStore();
    store.getState().handleServerEvent(created("a", "main-1"));
    store.getState().handleServerEvent(created("b", "main-2"));
    store.getState().handleServerEvent({ type: "btw.parent.closed", payload: { parentSessionId: "main-1", threadIds: ["a"] } });
    store.getState().handleServerEvent({
      type: "btw.stream.message",
      payload: { threadId: "a", message: assistantMessage("a", "late") },
    });
    store.getState().handleServerEvent({
      type: "session.status",
      payload: { sessionId: "b", status: "error", error: "ordinary" },
    });

    assert.equal(store.getState().threads.a, undefined);
    assert.equal(store.getState().threadIdsByParent["main-1"], undefined);
    assert.equal(store.getState().activeThreadIdByParent["main-1"], undefined);
    assert.equal(store.getState().threads.b.status, "idle");
    assert.equal(store.getState().threads.b.error, undefined);
  });
});
