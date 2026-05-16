# doc/CLAW-v1.0-需求架构Spec.md

> 模块：`doc` · 语言：`markdown` · 行数：825

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
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
│   │   ├── c
... (truncated)
```
