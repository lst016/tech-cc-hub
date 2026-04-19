# CLAW - 编程 Agent 协作平台

**版本：** v0.1（规划中）  
**日期：** 2026-04-18  
**状态：** 需求确认，待开发

---

## 一、项目概述

### 1.1 目标
打造一个 **编程 Agent 协作平台**，实现：
- GUI 可视化控制编程 Agent（Claude Code / Codex）
- 全量 Hooks 观测，增强可控性
- 多 Agent 协作（Hub + Workers 主从模式）
- 本地文件系统驱动，Git 同步配置
- AI 智能分析执行数据（人工干预、返工率、错误率等）

### 1.2 定位
```
┌─────────────────────────────────────────────┐
│                 用户（你）                    │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│              CLAW GUI（Tauri）               │
│   聊天 + 实时日志 + Monaco编辑 + 分析仪表盘  │
└─────────────────────┬───────────────────────┘
                      │
┌─────────────────────▼───────────────────────┐
│            Hub（任务调度中心）                 │
│    任务分解 → Worker 调度 → 结果合并         │
└─────────────────────┬───────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Claude  │  │  Codex   │  │ Skills  │
   │  Code   │  │          │  │         │
   └─────────┘  └─────────┘  └─────────┘
```

### 1.3 分期规划

| 阶段 | 内容 | 目标 |
|---|---|---|
| **一期** | 本地 GUI + 单/多 Worker + 全量 Hooks + 文件系统驱动 | 跑通核心流程 |
| **二期** | MongoDB 运行时数据 + 跨设备同步 | 多设备协作 |
| **三期** | 云端 API Server + 团队协作 | 多用户共享 |

---

## 二、系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        GUI 层（Tauri + React）                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ 聊天控制  │  │ 实时日志  │  │ 文件编辑  │  │    分析仪表盘    │  │
│  │ (CC/W)  │  │ (WebSocket)│ │ (Monaco) │  │ (AI 分析可视化)  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP + WebSocket
┌───────────────────────────────▼─────────────────────────────────┐
│                      后端层（FastAPI Python）                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Agent Adapter Layer（抽象层）            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │  │
│  │  │ Claude Code │  │   Codex     │  │  Future...  │        │  │
│  │  │  Connector  │  │  Connector  │  │  Connector  │        │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────────┐  │
│  │    Hub    │  │   Hooks   │  │  Analyzer │  │  Git Sync   │  │
│  │ (任务调度) │  │ (观测增强) │  │ (AI分析)  │  │ (手动触发)  │  │
│  └───────────┘  └───────────┘  └───────────┘  └─────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ↓                       ↓                       ↓
   本地文件系统              Git 仓库              Agent 执行
   （运行时数据）           （配置同步）          （subprocess）
   - logs/*.jsonl           - skills/*.md
   - sessions/*.md          - config/*.md
   - workspace/*.md          - prompts/*.md
```

### 2.2 Agent Adapter Layer

**统一接口定义：**
```python
class AgentAdapter(Protocol):
    async def start(self, config: AgentConfig) -> str:  # 返回 session_id
    async def send_message(self, session_id: str, message: str) -> None:
    async def stop(self, session_id: str) -> None:
    async def get_status(self, session_id: str) -> AgentStatus:
    def get_hooks_config(self) -> HooksConfig:  # 返回该 Agent 的 Hooks 配置
```

**配置文件 `config/active_agent.json`：**
```json
{
  "active": "claude",
  "agents": {
    "claude": {
      "type": "claude_code",
      "command": "claude",
      "args": ["--print"]
    },
    "codex": {
      "type": "codex",
      "command": "openai-codex",
      "args": []
    }
  }
}
```

---

## 三、技术栈

### 3.1 GUI 层
| 组件 | 技术 | 说明 |
|---|---|---|
| 桌面框架 | Tauri 2.x | 轻量、安全、原生体验 |
| 前端框架 | React 18 + TypeScript | 组件化、类型安全 |
| 状态管理 | Zustand | 轻量、够用 |
| UI 组件 | Tailwind CSS + shadcn/ui | 快速开发 |
| 编辑器 | Monaco Editor | VSCode 同款，Markdown 友好 |
| 实时通信 | WebSocket | 日志流推送 |
| 图表 | Recharts | 分析数据可视化 |

### 3.2 后端层
| 组件 | 技术 | 说明 |
|---|---|---|
| Web 框架 | FastAPI | 高性能、自动文档 |
| 异步通信 | asyncio + aiofiles | 非阻塞文件读写 |
| WebSocket | fastapi.websocket | 实时日志推送 |
| 子进程管理 | asyncio.subprocess | Agent 进程控制 |
| Git 操作 | GitPython | 配置同步 |
| AI 分析 | Claude API / 本地模型 | 执行数据分析 |

### 3.3 数据层
| 类型 | 存储 | 说明 |
|---|---|---|
| 运行时数据 | 本地文件系统 | logs/sessions/workspace |
| 配置数据 | Git 仓库 | skills/config/prompts |
| 二期 | MongoDB | 运行时数据持久化 |

---

## 四、目录结构

```
claw/
├── frontend/                    # Tauri + React GUI
│   ├── src/
│   │   ├── components/         # UI 组件
│   │   │   ├── Chat/           # 聊天控制
│   │   │   ├── LogViewer/      # 实时日志
│   │   │   ├── FileEditor/     # Monaco 编辑器
│   │   │   ├── FileTree/       # 文件树
│   │   │   └── Dashboard/      # 分析仪表盘
│   │   ├── hooks/              # React hooks
│   │   ├── stores/             # Zustand stores
│   │   ├── services/           # API 调用
│   │   └── App.tsx
│   ├── tauri.conf.json
│   └── package.json
│
├── backend/                     # FastAPI 后端
│   ├── adapters/               # Agent Adapter 实现
│   │   ├── base.py             # 抽象基类
│   │   ├── claude_code.py      # Claude Code Connector
│   │   └── codex.py            # Codex Connector
│   ├── hub/                    # 任务调度中心
│   │   ├── __init__.py
│   │   ├── dispatcher.py        # Worker 调度
│   │   ├── merger.py            # 结果合并
│   │   └── session.py           # Session 管理
│   ├── hooks/                  # Hooks 处理器
│   │   ├── manager.py           # Hook 管理器
│   │   └── handlers/            # 各事件处理器
│   ├── analyzer/               # AI 分析模块
│   │   ├── metrics.py           # 指标计算
│   │   └── reporter.py          # 报告生成
│   ├── services/               # 业务服务
│   │   ├── git_sync.py          # Git 同步
│   │   └── file_manager.py      # 文件管理
│   ├── api/                    # API 路由
│   │   ├── chat.py
│   │   ├── logs.py
│   │   ├── files.py
│   │   └── analysis.py
│   └── main.py
│
├── sync/                        # Git 同步目录（配置文件）
│   ├── skills/                  # Skills 定义
│   │   └── README.md
│   ├── config/                  # 系统配置
│   │   ├── active_agent.json    # 当前 Agent
│   │   └── hooks.yaml           # Hooks 配置
│   └── prompts/                 # 提示词模板
│
├── data/                        # 本地运行时数据
│   ├── logs/                    # 执行日志
│   │   └── {session_id}.jsonl
│   ├── sessions/                # Session 上下文
│   │   └── {session_id}.md
│   ├── workspace/               # 工作文件
│   │   └── *.md
│   └── cache/                   # 缓存
│
├── tests/                       # 测试
├── docs/                        # 文档
└── CLAW.md                      # 本文件
```

---

## 五、数据模型

### 5.1 执行日志（logs/{session_id}.jsonl）

每行一个 JSON 事件，全量记录：

```json
// 用户提交消息
{"ts": 1744960000, "type": "human", "content": "帮我写个排序算法"}

// AI 思考过程（可选）
{"ts": 1744960001, "type": "ai_think", "content": "用户需要排序..."}

// 工具调用前
{"ts": 1744960002, "type": "pre_tool", "tool": "bash", "cmd": "cat > sort.py", "args": {}}

// 工具调用后（成功）
{"ts": 1744960003, "type": "post_tool", "tool": "bash", "cmd": "cat > sort.py", "success": true, "duration_ms": 120}

// 工具调用后（失败）
{"ts": 1744960004, "type": "post_tool_failure", "tool": "bash", "cmd": "invalid_cmd", "error": "Command not found", "stack": ""}

// 文件变更
{"ts": 1744960005, "type": "file_change", "files": ["sort.py"], "action": "create"}

// 权限请求
{"ts": 1744960006, "type": "permission", "cmd": "rm -rf /", "approved": true}

// 上下文压缩
{"ts": 1744960007, "type": "pre_compact", "context_size": 150000, "reason": "token_limit"}

// 通知
{"ts": 1744960008, "type": "notification", "content": "任务完成", "level": "info"}

// Session 统计
{"ts": 1744960009, "type": "session_end", "duration_ms": 60000, "total_tokens": 5000, "tools_called": 12, "success": true}
```

### 5.2 Session 上下文（sessions/{session_id}.md）

```markdown
# Session: {session_id}
Started: 2026-04-18 12:00:00
Agent: claude

## Summary
用户请求：实现排序算法
最终状态：完成

## Key Decisions
- 使用快速排序（时间复杂度 O(n log n)）
- 保留原数组不变，返回新数组

## Metrics
- Duration: 60s
- Tokens: 5000
- Tools Called: 12
- Human Interventions: 2
- Rework Count: 1
```

### 5.3 Skills 定义（skills/*.md）

```markdown
---
name: sort_algorithm
description: 生成排序算法实现
triggers:
  - "排序"
  - "sort"
agent: claude
priority: 1
---

# Sort Algorithm Skill

## 触发条件
检测到排序相关请求时触发

## 执行流程
1. 分析数据规模和特性
2. 选择合适算法（快排/归并/计数等）
3. 生成代码
4. 运行测试验证

## 约束
- 必须包含单元测试
- 注释必须完整
```

---

## 六、Hooks 全量事件

Claude Code 支持 **14 个全量 Hooks 事件**：

| 事件 | 触发时机 | 捕获数据 |
|---|---|---|
| **SessionStart** | Session 初始化 | git status、env、初始上下文大小 |
| **UserPromptSubmit** | 用户提交消息 | 原始 prompt、长度、时间戳 |
| **PreToolUse** | 工具执行前 | 工具名、参数、上下文 |
| **PostToolUse** | 工具执行后 | 工具名、结果、耗时、成功状态 |
| **PostToolUseFailure** | 工具执行失败 | 工具名、错误类型、堆栈 |
| **PreCompact** | 上下文压缩前 | 当前上下文大小、压缩原因 |
| **PostCompact** | 上下文压缩后 | 压缩后大小、丢失内容摘要 |
| **PermissionRequest** | 权限弹窗 | 命令详情、是否批准、超时 |
| **Notification** | Claude 发通知 | 通知内容、类型、级别 |
| **Stop** | 响应结束 | 停止原因、token 消耗统计 |
| **SessionEnd** | Session 关闭 | 最终统计、任务完成状态 |
| **SubagentStart** | 子 Agent 启动 | agent 类型、任务描述 |
| **SubagentStop** | 子 Agent 停止 | agent 类型、执行结果 |
| **TaskCompleted** | 任务完成 | 任务描述、完成状态、耗时 |

---

## 七、AI 分析指标体系

### 7.1 核心指标

| 维度 | 指标 | 说明 |
|---|---|---|
| **执行效率** | 单次任务耗时 | Session 开始到结束 |
| | Token 消耗 | 输入 + 输出 token |
| | 工具调用次数 | 总工具调用数 |
| **人工干预** | 人工消息数 | human 消息占比 |
| | 人工消息率 | human / total messages |
| | 平均人工间隔 | 用户多久介入一次 |
| **返工率** | 指令修改次数 | 同一目标重复修改 |
| | 撤销/回退次数 | 撤销操作统计 |
| | 返工率 | rework / total tasks |
| **错误率** | 工具失败次数 | PostToolUseFailure 计数 |
| | 错误类型分布 | 按工具/错误类型分组 |
| | 错误率 | failures / total tools |
| **成功率** | 任务完成率 | TaskCompleted success |
| | 子任务完成率 | 各子任务完成情况 |
| **路径复杂度** | 总步骤数 | Session 中所有步骤 |
| | 工具调用链深度 | 嵌套调用层数 |
| | 上下文压缩次数 | PreCompact 计数 |
| **Skills 命中率** | 触发 skill 类型 | 命中的 skill 列表 |
| | Skill 使用频率 | 各 skill 调用次数 |
| | Skill 效果评分 | 触发后任务完成质量 |

### 7.2 分析报告格式（analysis/{session_id}.md）

```markdown
# 执行分析报告

## 基本信息
- Session: {id}
- Agent: claude
- 时间: 2026-04-18 12:00:00
- 总耗时: 60s

## 效率指标
- Token 消耗: 5,000
- 工具调用: 12 次

## 人工干预分析
- 人工消息: 3 条 (23%)
- 返工次数: 1 次
- ⚠️ 返工原因: 排序算法选择不当

## 错误分析
- 工具失败: 1 次
- 错误类型: bash (1次)
- ✅ 错误已自动恢复

## Skills 使用
- 触发: sort_algorithm
- 效果: ✅ 成功

## 综合评分
- 效率: ⭐⭐⭐⭐
- 质量: ⭐⭐⭐⭐⭐
- 可维护性: ⭐⭐⭐⭐

## 改进建议
1. 任务开始前先确认数据规模和特性
2. 复杂任务先分解再执行
```

---

## 八、Hub + Workers 多 Agent 协作

### 8.1 协作模式

```
┌─────────────────────────────────────────────────────────────┐
│                          Hub（主控）                          │
│  任务接收 → 智能分解 → Worker 调度 → 结果合并 → 观测记录   │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ↓               ↓               ↓
     ┌─────────┐    ┌─────────┐    ┌─────────┐
     │Worker 1 │    │Worker 2 │    │Worker 3 │
     │(Agent A)│    │(Agent B)│    │(Agent C)│
     │ 做子任务│    │ 做子任务│    │ 做子任务│
     │    A    │    │    B    │    │    C    │
     └─────────┘    └─────────┘    └─────────┘
```

### 8.2 协作流程

```
用户: "帮我实现用户系统和订单系统"

Hub 接收请求
    ↓
任务分解
    - Worker 1: 用户系统（注册/登录/权限）
    - Worker 2: 订单系统（下单/支付/物流）
    - Worker 3: 公共模块（数据库连接/日志）
    ↓
并行/串行执行（按依赖关系）
    ↓
结果收集
    ↓
自动合并 + 冲突检测
    ↓
观测记录（Hooks 全量捕获）
    ↓
分析报告生成
```

### 8.3 依赖关系管理

```python
# config/workflow.yaml
workflows:
  user_order_system:
    tasks:
      - id: common
        name: 公共模块
        workers: [worker_3]
        
      - id: user_system
        name: 用户系统
        workers: [worker_1]
        depends_on: [common]
        
      - id: order_system
        name: 订单系统
        workers: [worker_2]
        depends_on: [common, user_system]
```

---

## 九、一期 MVP 范围

### 9.1 必须实现

| 功能 | 优先级 | 说明 |
|---|---|---|
| GUI 基础框架 | P0 | Tauri + React 搭建 |
| 聊天控制 CC | P0 | 消息收发、Session 管理 |
| 实时日志流 | P0 | WebSocket 推送 |
| 本地文件编辑 | P0 | Monaco Editor |
| 文件树管理 | P0 | 目录浏览、文件操作 |
| Claude Code Connector | P0 | subprocess 通信 |
| 全量 Hooks 捕获 | P0 | 14 个事件全覆盖 |
| AI 分析基础 | P1 | 核心指标计算 |
| Git Sync 基础 | P1 | 手动 pull/push |
| Hub 单 Worker 模式 | P1 | 任务调度基础 |
| 分析仪表盘 | P2 | 可视化展示 |

### 9.2 二期扩展

| 功能 | 说明 |
|---|---|
| MongoDB 集成 | 运行时数据持久化 |
| 多 Worker 并行 | Hub + 多 Worker 协作 |
| Codex Connector | 第二种 Agent 支持 |
| 跨设备同步 | 云端 API + 数据同步 |

---

## 十、开发计划

### Phase 1: 核心框架（预计 2 周）
- [ ] 项目初始化（Tauri + React + FastAPI）
- [ ] Claude Code Connector 实现
- [ ] 基础聊天功能
- [ ] 实时日志 WebSocket

### Phase 2: 文件系统 + Hooks（预计 2 周）
- [ ] Monaco Editor 集成
- [ ] 文件树组件
- [ ] 全量 Hooks 捕获
- [ ] 日志写入和读取

### Phase 3: AI 分析 + Git Sync（预计 1 周）
- [ ] 核心指标计算
- [ ] 分析报告生成
- [ ] Git Sync 功能
- [ ] 分析仪表盘

### Phase 4: Hub + Workers（预计 2 周）
- [ ] Hub 任务调度
- [ ] 多 Worker 支持
- [ ] 结果合并
- [ ] 协作流程优化

---

## 十一、风险与备选

| 风险 | 应对 |
|---|---|
| Claude Code Hooks 接口变更 | 预留抽象层，灵活适配 |
| Monaco Editor 性能问题 | 大文件分页加载 |
| WebSocket 长连接断线 | 自动重连 + 消息缓冲 |
| 多 Worker 资源竞争 | 进程隔离 + 资源限制 |

---

## 附录

### A. 相关文档
- Claude Code Hooks: `https://docs.anthropic.com/claude-code/hooks`
- Tauri 文档: `https://tauri.app/`
- FastAPI 文档: `https://fastapi.tiangolo.com/`

### B. 参考项目
- Continue.dev: VSCode 中的 AI 编程插件
- Claude Desktop: Anthropic 官方桌面应用
- Cursor: AI 代码编辑器
