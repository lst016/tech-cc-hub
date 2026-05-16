# 模块改造入口：task-engine

<agent_card id="module-task-engine" kind="module">

## 什么时候用
当任务落在 task-engine 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `src/electron/libs/task/types.ts`: 被依赖较多或包含关键导出
- `src/electron/libs/task/executor.ts`: 任务执行、恢复、重试、会话归档触发等核心编排
- `src/electron/libs/task/repository.ts`: 包含 SQLite/FTS/vector schema 或索引写入
- `src/electron/libs/task/index.ts`: 入口文件，适合从这里跟踪启动链路
- `src/electron/libs/task/providers/lark-provider.ts`: 被依赖较多或包含关键导出

## 相关文件
- `src/electron/libs/task/types.ts`
- `src/electron/libs/task/executor.ts`
- `src/electron/libs/task/repository.ts`
- `src/electron/libs/task/index.ts`
- `src/electron/libs/task/providers/lark-provider.ts`

## 改代码指南
- 先确认需求是否真的属于 task-engine，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build
- npm run qa:knowledge

## 风险点
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。
- 数据库 schema 变更要考虑旧数据和向量维度。

## 检索关键词
task-engine, types.ts, event:task.list, event:task.updated, event:task.deleted, event:task.execution.started, event:task.execution.completed, event:task.execution.log, event:task.execution.bundle, event:task.settings, executor.ts, event:stream.user_prompt, event:session.status, repository.ts, database:tasks, database:task_executions, database:task_execution_logs, database:task_subtasks, database:task_artifacts, database:task_dismissals, database:idx_tasks_provider, database:idx_tasks_local_status, index.ts, entrypoint:src/electron/libs/task/index.ts

## 代码信号
- event:task.list
- event:task.updated
- event:task.deleted
- event:task.execution.started
- event:task.execution.completed
- event:task.execution.log
- event:task.execution.bundle
- event:task.settings
- event:stream.user_prompt
- event:task.execution.bundle
- event:session.status
- database:tasks
- database:task_executions
- database:task_execution_logs
- database:task_subtasks
- database:task_artifacts
- database:task_dismissals
- database:idx_tasks_provider
- database:idx_tasks_local_status
- entrypoint:src/electron/libs/task/index.ts
- event:my_tasks
- event:open_id

</agent_card>
