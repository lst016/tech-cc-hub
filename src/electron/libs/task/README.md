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
