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
      payload: {
        threadId: "a",
        toolUseId: "tool-a",
        toolName: "Edit",
        input: { path: "a.ts" },
        requestId: "request-a",
        blockedPath: "D:/outside/a.ts",
        decisionReason: "outside_workspace",
        title: "Claude wants to edit a file",
        displayName: "Edit file",
        description: "The file is outside the workspace",
        matchedAskRule: { source: "user", toolName: "Edit", ruleContent: "ask Edit" },
        agentId: "agent-a",
        suggestions: [{
          type: "addRules",
          behavior: "allow",
          destination: "session",
          rules: [{ toolName: "Edit" }],
        }],
      },
    } as ServerEvent);

    assert.deepEqual(store.getState().threads.a.messages.map((message) => message.type), ["user_prompt", "assistant"]);
    assert.deepEqual(store.getState().threads.a.permissionRequests.map((request) => request.toolUseId), ["tool-a"]);
    assert.equal(store.getState().threads.a.permissionRequests[0]?.requestId, "request-a");
    assert.equal(store.getState().threads.a.permissionRequests[0]?.blockedPath, "D:/outside/a.ts");
    assert.equal(store.getState().threads.a.permissionRequests[0]?.displayName, "Edit file");
    assert.equal(store.getState().threads.a.permissionRequests[0]?.agentId, "agent-a");
    assert.equal(store.getState().threads.a.permissionRequests[0]?.suggestions?.length, 1);
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

  it("conversation reset clears derived UI state while preserving thread runtime choices and draft", () => {
    const store = createBtwStore();
    store.getState().handleServerEvent(created("a", "main-1", "Old conversation"));
    store.getState().setDraft("a", "unsent draft");
    store.getState().setAttachments("a", [imageAttachment("draft-image")]);
    store.getState().setModel("a", "model-a", "profile-a");
    store.getState().setReasoningMode("a", "xhigh");
    store.getState().handleServerEvent({
      type: "btw.stream.message",
      payload: { threadId: "a", message: assistantMessage("a", "old answer") },
    });
    store.getState().handleServerEvent({
      type: "btw.stream.message",
      payload: {
        threadId: "a",
        message: { type: "stream_event", event: { type: "content_block_start" } } as StreamMessage,
      },
    });
    store.getState().handleServerEvent({
      type: "btw.permission.request",
      payload: { threadId: "a", toolUseId: "tool-a", toolName: "Edit", input: {} },
    });
    store.getState().handleServerEvent({
      type: "btw.runner.error",
      payload: { threadId: "a", message: "old error" },
    });

    const resetMessage = {
      type: "conversation_reset",
      new_conversation_id: "44444444-4444-4444-8444-444444444444",
      uuid: "55555555-5555-4555-8555-555555555555",
      session_id: "a",
    } as StreamMessage;
    store.getState().handleServerEvent({
      type: "btw.stream.message",
      payload: { threadId: "a", message: resetMessage },
    });

    const thread = store.getState().threads.a;
    assert.equal(thread.title, "New Session");
    assert.deepEqual(thread.messages, [resetMessage]);
    assert.equal(thread.partialMessage, "");
    assert.equal(thread.partialVisible, false);
    assert.deepEqual(thread.permissionRequests, []);
    assert.equal(thread.error, undefined);
    assert.equal(thread.model, "model-a");
    assert.equal(thread.configProfileId, "profile-a");
    assert.equal(thread.reasoningMode, "xhigh");
    assert.equal(thread.permissionMode, "default");
    assert.equal(thread.cwd, "D:/workspace/project");
    assert.equal(thread.draft, "unsent draft");
    assert.equal(thread.attachments[0]?.id, "draft-image");
    assert.ok(thread.updatedAt > 1);
  });

  it("folds pure tool progress heartbeats without dropping retry frames", () => {
    const store = createBtwStore();
    store.getState().handleServerEvent(created("a"));
    const heartbeat = (elapsed: number): StreamMessage => ({
      type: "tool_progress",
      tool_use_id: "tool-a",
      tool_name: "Task",
      parent_tool_use_id: null,
      elapsed_time_seconds: elapsed,
      heartbeat: true,
    } as StreamMessage);

    for (let elapsed = 1; elapsed <= 25; elapsed += 1) {
      store.getState().handleServerEvent({
        type: "btw.stream.message",
        payload: { threadId: "a", message: heartbeat(elapsed) },
      });
    }
    store.getState().handleServerEvent({
      type: "btw.stream.message",
      payload: {
        threadId: "a",
        message: {
          ...heartbeat(26),
          subagent_retry: {
            agent_id: "agent-a",
            attempt: 1,
            max_retries: 3,
            retry_delay_ms: 1000,
            error_status: 429,
            error_category: "rate_limit",
          },
        } as StreamMessage,
      },
    });

    const progress = store.getState().threads.a.messages.filter((message) => message.type === "tool_progress");
    assert.equal(progress.length, 2);
    assert.equal(progress.filter((message) => message.heartbeat && !message.subagent_retry).length, 1);
    assert.equal(progress.find((message) => message.heartbeat && !message.subagent_retry)?.elapsed_time_seconds, 25);
    assert.equal(progress.filter((message) => message.subagent_retry).length, 1);
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
