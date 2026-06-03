# 定时任务调度策略

> 与 `SPEC.md` / `TASKS.md` 配套；本文件是 cron 模块运行时行为的"宪法"。

---

## 1. 触发模式（executionMode）

| 模式 | 行为 | 适用 |
|---|---|---|
| `existing` | 每次 fire 沿用 `job.metadata.conversationId`，往同一 session 追加 message | 默认；运维日报、状态检查 |
| `new_conversation` | 每次 fire 派生新 session（基于 `templateConversationId`）；隔离 | 多项目并行任务（v1.0 暂未实现） |
| `existing_thread` | 复用 session 但把每次 fire 的输出折叠到 thread ID | 长流程对话（v1.0 暂未实现） |

**默认**：`existing`（F-01 修复后）。

---

## 2. Busy-Retry 退避算法（F-04）

### 旧行为（v0）
- 硬编码 `setTimeout(30000)` 退避，最多 3 次后标 `skipped`
- 缺陷：`everyMs=60_000` 的高频任务会被拖过下个自然周期

### 新行为（v1）
- 退避间隔 = `min(30s, max(1s, (nextRunAtMs - now) / 2))`
- 上限：默认 3 次后标 `skipped`（可由 `state.maxRetries` 覆盖）
- 退避过程中 `state.lastStatus = 'retrying'`
- 退避次数清零触发：成功 / 自然到点 / 用户 disable

### 伪代码
```ts
const backoffMs = Math.min(30_000, Math.max(1_000, (nextRunAtMs - Date.now()) / 2));
```

参考：AWS "Exponential Backoff And Jitter"（去掉 jitter 简化版）。

---

## 3. Missed-Run 恢复策略（F-05）

### 触发时机
- `CronService.init()` 启动时
- `app.on('resume')` 系统唤醒
- 手动 `cron:trigger-catchup` IPC

### 计算公式
对每个 `enabled` 的 `cron` job：
```
missedCount = max(0, floor((now - lastCheckedAt) / expectedInterval)) - 1
```

### Misfire Policy（`state.misfirePolicy`，默认 `fire-once`）

| 策略 | 行为 |
|---|---|
| `fire-once` | 只补一次最近的，下一次按原 schedule |
| `catchup` | 连续补 missedCount 次（限 5 次防爆） |
| `skip` | 不补，记 `missed` 状态 |

### 状态机
```
scheduled → (触发) → running → (完成) → ok / error
                ↓
              skipped（busy 退避超限）
                ↓
              missed（错过未触发）
```

---

## 4. Stuck Job Watchdog（F-07）

- 扫描周期：5 分钟
- 判定条件：`cron_job_runs.status='running'` 且 `now - started_at > 10min`
- 动作：
  1. `updateCronRun(runId, { status: 'missed', finished_at: now, error: '执行超时' })`
  2. `busyGuard.setProcessing(conversationId, false)`
  3. 触发 `emitJobRunsAppended`

---

## 5. Per-Job 并发控制（F-12）

- `state.maxConcurrent` 默认 1
- 实现：`CronBusyGuard` 内部从 `Set<boolean>` 改为 `Map<conversationId, number>` 引用计数
- 上限检查：达到 `maxConcurrent` 时走 busy-retry 路径

---

## 6. Jitter 策略（F-11）

- `CronSchedule.jitterMs?: number`，范围 0-60000
- 触发时刻：在 croner 实际 fire 时间上叠加 `random(0, jitterMs)` 延迟
- 不影响 `nextRunAtMs`（UI 仍展示基准时间）
- 推荐配置：高频任务 `everyMs < 5min` → jitterMs=5000；低频任务无需

---

## 7. 时区策略（F-13）

- `CronSchedule.tz` 必填（默认 `Asia/Shanghai`）
- croner 内部用 IANA tz 名称（"Asia/Shanghai"、"UTC"、"America/New_York"）
- UI 展示：按 `job.schedule.tz` 格式化 `nextRunAtMs` 和 `lastRunAtMs`
- 工具函数：`formatInTimezone(ms, tz): string` 输出 `YYYY-MM-DD HH:mm:ss tz`

---

## 8. 安全策略

| 主体 | 权限 |
|---|---|
| 用户（UI） | create / read / update / pause / resume / delete（自己的任务） |
| Agent（MCP） | create / read / list / **update**（自己的任务）/ delete（自己的任务） |
| Agent 越权 | 删 user 任务 → 拒绝；读 user 任务 → 允许（只读） |
| `conversationId` 注入 | Agent 可指定，但**必须在 `useAppStore.sessions/archivedSessions` 存在**；否则 fallback 到 `__system__` 并 warn |

---

## 9. 性能预算

| 维度 | 预算 |
|---|---|
| 100 enabled job 启动初始化 | < 2s |
| 每 job 内存 | < 5KB（不含历史） |
| 每 1000 cron_job_runs 磁盘 | < 1MB |
| 单 IPC 调用延迟 | < 50ms |
| busy-retry 退避总耗时 | < 90s（3 次 × 30s 上限） |

---

## 10. 错误码 / 状态码

| 状态 | 含义 | 触发 |
|---|---|---|
| `ok` | 成功 | executor 返回成功 |
| `error` | 执行异常 | executor throw |
| `skipped` | 跳过 | busy-retry 超限 / at 模式时间已过 |
| `missed` | 错过 | stuck watchdog / 进程挂掉未触发 |
| `running` | 进行中 | executor.executeJob 进入 |
| `retrying` | 重试中 | busy-retry 退避期间 |

---

## 11. 与其他模块的契约

- `runner/`：executor 通过回调 `sendMessage(convId, text, mode)` 调入，不直接耦合
- `session-store/`：通过 `useAppStore.sessions` 暴露给 UI 选择；`new_conversation` 模式需要从 session-store 派生
- `desktop-notifications/`：成功 / 失败 / 错过触发桌面通知
- `agent-runtime.json`（MCP 注入）：`setCronService(service)` 在 `main.ts:3140`

---

## 12. 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-06-03 | 初版；P0/P1 全部策略；F-01 默认 existing；退避算法；missed-run；stuck watchdog；jitter；maxConcurrent；时区 |
