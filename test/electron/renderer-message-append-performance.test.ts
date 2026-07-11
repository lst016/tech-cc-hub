import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import * as appStoreModule from "../../src/ui/store/useAppStore.js";
import type { SessionView } from "../../src/ui/store/useAppStore.js";
import type { StreamMessage } from "../../src/ui/types.js";

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
