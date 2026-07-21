import { test } from "node:test";
import assert from "node:assert/strict";
import { CronBusyGuard, CronJobExecutor } from "../../src/electron/libs/cron/cron-executor.js";
import type { CronJob } from "../../src/electron/libs/cron/cron-types.js";

function makeJob(): CronJob {
  return {
    id: "cron_executor_test",
    name: "执行器测试",
    enabled: true,
    schedule: { kind: "every", everyMs: 60_000, description: "每分钟" },
    target: {
      payload: { kind: "message", text: "ping" },
      executionMode: "existing",
    },
    metadata: {
      conversationId: "conversation_test",
      agentType: "default",
      createdBy: "user",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    state: { runCount: 0, retryCount: 0, maxRetries: 3 },
  };
}

test("CronJobExecutor 成功投递后释放内部会话 busy 状态", async () => {
  const guard = new CronBusyGuard();
  const executor = new CronJobExecutor(guard, async () => {});

  await executor.executeJob(makeJob());

  assert.equal(guard.isProcessing("conversation_test"), false);
});

test("CronJobExecutor 投递失败后也释放内部会话 busy 状态", async () => {
  const guard = new CronBusyGuard();
  const executor = new CronJobExecutor(guard, async () => {
    throw new Error("dispatch failed");
  });

  await assert.rejects(executor.executeJob(makeJob()), /dispatch failed/);

  assert.equal(guard.isProcessing("conversation_test"), false);
});

test("CronJobExecutor 同时识别真实运行中的会话", () => {
  const guard = new CronBusyGuard();
  let sessionRunning = true;
  const executor = new CronJobExecutor(guard, undefined, () => sessionRunning);

  assert.equal(executor.isConversationBusy("conversation_test"), true);

  sessionRunning = false;
  assert.equal(executor.isConversationBusy("conversation_test"), false);
});
