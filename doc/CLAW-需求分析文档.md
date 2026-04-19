# CLAW - 需求分析文档

**版本：** v0.1（需求分析）  
**日期：** 2026-04-18  
**状态：** 需求收集完成，待评审

---

## 一、需求背景

### 1.1 问题域

| 问题 | 现状 | 痛点 |
|---|---|---|
| Agent 执行不透明 | Claude Code 黑盒执行 | 无法观测执行过程 |
| 缺乏量化指标 | 不知道 Agent 效率如何 | 无法优化改进 |
| 多 Agent 协作缺失 | 单 Agent 无法分工 | 复杂任务无法拆分 |
| 配置无法同步 | skills 配置散落 | 换设备需要手动迁移 |
| 人工干预难追踪 | 不知道何时介入 | 返工原因不清晰 |

### 1.2 目标用户

- **主要用户**：陆晟韬（研发程序员）
- **使用场景**：日常开发、代码生成、任务自动化
- **技能水平**：能熟练使用 Claude Code，有一定工程化思维

### 1.3 核心价值

```
┌─────────────────────────────────────────────────────────────┐
│  CLAW = 增强可控性 + 全量观测 + 多 Agent 协作 + 量化分析     │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、功能需求

### 2.1 Agent 抽象层

**需求描述：**  
将不同编程 Agent（Claude Code、Codex）抽象为统一接口，实现"谁强换谁"的灵活切换。

**具体要求：**
- 统一接口：`start()`, `send_message()`, `stop()`, `get_status()`
- 配置驱动：修改配置文件即可切换 Agent
- 无需改动上层业务逻辑

**验收标准：**
- [ ] Claude Code 可正常工作
- [ ] 切换到 Codex 只需改配置
- [ ] 上层应用无感知 Agent 切换

---

### 2.2 GUI 控制台

**需求描述：**  
提供可视化界面控制编程 Agent，实现"聊天 + 实时日志 + 文件编辑 + 分析仪表盘"四合一。

**子功能列表：**

| 功能 | 描述 | 优先级 |
|---|---|---|
| 聊天控制 | 向 Agent 发送消息、接收响应 | P0 |
| 实时日志流 | WebSocket 推送执行日志到 GUI | P0 |
| 文件编辑 | Monaco Editor 编辑工作文件 | P0 |
| 文件树 | 目录浏览、文件操作 | P0 |
| 分析仪表盘 | 可视化展示各项指标 | P1 |

**验收标准：**
- [ ] 发送消息后 1s 内看到响应
- [ ] 日志延迟 < 500ms
- [ ] 支持打开 10+ 文件

---

### 2.3 全量 Hooks 观测

**需求描述：**  
捕获 Claude Code 全部 14 个 Hooks 事件，增强可观测性。

**事件清单：**

| 事件 | 捕获内容 |
|---|---|
| SessionStart | git status、env、初始上下文 |
| UserPromptSubmit | 原始 prompt、长度、时间戳 |
| PreToolUse | 工具名、参数、上下文 |
| PostToolUse | 工具名、结果、耗时、成功状态 |
| PostToolUseFailure | 工具名、错误类型、堆栈 |
| PreCompact | 上下文大小、压缩原因 |
| PostCompact | 压缩后大小、丢失内容 |
| PermissionRequest | 命令详情、是否批准 |
| Notification | 通知内容、类型 |
| Stop | 停止原因、token 消耗 |
| SessionEnd | 最终统计、任务完成状态 |
| SubagentStart | agent 类型、任务描述 |
| SubagentStop | agent 类型、执行结果 |
| TaskCompleted | 任务描述、完成状态 |

**验收标准：**
- [ ] 14 个事件全覆盖
- [ ] 每条日志 < 100ms 写入
- [ ] 日志可回放（从指定位置重放）

---

### 2.4 AI 智能分析

**需求描述：**  
基于执行日志，AI 自动分析人工干预、返工次数、错误率等关键指标。

**分析维度：**

| 维度 | 指标 | 说明 |
|---|---|---|
| 执行效率 | 耗时、Token 消耗、工具调用数 | Agent 原生提供 |
| 人工干预 | 人工消息数、占比、介入间隔 | 区分 AI vs 人工 |
| 返工率 | 指令修改次数、撤销次数 | 同一目标反复修改 |
| 错误率 | 工具失败次数、类型分布 | 失败原因分析 |
| 成功率 | 任务完成率、子任务完成率 | 成功/失败判定 |
| 路径复杂度 | 步骤数、工具链深度、压缩次数 | 执行路径分析 |
| Skills 命中率 | 触发类型、频率、效果 | Skills 使用情况 |

**验收标准：**
- [ ] Session 结束后自动生成分析报告
- [ ] 支持按时间范围查询历史分析
- [ ] 报告包含改进建议

---

### 2.5 多 Agent 协作（Hub + Workers + 主从复制）

**需求描述：**  
实现主从架构：Hub 负责任务分解和调度，Workers 负责具体执行。采用**主从复制**模式实现上下文控制。

**架构图：**
```
┌─────────────────────────────────────────────────────────────────┐
│                         Hub（主上下文）                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Global Context                                             │  │
│  │ - 原始任务描述                                              │  │
│  │ - 全局约束（代码风格、技术栈、约束条件）                     │  │
│  │ - 子任务列表 + 依赖关系                                     │  │
│  │ - 已完成任务摘要（Worker 完成后写入）                        │  │
│  │ - 进行中任务状态                                           │  │
│  │ - 全局变量/状态（Workers 可读写）                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                    上下文快照同步（按需复制）                    │
│                              ↓                                   │
│    ┌─────────────────────────┼─────────────────────────┐       │
│    ↓                         ↓                         ↓         │
│ ┌─────────────┐         ┌─────────────┐         ┌─────────────┐ │
│ │  Worker 1  │         │  Worker 2  │         │  Worker 3  │ │
│ │             │         │             │         │             │ │
│ │ SubContext  │         │ SubContext  │         │ SubContext  │ │
│ │ - 主上下文  │         │ - 主上下文  │         │ - 主上下文  │ │
│ │   快照      │         │   快照      │         │   快照      │ │
│ │ - 子任务    │         │ - 子任务    │         │ - 子任务    │ │
│ │   上下文    │         │   上下文    │         │   上下文    │ │
│ │ - 专属变量  │         │ - 专属变量  │         │ - 专属变量  │ │
│ └─────────────┘         └─────────────┘         └─────────────┘ │
│                              │                                   │
│                   Worker 结果回写 → Hub 合并                     │
└─────────────────────────────────────────────────────────────────┘
```

**协作模式：**
```
用户请求 → Hub 接收 → 任务分解 → 上下文分发 → Workers 执行 → 结果回写 → Hub 合并 → 分析报告
```

**依赖管理：**
- 支持串行执行（按依赖顺序）
- 支持并行执行（无依赖任务）
- 支持条件执行（if/else 逻辑）

**验收标准：**
- [ ] 一期支持 Hub + 单 Worker
- [ ] 二期支持 Hub + 多 Workers 并行
- [ ] 依赖关系可配置
- [ ] 上下文冲突检测与处理

---

### 2.6 Git 配置同步

**需求描述：**  
通过 Git 管理配置数据（skills、config、prompts），实现跨设备同步。

**同步范围：**

| 目录 | 内容 | 入 Git |
|---|---|---|
| skills/ | Skills 配置文件 | ✅ |
| config/ | 系统配置 | ✅ |
| prompts/ | 提示词模板 | ✅ |
| workspace/ | 工作文件 | 可选 |

**同步策略：**
- 手动触发：`git pull` / `git push`
- 不自动同步，避免冲突

**验收标准：**
- [ ] 一键 pull/push
- [ ] 冲突提示
- [ ] 分支管理

---

### 2.7 本地文件系统驱动

**需求描述：**  
一期完全基于本地文件系统，不依赖数据库。

**存储结构：**

| 数据类型 | 存储位置 | 格式 |
|---|---|---|
| 执行日志 | data/logs/{session_id}.jsonl | JSONL |
| Session 上下文 | data/sessions/{session_id}.md | Markdown |
| 工作文件 | data/workspace/*.md | Markdown |
| 分析报告 | data/analysis/{session_id}.md | Markdown |
| 缓存 | data/cache/ | - |

**二期升级：**
- MongoDB 替代文件存储
- 文件系统接口保持不变

**验收标准：**
- [ ] 日志写入不丢失
- [ ] 支持 1000+ Session 历史
- [ ] 磁盘空间告警

---

## 三、非功能需求

### 3.1 性能

| 指标 | 要求 |
|---|---|
| 消息响应延迟 | < 1s |
| 日志推送延迟 | < 500ms |
| 大文件编辑 | 支持 10MB+ 文件 |
| 并发 Session | 支持 5 个并发 |

### 3.2 可用性

| 指标 | 要求 |
|---|---|
| 进程崩溃恢复 | 自动重启 + 状态恢复 |
| 断线重连 | WebSocket 自动重连 |
| 数据持久化 | 每次操作即时落盘 |

### 3.3 可扩展性

| 维度 | 要求 |
|---|---|
| Agent 类型 | 可扩展新 Agent 类型 |
| 分析指标 | 可添加新指标 |
| 存储后端 | 可切换 MongoDB |

### 3.4 安全

| 需求 | 说明 |
|---|---|
| 敏感信息 | API Key 等不上传 Git |
| 文件权限 | 最小权限原则 |
| 命令执行 | Hooks 捕获高危操作 |

---

## 四、用户故事

### 4.1 日常开发

```
作为研发，我想要：
  通过 GUI 向 Claude Code 发送编程任务，
  以便在可视化界面中完成开发工作，
  同时观察实时执行日志。

场景：
  - 输入："帮我写一个用户登录 API"
  - 看到：Claude Code 思考过程、工具调用、文件变更
  - 结果：API 代码 + 执行报告
```

### 4.2 问题分析

```
作为研发，我想要：
  查看某个 Session 的详细分析报告，
  以便了解人工干预次数、错误原因等，
  持续优化 Agent 使用方式。

场景：
  - 查看：人工消息 3 条 (23%)，返工 1 次
  - 原因：排序算法选择不当
  - 建议：任务开始前先确认数据规模
```

### 4.3 跨设备同步

```
作为研发，我想要：
  在公司电脑上配置好 Skills，
  回家后一键同步到个人电脑，
  保持一致的配置体验。

场景：
  - 公司：配置了 sort_algorithm skill
  - 回家：git pull，同步配置
  - 继续：无缝衔接开发工作
```

### 4.4 多 Agent 协作

```
作为研发，我想要：
  将复杂任务分解给多个 Agent 并行执行，
  以便缩短总执行时间，
  同时保持结果一致性。

场景：
  - 任务：实现用户系统 + 订单系统
  - Worker 1：用户系统
  - Worker 2：订单系统
  - Worker 3：公共模块
  - 结果：自动合并 + 冲突检测
```

---

## 五、优先级矩阵

| 需求 | 商业价值 | 技术难度 | 优先级 |
|---|---|---|---|
| Agent 抽象层 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | **P0** |
| GUI 聊天控制 | ⭐⭐⭐⭐⭐ | ⭐⭐ | **P0** |
| 实时日志流 | ⭐⭐⭐⭐⭐ | ⭐⭐ | **P0** |
| 全量 Hooks 捕获 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | **P0** |
| 本地文件驱动 | ⭐⭐⭐⭐⭐ | ⭐⭐ | **P0** |
| Monaco 文件编辑 | ⭐⭐⭐⭐ | ⭐⭐ | **P0** |
| AI 分析基础 | ⭐⭐⭐⭐ | ⭐⭐⭐ | **P1** |
| Hub 单 Worker | ⭐⭐⭐⭐ | ⭐⭐⭐ | **P1** |
| Git Sync | ⭐⭐⭐⭐ | ⭐⭐ | **P1** |
| 分析仪表盘 | ⭐⭐⭐ | ⭐⭐ | **P2** |
| Hub 多 Workers | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **P2** |
| MongoDB 集成 | ⭐⭐⭐⭐ | ⭐⭐⭐ | **P2** |
| Codex Connector | ⭐⭐⭐ | ⭐⭐⭐ | **P2** |

---

## 六、风险与约束

### 6.1 技术风险

| 风险 | 影响 | 应对 |
|---|---|---|
| Claude Code Hooks 接口变更 | 高 | 预留抽象层，版本锁定 |
| Monaco Editor 性能问题 | 中 | 大文件分页加载 |
| WebSocket 长连接断线 | 中 | 自动重连 + 缓冲 |
| 多 Worker 资源竞争 | 中 | 进程隔离 + 资源限制 |

### 6.2 业务约束

| 约束 | 说明 |
|---|---|
| 一期本地优先 | 不上云、不用数据库 |
| 优先 Markdown | 工作文件格式统一为 MD |
| 手动 Git Sync | 不做自动同步，避免冲突 |

### 6.3 外部依赖

| 依赖 | 版本要求 | 备选 |
|---|---|---|
| Claude Code | 最新版 | Codex |
| Node.js | 18+ | - |
| Python | 3.10+ | - |
| Tauri | 2.x | Electron |

---

## 九、Context Specification（上下文控制规范）

### 9.1 数据结构定义

#### Global Context（Hub 主上下文）

```json
{
  "version": "1.0",
  "session_id": "sess_xxx",
  "created_at": "2026-04-18T12:00:00Z",
  "updated_at": "2026-04-18T12:30:00Z",

  "original_task": {
    "description": "实现用户系统 + 订单系统",
    "constraints": ["Python + FastAPI", "RESTful API", "统一错误码"],
    "deadline": "2026-04-20T18:00:00Z"
  },

  "global_vars": {
    "db_connection": "postgres://...",
    "shared_cache": {},
    "constants": {}
  },

  "subtasks": [
    {
      "id": "task_1",
      "worker_id": "worker_1",
      "description": "实现用户模块",
      "status": "completed",
      "dependencies": [],
      "result_summary": "..."
    },
    {
      "id": "task_2",
      "worker_id": "worker_2",
      "description": "实现订单模块",
      "status": "in_progress",
      "dependencies": ["task_1"],
      "result_summary": null
    }
  ],

  "completed_tasks": [
    {
      "task_id": "task_1",
      "worker_id": "worker_1",
      "completed_at": "2026-04-18T12:20:00Z",
      "files_created": ["user/models.py", "user/routes.py"],
      "files_modified": ["config.py"],
      "summary": "用户 CRUD + 认证完成"
    }
  ],

  "in_progress_tasks": [
    {
      "task_id": "task_2",
      "worker_id": "worker_2",
      "started_at": "2026-04-18T12:25:00Z",
      "current_step": "查询用户历史订单",
      "progress_percent": 45
    }
  ],

  "context_stats": {
    "total_tokens": 150000,
    "compression_count": 2,
    "last_compact_at": "2026-04-18T12:15:00Z"
  }
}
```

#### Worker SubContext（Worker 子上下文）

```json
{
  "version": "1.0",
  "worker_id": "worker_1",
  "parent_session_id": "sess_xxx",
  "subtask_id": "task_1",

  "master_snapshot": {
    "snapshot_at": "2026-04-18T12:20:00Z",
    "original_task": { ... },
    "global_vars": { ... },
    "completed_tasks": [ ... ],
    "context_hash": "abc123"
  },

  "subtask_context": {
    "description": "实现用户模块",
    "allowed_files": ["user/", "config.py"],
    "denied_files": ["order/", "payment/"],
    "output_files": ["user/models.py", "user/routes.py", "user/schemas.py"]
  },

  "local_vars": {
    "user_model_fields": ["id", "username", "email", "password_hash"],
    "generated_code": { ... }
  },

  "execution_log": [
    {
      "ts": "2026-04-18T12:20:01Z",
      "type": "tool_call",
      "action": "write_file",
      "file": "user/models.py",
      "success": true
    }
  ],

  "status": {
    "state": "running",
    "progress_percent": 75,
    "current_action": "编写用户路由"
  }
}
```

---

### 9.2 上下文同步协议

#### 同步类型

| 类型 | 触发时机 | 内容 | 方向 |
|---|---|---|---|
| **Full Sync** | Worker 启动 | 全量主上下文快照 | Hub → Worker |
| **Incremental Sync** | 主上下文更新 | 增量变更（diff） | Hub → Worker |
| **Worker Result** | Worker 完成 | 结果摘要 + 产物 | Worker → Hub |
| **Heartbeat** | 定时 30s | 当前状态 + 进度 | Worker → Hub |
| **Conflict Report** | 冲突检测 | 冲突详情 | Worker → Hub |

#### 同步流程

```
┌─────────────────────────────────────────────────────────────────┐
│                         同步流程                                  │
└─────────────────────────────────────────────────────────────────┘

1. Worker 启动
   Hub → Worker: Full Sync（主上下文快照）
   Worker 确认: 回传 snapshot_hash

2. 执行中
   Hub → Worker: Incremental Sync（如主上下文有更新）
   Worker → Hub: Heartbeat（每 30s）

3. Worker 完成
   Worker → Hub: Worker Result（结果摘要）
   Hub 验证: 比对 snapshot_hash + result

4. Hub 合并
   Hub: 冲突检测 → 结果合并 → 更新 Global Context
```

---

### 9.3 冲突处理策略

#### 冲突类型

| 冲突类型 | 检测时机 | 处理策略 |
|---|---|---|
| **文件修改冲突** | Worker 完成后 | 提示用户，手动合并 |
| **全局变量冲突** | Worker 回写时 | Hub 仲裁（最后写入优先） |
| **依赖执行冲突** | 任务调度时 | 串行化等待 |
| **上下文版本冲突** | 同步时 | 版本号对比，强制同步最新 |

#### 冲突处理流程

```
冲突检测 → 分类 → 处理策略 → 结果

1. 文件修改冲突
   - 检测：比较文件 hash
   - 策略：保留两个版本，让用户手动合并
   - 输出：conflict_report.md

2. 全局变量冲突
   - 检测：比较变量版本号
   - 策略：Hub 仲裁（可配置：最后写入 / 首个写入 / 用户决策）
   - 输出：merged_vars.json

3. 依赖执行冲突
   - 检测：任务依赖图分析
   - 策略：强制串行，被依赖者先执行
   - 输出：execution_order.json
```

---

### 9.4 任务依赖配置

#### 依赖语法

```yaml
# CLAWfile.yml
tasks:
  - id: task_1
    name: 用户模块
    worker: worker_1
    dependencies: []
    parallel: true

  - id: task_2
    name: 订单模块
    worker: worker_2
    dependencies: [task_1]
    parallel: false

  - id: task_3
    name: 集成测试
    worker: worker_3
    dependencies: [task_1, task_2]
    parallel: false
```

#### 依赖执行图

```
Task 1 (User) ──┬──→ Task 2 (Order) ──┐
                │                      ├──→ Task 3 (Integration)
                │                      │
                └──────────────────────┘
                
并行：Task 1
串行：Task 2 等待 Task 1
串行：Task 3 等待 Task 1 + Task 2
```

---

### 9.5 Token 控制策略

| 策略 | 说明 | 适用场景 |
|---|---|---|
| **Hard Limit** | 超过阈值强制压缩 | Token 紧张时 |
| **Soft Limit** | 接近阈值预警，不强制 | 日常监控 |
| **Auto Compact** | 自动压缩低价值上下文 | Worker 执行中 |
| **Selective Sync** | 只同步必要的主上下文字段 | 减少复制开销 |

#### Token 分配（示例）

```
总预算: 200,000 tokens

Hub 主上下文:     80,000 tokens（固定）
Worker 1:        40,000 tokens
Worker 2:        40,000 tokens
Worker 3:        40,000 tokens
─────────────────────────────
总分配:          200,000 tokens

超限处理:
- 任何 Worker 超过 40k → 自动压缩
- Hub 超过 80k → 提示用户
- 整体超限 → 暂停新 Worker 启动
```

---

### 9.6 上下文持久化

#### 存储结构

```
data/
├── sessions/
│   └── {session_id}/
│       ├── global_context.json      # Hub 主上下文
│       ├── subtasks.yaml            # 任务依赖配置
│       ├── workers/
│       │   ├── worker_1/
│       │   │   ├── sub_context.json  # Worker 子上下文
│       │   │   └── execution_log.jsonl
│       │   ├── worker_2/
│       │   └── ...
│       ├── conflicts/               # 冲突报告
│       │   └── {conflict_id}.md
│       └── result/
│           ├── merged_context.json   # 合并后上下文
│           └── final_report.md       # 最终报告
└── snapshots/
    └── {session_id}/
        └── {snapshot_id}.json       # 历史快照
```

#### 快照策略

| 场景 | 触发 | 保留数量 |
|---|---|---|
| Worker 启动 | 每次启动 | 最近 3 个 |
| Worker 完成 | 每次完成 | 最近 3 个 |
| 上下文压缩前 | 每次压缩 | 最近 5 个 |
| 冲突发生时 | 每次冲突 | 所有 |

---

## 十、待确认事项

| # | 问题 | 状态 | 备注 |
|---|---|---|---|
| 1 | Claude Code Hooks 触发方式 | 待确认 | subprocess 通信细节 |
| 2 | Monaco Editor 多文件管理策略 | 待确认 | tab 模式 vs 预览模式 |
| 3 | AI 分析使用本地模型还是 API | 待确认 | 成本 vs 隐私 |
| 4 | Git 仓库位置 | 待确认 | 本地还是 GitHub/Gitea |
| 5 | Workspace 是否入 Git | 待确认 | 代码文件同步需求 |
| 6 | 权限控制 | 待确认 | 是否需要多用户 |

---

## 八、后续工作

- [ ] 需求评审（本文档）
- [ ] 技术方案设计
- [ ] 项目初始化
- [ ] 详细设计
- [ ] 迭代开发

---

## 附录

### A. 术语表

| 术语 | 定义 |
|---|---|
| CLAW | 编程 Agent 协作平台（项目名） |
| Hub | 主控 Agent，负责任务分解和调度 |
| Worker | 执行 Agent，负责具体子任务 |
| Hooks | Claude Code 的事件钩子系统 |
| jsonl | JSON Lines，每行一个 JSON 的格式 |

### B. 参考资料

- Claude Code Hooks: `https://docs.anthropic.com/claude-code/hooks`
- Tauri 文档: `https://tauri.app/`
- FastAPI 文档: `https://fastapi.tiangolo.com/`
