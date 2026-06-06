# 定时任务实施任务分解

> 与 `SPEC.md` 配套；本文件用于工作流编排与 Agent 分工。
> 单轮 ≤3 文件写入上限；Phase 间不合并。

---

## Phase 0: 准备（已完成 ✅）

- [x] 阅读现状并打分（7.0/10）
- [x] 写 SPEC.md / TASKS.md / POLICY.md
- [x] 拉用户授权

---

## Phase A: P0 必修（核心正确性 + 复用会话）· 共 ~3 天

### A1 后端 schema + 持久化（半天）

- **任务**：新增 `cron_job_runs` 表 + CRUD + 索引 + `CronJobRun` 类型
- **文件**（≤3）：
  - `src/types/cron.ts` —— 新增 `CronJobRun` 类型
  - `src/electron/libs/cron/cron-db.ts` —— 表迁移 + `insertCronRun` / `listCronRuns` / `updateCronRun` / `getStuckRuns`
- **验收**：`getCronDb()` 启动后表存在；`insertCronRun` roundtrip 通过

### A2 后端调度主控（一天）

- **任务**：busy-retry 退避算法 / missed-run 恢复 / stuck watchdog / pause-resume
- **文件**（≤3）：
  - `src/electron/libs/cron/cron-service.ts` —— 三个算法 + 新方法
  - `src/electron/libs/cron/cron-types.ts` —— `state.misfirePolicy` / `state.maxConcurrent` 字段
  - `test/electron/cron-service.test.ts`（新建）—— 退避/missed-run/stuck 各 2 case
- **验收**：9 个 case 全绿；tsc 通过

### A3 MCP 工具 + IPC 扩展（半天）

- **任务**：默认 `existing` / `update_scheduled_task` / IPC 新增 5 个 channel
- **文件**（≤3）：
  - `src/electron/libs/mcp-tools/cron.ts` —— 默认改 existing + update handler
  - `src/electron/libs/cron/cron-ipc-handlers.ts` —— 新增 pause/resume/bind-conversation/list-runs/trigger-catchup
  - `src/electron/libs/cron/cron-event-emitter.ts` —— 新增 `emitJobRunsAppended` / `emitJobBound`
- **验收**：6 个 MCP/IPC handler 注册；EventEmitter 编译通过

### A4 前端 UI（一天）

- **任务**：「绑到当前会话」按钮 + 「选已有工作区」下拉 + `bindConversation` / `pauseJob` / `resumeJob` action
- **文件**（≤3）：
  - `src/ui/components/cron/CreateTaskDialog.tsx` —— 「选已有工作区」下拉
  - `src/ui/components/cron/ScheduledTasksPage.tsx` —— 「绑到当前会话」按钮 + pause/resume
  - `src/ui/pages/cron/useCronJobs.ts` —— `bindConversation` / `pauseJob` / `resumeJob` action
- **验收**：UI 可用；tsc 通过

### A5 单测补齐（半天）

- **任务**：F-01/F-02/F-03/F-04/F-05/F-07 + DB roundtrip 共 18+ case
- **文件**（≤3）：
  - `test/electron/cron-db.test.ts`（新建）—— roundtrip 3 + cron_job_runs 3
  - `test/electron/mcp-cron.test.ts`（新建）—— create/update/list 3
  - `test/electron/cron-service.test.ts`（A2 已建，继续补）—— 凑齐
- **验收**：`npm run test:electron` 全绿

### A6 集成验证（半天）

- **任务**：`npx tsc --noEmit` + `npm run qa:smoke` + 真窗口手动跑通 F-01/F-08/F-09
- **文件**：无
- **验收**：类型零错；QA 截图存到 `scripts/qa/artifacts/`

---

## Phase B: P1 推荐（生产可靠性增强）· 共 ~2 天

### B1 调度表达力增强（一天）

- **任务**：jitter / maxConcurrent / 时区显式化 / 预览未来 5 次
- **文件**（≤3）：
  - `src/electron/libs/cron/cron-service.ts` + `cron-types.ts` —— jitter 与 semaphore
  - `src/ui/pages/cron/cronUtils.ts` + `ScheduledTasksPage.tsx` —— 时区与 nextRuns
  - `test/electron/cron-service.test.ts` —— jitter 与 semaphore 单测

### B2 集成新模式 `existing_thread`（半天）

- **任务**：thread ID 折叠
- **文件**（≤3）：
  - `src/types/cron.ts` + `cron-executor.ts` —— thread 字段
  - `src/ui/components/cron/CronStatusTag.tsx` —— thread 折叠展示

### B3 单测补齐（半天）

- **任务**：jitter / missed-run / DB roundtrip 8 case
- **文件**（≤3）：
  - 增量补到 `cron-service.test.ts` / `cron-db.test.ts` / 新建 `cron-executor.test.ts`

---

## Phase C: P2 增强（看真实诉求）· 共 ~1 周

### C1 new_conversation 真正实现（2 天）

- **任务**：templateConversationId 派生新 session
- **文件**：session-store.ts + cron-executor.ts + UI

### C2 session 生命周期联动（1 天）

- **任务**：session 删除/归档时降级
- **文件**：session-store.ts + useAppStore.ts + cron-event-emitter.ts

### C3 i18n / 导入导出 / 预览（3 天）

- **任务**：t() 抽离 / .ics 互转 / 5 次 nextRuns
- **文件**：i18n config + cronUtils.ts + UI

---

## 任务依赖图

```
A1 (DB) ─┬─→ A2 (Service) ─┬─→ A3 (MCP/IPC) ─┬─→ A6 (集成)
         │                  │                  │
         └─→ A5 (Test) ─────┴─→ A4 (UI) ───────┘
```

- A1 必须最先（其他都依赖 cron_job_runs 表）
- A2 / A3 / A4 可并行
- A5 / A6 串行收尾

---

## 验收关卡

| 关卡 | 通过条件 |
|---|---|
| Type check | `npx tsc --noEmit` 零错 |
| Unit test | `npm run test:electron` 全绿，≥18 case |
| Smoke QA | `npm run qa:smoke` 5/5 |
| Window QA | 真窗口手动跑通 F-01/F-08/F-09 并截图 |
| Build | `npm run build` 成功 |
| Lint | `npx eslint src` 零 error |

---

## 风险登记

| 风险 | 影响 | 缓解 |
|---|---|---|
| croner 库 API 变更 | 中 | 锁定版本；A1 先确认 |
| SQLite ALTER TABLE 兼容性 | 低 | 现有表结构不动，只新增 |
| Electron 主进程 IPC 大量新增 | 中 | 复用现有 event bus 模式 |
| 会话删除导致 job 失效 | 中 | F-17 session 生命周期联动（C2） |
| 单测对 croner 真实时间依赖 | 中 | 用 sinon fake timer |
