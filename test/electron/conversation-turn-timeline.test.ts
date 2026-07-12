import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceConversationTurnPreviewContent,
  buildConversationTurns,
  findActiveConversationTurnIndex,
  shouldShowConversationTurnTimeline,
  getConversationTurnMarkWidth,
  getConversationTurnPreviewOffset,
} from "../../src/ui/utils/conversation-turn-timeline.js";

test("advanceConversationTurnPreviewContent keeps only the latest outgoing turn", () => {
  const initial = { currentIndex: null, previousIndex: null, version: 0 };
  const first = advanceConversationTurnPreviewContent(initial, 1, true);
  const second = advanceConversationTurnPreviewContent(first, 2, true);
  const third = advanceConversationTurnPreviewContent(second, 3, true);

  assert.deepEqual(first, { currentIndex: 1, previousIndex: null, version: 1 });
  assert.deepEqual(second, { currentIndex: 2, previousIndex: 1, version: 2 });
  assert.deepEqual(third, { currentIndex: 3, previousIndex: 2, version: 3 });
  assert.equal(advanceConversationTurnPreviewContent(third, 3, true), third);
  assert.deepEqual(
    advanceConversationTurnPreviewContent(third, 4, false),
    { currentIndex: 4, previousIndex: null, version: 4 },
  );
});

test("getConversationTurnMarkWidth keeps the current turn distinct while hover expands by distance", () => {
  assert.equal(getConversationTurnMarkWidth(1, 1, null), 10);
  assert.equal(getConversationTurnMarkWidth(3, 1, null), 8);

  assert.equal(getConversationTurnMarkWidth(3, 1, 3), 40);
  assert.equal(getConversationTurnMarkWidth(2, 1, 3), 32);
  assert.equal(getConversationTurnMarkWidth(1, 1, 3), 24);
  assert.equal(getConversationTurnMarkWidth(5, 1, 3), 24);
  assert.equal(getConversationTurnMarkWidth(8, 1, 3), 12);
});

test("getConversationTurnPreviewOffset derives the anchor without reading layout", () => {
  const visibleTurnIndexes = [0, 2, 3, 7];

  assert.equal(getConversationTurnPreviewOffset(visibleTurnIndexes, null), null);
  assert.equal(getConversationTurnPreviewOffset(visibleTurnIndexes, 0), 8);
  assert.equal(getConversationTurnPreviewOffset(visibleTurnIndexes, 3), 32);
  assert.equal(getConversationTurnPreviewOffset(visibleTurnIndexes, 8), null);
});

test("buildConversationTurns extracts only user prompts and preserves message anchors", () => {
  const turns = buildConversationTurns([
    { originalIndex: 2, message: { type: "assistant" } },
    {
      originalIndex: 4,
      message: {
        type: "user_prompt",
        prompt: "  第一轮\n\n提问  ",
        capturedAt: 1_000,
      },
    },
    { originalIndex: 5, message: { type: "result" } },
    {
      originalIndex: 8,
      message: {
        type: "user_prompt",
        prompt: "第二轮提问",
        capturedAt: 2_000,
      },
    },
  ]);

  assert.deepEqual(turns, [
    { index: 0, originalIndex: 4, summary: "第一轮 提问", capturedAt: 1_000 },
    { index: 1, originalIndex: 8, summary: "第二轮提问", capturedAt: 2_000 },
  ]);
});

test("buildConversationTurns keeps long prompts compact for accessible labels", () => {
  const [turn] = buildConversationTurns([{
    originalIndex: 9,
    message: {
      type: "user_prompt",
      prompt: "这是一条需要被压缩的用户提问".repeat(8),
    },
  }]);

  assert.ok(turn);
  assert.equal(turn.summary.length, 48);
  assert.match(turn.summary, /…$/);
  assert.equal(turn.capturedAt, undefined);
});

test("buildConversationTurns groups each prompt with its assistant preview and activity labels", () => {
  const turns = buildConversationTurns([
    {
      originalIndex: 1,
      message: {
        type: "user_prompt",
        prompt: "本地 dev 没找到侧边对话",
        capturedAt: 1_000,
        attachments: [{ name: "side-conversation.png" }],
      },
    } as never,
    {
      originalIndex: 2,
      message: {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: " 已修复。原因是侧聊代码之前只在独立工作树中。 " },
            { type: "tool_use", name: "Edit", input: { file_path: "D:/tool/tech-cc-hub/src/ui/App.tsx" } },
          ],
        },
      },
    } as never,
    { originalIndex: 3, message: { type: "user", message: { content: [{ type: "tool_result" }] } } } as never,
    {
      originalIndex: 4,
      message: { type: "user_prompt", prompt: "继续验证点击切换", capturedAt: 2_000 },
    },
    {
      originalIndex: 5,
      message: {
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "第二轮回复" }] },
      },
    } as never,
  ]);

  assert.deepEqual(turns, [
    {
      index: 0,
      originalIndex: 1,
      summary: "本地 dev 没找到侧边对话",
      capturedAt: 1_000,
      assistantSummary: "已修复。原因是侧聊代码之前只在独立工作树中。",
      activityLabels: ["side-conversation.png", "App.tsx"],
      toolCount: 1,
    },
    {
      index: 1,
      originalIndex: 4,
      summary: "继续验证点击切换",
      capturedAt: 2_000,
      assistantSummary: "第二轮回复",
    },
  ]);
});

test("findActiveConversationTurnIndex chooses the latest turn before the viewport center", () => {
  const turnTops = [120, 380, 760, 1_100];

  assert.equal(findActiveConversationTurnIndex(turnTops, 80), 0);
  assert.equal(findActiveConversationTurnIndex(turnTops, 500), 1);
  assert.equal(findActiveConversationTurnIndex(turnTops, 1_400), 3);
  assert.equal(findActiveConversationTurnIndex([], 500), -1);
  assert.equal(
    findActiveConversationTurnIndex([Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, 120, 380, 760], 500),
    3,
  );
});

test("shouldShowConversationTurnTimeline hides when the chat viewport cannot fit the rail", () => {
  assert.equal(shouldShowConversationTurnTimeline(919), false);
  assert.equal(shouldShowConversationTurnTimeline(920), true);
  assert.equal(shouldShowConversationTurnTimeline(1_200), true);
});
