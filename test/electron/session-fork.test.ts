import test from "node:test";
import assert from "node:assert/strict";

import {
  forkStoredSession,
  type SessionForkSdk,
  type SessionForkStore,
} from "../../src/electron/libs/session-fork/index.js";
import type { StreamMessage } from "../../src/electron/types.js";

function assistant(uuid: string, text: string, sessionId = "remote-source"): StreamMessage {
  return {
    type: "assistant",
    uuid,
    session_id: sessionId,
    parent_tool_use_id: null,
    message: {
      id: `message-${uuid}`,
      role: "assistant",
      content: [{ type: "text", text }],
      model: "claude-sonnet-4-5",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    },
    capturedAt: 1,
    historyId: uuid,
  } as StreamMessage;
}

test("native session fork creates a resumable local branch and remaps assistant UUIDs", async () => {
  const sourceSession = {
    id: "local-source",
    title: "权限审查",
    status: "completed" as const,
    claudeSessionId: "remote-source",
    cwd: "D:/workspace/project",
    model: "claude-sonnet-4-5",
    configProfileId: "anthropic-work",
    lastPrompt: "分支点之后的最新问题",
    executionMode: "foreground" as const,
    reasoningMode: "high" as const,
    permissionMode: "default" as const,
    runSurface: "development" as const,
    agentId: "reviewer",
    allowedTools: "*",
    pendingPermissions: new Map(),
  };
  const sourceMessages: StreamMessage[] = [
    assistant("archived-assistant", "早期会话片段", "remote-archived"),
    { type: "user_prompt", prompt: "检查权限", capturedAt: 1, historyId: "local-prompt-1" },
    assistant("old-assistant-1", "第一轮"),
    { type: "user_prompt", prompt: "继续检查", capturedAt: 2, historyId: "local-prompt-2" },
    assistant("old-assistant-2", "第二轮"),
    assistant("old-assistant-3", "不应进入分支"),
  ];
  const recorded: StreamMessage[] = [];
  const updates: Array<Record<string, unknown>> = [];
  const createdSession = {
    ...sourceSession,
    id: "local-fork",
    title: "权限审查（分支）",
    status: "idle" as const,
    claudeSessionId: undefined,
  };
  const store: SessionForkStore = {
    getSession: (id) => id === sourceSession.id ? sourceSession : undefined,
    getSessionHistory: (id) => id === sourceSession.id
      ? { session: sourceSession as never, messages: sourceMessages }
      : null,
    createSession: (options) => {
      assert.equal(options.title, "权限审查（分支）");
      assert.equal(options.cwd, sourceSession.cwd);
      assert.equal(options.model, sourceSession.model);
      assert.equal(options.configProfileId, sourceSession.configProfileId);
      assert.equal(options.prompt, "继续检查");
      return createdSession as never;
    },
    updateSession: (_id, update) => {
      updates.push(update);
      return Object.assign(createdSession, update) as never;
    },
    recordMessage: (_id, message) => {
      recorded.push(message);
      return message;
    },
  };
  const sourceTranscript = [
    { type: "user" as const, uuid: "remote-user-1", session_id: "remote-source", message: {}, parent_tool_use_id: null, parent_agent_id: null },
    { type: "assistant" as const, uuid: "old-assistant-1", session_id: "remote-source", message: {}, parent_tool_use_id: null, parent_agent_id: null },
    { type: "user" as const, uuid: "remote-user-2", session_id: "remote-source", message: {}, parent_tool_use_id: null, parent_agent_id: null },
    { type: "assistant" as const, uuid: "old-assistant-2", session_id: "remote-source", message: {}, parent_tool_use_id: null, parent_agent_id: null },
    { type: "assistant" as const, uuid: "old-assistant-3", session_id: "remote-source", message: {}, parent_tool_use_id: null, parent_agent_id: null },
  ];
  const targetTranscript = [
    { type: "user" as const, uuid: "new-user-1", session_id: "remote-fork", message: {}, parent_tool_use_id: null, parent_agent_id: null },
    { type: "assistant" as const, uuid: "new-assistant-1", session_id: "remote-fork", message: {}, parent_tool_use_id: null, parent_agent_id: null },
    { type: "user" as const, uuid: "new-user-2", session_id: "remote-fork", message: {}, parent_tool_use_id: null, parent_agent_id: null },
    { type: "assistant" as const, uuid: "new-assistant-2", session_id: "remote-fork", message: {}, parent_tool_use_id: null, parent_agent_id: null },
  ];
  const forkCalls: unknown[][] = [];
  const sdk: SessionForkSdk = {
    getSessionMessages: async (sessionId) => sessionId === "remote-source" ? sourceTranscript : targetTranscript,
    forkSession: async (...args) => {
      forkCalls.push(args);
      return { sessionId: "remote-fork" };
    },
  };

  const result = await forkStoredSession({
    store,
    sdk,
    sourceSessionId: sourceSession.id,
    upToMessageId: "old-assistant-2",
  });

  assert.equal(result.session.id, "local-fork");
  assert.equal(result.session.claudeSessionId, "remote-fork");
  assert.equal(result.session.configProfileId, "anthropic-work");
  assert.deepEqual(forkCalls, [["remote-source", {
    dir: sourceSession.cwd,
    upToMessageId: "old-assistant-2",
    title: "权限审查（分支）",
  }]]);
  assert.deepEqual(updates, [{ claudeSessionId: "remote-fork", status: "idle" }]);
  assert.equal(recorded.length, 5);
  const recordedAssistants = recorded.filter((message) => message.type === "assistant");
  assert.notEqual(recordedAssistants[0]?.uuid, "archived-assistant");
  assert.equal(recordedAssistants[0]?.historyId, recordedAssistants[0]?.uuid);
  assert.deepEqual(recordedAssistants.slice(1).map((message) => message.uuid), [
    "new-assistant-1",
    "new-assistant-2",
  ]);
  assert.ok(recorded.every((message) => message.historyId !== "local-prompt-1" && message.historyId !== "local-prompt-2"));
  assert.ok(recorded.every((message) => !("session_id" in message) || message.session_id === "remote-fork"));
});

test("native session fork rejects local sessions that have no resumable SDK session", async () => {
  const store = {
    getSession: () => ({ id: "local", title: "本地会话", status: "idle", pendingPermissions: new Map() }),
    getSessionHistory: () => null,
  } as unknown as SessionForkStore;
  const sdk = {
    forkSession: async () => ({ sessionId: "unused" }),
    getSessionMessages: async () => [],
  } satisfies SessionForkSdk;

  await assert.rejects(
    forkStoredSession({ store, sdk, sourceSessionId: "local", upToMessageId: "assistant" }),
    /尚未建立可恢复的 Agent SDK 会话/,
  );
});
