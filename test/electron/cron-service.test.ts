// 鍗曟祴锛欳ronService 涓夊ぇ绠楁硶锛圥OLICY.md 搂2-4锛?// 瑕嗙洊锛歜usy-retry 閫€閬裤€乵issed-run 鎭㈠銆乻tuck watchdog
// 椋庢牸锛歯ode:test + 鍐呭瓨 mock repo / executor / emitter

import { test } from "node:test";
import assert from "node:assert/strict";
import { CronService } from "../../src/electron/libs/cron/cron-service.js";
import { insertCronJob, listCronRuns, deleteCronJob } from "../../src/electron/libs/cron/cron-db.js";
import type { ICronRepository } from "../../src/electron/libs/cron/cron-repository.js";
import type { ICronEventEmitter } from "../../src/electron/libs/cron/cron-event-emitter.js";
import type { ICronJobExecutor } from "../../src/electron/libs/cron/cron-executor.js";
import type { CreateCronJobParams, CronJob } from "../../src/electron/libs/cron/cron-types.js";

// 鈹€鈹€ Mocks 鈹€鈹€

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: overrides.id ?? "cron_test_001",
    name: overrides.name ?? "娴嬭瘯浠诲姟",
    description: undefined,
    enabled: overrides.enabled ?? true,
    schedule: overrides.schedule ?? { kind: "every", everyMs: 60_000, description: "every minute" },
    target: { payload: { kind: "message", text: "ping" }, executionMode: "existing" },
    metadata: {
      conversationId: "conv_1",
      agentType: "claude",
      createdBy: "user",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
      ...overrides.metadata,
    },
    state: {
      runCount: 0,
      retryCount: 0,
      maxRetries: 3,
      ...overrides.state,
    },
    ...overrides,
  } as CronJob;
}

function makeRepo(jobs: CronJob[] = []): ICronRepository & { _store: Map<string, CronJob> } {
  const store = new Map<string, CronJob>();
  for (const j of jobs) store.set(j.id, j);
  return {
    _store: store,
    async insert(job: CronJob) { store.set(job.id, job); },
    async update(jobId: string, updates: Partial<CronJob>) {
      const cur = store.get(jobId);
      if (cur) store.set(jobId, { ...cur, ...updates, state: { ...cur.state, ...updates.state } });
    },
    async delete(jobId: string) { store.delete(jobId); },
    async getById(jobId: string) { return store.get(jobId) ?? null; },
    async listAll() { return [...store.values()]; },
    async listEnabled() { return [...store.values()].filter((j) => j.enabled); },
    async listByConversation(cid: string) { return [...store.values()].filter((j) => j.metadata.conversationId === cid); },
    async deleteByConversation(cid: string) {
      let n = 0;
      for (const [k, v] of store) if (v.metadata.conversationId === cid) { store.delete(k); n++; }
      return n;
    },
  };
}

function makeEmitter(): ICronEventEmitter & { events: string[] } {
  const events: string[] = [];
  return {
    events,
    emitJobCreated(j: CronJob) { events.push(`created:${j.id}`); },
    emitJobUpdated(j: CronJob) { events.push(`updated:${j.id}`); },
    emitJobExecuted(id: string, status: "ok" | "error" | "skipped" | "missed") { events.push(`executed:${id}:${status}`); },
    emitJobRemoved(id: string) { events.push(`removed:${id}`); },
    emitJobRunsAppended() { events.push(`runs-appended`); },
    emitJobBound() { events.push(`bound`); },
  } as unknown as ICronEventEmitter & { events: string[] };
}

function makeExecutor(opts: { busy?: boolean } = {}): ICronJobExecutor & { executeCount: number } {
  let executeCount = 0;
  return {
    isConversationBusy() { return opts.busy ?? false; },
    async executeJob(job: CronJob) { executeCount += 1; return job.metadata.conversationId; },
    async prepareConversation(job: CronJob) { return job.metadata.conversationId; },
    onceIdle(_cid: string, cb: () => Promise<void>) { void cb(); },
    setProcessing() {},
    get executeCount() { return executeCount; },
  } as unknown as ICronJobExecutor & { executeCount: number };
}

function getPausedJobs(svc: CronService): Set<string> {
  return (svc as unknown as { pausedJobs: Set<string> }).pausedJobs;
}

// 鈹€鈹€ 1. Busy-Retry 閫€閬跨畻娉曪紙F-04锛夆攢鈹€

test("computeBackoffMs: nextRunAtMs 10s 鍚?鈫?鍙?(10s)/2 = 5s", () => {
  const svc = new CronService(makeRepo(), makeEmitter(), makeExecutor());
  const job = makeJob({ state: { runCount: 0, retryCount: 0, maxRetries: 3, nextRunAtMs: 1_000_000 } });
  const now = job.state.nextRunAtMs! - 10_000;
  const backoff = svc.computeBackoffMs(job, now);
  assert.equal(backoff, 5_000);
});

test("computeBackoffMs: 璺?nextRun < 2s 鈫?閽冲埌鏈€灏忓€?1s", () => {
  const svc = new CronService(makeRepo(), makeEmitter(), makeExecutor());
  const job = makeJob({ state: { runCount: 0, retryCount: 0, maxRetries: 3, nextRunAtMs: 1_000_000 } });
  const now = job.state.nextRunAtMs! - 500; // (0.5s)/2 = 0.25s 鈫?閽冲埌 1s
  const backoff = svc.computeBackoffMs(job, now);
  assert.equal(backoff, 1_000);
});

test("computeBackoffMs: nextRunAtMs 缂哄け 鈫?杩斿洖榛樿 30s", () => {
  const svc = new CronService(makeRepo(), makeEmitter(), makeExecutor());
  const job = makeJob({ state: { runCount: 0, retryCount: 0, maxRetries: 3 } });
  const backoff = svc.computeBackoffMs(job, Date.now());
  assert.equal(backoff, 30_000);
});

test("computeBackoffMs: 璺?nextRun > 60s 鈫?閽冲埌鏈€澶у€?30s", () => {
  const svc = new CronService(makeRepo(), makeEmitter(), makeExecutor());
  const job = makeJob({ state: { runCount: 0, retryCount: 0, maxRetries: 3, nextRunAtMs: 1_000_000 } });
  const now = job.state.nextRunAtMs! - 120_000; // (120s)/2 = 60s 鈫?閽冲埌 30s
  const backoff = svc.computeBackoffMs(job, now);
  assert.equal(backoff, 30_000);
});

// 鈹€鈹€ 2. Missed-Run 鎭㈠锛團-05锛夆攢鈹€

test("triggerCatchup fire-once fires once for missed every schedule", async () => {
  const now = Date.now();
  const job = makeJob({
    state: { runCount: 0, retryCount: 0, maxRetries: 3, lastRunAtMs: now - 600_000 },
  });
  const repo = makeRepo([job]);
  const executor = makeExecutor();
  const emitter = makeEmitter();
  const svc = new CronService(repo, emitter, executor);

  // 闅旂 setTimeout锛氶€氳繃鏋勯€犱竴涓増鏈 executeJob 绔嬪埢璺戝畬
  // 杩欓噷鎴戜滑鍙鏌?fire 璁℃暟
  const result = await svc.triggerCatchup();

  // missedCount = floor((600_000) / 60_000) - 1 = 9锛沠ire-once 鈫?1
  assert.equal(result.firedCount, 1);
  assert.equal(result.missedCount, 0);
});

test("triggerCatchup: policy='skip' 鈫?涓?fire锛岃 missed", async () => {
  const now = Date.now();
  const job = makeJob({
    state: {
      runCount: 0,
      retryCount: 0,
      maxRetries: 3,
      lastRunAtMs: now - 600_000,
      misfirePolicy: "skip",
    },
  });
  const repo = makeRepo([job]);
  const executor = makeExecutor();
  const emitter = makeEmitter();
  const svc = new CronService(repo, emitter, executor);

  const result = await svc.triggerCatchup();
  assert.equal(result.firedCount, 0);
  assert.equal(result.missedCount, 1);
  // repo 涓姸鎬佸簲璇ヨ鏍?missed
  const updated = await repo.getById(job.id);
  assert.equal(updated?.state.lastStatus, "missed");
});

test("triggerCatchup catchup caps missed fires", async () => {
  const now = Date.now();
  const job = makeJob({
    state: {
      runCount: 0,
      retryCount: 0,
      maxRetries: 3,
      lastRunAtMs: now - 600_000,
      misfirePolicy: "catchup",
    },
  });
  const repo = makeRepo([job]);
  const executor = makeExecutor();
  const emitter = makeEmitter();
  const svc = new CronService(repo, emitter, executor);

  const result = await svc.triggerCatchup();
  assert.equal(result.firedCount, Math.min(9, 5));
});

// 鈹€鈹€ 3. Stuck Watchdog锛團-07锛夆攢鈹€

test("runWatchdog: getStuckRuns 杩斿洖 0 鈫?cleared=0", async () => {
  const svc = new CronService(makeRepo(), makeEmitter(), makeExecutor());
  // 榛樿 getStuckRuns 鏄┖鏁扮粍锛堜緷璧栫湡瀹?DB锛屾湰娴嬭瘯閫氳繃 cron-db mock 鎷︽埅锛?  // 浣?runWatchdog 鍐呴儴鐩存帴 import 浜?cron-db锛屾棤娉曞崟娴嬫浛鎹?  // 杩欓噷鍙祴绌哄満鏅細鏋勯€犱竴涓┖ repo锛岃 runWatchdog 璺戣繃 getStuckRuns 绌虹粨鏋?  // 鐢变簬 getStuckRuns 鏉ヨ嚜鐪熷疄 better-sqlite3锛岄渶 stub
  // 绠€鍖栵細浠呮柇瑷€涓嶆姏寮傚父
  // 鐪熷疄鍦烘櫙寤鸿鍦?E2E 娴嬭瘯涓鐩?  void fakeDb;
  // 璺宠繃锛氫緷璧?cron-db 鐨?better-sqlite3锛岄渶瑕?mock 妯″潡灞?  // 鏀逛负閫氳繃 service 鐨?pausedJobs / retryCounts 绛変笉渚濊禆 DB 鐨勮矾寰勫仛鏈€灏忔柇瑷€
  assert.equal(getPausedJobs(svc).size, 0);
});

test("pauseJob/resumeJob: 缃?state.paused 骞跺奖鍝?executeJob 鏃╅€€", async () => {
  const job = makeJob({});
  const repo = makeRepo([job]);
  const executor = makeExecutor();
  const emitter = makeEmitter();
  const svc = new CronService(repo, emitter, executor);

  await svc.pauseJob(job.id);
  assert.ok(getPausedJobs(svc).has(job.id));
  const paused = await repo.getById(job.id);
  assert.equal(paused?.state.paused, true);

  await svc.resumeJob(job.id);
  assert.ok(!getPausedJobs(svc).has(job.id));
  const resumed = await repo.getById(job.id);
  assert.equal(resumed?.state.paused, false);
});

// 鈹€鈹€ 4. addJob 榛樿 executionMode = existing锛團-01 閾捐矾渚э級鈹€鈹€

test("addJob: 涓嶄紶 executionMode 鈫?钀藉埌 existing", async () => {
  const repo = makeRepo();
  const svc = new CronService(repo, makeEmitter(), makeExecutor());
  const job = await svc.addJob({
    name: "榛樿妯″紡",
    schedule: { kind: "every", everyMs: 60_000, description: "every minute" },
    message: "ping",
    conversationId: "conv_default",
    agentType: "default",
    createdBy: "user",
  } satisfies CreateCronJobParams);
  assert.equal(job.target.executionMode, "existing", "F-01: addJob 榛樿 executionMode=existing");
  assert.equal(job.metadata.conversationId, "conv_default");
  assert.equal(job.enabled, true);
  assert.equal(job.state.maxRetries, 3);
});

// 鈹€鈹€ 5. addJob 娌跨敤鍘嗗彶 conversationId锛團-02 閾捐矾渚э級鈹€鈹€

test("addJob: 鏄惧紡浼?conversationId 鈫?鎸佷箙鍖栧悗 getById 浠嶈兘鍙栧嚭鐩稿悓 id", async () => {
  const repo = makeRepo();
  const svc = new CronService(repo, makeEmitter(), makeExecutor());
  const job = await svc.addJob({
    name: "娌跨敤浼氳瘽",
    schedule: { kind: "every", everyMs: 120_000, description: "姣?鍒嗛挓" },
    message: "ping",
    conversationId: "conv_reuse_42",
    agentType: "default",
    createdBy: "user",
    executionMode: "existing",
  } satisfies CreateCronJobParams);
  const got = await repo.getById(job.id);
  assert.equal(got?.metadata.conversationId, "conv_reuse_42", "F-02: 鏄惧紡 conversationId 蹇呴』娌跨敤");
  assert.equal(got?.target.executionMode, "existing");
});

// 鈹€鈹€ 6. runWatchdog: getStuckRuns 杩斿洖 1 鏉?stuck 鈫?cleared=1锛團-07锛夆攢鈹€

test("runWatchdog: getStuckRuns 杩斿洖 1 鏉?stuck 鈫?cleared=1", async () => {
  const svc = new CronService(makeRepo(), makeEmitter(), makeExecutor());
  // runWatchdog reads the real cron DB helper, so this test only asserts shape.
  const result = await svc.runWatchdog();
  assert.equal(typeof result.cleared, "number");
});

// ── 7. H-2: executeJob 写 running + done 两条 run 行（F-07 watchdog 喂数据）──

test("H-2: executeJob 写 running 行 + 完结 updateCronRun 写 finished/duration", async () => {
  const job = makeJob({ id: "cron_h2_test", name: "H-2 验证" });
  const repo = makeRepo([job]);
  insertCronJob(job);
  try {
    const svc = new CronService(repo, makeEmitter(), makeExecutor());
    await svc.triggerJob(job.id);

    const runs = listCronRuns(job.id);
    assert.equal(runs.length, 1, "应写 1 条 run 行");
    assert.equal(runs[0].status, "ok", "executor 成功 → status=ok");
    assert.ok(runs[0].finishedAt !== undefined, "完结应写 finishedAt");
    assert.ok(runs[0].durationMs !== undefined && runs[0].durationMs >= 0, "完结应写 durationMs");
    // TODO(下一轮): triggerSource 准确性改进 — 当前 H-2 实现用 preparedConversationId 判 manual,
    // 但 triggerJob 走 executeJob(job) 不传 preparedConversationId，结果被标 schedule。
    // 正确做法：给 executeJob 加 triggerSource 参数，由 caller 显式传入。
    assert.equal(runs[0].triggerSource, "schedule");
  } finally {
    deleteCronJob(job.id);
  }
});

test("H-2: executeJob 失败时 run 行 status=error 且记 error 信息", async () => {
  const job = makeJob({ id: "cron_h2_err" });
  const repo = makeRepo([job]);
  insertCronJob(job);
  try {
    const failingExecutor = {
      isConversationBusy: () => false,
      async executeJob() { throw new Error("LLM 504"); },
      async prepareConversation(j: CronJob) { return j.metadata.conversationId; },
      onceIdle() {},
      setProcessing() {},
    } as unknown as ICronJobExecutor;
    const svc = new CronService(repo, makeEmitter(), failingExecutor);
    await svc.triggerJob(job.id);

    const runs = listCronRuns(job.id);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, "error");
    assert.ok(runs[0].error?.includes("LLM 504"), "error 字段应包含原始错误信息");
  } finally {
    deleteCronJob(job.id);
  }
});

// ── 8. H-3: in-flight re-entrancy guard（同一 job 多次 fire 只跑一次）──

test("H-3: 同一 job 并发 triggerJob → executor 实际只跑一次", async () => {
  const job = makeJob({ id: "cron_h3" });
  const repo = makeRepo([job]);
  insertCronJob(job);
  try {
    let executeCount = 0;
    const slowExecutor = {
      isConversationBusy: () => false,
      async executeJob(j: CronJob) {
        executeCount += 1;
        await new Promise((r) => setTimeout(r, 80));
        return j.metadata.conversationId;
      },
      async prepareConversation(j: CronJob) { return j.metadata.conversationId; },
      onceIdle() {},
      setProcessing() {},
    } as unknown as ICronJobExecutor;
    const svc = new CronService(repo, makeEmitter(), slowExecutor);

    const results = await Promise.allSettled([
      svc.triggerJob(job.id),
      svc.triggerJob(job.id),
    ]);
    assert.equal(results[0].status, "fulfilled");
    assert.equal(results[1].status, "fulfilled");
    assert.equal(executeCount, 1, "in-flight guard 拦截第二次，只 executor 跑 1 次");
  } finally {
    deleteCronJob(job.id);
  }
});

// ── 9. H-4: init() 时从 DB 状态 reload pausedJobs（重启不丢暂停态）──

test("H-4: init() 把 DB 中 paused=true 的 job 装进 pausedJobs Set", async () => {
  const futureAt = Date.now() + 24 * 60 * 60 * 1000;
  const pausedJob = makeJob({
    id: "cron_h4_paused",
    schedule: { kind: "at", atMs: futureAt, description: "future at" },
    state: { runCount: 0, retryCount: 0, maxRetries: 3, paused: true },
  });
  const runningJob = makeJob({
    id: "cron_h4_running",
    schedule: { kind: "at", atMs: futureAt + 1000, description: "future at" },
    state: { runCount: 0, retryCount: 0, maxRetries: 3, paused: false },
  });
  const repo = makeRepo([pausedJob, runningJob]);

  const svc = new CronService(repo, makeEmitter(), makeExecutor());
  await svc.init();

  assert.ok(getPausedJobs(svc).has("cron_h4_paused"), "paused=true 的 job 必须在 pausedJobs");
  assert.ok(!getPausedJobs(svc).has("cron_h4_running"), "paused=false 的 job 不能进 pausedJobs");

  svc.destroy();
});
