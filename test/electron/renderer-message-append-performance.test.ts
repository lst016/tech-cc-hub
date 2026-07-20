import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import * as appStoreModule from "../../src/ui/store/useAppStore.js";
import type { SessionView } from "../../src/ui/store/useAppStore.js";
import type { ServerEvent, StreamMessage } from "../../src/ui/types.js";

function assistantText(label: string, capturedAt = 0): StreamMessage {
  return {
    type: "assistant",
    capturedAt,
    message: {
      role: "assistant",
      content: [{ type: "text", text: label }],
    },
  } as StreamMessage;
}

function createSession(messages: StreamMessage[], patch: Partial<SessionView> = {}): SessionView {
  return {
    id: "session-append",
    title: "append benchmark",
    status: "running",
    messages,
    permissionRequests: [],
    hydrated: true,
    hasMoreHistory: false,
    ...patch,
  };
}

function appendMessagesToSession(session: SessionView, messages: StreamMessage[]): SessionView {
  const append = (
    appStoreModule as unknown as {
      appendMessagesToSession?: (current: SessionView, next: StreamMessage[]) => SessionView;
    }
  ).appendMessagesToSession;
  if (!append) assert.fail("useAppStore should export appendMessagesToSession");
  return append(session, messages);
}

test("renderer append preserves order and does not mutate the previous message array", () => {
  const existing = Array.from({ length: 500 }, (_, index) => assistantText(`existing-${index}`, index));
  const next = Array.from({ length: 32 }, (_, index) => assistantText(`next-${index}`, 500 + index));
  const session = createSession(existing);

  const appended = appendMessagesToSession(session, next);

  assert.notStrictEqual(appended.messages, existing);
  assert.strictEqual(session.messages, existing);
  assert.equal(existing.length, 500);
  assert.equal(appended.messages.length, 532);
  assert.strictEqual(appended.messages[0], existing[0]);
  assert.strictEqual(appended.messages[499], existing[499]);
  assert.strictEqual(appended.messages[500], next[0]);
  assert.strictEqual(appended.messages[531], next[31]);
});

test("renderer append retains slash commands from every init message in the batch", () => {
  const session = createSession([], { slashCommands: ["help"] });
  const next = [
    {
      type: "system",
      subtype: "init",
      slash_commands: ["goal", "/help"],
    },
    {
      type: "system",
      subtype: "init",
      slash_commands: ["review", "goal"],
    },
  ] as StreamMessage[];

  const appended = appendMessagesToSession(session, next);

  assert.deepEqual(appended.slashCommands, ["goal", "help", "review"]);
});

test("renderer append replaces commands_changed snapshots including deletions and empty lists", () => {
  const session = createSession([], { slashCommands: ["help", "removed"] });
  const replaced = appendMessagesToSession(session, [{
    type: "system",
    subtype: "commands_changed",
    commands: [{
      name: "review",
      description: "Review changes",
      argumentHint: "[path]",
      aliases: ["audit"],
    }],
  } as StreamMessage]);

  assert.deepEqual(replaced.slashCommands, ["audit", "review"]);
  assert.deepEqual(replaced.slashCommandDetails, [{
    name: "review",
    description: "Review changes",
    argumentHint: "[path]",
    aliases: ["audit"],
  }]);

  const emptied = appendMessagesToSession(replaced, [{
    type: "system",
    subtype: "commands_changed",
    commands: [],
    uuid: "11111111-1111-4111-8111-111111111111",
    session_id: "session-append",
  } as StreamMessage]);
  assert.deepEqual(emptied.slashCommands, []);
  assert.deepEqual(emptied.slashCommandDetails, []);
});

test("renderer append resets derived conversation state while preserving runtime configuration", () => {
  const workflowSpec: NonNullable<SessionView["workflowSpec"]> = {
    workflowId: "workflow-1",
    name: "Workflow 1",
    version: "1",
    scope: "session",
    mode: "single-thread",
    entry: "manual",
    owner: "test",
    autoAdvance: false,
    autoBind: false,
    title: "Workflow 1",
    sections: { goal: "Test reset compatibility", rules: "Keep configuration" },
    steps: [],
    rawMarkdown: "# Old workflow",
  };
  const workflowCatalog: NonNullable<SessionView["workflowCatalog"]> = {
    sessionId: "session-append",
    roots: { project: "D:/workspace/.techcc/workflows" },
    entries: [{
      workflowId: "workflow-1",
      sourceLayer: "project",
      sourcePath: "D:/workspace/.techcc/workflows/workflow-1.md",
      markdown: "# Old workflow",
      document: workflowSpec,
    }],
  };
  const session = createSession([assistantText("old")], {
    title: "Old conversation",
    error: "old error",
    model: "claude-model",
    configProfileId: "profile-1",
    executionMode: "background",
    reasoningMode: "high",
    permissionMode: "default",
    cwd: "D:/workspace",
    slashCommands: ["old-command"],
    slashCommandDetails: [{ name: "old-command", description: "Old command" }],
    permissionRequests: [{ toolUseId: "permission-1", toolName: "Edit", input: {} }],
    lastPrompt: "old prompt",
    workflowMarkdown: "# Old workflow",
    workflowSourceLayer: "project",
    workflowSourcePath: "D:/workspace/.techcc/workflows/workflow-1.md",
    workflowState: {
      workflowId: "workflow-1",
      sourceLayer: "session",
      status: "running",
      steps: [],
    },
    workflowSpec,
    workflowError: "old workflow error",
    workflowCatalog,
    latestGoal: {
      sessionId: "session-append",
      objective: "old goal",
      status: "active",
      updatedAt: 1,
      source: "get_goal",
    },
    latestPlan: {
      sessionId: "session-append",
      updatedAt: 1,
      source: "update_plan",
      plan: [{ step: "old plan", status: "in_progress" }],
    },
    hydrated: false,
    hasMoreHistory: true,
    historyCursor: { beforeCreatedAt: 1, beforeId: "message-1" },
  });
  const resetMessage = {
    type: "conversation_reset",
    new_conversation_id: "22222222-2222-4222-8222-222222222222",
    uuid: "33333333-3333-4333-8333-333333333333",
    session_id: "session-append",
  } as StreamMessage;

  const reset = appendMessagesToSession(session, [resetMessage]);

  assert.strictEqual(reset.messages[0], resetMessage);
  assert.equal(reset.messages.length, 1);
  assert.equal(reset.title, "New Session");
  assert.equal(reset.error, undefined);
  assert.deepEqual(reset.slashCommands, ["old-command"]);
  assert.deepEqual(reset.slashCommandDetails, [{ name: "old-command", description: "Old command" }]);
  assert.deepEqual(reset.permissionRequests, []);
  assert.equal(reset.lastPrompt, undefined);
  assert.equal(reset.workflowMarkdown, "# Old workflow");
  assert.equal(reset.workflowSourceLayer, "project");
  assert.equal(reset.workflowSourcePath, "D:/workspace/.techcc/workflows/workflow-1.md");
  assert.equal(reset.workflowState, undefined);
  assert.strictEqual(reset.workflowSpec, workflowSpec);
  assert.equal(reset.workflowError, undefined);
  assert.strictEqual(reset.workflowCatalog, workflowCatalog);
  assert.equal(reset.latestGoal, undefined);
  assert.equal(reset.latestPlan, undefined);
  assert.equal(reset.hydrated, true);
  assert.equal(reset.hasMoreHistory, false);
  assert.equal(reset.historyCursor, undefined);
  assert.ok((reset.updatedAt ?? 0) > 1);
  assert.equal(reset.model, "claude-model");
  assert.equal(reset.configProfileId, "profile-1");
  assert.equal(reset.executionMode, "background");
  assert.equal(reset.reasoningMode, "high");
  assert.equal(reset.permissionMode, "default");
  assert.equal(reset.cwd, "D:/workspace");
});

test("renderer append folds pure heartbeats by tool use id but retains retry progress", () => {
  const heartbeat = (toolUseId: string, elapsed: number): StreamMessage => ({
    type: "tool_progress",
    tool_use_id: toolUseId,
    tool_name: "Task",
    parent_tool_use_id: null,
    elapsed_time_seconds: elapsed,
    heartbeat: true,
  } as StreamMessage);
  const retry = {
    ...heartbeat("tool-1", 25),
    subagent_retry: {
      agent_id: "agent-1",
      attempt: 2,
      max_retries: 3,
      retry_delay_ms: 1000,
      error_status: 429,
      error_category: "rate_limit",
    },
  } as StreamMessage;
  const session = createSession([heartbeat("tool-1", 1), heartbeat("tool-1", 2)]);
  const incoming = [
    ...Array.from({ length: 50 }, (_, index) => heartbeat("tool-1", index + 3)),
    retry,
    heartbeat("tool-2", 1),
  ];

  const appended = appendMessagesToSession(session, incoming);
  const toolOneHeartbeats = appended.messages.filter((message) => (
    message.type === "tool_progress"
    && message.tool_use_id === "tool-1"
    && message.heartbeat === true
    && !message.subagent_retry
  ));
  const retries = appended.messages.filter((message) => (
    message.type === "tool_progress" && message.subagent_retry
  ));

  assert.equal(toolOneHeartbeats.length, 1);
  assert.equal((toolOneHeartbeats[0] as { elapsed_time_seconds?: number } | undefined)?.elapsed_time_seconds, 52);
  assert.equal(retries.length, 1);
  assert.equal(appended.messages.filter((message) => message.type === "tool_progress" && message.tool_use_id === "tool-2").length, 1);
});

test("renderer history reconstruction applies assistant supersedes in message order", () => {
  const superseded = {
    type: "assistant",
    uuid: "88888888-8888-4888-8888-888888888888",
    session_id: "session-append",
    parent_tool_use_id: null,
    message: { role: "assistant", content: [{ type: "text", text: "obsolete" }] },
  } as unknown as StreamMessage;
  const replacement = {
    type: "assistant",
    uuid: "99999999-9999-4999-8999-999999999999",
    session_id: "session-append",
    parent_tool_use_id: null,
    supersedes: ["88888888-8888-4888-8888-888888888888"],
    message: { role: "assistant", content: [{ type: "text", text: "replacement" }] },
  } as unknown as StreamMessage;

  const reconstructed = appendMessagesToSession(createSession([]), [superseded, replacement]);

  assert.deepEqual(reconstructed.messages, [replacement]);
});

test("assistant supersedes clears plan and goal derived from the retracted frame", () => {
  const stateful = {
    type: "assistant",
    uuid: "stateful-frame",
    capturedAt: 100,
    message: {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "plan-tool",
          name: "update_plan",
          input: { plan: [{ step: "obsolete", status: "in_progress" }] },
        },
        {
          type: "tool_use",
          id: "goal-tool",
          name: "create_goal",
          input: { objective: "obsolete goal" },
        },
      ],
    },
  } as unknown as StreamMessage;
  const withDerivedState = appendMessagesToSession(createSession([]), [stateful]);
  assert.equal(withDerivedState.latestPlan?.plan[0]?.step, "obsolete");
  assert.equal(withDerivedState.latestGoal?.objective, "obsolete goal");

  const replacement = {
    type: "assistant",
    uuid: "replacement-frame",
    capturedAt: 101,
    supersedes: ["stateful-frame"],
    message: { role: "assistant", content: [{ type: "text", text: "replacement" }] },
  } as unknown as StreamMessage;
  const replaced = appendMessagesToSession(withDerivedState, [replacement]);

  assert.equal(replaced.latestPlan, undefined);
  assert.equal(replaced.latestGoal, undefined);
  assert.deepEqual(replaced.messages, [replacement]);
});

test("main renderer store preserves structured permission request metadata", () => {
  const sessionId = "permission-metadata-session";
  appStoreModule.useAppStore.setState({
    sessions: { [sessionId]: createSession([], { id: sessionId }) },
    archivedSessions: {},
  });
  appStoreModule.useAppStore.getState().handleServerEvent({
    type: "permission.request",
    payload: {
      sessionId,
      toolUseId: "tool-1",
      toolName: "Read",
      input: { file_path: "D:/outside.txt" },
      requestId: "request-1",
      blockedPath: "D:/outside.txt",
      decisionReason: "outside_workspace",
      title: "Claude wants to read a file",
      displayName: "Read file",
      description: "Read access outside the workspace",
      matchedAskRule: { source: "user", toolName: "Read", ruleContent: "ask Read" },
      agentId: "agent-1",
      suggestions: [{
        type: "addRules",
        behavior: "allow",
        destination: "session",
        rules: [{ toolName: "Read" }],
      }],
    },
  } as ServerEvent);

  const request = appStoreModule.useAppStore.getState().sessions[sessionId]?.permissionRequests[0];
  assert.equal(request?.requestId, "request-1");
  assert.equal(request?.blockedPath, "D:/outside.txt");
  assert.equal(request?.decisionReason, "outside_workspace");
  assert.equal(request?.title, "Claude wants to read a file");
  assert.equal(request?.displayName, "Read file");
  assert.equal(request?.description, "Read access outside the workspace");
  assert.equal(request?.matchedAskRule?.ruleContent, "ask Read");
  assert.equal(request?.agentId, "agent-1");
  assert.equal(request?.suggestions?.length, 1);
});

test("main renderer store applies conversation reset synchronously without clearing runtime choices", () => {
  const sessionId = "live-reset-session";
  appStoreModule.useAppStore.setState({
    activeSessionId: sessionId,
    globalError: "old global error",
    sessions: {
      [sessionId]: createSession([assistantText("old")], {
        id: sessionId,
        title: "Old title",
        model: "model-a",
        configProfileId: "profile-a",
        reasoningMode: "xhigh",
        permissionMode: "default",
        permissionRequests: [{ toolUseId: "tool-1", toolName: "Edit", input: {} }],
        latestPlan: {
          sessionId,
          updatedAt: 1,
          source: "update_plan",
          plan: [{ step: "old", status: "in_progress" }],
        },
      }),
    },
    archivedSessions: {},
  });
  const resetMessage = {
    type: "conversation_reset",
    new_conversation_id: "66666666-6666-4666-8666-666666666666",
    uuid: "77777777-7777-4777-8777-777777777777",
    session_id: sessionId,
  } as StreamMessage;

  appStoreModule.useAppStore.getState().handleServerEvent({
    type: "stream.message",
    payload: { sessionId, message: resetMessage },
  });

  const session = appStoreModule.useAppStore.getState().sessions[sessionId];
  assert.deepEqual(session.messages, [resetMessage]);
  assert.equal(session.title, "New Session");
  assert.deepEqual(session.permissionRequests, []);
  assert.equal(session.latestPlan, undefined);
  assert.equal(session.model, "model-a");
  assert.equal(session.configProfileId, "profile-a");
  assert.equal(session.reasoningMode, "xhigh");
  assert.equal(session.permissionMode, "default");
  assert.ok((session.updatedAt ?? 0) > 1);
  assert.equal(appStoreModule.useAppStore.getState().globalError, null);
});

test("renderer append resolves goal results across batches and carries plan state forward", () => {
  const goalToolUse = {
    type: "assistant",
    capturedAt: 100,
    message: {
      content: [{ type: "tool_use", id: "goal-read", name: "get_goal", input: {} }],
    },
  } as StreamMessage;
  const session = createSession([goalToolUse], {
    latestPlan: {
      sessionId: "session-append",
      updatedAt: 50,
      source: "update_plan",
      plan: [{ step: "existing step", status: "completed" }],
    },
  });
  const goalResult = {
    type: "user",
    capturedAt: 200,
    message: {
      content: [{
        type: "tool_result",
        tool_use_id: "goal-read",
        content: JSON.stringify({
          objective: "keep the full goal scan",
          status: "active",
          token_budget: 4000,
        }),
      }],
    },
  } as StreamMessage;
  const planUpdate = {
    type: "assistant",
    capturedAt: 300,
    message: {
      content: [{
        type: "tool_use",
        id: "plan-update",
        name: "update_plan",
        input: { plan: [{ step: "new step", status: "in_progress" }] },
      }],
    },
  } as StreamMessage;

  const appended = appendMessagesToSession(session, [goalResult, planUpdate]);

  assert.equal(appended.latestGoal?.objective, "keep the full goal scan");
  assert.equal(appended.latestGoal?.source, "get_goal");
  assert.equal(appended.latestGoal?.tokenBudget, 4000);
  assert.deepEqual(appended.latestPlan?.plan, [{ step: "new step", status: "in_progress" }]);
  assert.equal(appended.latestPlan?.source, "update_plan");

  const carried = appendMessagesToSession(appended, [assistantText("no state update", 400)]);
  assert.strictEqual(carried.latestGoal, appended.latestGoal);
  assert.strictEqual(carried.latestPlan, appended.latestPlan);
});

test("renderer append p95 stays below 1ms for 500 existing and 32 next messages", (context) => {
  const existing = Array.from({ length: 500 }, (_, index) => assistantText(`existing-${index}`, index));
  const next = Array.from({ length: 32 }, (_, index) => assistantText(`next-${index}`, 500 + index));
  const session = createSession(existing);

  for (let index = 0; index < 200; index += 1) {
    appendMessagesToSession(session, next);
  }

  const samples: number[] = [];
  for (let index = 0; index < 1000; index += 1) {
    const startedAt = performance.now();
    appendMessagesToSession(session, next);
    samples.push(performance.now() - startedAt);
  }

  samples.sort((left, right) => left - right);
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
  context.diagnostic(`renderer append p95: ${p95.toFixed(4)}ms (1000 samples)`);
  assert.ok(p95 < 1, `expected renderer append p95 < 1ms, received ${p95.toFixed(4)}ms`);
});
