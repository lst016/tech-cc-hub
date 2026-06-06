# 定时任务（Cron）全量 Spec

> 版本：v1.0 · 起草日期：2026-06-03 · 状态：待评审 → 待实施
>
> 来源：以 AionUi CronService.ts / CronStore.ts 为骨架的现有实现（`src/electron/libs/cron/`）
> 适配本项目（tech-cc-hub：Electron + React + Claude Agent SDK）。

---

## 1. 背景与现状

### 1.1 已有实现盘点

| 模块 | 文件 | 行数 | 评估 |
|---|---|---|---|
| 类型 | `cron-types.ts` | 36 | ✅ 干净 |
| 持久化 | `cron-db.ts` | 240 | ⚠️ 单条状态，无历史表 |
| 仓储 | `cron-repository.ts` | 60 | ✅ 接口清晰 |
| 调度主控 | `cron-service.ts` | 336 | ⚠️ 30s 硬退避 / 缺 missed-run |
| 执行器 | `cron-executor.ts` | 155 | ✅ BusyGuard 思路对 |
| 事件桥 | `cron-event-emitter.ts` | 12 | ✅ |
| IPC | `cron-ipc-handlers.ts` | 65 | ⚠️ 缺 trigger / pause / resume |
| MCP 工具 | `mcp-tools/cron.ts` | 216 | ⚠️ 默认 new_conversation，缺 update/pause |
| UI 列表 | `ScheduledTasksPage.tsx` | 297 | ✅ 有 workspace 联动 |
| UI 创建 | `CreateTaskDialog.tsx` | 447 | ✅ |

### 1.2 当前综合评分：**7.0 / 10**

- 架构清晰度 8.5 / 调度能力 7.0 / 持久化 6.0 / 重试 5.5 / 观测 5.5 / 安全 7.0

### 1.3 三大痛点

1. **复用会话**：链路里 `executionMode` 字段是通的，但 MCP 工具默认 `new_conversation`，且后端没有 `new_conversation` 派生新 session 的实现，"复用"事实上未跑通。
2. **可靠性**：30s 硬退避、缺 missed-run 恢复、缺执行历史表、缺 stuck job watchdog。
3. **可观测性**：只有 `lastStatus/lastError` 单条状态，无耗时/token/历史曲线。

---

## 2. 目标

### 2.1 业务目标

1. **复用会话成为默认体感**：用户在 UI 和 Agent 入口创建的定时任务，默认沿用同一会话上下文，多次触发共享历史。
2. **跨 job 共享 session**：用户能把多个任务绑到同一条「运维日报」会话里。
3. **崩溃后不丢触发**：应用崩溃 / 唤醒时自动补跑错过的触发。
4. **生产级可观测**：每次执行有完整历史、耗时、token、错误堆栈。

### 2.2 技术目标

- 不破坏现有 CV 来源（保留 AionUi 适配痕迹）。
- P0 改动控制在 ≤10 个文件。
- 保持 TypeScript 严格模式 + React 19 函数组件风格 + Tailwind v4。
- 每次改动后跑 `npx tsc --noEmit` 验证。

---

## 3. 功能需求（按优先级）

### 3.1 P0 必修

| ID | 需求 | 验收 |
|---|---|---|
| F-01 | MCP 工具默认 `existing` 模式 | Agent 不传 executionMode 时落到 existing |
| F-02 | conversationId 兜底沿用历史 | Agent 不传时自动用 `job.metadata.conversationId` |
| F-03 | MCP `update_scheduled_task` 工具 | 支持改 `enabled` / `executionMode` / `message` / `schedule` |
| F-04 | busy-retry 退避算法 | 不用 30s 硬编码，按 `min(30s, max(1s, (nextRunAtMs - now)/2))` |
| F-05 | missed-run 恢复 | 启动时 / 唤醒时扫描 `nextRunAtMs` 追补（misfire policy: fire-once 默认） |
| F-06 | `cron_job_runs` 历史表 | 记录每次执行的 started_at / finished_at / status / error / duration_ms / tokens |
| F-07 | stuck job watchdog | `state.lastStatus='running'` 超过 10min 自动标 missed |
| F-08 | UI 「绑到当前会话」按钮 | 一键把 job 绑到当前 active session |
| F-09 | UI 「选已有工作区」下拉 | 创建任务时可选已存在的 session 作为目标 |
| F-10 | F-01/F-02/F-03 单元测试 | 至少 6 个 case 覆盖 |

### 3.2 P1 推荐

| ID | 需求 | 验收 |
|---|---|---|
| F-11 | jitter 支持 | `CronSchedule.jitterMs?` 字段，0-60s 随机抖动 |
| F-12 | per-job 并发上限 | `state.maxConcurrent` 字段，默认 1 |
| F-13 | 时区显式化 | UI 列表按 job.tz 格式化 nextRunAtMs |
| F-14 | 触发模式 `existing_thread` | 把多次 fire 折叠到同一 thread ID（UI 折叠展示） |
| F-15 | 5 个 P0 之外的单测 | 覆盖 busy-retry 退避 / missed-run / DB roundtrip |

### 3.3 P2 增强

| ID | 需求 | 验收 |
|---|---|---|
| F-16 | `new_conversation` 真正实现 | 基于 templateConversationId 派生新 session |
| F-17 | session 生命周期联动 | 绑定的 session 删/归档时弹提示 + 自动 fallback |
| F-18 | i18n 抽离 | cron-service.ts 中文 hardcode 走 t() |
| F-19 | 导入/导出 .ics | 用户可从外部日历导入或导出 |
| F-20 | 预览未来 5 次 | UI 用 `cron.nextRuns(5)` 展示 |

---

## 4. 数据模型改动

### 4.1 现有 `cron_jobs` 表（不变）

参考 `cron-db.ts:27-52`，字段保持。

### 4.2 新增 `cron_job_runs` 表

```sql
CREATE TABLE cron_job_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL,            -- 'running' | 'ok' | 'error' | 'skipped' | 'missed'
  error TEXT,
  duration_ms INTEGER,
  tokens_in INTEGER,
  tokens_out INTEGER,
  conversation_id TEXT,            -- 本次执行实际写入的会话 ID
  trigger_source TEXT,             -- 'schedule' | 'manual' | 'catchup'
  FOREIGN KEY (job_id) REFERENCES cron_jobs(id) ON DELETE CASCADE
);
CREATE INDEX idx_cron_runs_job ON cron_job_runs(job_id, started_at DESC);
CREATE INDEX idx_cron_runs_status ON cron_job_runs(status, started_at);
```

### 4.3 `CronSchedule` 新增可选字段

```ts
type CronSchedule =
  | { kind: "cron"; expr: string; tz?: string; description: string; jitterMs?: number }
  | { kind: "every"; everyMs: number; description: string; jitterMs?: number }
  | { kind: "at"; atMs: number; description: string };
```

`jitterMs` 加在 `cron` 和 `every` 上；`at` 是一次性，无需 jitter。

### 4.4 `CronJob.metadata` 新增 `templateConversationId`

可选。`executionMode="new_conversation"` 时从该 template 派生新 session。

### 4.5 `CronJob.state` 新增字段

- `maxConcurrent: number`（默认 1）
- `misfirePolicy: "fire-once" | "catchup" | "skip"`（默认 `fire-once`）

---

## 5. API 改动

### 5.1 IPC 新增

| Channel | 入参 | 出参 | 说明 |
|---|---|---|---|
| `cron:pause-job` | `{ jobId }` | `CronJob` | 暂停（保留 timer 但不触发） |
| `cron:resume-job` | `{ jobId }` | `CronJob` | 恢复 |
| `cron:bind-conversation` | `{ jobId, conversationId, conversationTitle? }` | `CronJob` | 绑定到指定会话 |
| `cron:list-runs` | `{ jobId, limit? }` | `CronJobRun[]` | 查历史执行 |
| `cron:trigger-catchup` | `{ jobId }` | `{ triggered: number }` | 手动触发 missed-run 追补 |

### 5.2 MCP 工具新增 / 修改

| 工具 | 改动 |
|---|---|
| `create_scheduled_task` | **默认 executionMode 改 `"existing"`**；新增 `templateConversationId?` / `jitterMs?` / `misfirePolicy?` |
| `update_scheduled_task` | **新增**；支持改 `enabled` / `executionMode` / `message` / `schedule` / `jitterMs` / `misfirePolicy` |
| `list_scheduled_tasks` | 返回新增 `nextRuns?: number[]`（未来 5 次） |
| `delete_scheduled_task` | 不变 |

### 5.3 EventEmitter 新增

```ts
emitJobRunsAppended(jobId: string, runs: CronJobRun[]): void;
emitJobBound(jobId: string, conversationId: string): void;
```

---

## 6. 模块改动清单

### 6.1 后端

| 文件 | 改动 |
|---|---|
| `cron-types.ts` | 新增 `CronJobRun` 类型 |
| `cron-db.ts` | 新增 `cron_job_runs` 表 + CRUD；schedule 支持 `jitterMs` |
| `cron-service.ts` | busy-retry 退避算法；missed-run 恢复；stuck watchdog；pause/resume |
| `cron-executor.ts` | `CronJobExecutor.executeJob` 每次写 `cron_job_runs`；支持 maxConcurrent semaphore |
| `cron-event-emitter.ts` | 新增 `emitJobRunsAppended` / `emitJobBound` |
| `cron-ipc-handlers.ts` | 新增 5 个 IPC handler |
| `mcp-tools/cron.ts` | 默认 `existing`；新增 `update_scheduled_task`；增 `jitterMs` / `misfirePolicy` |

### 6.2 前端

| 文件 | 改动 |
|---|---|
| `CreateTaskDialog.tsx` | 「选已有工作区」下拉；「绑到当前会话」按钮 |
| `ScheduledTasksPage.tsx` | 「绑到当前会话」按钮；时区显式化；预览未来 5 次 |
| `useCronJobs.ts` | 新增 `bindConversation` / `pauseJob` / `resumeJob` action |
| `cronUtils.ts` | 新增 `formatNextRuns(job, n)` / `formatInTimezone(ms, tz)` |

### 6.3 测试

| 文件 | 内容 |
|---|---|
| `test/electron/cron-service.test.ts` | busy-retry 退避 / missed-run 恢复 / stuck watchdog / 3 case × 4 |
| `test/electron/cron-db.test.ts` | Row↔Job roundtrip / cron_job_runs CRUD / 3 case × 3 |
| `test/electron/mcp-cron.test.ts` | create / update / list / security boundary / 3 case × 3 |

### 6.4 文档

| 文件 | 内容 |
|---|---|
| `doc/40-product/cron/POLICY.md` | 调度策略（退避/missed-run/并发/jitter/时区） |
| `doc/40-product/cron/TASKS.md` | 实施分解 |

---

## 7. 验收标准

### 7.1 单元测试

- F-01/F-02/F-03 各 3 case（共 9）
- F-04/F-05/F-07 各 2 case（共 6）
- DB roundtrip 3 case
- 总数 ≥ 18 case 全绿

### 7.2 Electron 真窗口 QA

- 创建任务 → 选「绑到当前会话」→ 1 分钟后手动触发 → 验证同 session 内追加 message
- 关闭应用 5 分钟 → 重开 → 验证 missed-run 追补
- 同 conversationId 上并发触发 2 次 → 验证 busy-retry 退避不撞期
- kill 模拟 9:00 时段 → 验证 30s 退避后正确进入下个周期

### 7.3 类型验证

- `npx tsc --noEmit` 零错误
- 现有 22 个 cron 相关单测不回归

---

## 8. 非功能需求

- **性能**：100 个 enabled job 启动时，初始化耗时 < 2s
- **内存**：每 job 内存占用 < 5KB（不含历史）
- **磁盘**：每 1000 条 cron_job_runs < 1MB
- **并发**：单会话 maxConcurrent=1 默认；可配置
- **告警**：连续 3 次 error 自动桌面通知

---

## 9. 上游 CV 来源

- 调度表达力与三模式：CV from AionUi CronService.ts
- BusyGuard：CV from AionUi CronBusyGuard.ts
- 持久化：CV from AionUi CronStore.ts
- IPC 桥：CV from AionUi cronBridge.ts
- croner 库：https://www.npmjs.com/package/croner
- 退避算法参考：AWS Architecture Blog "Exponential Backoff And Jitter"
- Missed-run 策略：Quartz Scheduler Misfire Policy

---

## 10. 范围外（v1.0 不做）

- 分布式调度（多实例协调）
- Web UI（v1.0 仅 Electron）
- Webhook / HTTP 触发器
- 任务依赖（DAG）
- 优先级队列
