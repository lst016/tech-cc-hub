// 单测：MCP 定时任务工具 (F-01 默认 existing / F-02 兜底 / F-03 update / 安全边界)
// 风格：node:test + 手写 stub（不依赖 sinon）
// 通过 setCronService 注入桩服务，getCronMcpServer().instance['_registeredTools'] 取出 handlers 直接调用

import test from "node:test";
import assert from "node:assert/strict";

import { setCronService, getCronMcpServer, CRON_TOOL_NAMES } from "../../src/electron/libs/mcp-tools/cron.js";
import type { CronService } from "../../src/electron/libs/cron/cron-service.js";
import type { CronJob, CreateCronJobParams } from "../../src/electron/libs/cron/cron-types.js";

type Handler = (
  input: any,
  extra: unknown,
) => Promise<{ isError?: boolean; content: Array<{ type: string; text: string }> }>;

type Stub = {
  calls: Record<string, unknown[][]>;
  impls: Partial<CronService>;
};

function getHandlerMap(): Record<string, { handler: Handler }> {
  const server = getCronMcpServer();
  const inst: any = server.instance;
  const tools = inst._registeredTools as Record<string, { handler: Handler }>;
  if (!tools) throw new Error("McpServer._registeredTools 不可访问，请检查 SDK 版本");
  return tools;
}

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: overrides.id ?? "job_001",
    name: overrides.name ?? "测试任务",
    description: undefined,
    enabled: overrides.enabled ?? true,
    schedule: overrides.schedule ?? { kind: "every", everyMs: 60_000, description: "每分钟" },
    target: overrides.target ?? { payload: { kind: "message", text: "ping" }, executionMode: "existing" },
    metadata: {
      conversationId: "conv_1",
      agentType: "default",
      createdBy: "user",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      ...overrides.metadata,
    },
    state: {
      runCount: 0,
      retryCount: 0,
      maxRetries: 3,
      nextRunAtMs: 1_700_000_060_000,
      ...overrides.state,
    },
    ...overrides,
  } as CronJob;
}

function makeStubService(): Stub {
  const calls: Record<string, unknown[][]> = {
    addJob: [],
    listJobs: [],
    getJob: [],
    updateJob: [],
    removeJob: [],
    pauseJob: [],
    resumeJob: [],
    triggerCatchup: [],
    runWatchdog: [],
  };
  return {
    calls,
    impls: {
      async addJob(params: CreateCronJobParams) {
        calls.addJob.push([params]);
        return makeJob({ id: "job_new", metadata: { ...makeJob().metadata, createdBy: "agent" } });
      },
      async listJobs() {
        calls.listJobs.push([]);
        return [makeJob({ id: "j1" })];
      },
      async getJob(jobId: string) {
        calls.getJob.push([jobId]);
        return null;
      },
      async updateJob(jobId: string, updates: Partial<CronJob>) {
        calls.updateJob.push([jobId, updates]);
        return makeJob({ id: jobId, ...updates });
      },
      async removeJob(jobId: string) {
        calls.removeJob.push([jobId]);
      },
      async pauseJob(jobId: string) {
        calls.pauseJob.push([jobId]);
        return makeJob({ id: jobId, state: { ...makeJob().state, paused: true } });
      },
      async resumeJob(jobId: string) {
        calls.resumeJob.push([jobId]);
        return makeJob({ id: jobId, state: { ...makeJob().state, paused: false } });
      },
      async triggerCatchup() {
        calls.triggerCatchup.push([]);
        return { checkedJob: 0, firedCount: 0, missedCount: 0 };
      },
      async runWatchdog() {
        calls.runWatchdog.push([]);
        return { cleared: 0 };
      },
      computeBackoffMs() {
        return 30_000;
      },
    },
  };
}

function setStub(stub: Stub): void {
  // 注入桩：构造一个最小可用的 CronService 形状
  const service = {
    addJob: async (p: CreateCronJobParams) => stub.impls.addJob!(p),
    listJobs: async (): Promise<CronJob[]> => stub.impls.listJobs!(),
    getJob: async (id: string): Promise<CronJob | null> => stub.impls.getJob!(id),
    updateJob: async (id: string, u: Partial<CronJob>): Promise<CronJob> => stub.impls.updateJob!(id, u),
    removeJob: async (id: string): Promise<void> => stub.impls.removeJob!(id),
    pauseJob: async (id: string): Promise<CronJob> => stub.impls.pauseJob!(id),
    resumeJob: async (id: string): Promise<CronJob> => stub.impls.resumeJob!(id),
    triggerCatchup: async () => stub.impls.triggerCatchup!(),
    runWatchdog: async () => stub.impls.runWatchdog!(),
    computeBackoffMs: () => 30_000,
  };
  setCronService(service as unknown as CronService);
}

test("create_scheduled_task: 不传 executionMode → 落到 existing（F-01）", async () => {
  const stub = makeStubService();
  setStub(stub);

  const tools = getHandlerMap();
  const handler = tools["create_scheduled_task"]?.handler;
  assert.ok(handler, "create_scheduled_task 必须注册");

  const result = await handler(
    {
      name: "新任务",
      scheduleKind: "every",
      everySeconds: 120,
      message: "提醒我",
    },
    {},
  );

  assert.equal(result.isError, false, "工具调用不应返回错误");
  const callArgs = stub.calls.addJob[0] as unknown as [CreateCronJobParams];
  const params = callArgs[0];
  assert.equal(params.executionMode, "existing", "F-01: 默认 executionMode 必须是 existing");
  assert.equal(params.conversationId, "__system__", "未传 conversationId 时落到 __system__");
});

test("create_scheduled_task: 显式传 conversationId → 沿用（F-02 兜底）", async () => {
  const stub = makeStubService();
  setStub(stub);

  const tools = getHandlerMap();
  const handler = tools["create_scheduled_task"]!.handler;
  await handler(
    {
      name: "绑到现有会话",
      scheduleKind: "cron",
      cronExpression: "*/5 * * * *",
      message: "周期提醒",
      conversationId: "conv_existing_42",
      executionMode: "existing",
    },
    {},
  );

  const params = (stub.calls.addJob[0] as unknown as [CreateCronJobParams])[0];
  assert.equal(params.conversationId, "conv_existing_42", "F-02: 显式 conversationId 必须沿用");
  assert.equal(params.executionMode, "existing");
});

test("update_scheduled_task: enabled + message → 调 updateJob（F-03）", async () => {
  const stub = makeStubService();
  setStub(stub);
  // stub getJob 返回 agent 创建的任务
  stub.impls.getJob = async () => makeJob({
    id: "job_update",
    metadata: { ...makeJob().metadata, createdBy: "agent" },
  });

  const tools = getHandlerMap();
  const handler = tools["update_scheduled_task"]!.handler;
  const result = await handler(
    {
      jobId: "job_update",
      enabled: false,
      message: "新提示",
    },
    {},
  );

  assert.equal(result.isError, false);
  assert.equal(stub.calls.updateJob.length, 1, "F-03: update_scheduled_task 必须调 updateJob");
  const [jobId, updates] = stub.calls.updateJob[0] as unknown as [string, Partial<CronJob>];
  assert.equal(jobId, "job_update");
  assert.equal(updates.enabled, false);
  assert.equal(updates.target?.payload.text, "新提示");
});

test("update_scheduled_task: createdBy='user' 的任务 → 拒绝并返回错误（安全边界）", async () => {
  const stub = makeStubService();
  setStub(stub);
  // stub getJob 返回用户创建的任务
  stub.impls.getJob = async () => makeJob({
    id: "job_user",
    metadata: { ...makeJob().metadata, createdBy: "user" },
  });

  const tools = getHandlerMap();
  const handler = tools["update_scheduled_task"]!.handler;
  const result = await handler(
    {
      jobId: "job_user",
      enabled: false,
    },
    {},
  );

  assert.equal(result.isError, true, "用户创建的任务必须返回错误");
  const text = result.content[0]?.text ?? "";
  assert.match(text, /Agent 无权修改/, "错误信息应明确指出 Agent 无权修改");
  assert.equal(stub.calls.updateJob.length, 0, "安全边界：不应调 updateJob");
});

test("list_scheduled_tasks: 调用 listJobs 并返回摘要", async () => {
  const stub = makeStubService();
  setStub(stub);
  stub.impls.listJobs = async () => [
    makeJob({ id: "j1", name: "A" }),
    makeJob({ id: "j2", name: "B", enabled: false }),
  ];

  const tools = getHandlerMap();
  const handler = tools["list_scheduled_tasks"]!.handler;
  const result = await handler({}, {});
  assert.equal(result.isError, false);
  const text = result.content[0]?.text ?? "";
  const parsed = JSON.parse(text);
  assert.equal(parsed.count, 2);
  assert.equal(parsed.jobs[0].id, "j1");
  assert.equal(parsed.jobs[1].enabled, false);
});

test("create_scheduled_task: scheduleKind=at + 过去时间戳 → 仍走 addJob（atMs 已落库）", async () => {
  const stub = makeStubService();
  setStub(stub);
  const futureIso = new Date(Date.now() + 60_000).toISOString();
  const tools = getHandlerMap();
  const handler = tools["create_scheduled_task"]!.handler;
  const result = await handler(
    {
      name: "at-任务",
      scheduleKind: "at",
      atTimestamp: futureIso,
      message: "x",
    },
    {},
  );
  assert.equal(result.isError, false);
  assert.equal(stub.calls.addJob.length, 1);
  const params = (stub.calls.addJob[0] as unknown as [CreateCronJobParams])[0];
  assert.equal(params.schedule.kind, "at");
});

test("CRON_TOOL_NAMES 暴露 4 个工具名", () => {
  assert.deepEqual([...CRON_TOOL_NAMES], [
    "create_scheduled_task",
    "list_scheduled_tasks",
    "update_scheduled_task",
    "delete_scheduled_task",
  ]);
});
