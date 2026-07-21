import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLarkCliCardPatchArgs,
  buildLarkCliCardPatchFileArgs,
  buildLarkCliDelayedCardUpdateArgs,
  buildLarkCliDelayedCardUpdateFileArgs,
  buildLarkCliWorkflowCardSendArgs,
  buildLarkCliWorkflowCardSendFileArgs,
  buildLarkWorkflowCardSendBody,
  buildLarkWorkflowCard,
  createLarkWorkflowCardCoordinator,
  normalizeLarkCardActionEvent,
  parseLarkWorkflowCardSendResponse,
  resolveLarkWorkflowReplyDelivery,
  type LarkWorkflowCardSnapshot,
} from "../../src/electron/libs/channel/lark-workflow-card.js";
import type { ChannelReplyTarget } from "../../src/electron/libs/channel/channel-workspace.js";

const target: ChannelReplyTarget = {
  provider: "lark",
  conversationId: "chat",
  rawConversationId: "oc_demo",
  externalMessageId: "om_prompt",
  senderId: "ou_owner",
  workspaceRoot: "C:\\channels\\lark\\chat",
};

function runningSnapshot(overrides: Partial<LarkWorkflowCardSnapshot> = {}): LarkWorkflowCardSnapshot {
  return {
    sessionId: "session-1",
    title: "交付飞书流程卡片",
    prompt: "请完成飞书深度交互接入",
    status: "running",
    updatedAt: Date.parse("2026-07-21T10:30:00+08:00"),
    runs: [{
      id: "session-1:task-1",
      taskId: "task-1",
      workflowRunId: "session-1:task-1",
      workflowName: "TDD implementation",
      status: "running",
      summary: "正在实现卡片原位更新",
    }],
    ...overrides,
  };
}

test("builds a Card 2.0 workflow view with semantic progress and versioned stop actions", () => {
  const card = buildLarkWorkflowCard({ ...runningSnapshot(), cardVersion: 3 });
  const serialized = JSON.stringify(card);

  assert.equal(card.schema, "2.0");
  assert.equal(card.config.update_multi, true);
  assert.equal(card.config.enable_forward, false);
  assert.equal(card.header.title.content, "交付飞书流程卡片");
  assert.equal(card.header.template, "blue");
  assert.match(serialized, /请完成飞书深度交互接入/);
  assert.match(serialized, /正在实现卡片原位更新/);
  assert.match(serialized, /停止流程/);
  assert.match(serialized, /停止此任务/);
  assert.match(serialized, /"action":"stop_session"/);
  assert.match(serialized, /"action":"stop_task"/);
  assert.match(serialized, /"sessionId":"session-1"/);
  assert.match(serialized, /"cardVersion":3/);
});

test("renders permission confirmation without leaking tool input secrets", () => {
  const card = buildLarkWorkflowCard({
    ...runningSnapshot({
      permission: {
        toolUseId: "tool-1",
        toolName: "Bash",
        input: { command: "deploy", accessToken: "secret-token-must-not-render" },
      },
    }),
    cardVersion: 4,
  });
  const serialized = JSON.stringify(card);

  assert.equal(card.header.template, "yellow");
  assert.match(serialized, /等待确认/);
  assert.match(serialized, /Bash/);
  assert.doesNotMatch(serialized, /secret-token-must-not-render/);
  assert.match(serialized, /"action":"permission_allow"/);
  assert.match(serialized, /"action":"permission_deny"/);
  assert.match(serialized, /"toolUseId":"tool-1"/);
});

test("uses terminal state semantics and exposes only valid recovery or delivery actions", () => {
  const failed = buildLarkWorkflowCard({
    ...runningSnapshot({
      status: "error",
      error: "测试失败：更新消息超时",
      runs: [{
        id: "session-1:task-1",
        taskId: "task-1",
        workflowRunId: "session-1:task-1",
        workflowName: "TDD implementation",
        status: "failed",
        summary: "更新消息超时",
        canResume: true,
        canRerun: true,
      }],
    }),
    cardVersion: 5,
  });
  const failedJson = JSON.stringify(failed);
  assert.equal(failed.header.template, "red");
  assert.match(failedJson, /继续执行/);
  assert.match(failedJson, /"action":"resume_run"/);
  assert.match(failedJson, /重新执行/);
  assert.match(failedJson, /"action":"rerun_run"/);
  assert.doesNotMatch(failedJson, /"action":"stop_session"/);

  const completed = buildLarkWorkflowCard({
    ...runningSnapshot({
      status: "completed",
      assistantSummary: "已完成并通过全部测试。",
      runs: [{
        id: "session-1:task-1",
        taskId: "task-1",
        workflowRunId: "session-1:task-1",
        workflowName: "TDD implementation",
        status: "completed",
        summary: "全部测试通过",
        sessionUrl: "https://example.com/delivery",
      }],
    }),
    cardVersion: 6,
  });
  const completedJson = JSON.stringify(completed);
  assert.equal(completed.header.template, "green");
  assert.match(completedJson, /已完成并通过全部测试/);
  assert.match(completedJson, /https:\/\/example\.com\/delivery/);
  assert.doesNotMatch(completedJson, /"action":"stop_session"/);
});

test("builds bot card send, in-place PATCH, and delayed callback update arguments", () => {
  const card = buildLarkWorkflowCard({ ...runningSnapshot(), cardVersion: 1 });
  const sendArgs = buildLarkCliWorkflowCardSendArgs(target, card, "techcc-card-demo");
  assert.deepEqual(sendArgs.slice(0, 4), ["im", "+messages-send", "--chat-id", "oc_demo"]);
  assert.equal(sendArgs[sendArgs.indexOf("--msg-type") + 1], "interactive");
  assert.deepEqual(JSON.parse(sendArgs[sendArgs.indexOf("--content") + 1]), card);
  assert.equal(sendArgs[sendArgs.indexOf("--as") + 1], "bot");
  assert.equal(sendArgs[sendArgs.indexOf("--idempotency-key") + 1], "techcc-card-demo");

  const patchArgs = buildLarkCliCardPatchArgs("om_card", card);
  assert.deepEqual(patchArgs.slice(0, 3), ["api", "PATCH", "/open-apis/im/v1/messages/om_card"]);
  assert.deepEqual(JSON.parse(patchArgs[patchArgs.indexOf("--data") + 1]), {
    content: JSON.stringify(card),
  });
  assert.equal(patchArgs[patchArgs.indexOf("--as") + 1], "bot");

  const delayedArgs = buildLarkCliDelayedCardUpdateArgs("callback-token", card);
  assert.deepEqual(delayedArgs.slice(0, 3), ["api", "POST", "/open-apis/interactive/v1/card/update"]);
  assert.deepEqual(JSON.parse(delayedArgs[delayedArgs.indexOf("--data") + 1]), {
    token: "callback-token",
    card,
  });
});

test("uses file-backed raw API arguments so full cards do not exceed the Windows command line limit", () => {
  const card = buildLarkWorkflowCard({ ...runningSnapshot(), cardVersion: 1 });
  assert.deepEqual(buildLarkWorkflowCardSendBody(target, card, "techcc-card-demo"), {
    receive_id: "oc_demo",
    msg_type: "interactive",
    content: JSON.stringify(card),
    uuid: "techcc-card-demo",
  });

  const sendArgs = buildLarkCliWorkflowCardSendFileArgs("send.json");
  assert.deepEqual(sendArgs.slice(0, 3), ["api", "POST", "/open-apis/im/v1/messages"]);
  assert.equal(sendArgs[sendArgs.indexOf("--params") + 1], JSON.stringify({ receive_id_type: "chat_id" }));
  assert.equal(sendArgs[sendArgs.indexOf("--data") + 1], "@send.json");
  assert.equal(sendArgs.join(" ").includes(JSON.stringify(card)), false);

  const patchArgs = buildLarkCliCardPatchFileArgs("om_card", "patch.json");
  assert.deepEqual(patchArgs.slice(0, 3), ["api", "PATCH", "/open-apis/im/v1/messages/om_card"]);
  assert.equal(patchArgs[patchArgs.indexOf("--data") + 1], "@patch.json");

  const delayedArgs = buildLarkCliDelayedCardUpdateFileArgs("callback.json");
  assert.deepEqual(delayedArgs.slice(0, 3), ["api", "POST", "/open-apis/interactive/v1/card/update"]);
  assert.equal(delayedArgs[delayedArgs.indexOf("--data") + 1], "@callback.json");

  assert.throws(
    () => buildLarkCliWorkflowCardSendFileArgs("D:\\Temp\\send.json"),
    /relative path/i,
  );
});

test("parses nested card send responses and rejects responses without a message id", () => {
  assert.deepEqual(parseLarkWorkflowCardSendResponse(JSON.stringify({
    ok: true,
    data: { message_id: "om_card", chat_id: "oc_demo" },
  })), { messageId: "om_card", chatId: "oc_demo" });
  assert.throws(() => parseLarkWorkflowCardSendResponse('{"ok":true,"data":{}}'), /message_id/);
});

test("normalizes only complete, typed card action callbacks", () => {
  const event = normalizeLarkCardActionEvent({
    type: "card.action.trigger",
    event_id: "evt-1",
    operator_id: "ou_owner",
    message_id: "om_card",
    chat_id: "oc_demo",
    token: "callback-token",
    action_tag: "button",
    action_value: JSON.stringify({
      v: 1,
      action: "stop_task",
      sessionId: "session-1",
      taskId: "task-1",
      cardVersion: 2,
    }),
    timestamp: "1784601000000",
  });

  assert.deepEqual(event?.action, {
    v: 1,
    action: "stop_task",
    sessionId: "session-1",
    taskId: "task-1",
    cardVersion: 2,
  });
  assert.equal(event?.eventId, "evt-1");
  assert.equal(event?.callbackToken, "callback-token");
  assert.equal(normalizeLarkCardActionEvent({
    type: "card.action.trigger",
    event_id: "evt-bad",
    operator_id: "ou_owner",
    message_id: "om_card",
    chat_id: "oc_demo",
    action_tag: "button",
    action_value: "not-json",
  }), null);
  assert.equal(normalizeLarkCardActionEvent({
    type: "card.action.trigger",
    event_id: "evt-bad-2",
    operator_id: "ou_owner",
    message_id: "om_card",
    chat_id: "oc_demo",
    action_tag: "button",
    action_value: JSON.stringify({ v: 1, action: "stop_task", sessionId: "session-1", cardVersion: 2 }),
  }), null);
});

test("coordinator sends once, updates the same message, rejects stale or foreign actions, and deduplicates callbacks", async () => {
  const sent: Array<{ idempotencyKey: string; card: unknown }> = [];
  const updated: Array<{ messageId: string; card: unknown }> = [];
  const coordinator = createLarkWorkflowCardCoordinator({
    send: async (_target, card, idempotencyKey) => {
      sent.push({ card, idempotencyKey });
      return { messageId: "om_card", chatId: "oc_demo" };
    },
    update: async (messageId, card) => {
      updated.push({ messageId, card });
    },
  });

  await coordinator.sync(target, runningSnapshot());
  await coordinator.sync(target, runningSnapshot());
  await coordinator.sync(target, runningSnapshot({
    runs: [{
      id: "session-1:task-1",
      taskId: "task-1",
      workflowRunId: "session-1:task-1",
      workflowName: "TDD implementation",
      status: "completed",
      summary: "测试已经通过",
    }],
  }));

  assert.equal(sent.length, 1);
  assert.match(sent[0].idempotencyKey, /^techcc-card-[a-f0-9]{32}$/);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].messageId, "om_card");
  assert.equal(coordinator.getState("session-1")?.version, 2);

  const current = normalizeLarkCardActionEvent({
    type: "card.action.trigger",
    event_id: "evt-current",
    operator_id: "ou_owner",
    message_id: "om_card",
    chat_id: "oc_demo",
    token: "callback-token",
    action_tag: "button",
    action_value: JSON.stringify({
      v: 1,
      action: "stop_session",
      sessionId: "session-1",
      cardVersion: 2,
    }),
  });
  assert.ok(current);
  assert.deepEqual(coordinator.acceptAction(current), { ok: true });
  assert.deepEqual(coordinator.acceptAction(current), { ok: false, reason: "duplicate" });

  const stale = { ...current, eventId: "evt-stale", action: { ...current.action, cardVersion: 1 } };
  assert.deepEqual(coordinator.acceptAction(stale), { ok: false, reason: "stale" });
  const foreignOperator = { ...current, eventId: "evt-operator", operatorId: "ou_other" };
  assert.deepEqual(coordinator.acceptAction(foreignOperator), { ok: false, reason: "foreign_operator" });
  const foreignMessage = { ...current, eventId: "evt-message", messageId: "om_other" };
  assert.deepEqual(coordinator.acceptAction(foreignMessage), { ok: false, reason: "foreign_message" });
});

test("never downgrades a Lark workflow reply to plain text", async () => {
  let syncCalls = 0;
  assert.equal(await resolveLarkWorkflowReplyDelivery("lark", async () => {
    syncCalls += 1;
    return true;
  }), "workflow_card");
  assert.equal(syncCalls, 1);

  assert.equal(await resolveLarkWorkflowReplyDelivery("lark", async () => false), "skipped");
  assert.equal(await resolveLarkWorkflowReplyDelivery("slack", async () => {
    throw new Error("non-Lark providers must not attempt a card sync");
  }), "text");
});
