import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildLarkAskUserQuestionAnsweredInput,
  buildLarkAskUserQuestionOptionAnswerInput,
  buildLarkCliCardPatchArgs,
  buildLarkCliCardPatchFileArgs,
  buildLarkCliDelayedCardUpdateArgs,
  buildLarkCliDelayedCardUpdateFileArgs,
  buildLarkCliWorkflowCardSendArgs,
  buildLarkCliWorkflowCardSendFileArgs,
  buildLarkWorkflowCardSendBody,
  buildLarkWorkflowCard,
  createLarkWorkflowCardCoordinator,
  deriveLarkAgentConversationEntries,
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

test("builds a quiet Card 2.0 agent conversation instead of a colored workflow dashboard", () => {
  const card = buildLarkWorkflowCard({ ...runningSnapshot(), cardVersion: 3 });
  const serialized = JSON.stringify(card);

  assert.equal(card.schema, "2.0");
  assert.equal(card.config.update_multi, true);
  assert.equal(card.config.enable_forward, false);
  assert.equal(card.header, undefined);
  assert.equal(card.body.padding, "12px 16px 12px 16px");
  assert.equal(card.body.vertical_spacing, "6px");
  assert.match(serialized, /> 请完成飞书深度交互接入/);
  assert.match(serialized, /执行过程/);
  assert.match(serialized, /正在实现卡片原位更新/);
  assert.match(serialized, /"tag":"collapsible_panel"/);
  assert.match(serialized, /"expanded":false/);
  assert.match(serialized, /正在执行/);
  assert.doesNotMatch(serialized, /当前状态|子任务完成|最近更新|执行进度/);
  assert.doesNotMatch(serialized, /green-50|blue-50|yellow-50/);
  assert.match(serialized, /停止/);
  assert.match(serialized, /"action":"stop_session"/);
  assert.match(serialized, /"sessionId":"session-1"/);
  assert.match(serialized, /"cardVersion":3/);
});

test("renders every part of long requester feedback without dropping the tail", () => {
  const feedback = Array.from({ length: 1_300 }, (_, index) => String(index % 10)).join("");
  const card = buildLarkWorkflowCard({
    ...runningSnapshot({ prompt: feedback, runs: [] }),
    cardVersion: 3,
  });
  const feedbackBlocks = card.body.elements.slice(0, 3) as Array<{ tag?: string; content?: string }>;

  assert.equal(feedbackBlocks.length, 3);
  assert.deepEqual(feedbackBlocks.map((block) => block.tag), ["markdown", "markdown", "markdown"]);
  assert.equal(feedbackBlocks[0]?.content, `> ${feedback.slice(0, 600)}`);
  assert.equal(feedbackBlocks[1]?.content, `> （续 2/3）${feedback.slice(600, 1_200)}`);
  assert.equal(feedbackBlocks[2]?.content, `> （续 3/3）${feedback.slice(1_200)}`);
  assert.ok((feedbackBlocks[2]?.content ?? "").endsWith(feedback.slice(-100)));
});

test("derives the current agent turn as narrative plus one compact tool summary", () => {
  const entries = deriveLarkAgentConversationEntries([
    {
      type: "user_prompt",
      prompt: "补齐构建链路",
      capturedAt: 1,
    },
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "我先确认 Web 产物与桌面端壳体之间的依赖关系。" },
          { type: "tool_use", id: "tool-read", name: "Read", input: { file_path: "package.json" } },
          { type: "tool_use", id: "tool-bash", name: "Bash", input: { command: "npm run build" } },
        ],
      },
    },
    {
      type: "user",
      message: {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "tool-read", content: "ok" },
          { type: "tool_result", tool_use_id: "tool-bash", content: "failed", is_error: true },
        ],
      },
    },
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "问题在产物交接，我继续修复。" }],
      },
    },
  ] as never[], "running");

  assert.deepEqual(entries, [
    {
      id: "assistant-1-0",
      kind: "assistant",
      text: "我先确认 Web 产物与桌面端壳体之间的依赖关系。",
    },
    {
      id: "assistant-3-0",
      kind: "assistant",
      text: "问题在产物交接，我继续修复。",
    },
    {
      id: "tools-1",
      kind: "tools",
      title: "运行 1 条命令，读取 1 个文件",
      detail: "• 读取文件：package.json\n• 运行命令：npm run build",
      status: "error",
    },
  ]);
});

test("keeps the Lark question bridge out of the execution activity summary", () => {
  const entries = deriveLarkAgentConversationEntries([
    {
      type: "assistant",
      message: {
        content: [{
          type: "tool_use",
          id: "ask-bridge-1",
          name: "mcp__tech-cc-hub-lark__ask_user_question",
          input: { questions: [{ question: "项目在哪里？" }] },
        }],
      },
    } as never,
  ], "running");

  assert.deepEqual(entries, []);
});

test("compresses repeated tool updates into one collapsed activity panel", () => {
  const conversation = deriveLarkAgentConversationEntries([
    { type: "user_prompt", prompt: "继续修复", capturedAt: 1 },
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "tool_use", id: "read-1", name: "Read", input: { file_path: "C:\\Users\\demo\\AppData\\Local\\Temp\\tasks\\result.output" } },
          { type: "tool_use", id: "read-2", name: "Read", input: { file_path: "package.json" } },
          { type: "tool_use", id: "bash-1", name: "Bash", input: { command: "npm run build" } },
          { type: "tool_use", id: "bash-2", name: "Bash", input: { command: "npm test" } },
        ],
      },
    },
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "tool_use", id: "search-1", name: "ToolSearch", input: { query: "lark card" } },
          { type: "tool_use", id: "task-1", name: "TaskOutput", input: { task_id: "task-1" } },
          { type: "tool_use", id: "plan-1", name: "mcp__tech-cc-hub-plan__update_plan", input: {} },
        ],
      },
    },
  ] as never[], "running");
  const card = buildLarkWorkflowCard({
    ...runningSnapshot({ runs: [], conversation }),
    cardVersion: 3,
  });
  const serialized = JSON.stringify(card);

  assert.equal(serialized.match(/"tag":"collapsible_panel"/g)?.length, 1);
  assert.match(serialized, /执行过程 · 运行 2 条命令，读取 2 个文件，搜索 1 次，其他 2 项/);
  assert.match(serialized, /"expanded":false/);
  assert.match(serialized, /读取任务结果：task-1/);
  assert.match(serialized, /更新计划/);
  assert.match(serialized, /…\/tasks\/result\.output/);
  assert.doesNotMatch(serialized, /Users\\\\demo\\\\AppData/);
});

test("keeps long agent conversations below the Feishu card payload limit", () => {
  const card = buildLarkWorkflowCard({
    ...runningSnapshot({
      runs: [],
      conversation: Array.from({ length: 20 }, (_, index) => ({
        id: `assistant-${index}`,
        kind: "assistant" as const,
        text: `${index} ${"长内容".repeat(1_500)}`,
      })),
    }),
    cardVersion: 3,
  });

  assert.ok(Buffer.byteLength(JSON.stringify(card), "utf8") < 30_000);
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

  assert.equal(card.header, undefined);
  assert.match(serialized, /等待确认/);
  assert.match(serialized, /Bash/);
  assert.doesNotMatch(serialized, /secret-token-must-not-render/);
  assert.doesNotMatch(serialized, /yellow-50/);
  assert.match(serialized, /"action":"permission_allow"/);
  assert.match(serialized, /"action":"permission_deny"/);
  assert.match(serialized, /"toolUseId":"tool-1"/);
});

test("renders AskUserQuestion as answer buttons instead of a generic permission prompt", () => {
  const card = buildLarkWorkflowCard({
    ...runningSnapshot({
      permission: {
        toolUseId: "ask-1",
        toolName: "AskUserQuestion",
        input: {
          questions: [{
            header: "发布方式",
            question: "这次要怎么发布？",
            options: [
              { label: "直接发布", description: "构建后推送正式版本" },
              { label: "仅打包", description: "先生成安装包检查" },
            ],
          }],
        },
      },
    }),
    cardVersion: 5,
  });
  const serialized = JSON.stringify(card);

  assert.match(serialized, /请回答以下问题/);
  assert.match(serialized, /这次要怎么发布/);
  assert.match(serialized, /直接发布/);
  assert.match(serialized, /仅打包/);
  assert.match(serialized, /"action":"question_answer"/);
  assert.match(serialized, /"answer":"直接发布"/);
  assert.doesNotMatch(serialized, /"action":"permission_allow"/);
  assert.doesNotMatch(serialized, /工具 \*\*AskUserQuestion\*\*/);

  const action = normalizeLarkCardActionEvent({
    type: "card.action.trigger",
    event_id: "evt-answer",
    operator_id: "ou_owner",
    message_id: "om_card",
    chat_id: "oc_demo",
    token: "callback-token",
    action_tag: "button",
    action_value: JSON.stringify({
      v: 1,
      action: "question_answer",
      sessionId: "session-1",
      cardVersion: 5,
      toolUseId: "ask-1",
      answer: "直接发布",
    }),
  });
  assert.equal(action?.action.action, "question_answer");
  assert.equal(action?.action.answer, "直接发布");

  assert.deepEqual(buildLarkAskUserQuestionAnsweredInput({
    questions: [
      { question: "发布渠道？" },
      { question: "版本说明？" },
    ],
  }, "1. 飞书\n2. 修复 AskUserQuestion"), {
    questions: [
      { question: "发布渠道？" },
      { question: "版本说明？" },
    ],
    answers: {
      "发布渠道？": "飞书",
      "版本说明？": "修复 AskUserQuestion",
    },
  });
  assert.deepEqual(buildLarkAskUserQuestionOptionAnswerInput({
    questions: [{
      question: "这次要怎么发布？",
      options: [{ label: "直接发布" }, { label: "仅打包" }],
    }],
  }, "仅打包"), {
    questions: [{
      question: "这次要怎么发布？",
      options: [{ label: "直接发布" }, { label: "仅打包" }],
    }],
    answers: { "这次要怎么发布？": "仅打包" },
  });
  assert.equal(buildLarkAskUserQuestionOptionAnswerInput({
    questions: [{ question: "这次要怎么发布？", options: [{ label: "直接发布" }] }],
  }, "伪造选项"), null);

  const freeformCard = buildLarkWorkflowCard({
    ...runningSnapshot({
      permission: {
        toolUseId: "ask-freeform",
        toolName: "AskUserQuestion",
        input: { questions: [{ question: "请输入版本说明" }] },
      },
    }),
    cardVersion: 6,
  });
  const freeformJson = JSON.stringify(freeformCard);
  assert.match(freeformJson, /请直接回复这条飞书消息/);
  assert.match(freeformJson, /"action":"permission_deny"/);
});

test("routes a Lark text reply into the pending AskUserQuestion permission", () => {
  const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");
  assert.match(source, /activeSession = store\.getSession\(existingSession\.id\)/);
  assert.match(source, /pendingQuestion = \[\.\.\.\(activeSession\?\.pendingPermissions\.values\(\) \?\? \[\]\)\]/);
  assert.match(source, /buildLarkAskUserQuestionAnsweredInput\(pendingQuestion\.input, text\)/);
  assert.match(source, /type: "permission\.response"[\s\S]*toolUseId: pendingQuestion\.toolUseId[\s\S]*updatedInput/);
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
  assert.equal(failed.header, undefined);
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
  assert.equal(completed.header, undefined);
  assert.match(completedJson, /已完成并通过全部测试/);
  assert.match(completedJson, /https:\/\/example\.com\/delivery/);
  assert.doesNotMatch(completedJson, /交付摘要|green-50/);
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

test("coordinator starts a fresh bottom card for each inbound Lark message in the same session", async () => {
  const sent: Array<{ idempotencyKey: string; card: unknown }> = [];
  const updated: Array<{ messageId: string; card: unknown }> = [];
  const coordinator = createLarkWorkflowCardCoordinator({
    send: async (_target, card, idempotencyKey) => {
      sent.push({ card, idempotencyKey });
      return { messageId: `om_card_${sent.length}`, chatId: "oc_demo" };
    },
    update: async (messageId, card) => {
      updated.push({ messageId, card });
    },
  });
  const firstQuestion = { ...target, externalMessageId: "om_question_1" };
  const secondQuestion = { ...target, externalMessageId: "om_question_2" };

  await coordinator.sync(firstQuestion, runningSnapshot({ prompt: "first question" }));
  await coordinator.sync(secondQuestion, runningSnapshot({ prompt: "second question" }));

  assert.equal(sent.length, 2);
  assert.notEqual(sent[0]?.idempotencyKey, sent[1]?.idempotencyKey);
  assert.equal(coordinator.getState("session-1")?.messageId, "om_card_2");
  assert.equal(updated.length, 1);
  assert.equal(updated[0]?.messageId, "om_card_1");
  assert.doesNotMatch(JSON.stringify(updated[0]?.card), /正在处理|stop_session/);

  await coordinator.sync(secondQuestion, runningSnapshot({
    prompt: "second question",
    assistantSummary: "second answer",
  }));
  assert.equal(sent.length, 2);
  assert.equal(updated.at(-1)?.messageId, "om_card_2");
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
