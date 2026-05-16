# src/electron/libs/task/README.md

> 模块：`task-engine` · 语言：`markdown` · 行数：23

## 文件职责

配置文件

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Task Module

任务系统主进程代码统一收在这个目录，避免 `src/electron/libs` 根目录继续散落 `task-*` 文件。

## 边界

- `types.ts`: 任务、执行记录、IPC payload 的领域类型。
- `provider-registry.ts`: Provider 注册表和 fallback provider。
- `providers/`: 外部任务源适配器，目前包含 Lark。
- `repository.ts`: SQLite schema、任务状态、执行记录和日志持久化。
- `workflow.ts`: Symphony-style workflow 配置、轮询、重试和 stall 默认参数。
- `workspace.ts`: 每个任务的独立 workspace 创建和路径安全。
- `executor.ts`: 编排器，负责同步、自动执行、并发控制、重试、恢复和日志事件。
- `index.ts`: 对外统一出口。外部模块优先从这里 import。

## 运行原则

- 外部 provider 只负责把第三方任务映射成 `ExternalTask`，不直接改 UI 或会话。
- Repository 只做持久化，不启动 runner。
- Executor 是唯一调度入口，所有自动/手动执行都经过这里。
- 任务执行使用独立 workspace，避免多个任务互相污染。
- 旧任务库数据允许丢弃，schema 变化优先保持代码简单。

```
