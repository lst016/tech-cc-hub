# AionUi 调研报告 - Cron 调度模块

**模块**: `src/process/services/cron/`
**调研时间**: 2026-05-01

---

## 一、模块结构

```
cron/
├── CronBusyGuard.ts           # 并发保护
├── CronService.ts            # 调度引擎核心
├── CronStore.ts              # 状态定义
├── ICronEventEmitter.ts      # 事件发射器接口
├── ICronJobExecutor.ts       # 任务执行器接口
├── ICronRepository.ts        # 数据仓库接口
├── IpcCronEventEmitter.ts   # IPC 事件发射器实现
├── SkillSuggestWatcher.ts   # 技能建议监控
├── SqliteCronRepository.ts  # SQLite 存储实现
├── WorkerTaskManagerJobExecutor.ts  # Worker 执行器
├── cronServiceSingleton.ts  # 单例
└── cronSkillFile.ts         # Skill 文件管理
```

---

## 二、核心类型定义

### 2.1 CronStore.ts

```typescript
// 调度表达式类型
export type CronSchedule = string;

// CronJob 定义
export interface CronJob {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule: CronSchedule;
  target: {
    prompt?: string;    // 新 UI 系统使用
    message?: string;   // 旧技能系统使用
    conversationId: string;
    executionMode?: 'existing' | 'new_conversation';
  };
  metadata: {
    conversationId: string;
    conversationTitle?: string;
    agentType: AgentBackend;
    agentConfig?: Record<string, unknown>;
    createdBy: 'user' | 'agent';
    createdAt: string;
    updatedAt: string;
  };
  lastExecutedAt?: string;
  nextExecuteAt?: string;
  nextExecuteError?: string;
}

// 创建任务参数
export type CreateCronJobParams = {
  name: string;
  description?: string;
  schedule: CronSchedule;
  prompt?: string;
  message?: string;
  conversationId: string;
  conversationTitle?: string;
  agentType: AgentBackend;
  createdBy: 'user' | 'agent';
  executionMode?: 'existing' | 'new_conversation';
  agentConfig?: CronJob['metadata']['agentConfig'];
};
```

---

## 三、核心服务 CronService

### 3.1 构造函数

```typescript
export class CronService {
  private timers: Map<string, Cron | NodeJS.Timeout> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private retryCounts: Map<string, number> = new Map();
  private initialized = false;
  private powerSaveBlockerId: number | null = null;

  constructor(
    private readonly repo: ICronRepository,
    private readonly emitter: ICronEventEmitter,
    private readonly executor: ICronJobExecutor,
    private readonly conversationRepo: IConversationRepository
  ) {}
}
```

### 3.2 初始化流程

```typescript
async init(): Promise<void> {
  if (this.initialized) return;
  
  try {
    await this.cleanupOrphanJobs();           // 清理孤立任务
    await this.backfillCronJobIdOnConversations(); // 回填历史数据
    
    const jobs = await this.repo.listEnabled();
    for (const job of jobs) {
      await this.startTimer(job);
    }
    
    this.initialized = true;
    await this.updatePowerBlocker();
  } catch (error) {
    console.error('[CronService] Initialization failed:', error);
    throw error;
  }
}
```

### 3.3 孤儿任务清理

```typescript
private async cleanupOrphanJobs(): Promise<void> {
  const allJobs = await this.repo.listAll();
  for (const job of allJobs) {
    // new_conversation 模式不受孤立检查
    if (job.target.executionMode === 'new_conversation') continue;
    
    const conversation = await this.conversationRepo.getConversation(job.metadata.conversationId);
    if (!conversation) {
      // 检查是否有子会话
      const childConversations = await this.conversationRepo.getConversationsByCronJob(job.id);
      if (childConversations.length > 0) continue;
      
      // 删除孤立任务
      this.stopTimer(job.id);
      await this.repo.delete(job.id);
      await deleteCronSkillFile(job.id);
      this.emitter.emitJobRemoved(job.id);
    }
  }
}
```

### 3.4 定时器管理

```typescript
// 启动定时器
private async startTimer(job: CronJob): Promise<void> {
  const cron = new Cron(job.schedule, {
    timezone: getPlatformServices().timezone,
    onTick: async () => {
      await this.executeJob(job);
    },
    onMissed: async () => {
      await this.handleMissedExecution(job);
    },
  });
  
  this.timers.set(job.id, cron);
}

// 执行任务
private async executeJob(job: CronJob): Promise<void> {
  // 检查会话是否繁忙
  const busy = await this.conversationRepo.isConversationBusy(job.metadata.conversationId);
  if (busy) {
    await this.scheduleRetry(job);
    return;
  }
  
  // 执行任务
  try {
    await this.executor.execute(job);
    this.emitter.emitJobExecuted(job.id);
  } catch (error) {
    await this.handleExecutionError(job, error);
  }
}

// 重试机制
private async scheduleRetry(job: CronJob): Promise<void> {
  const maxRetries = 3;
  const retryCount = this.retryCounts.get(job.id) ?? 0;
  
  if (retryCount >= maxRetries) {
    await this.handleMaxRetriesExceeded(job);
    return;
  }
  
  const delay = Math.pow(2, retryCount) * 60000; // 1min, 2min, 4min
  
  const timer = setTimeout(async () => {
    await this.executeJob(job);
  }, delay);
  
  this.retryTimers.set(job.id, timer);
  this.retryCounts.set(job.id, retryCount + 1);
}
```

---

## 四、并发保护 CronBusyGuard

### 4.1 作用

防止同一任务并发执行，确保 Cron 调度和手动触发不会冲突。

### 4.2 设计思路

```typescript
class CronBusyGuard {
  private busyJobs: Set<string> = new Set();
  
  isJobBusy(jobId: string): boolean {
    return this.busyJobs.has(jobId);
  }
  
  markAsBusy(jobId: string): void {
    this.busyJobs.add(jobId);
  }
  
  markAsDone(jobId: string): void {
    this.busyJobs.delete(jobId);
  }
  
  async withLock<T>(jobId: string, fn: () => Promise<T>): Promise<T> {
    if (this.isJobBusy(jobId)) {
      throw new Error(`Job ${jobId} is already running`);
    }
    
    this.markAsBusy(jobId);
    try {
      return await fn();
    } finally {
      this.markAsDone(jobId);
    }
  }
}
```

---

## 五、数据仓库接口

### 5.1 ICronRepository

```typescript
export interface ICronRepository {
  // 创建任务
  create(params: CreateCronJobParams): Promise<CronJob>;
  
  // 更新任务
  update(id: string, params: Partial<CronJob>): Promise<CronJob>;
  
  // 删除任务
  delete(id: string): Promise<void>;
  
  // 获取任务
  get(id: string): Promise<CronJob | null>;
  
  // 列出所有任务
  listAll(): Promise<CronJob[]>;
  
  // 列出启用任务
  listEnabled(): Promise<CronJob[]>;
  
  // 列出禁用任务
  listDisabled(): Promise<CronJob[]>;
  
  // 更新执行时间
  updateExecutionTime(id: string, lastExecutedAt: string, nextExecuteAt: string): Promise<void>;
  
  // 更新错误状态
  updateError(id: string, error: string): Promise<void>;
}
```

### 5.2 SqliteCronRepository 实现

- 使用 SQLite 存储任务定义
- 持久化调度配置
- 支持任务状态查询

---

## 六、事件系统

### 6.1 ICronEventEmitter

```typescript
export interface ICronEventEmitter {
  emitJobCreated(job: CronJob): void;
  emitJobUpdated(job: CronJob): void;
  emitJobRemoved(jobId: string): void;
  emitJobExecuted(jobId: string): void;
  emitJobFailed(jobId: string, error: Error): void;
  emitJobSkipped(jobId: string, reason: string): void;
}
```

### 6.2 IpcCronEventEmitter

通过 IPC 桥接将事件发送到渲染进程。

---

## 七、Power Save Blocker

### 7.1 背景

在 macOS 上，CPU 可能会在系统空闲时降低频率，导致定时器不准确。

### 7.2 实现

```typescript
private async updatePowerBlocker(): Promise<void> {
  const hasEnabledJobs = (await this.repo.listEnabled()).length > 0;
  
  if (hasEnabledJobs && !this.powerSaveBlockerId) {
    // 阻止系统进入低功耗模式
    this.powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  } else if (!hasEnabledJobs && this.powerSaveBlockerId) {
    // 移除阻止
    powerSaveBlocker.stop(this.powerSaveBlockerId);
    this.powerSaveBlockerId = null;
  }
}
```

---

## 八、tech-cc-hub 借鉴建议

### 8.1 可直接借鉴

| 功能 | AionUi 实现 | 移植价值 |
|------|-------------|----------|
| **CronStore 类型定义** | 完整的任务模型 | 高 |
| **ICronRepository 接口** | 抽象数据层 | 高 |
| **CronBusyGuard** | 并发保护 | 高 |
| **孤儿任务清理** | 启动时自清理 | 中 |

### 8.2 需要适配

| 功能 | 差异点 |
|------|--------|
| **CronService** | 依赖自己的会话管理 |
| **CronJobExecutor** | 使用 Claude Agent SDK |
| **事件发射器** | 适配自己的 IPC |

### 8.3 实现优先级

| 优先级 | 功能 | 工作量 |
|--------|------|--------|
| P0 | CronStore 类型定义 | 1 day |
| P0 | ICronRepository 接口 | 1 day |
| P0 | SqliteCronRepository | 2 days |
| P1 | CronService 核心 | 3 days |
| P1 | CronBusyGuard | 1 day |
| P2 | Power Save Blocker | 1 day |

---

**文档路径**: `doc/00-research/AionUi-调研报告/02-Cron调度模块.md`
