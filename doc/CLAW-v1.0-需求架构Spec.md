# CLAW - 编程 Agent 协作平台

**版本：** v1.0（需求 + 架构 + Spec）  
**日期：** 2026-04-18  
**状态：** 待 Codex 补充实现细节

---

## 一、项目概述

### 1.1 核心定位

```
CLAW = 增强可控性 + 全量观测 + 多 Agent 协作 + 量化分析
```

将不同编程 Agent（Claude Code、Codex）抽象为统一接口，通过 Hub + Workers 主从架构实现多 Agent 协作，所有执行过程全量 Hooks 捕获，AI 自动分析效率指标。

### 1.2 目标用户

- **主要用户**：陆晟韬（研发程序员）
- **使用场景**：日常开发、代码生成、任务自动化
- **技能水平**：能熟练使用 Claude Code，有一定工程化思维

### 1.3 核心价值

| 价值点 | 说明 |
|---|---|
| 全量可观测 | 14 个 Hooks 事件全覆盖，执行过程透明 |
| 多 Agent 协作 | Hub 分解任务，多 Workers 并行执行 |
| 量化分析 | 自动统计人工干预、返工率、错误率等指标 |
| 灵活切换 | Agent 抽象层，"谁强换谁" |
| 跨设备同步 | Git 管理配置，绿色免安装 |

---

## 二、系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        GUI（Tauri + React）                      │
│   聊天 + 实时日志流 + Monaco 编辑 + 文件树 + 分析仪表盘          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ WebSocket（实时推送）
┌──────────────────────────────▼──────────────────────────────────┐
│                     后端（FastAPI Python）                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 Agent Adapter Layer                         │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │   │ Claude Code │  │   Codex     │  │   Future    │       │ │
│  │   │  Connector  │  │  Connector  │  │  Connectors │       │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐  │
│  │    Hub      │  │  Log Hooks  │  │   Log Analyzer         │  │
│  │  任务分解   │  │  事件捕获   │  │   AI 智能分析          │  │
│  │  Worker调度 │  │  14 事件    │  │   量化指标             │  │
│  └─────────────┘  └─────────────┘  └────────────────────────┘  │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐  │
│  │File Manager │  │  Git Sync   │  │   Context Manager      │  │
│  │  Monaco     │  │  手动触发   │  │   主从复制             │  │
│  └─────────────┘  └─────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ↓                     ↓                     ↓
    本地文件系统           CC Hooks              Agent Instances
    （logs/sessions）      （事件捕获）           （subprocess）
```

### 2.2 技术栈

| 层级 | 技术选型 | 理由 |
|---|---|---|
| GUI 框架 | Tauri 2.x | Rust 后端，原生性能，小体积 |
| 前端框架 | React 18 + TypeScript | 成熟生态，组件丰富 |
| UI 组件 | Ant Design / shadcn/ui | 企业级组件 |
| 代码编辑 | Monaco Editor | VSCode 同款，支持大文件 |
| WebSocket | socket.io / native WS | 实时日志推送 |
| 后端框架 | FastAPI Python | 高性能，异步支持 |
| Agent 通信 | subprocess（本地） | Claude Code 本地通信 |
| 日志存储 | JSONL 文件 | 可追加，可回放 |
| 配置管理 | YAML + JSON | 人类可读，易编辑 |

### 2.3 Agent 抽象层

```python
# backend/adapters/base.py
class BaseAgentAdapter(ABC):
    """Agent 适配器基类，所有 Agent 实现此接口"""
    
    @abstractmethod
    async def start(self, session_id: str, config: AgentConfig) -> None:
        """启动 Agent Session"""
        pass
    
    @abstractmethod
    async def send_message(self, message: str) -> AgentResponse:
        """发送消息"""
        pass
    
    @abstractmethod
    async def stop(self) -> ExecutionSummary:
        """停止 Agent"""
        pass
    
    @abstractmethod
    async def get_status(self) -> AgentStatus:
        """获取状态"""
        pass
    
    @abstractmethod
    def register_hooks(self, hook_handler: HookHandler) -> None:
        """注册 Hooks"""
        pass
```

**配置驱动切换：**

```yaml
# config/active_agent.yaml
active_agent: claude  # 或 codex

agents:
  claude:
    type: claude_code
    path: /usr/local/bin/claude
    hooks_enabled: true
    
  codex:
    type: codex
    api_endpoint: http://localhost:8080
    api_key: ${CODEX_API_KEY}
```

---

## 三、目录结构

```
CLAW/
├── CLAWfile.yaml              # 项目定义文件（任务配置）
├── README.md
├── Makefile
│
├── frontend/                   # Tauri + React GUI
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── LogStream.tsx
│   │   │   ├── FileTree.tsx
│   │   │   ├── MonacoEditor.tsx
│   │   │   └── AnalyticsDashboard.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   └── useAgent.ts
│   │   └── stores/
│   │       └── sessionStore.ts
│   ├── package.json
│   └── tauri.conf.json
│
├── backend/                    # FastAPI Python
│   ├── main.py                 # 应用入口
│   ├── adapters/               # Agent 适配器
│   │   ├── base.py
│   │   ├── claude_connector.py
│   │   └── codex_connector.py
│   ├── hub/                    # Hub 主控
│   │   ├── task_decomposer.py
│   │   ├── worker_scheduler.py
│   │   └── result_merger.py
│   ├── hooks/                  # Hooks 捕获
│   │   ├── handler.py
│   │   └── events.py
│   ├── context/                # 上下文管理
│   │   ├── global_context.py
│   │   ├── worker_context.py
│   │   └── sync_protocol.py
│   ├── analyzer/               # AI 分析
│   │   ├── metrics.py
│   │   └── report_generator.py
│   ├── storage/                 # 文件存储
│   │   ├── log_writer.py
│   │   └── session_manager.py
│   ├── sync/                   # Git 同步
│   │   └── git_manager.py
│   └── api/                    # API 路由
│       ├── agent.py
│       ├── session.py
│       └── analysis.py
│
├── data/                       # 数据目录
│   ├── logs/
│   │   └── {session_id}.jsonl
│   ├── sessions/
│   │   └── {session_id}/
│   │       ├── global_context.json
│   │       ├── subtasks.yaml
│   │       └── workers/
│   │           └── {worker_id}/
│   │               ├── sub_context.json
│   │               └── execution_log.jsonl
│   ├── analysis/
│   │   └── {session_id}.md
│   └── workspace/
│
├── skills/                     # Skills 配置
│   ├── README.md
│   └── examples/
│
├── config/                     # 系统配置
│   ├── active_agent.yaml
│   ├── hub.yaml
│   └── ui.yaml
│
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/
```

---

## 四、数据模型

### 4.1 执行日志（logs/{session_id}.jsonl）

```json
{"ts": 1744960000, "type": "session_start", "worker_id": "worker_1", "git_status": "...", "env": {...}}
{"ts": 1744960001, "type": "user_prompt", "content": "帮我写个排序"}
{"ts": 1744960002, "type": "ai_think", "content": "思考过程..."}
{"ts": 1744960003, "type": "pre_tool", "tool": "bash", "cmd": "sort file.txt", "args": {...}}
{"ts": 1744960004, "type": "post_tool", "tool": "bash", "cmd": "sort file.txt", "success": true, "duration_ms": 150}
{"ts": 1744960005, "type": "hook", "event": "PostToolUse", "data": {...}}
{"ts": 1744960006, "type": "tool_failure", "tool": "write", "error": "Permission denied"}
{"ts": 1744960007, "type": "human_intervention", "content": "不对，重新排"}
{"ts": 1744960008, "type": "file_change", "action": "create", "file": "sorted.py"}
{"ts": 1744960009, "type": "session_end", "summary": {...}}
```

### 4.2 Global Context（Hub 主上下文）

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
      "result_summary": "用户 CRUD + 认证完成"
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

### 4.3 Worker SubContext（Worker 子上下文）

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

## 五、Hooks 全量事件

### 5.1 事件清单

| 事件 | 触发时机 | 捕获数据 |
|---|---|---|
| **SessionStart** | Session 开始 | git status、env vars、初始上下文、working directory |
| **UserPromptSubmit** | 用户提交消息 | 原始 prompt、内容、长度、时间戳 |
| **PreToolUse** | 工具执行前 | 工具名、参数、完整调用上下文 |
| **PostToolUse** | 工具执行后 | 工具名、结果、执行耗时、成功状态 |
| **PostToolUseFailure** | 工具执行失败 | 工具名、错误类型、错误信息、堆栈 |
| **PreCompact** | 上下文压缩前 | 当前上下文大小、压缩原因 |
| **PostCompact** | 上下文压缩后 | 压缩后大小、丢失内容摘要 |
| **PermissionRequest** | 权限弹窗 | 命令详情、是否批准、超时 |
| **Notification** | Claude 发通知 | 通知内容、类型 |
| **Stop** | 响应结束 | 停止原因、token 消耗 |
| **SessionEnd** | Session 关闭 | 最终统计、任务完成状态 |
| **SubagentStart** | 子 Agent 启动 | agent 类型、任务描述 |
| **SubagentStop** | 子 Agent 停止 | agent 类型、执行结果 |
| **TaskCompleted** | 任务完成 | 任务描述、完成状态 |

### 5.2 Hook Handler 实现

```python
# backend/hooks/handler.py
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Dict, Any
import json
from datetime import datetime

class HookEvent(str, Enum):
    SESSION_START = "SessionStart"
    USER_PROMPT_SUBMIT = "UserPromptSubmit"
    PRE_TOOL_USE = "PreToolUse"
    POST_TOOL_USE = "PostToolUse"
    POST_TOOL_USE_FAILURE = "PostToolUseFailure"
    PRE_COMPACT = "PreCompact"
    POST_COMPACT = "PostCompact"
    PERMISSION_REQUEST = "PermissionRequest"
    NOTIFICATION = "Notification"
    STOP = "Stop"
    SESSION_END = "SessionEnd"
    SUBAGENT_START = "SubagentStart"
    SUBAGENT_STOP = "SubagentStop"
    TASK_COMPLETED = "TaskCompleted"

@dataclass
class HookData:
    event: HookEvent
    ts: int
    worker_id: str
    session_id: str
    data: Dict[str, Any]

class HookHandler:
    """Hooks 事件处理器"""
    
    def __init__(self, log_writer: 'LogWriter', ws_client: Optional['WebSocketClient'] = None):
        self.log_writer = log_writer
        self.ws_client = ws_client
    
    async def handle(self, event: HookEvent, worker_id: str, session_id: str, data: Dict[str, Any]) -> None:
        """处理 Hook 事件"""
        hook_data = HookData(
            event=event,
            ts=int(datetime.now().timestamp()),
            worker_id=worker_id,
            session_id=session_id,
            data=data
        )
        
        # 1. 写入日志文件
        await self.log_writer.write(hook_data)
        
        # 2. WebSocket 推送（实时）
        if self.ws_client:
            await self.ws_client.send(json.dumps({
                "type": "hook",
                "event": event.value,
                "data": data
            }))
        
        # 3. 触发分析（异步）
        await self._maybe_trigger_analysis(hook_data)
    
    async def handle_session_start(self, worker_id: str, session_id: str, data: Dict) -> None:
        await self.handle(HookEvent.SESSION_START, worker_id, session_id, data)
    
    async def handle_user_prompt(self, worker_id: str, session_id: str, prompt: str) -> None:
        await self.handle(HookEvent.USER_PROMPT_SUBMIT, worker_id, session_id, {
            "prompt": prompt,
            "length": len(prompt)
        })
    
    async def handle_pre_tool(self, worker_id: str, session_id: str, tool: str, args: Dict) -> None:
        await self.handle(HookEvent.PRE_TOOL_USE, worker_id, session_id, {
            "tool": tool,
            "args": args
        })
    
    async def handle_post_tool(self, worker_id: str, session_id: str, tool: str, 
                                success: bool, duration_ms: int, result: Any) -> None:
        await self.handle(HookEvent.POST_TOOL_USE, worker_id, session_id, {
            "tool": tool,
            "success": success,
            "duration_ms": duration_ms,
            "result": result
        })
    
    async def handle_tool_failure(self, worker_id: str, session_id: str, 
                                   tool: str, error: str, stack: str) -> None:
        await self.handle(HookEvent.POST_TOOL_USE_FAILURE, worker_id, session_id, {
            "tool": tool,
            "error": error,
            "stack": stack
        })
    
    async def handle_permission_request(self, worker_id: str, session_id: str,
                                         command: str, approved: bool, timeout: bool) -> None:
        await self.handle(HookEvent.PERMISSION_REQUEST, worker_id, session_id, {
            "command": command,
            "approved": approved,
            "timeout": timeout
        })
    
    async def handle_session_end(self, worker_id: str, session_id: str, 
                                  total_tokens: int, task_status: str) -> None:
        await self.handle(HookEvent.SESSION_END, worker_id, session_id, {
            "total_tokens": total_tokens,
            "task_status": task_status
        })
    
    async def _maybe_trigger_analysis(self, hook_data: HookData) -> None:
        """根据事件类型决定是否触发分析"""
        # Session 结束时触发完整分析
        if hook_data.event == HookEvent.SESSION_END:
            from backend.analyzer.metrics import MetricsAnalyzer
            analyzer = MetricsAnalyzer()
            await analyzer.analyze_session(hook_data.session_id)
```

---

## 六、上下文同步协议

### 6.1 同步类型

| 类型 | 触发时机 | 内容 | 方向 |
|---|---|---|---|
| **Full Sync** | Worker 启动 | 全量主上下文快照 | Hub → Worker |
| **Incremental Sync** | 主上下文更新 | 增量变更（diff） | Hub → Worker |
| **Worker Result** | Worker 完成 | 结果摘要 + 产物 | Worker → Hub |
| **Heartbeat** | 定时 30s | 当前状态 + 进度 | Worker → Hub |
| **Conflict Report** | 冲突检测 | 冲突详情 | Worker → Hub |

### 6.2 同步流程

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

### 6.3 冲突处理

| 冲突类型 | 检测时机 | 处理策略 |
|---|---|---|
| **文件修改冲突** | Worker 完成后 | 提示用户，手动合并 |
| **全局变量冲突** | Worker 回写时 | Hub 仲裁（最后写入优先） |
| **依赖执行冲突** | 任务调度时 | 串行化等待 |
| **上下文版本冲突** | 同步时 | 版本号对比，强制同步最新 |

---

## 七、AI 分析指标体系

### 7.1 分析维度

| 维度 | 指标 | 说明 |
|---|---|---|
| **执行效率** | 单次任务耗时、Token 消耗、工具调用数 | Agent 原生提供 |
| **人工干预** | 人工消息数、占比、介入间隔 | 区分 AI vs 人工 |
| **返工率** | 指令修改次数、撤销次数 | 同一目标反复修改 |
| **错误率** | 工具失败次数、类型分布 | 失败原因分析 |
| **成功率** | 任务完成率、子任务完成率 | 成功/失败判定 |
| **路径复杂度** | 步骤数、工具链深度、压缩次数 | 执行路径分析 |
| **Skills 命中率** | 触发类型、频率、效果 | Skills 使用情况 |
| **协作效率** | Worker 等待时间、并行度 | 多 Agent 场景 |
| **上下文利用率** | Token 使用率、压缩频率 | 上下文管理效果 |

### 7.2 分析报告模板

```markdown
# Session 分析报告

**Session ID:** sess_xxx  
**时间范围:** 2026-04-18 12:00 - 12:30  
**任务:** 实现用户登录 API

## 核心指标

| 指标 | 数值 | 评估 |
|---|---|---|
| 总耗时 | 28 分钟 | 正常 |
| Token 消耗 | 45,000 | 正常 |
| 工具调用数 | 23 | 正常 |
| 人工干预 | 3 次 (15%) | 偏高 |
| 返工次数 | 1 次 | 正常 |
| 错误次数 | 2 次 | 偏高 |
| 任务完成率 | 100% | 成功 |

## 人工干预分析

| # | 时间 | 干预内容 | 原因 |
|---|---|---|---|
| 1 | 12:05 | "排序算法用错了" | 需求理解偏差 |
| 2 | 12:15 | "改用异步" | 性能优化 |
| 3 | 12:22 | "注释补全" | 代码规范 |

**结论:** 人工干预集中在需求确认和性能优化阶段。

## 错误分析

| 错误类型 | 次数 | 主要原因 |
|---|---|---|
| 权限错误 | 1 | 文件权限不足 |
| 命令失败 | 1 | 依赖未安装 |

**建议:** 任务开始前检查环境和权限。

## 改进建议

1. 任务开始前先确认数据规模和性能要求
2. 涉及文件操作时先检查权限
3. 复杂排序场景提供示例数据

## 历史对比

| 指标 | 本次 | 上次 | 趋势 |
|---|---|---|---|
| 人工干预率 | 15% | 18% | ↓ 改善 |
| 返工率 | 4% | 6% | ↓ 改善 |
</math>
```

---

## 八、任务依赖配置

### 8.1 CLAWfile 语法

```yaml
# CLAWfile.yaml
version: "1.0"
session:
  name: "用户 + 订单系统"
  constraints:
    - "Python + FastAPI"
    - "RESTful API"
    - "统一错误码"

workers:
  - id: worker_1
    name: "用户模块"
    agent: claude
    tasks:
      - id: task_1_1
        description: "用户模型"
        dependencies: []
      - id: task_1_2
        description: "用户认证"
        dependencies: [task_1_1]

  - id: worker_2
    name: "订单模块"
    agent: claude
    tasks:
      - id: task_2_1
        description: "订单模型"
        dependencies: [task_1_1]
      - id: task_2_2
        description: "订单流程"
        dependencies: [task_2_1]

  - id: worker_3
    name: "集成测试"
    agent: claude
    tasks:
      - id: task_3_1
        description: "API 测试"
        dependencies: [task_1_2, task_2_2]

context:
  token_budget: 200000
  hub_allocation: 80000
  worker_allocation: 40000
  compaction_threshold: 0.8

output:
  format: "markdown"
  include_raw_logs: false
```

### 8.2 依赖执行图

```
Task 1_1 (User Model) ──┬──→ Task 1_2 (User Auth)
                        │
                        └──→ Task 2_1 (Order Model) ──→ Task 2_2 (Order Flow)
                                                        │
                                                        └──→ Task 3_1 (Integration Test)
                
并行: Task 1_1, Task 1_2, Task 2_1
串行: Task 1_2 等待 Task 1_1
串行: Task 2_1 等待 Task 1_1
串行: Task 2_2 等待 Task 2_1
串行: Task 3_1 等待 Task 1_2 + Task 2_2
```

---

## 九、API 接口

### 9.1 Agent API

```
POST   /api/agent/start          启动 Agent Session
POST   /api/agent/message         发送消息
POST   /api/agent/stop            停止 Agent
GET    /api/agent/status          获取状态
GET    /api/agent/logs            获取执行日志
```

### 9.2 Session API

```
POST   /api/session               创建 Session
GET    /api/session/{id}          获取 Session
PUT    /api/session/{id}          更新 Session
DELETE /api/session/{id}          删除 Session
GET    /api/session/{id}/context  获取上下文
```

### 9.3 Analysis API

```
GET    /api/analysis/{session_id}       获取分析报告
GET    /api/analysis/{session_id}/metrics 获取指标
POST   /api/analysis/{session_id}/regenerate 重新生成报告
```

### 9.4 Context API

```
POST   /api/context/sync          触发上下文同步
GET    /api/context/{worker_id}    获取 Worker 上下文
POST   /api/context/merge          合并上下文
GET    /api/context/conflicts      获取冲突列表
POST   /api/context/resolve/{id}   解决冲突
```

---

## 十、开发计划

### Phase 1: 核心框架（1-2 周）

- [ ] 项目初始化（Tauri + FastAPI）
- [ ] Agent Adapter 抽象层
- [ ] Claude Code Connector 实现
- [ ] 基础聊天界面
- [ ] WebSocket 实时日志

### Phase 2: Hooks + 分析（2-3 周）

- [ ] 14 个 Hooks 全量捕获
- [ ] 日志写入与回放
- [ ] AI 分析引擎
- [ ] 分析报告生成
- [ ] 分析仪表盘

### Phase 3: 多 Agent 协作（2-3 周）

- [ ] Hub 任务分解
- [ ] Worker 调度器
- [ ] 主从复制协议
- [ ] 上下文冲突处理
- [ ] 多 Worker 并行执行

### Phase 4: 完善与扩展（1-2 周）

- [ ] Codex Connector
- [ ] Monaco 文件编辑
- [ ] Git Sync
- [ ] 性能优化
- [ ] 文档完善

---

## 十一、待 Codex 补充

| # | 事项 | 说明 |
|---|---|---|
| 1 | Claude Code subprocess 通信细节 | stdin/stdout 交互协议 |
| 2 | Hooks 触发方式和参数 | 具体怎么调用 Python 脚本 |
| 3 | Codex API 接口规范 | OpenAI兼容还是自定义 |
| 4 | Monaco 多文件管理策略 | tab 模式 vs 预览模式 |
| 5 | Git Sync 具体实现 | git 命令封装 |
| 6 | WebSocket 心跳机制 | 重连策略 |
| 7 | 数据库迁移方案 | MongoDB 升级路径 |
| 8 | 部署文档 | Docker / 绿色版 |

---

## 附录

### A. 术语表

| 术语 | 定义 |
|---|---|
| CLAW | Coding Agent Lightweight Abstraction Workspace |
| Hub | 主控 Agent，负责任务分解和调度 |
| Worker | 执行 Agent，负责具体子任务 |
| SubContext | Worker 的子上下文 |
| Global Context | Hub 的全局上下文 |
| Hook | 事件钩子，用于捕获 Agent 执行过程 |
| jsonl | JSON Lines，每行一个 JSON 的格式 |

### B. 参考资料

- Claude Code: https://docs.anthropic.com/claude-code
- Tauri: https://tauri.app/
- FastAPI: https://fastapi.tiangolo.com/
- Monaco Editor: https://microsoft.github.io/monaco-editor/

### C. 依赖版本

| 依赖 | 版本 |
|---|---|
| Node.js | 18+ |
| Python | 3.10+ |
| Tauri | 2.x |
| React | 18.x |
| FastAPI | 0.100+ |
| Claude Code | 最新版 |
