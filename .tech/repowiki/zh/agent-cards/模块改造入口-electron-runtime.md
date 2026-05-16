# 模块改造入口：electron-runtime

<agent_card id="module-electron-runtime" kind="module">

## 什么时候用
当任务落在 electron-runtime 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `src/electron/main.ts`: Electron 主进程入口，注册窗口、IPC、知识库通道和开发桥
- `src/electron/ipc-handlers.ts`: 会话生命周期和主要 IPC 编排入口
- `src/electron/libs/runner.ts`: Agent system prompt、MCP、工作区和会话执行链路
- `src/electron/libs/session-store.ts`: 包含 SQLite/FTS/vector schema 或索引写入

## 相关文件
- `src/electron/main.ts`
- `src/electron/ipc-handlers.ts`
- `src/electron/libs/runner.ts`
- `src/electron/libs/session-store.ts`

## 改代码指南
- 先确认需求是否真的属于 electron-runtime，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build
- npm run qa:knowledge

## 风险点
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。

## 检索关键词
electron-runtime, main.ts, entrypoint:src/electron/main.ts, ipc:preview-list-directory, ipc:preview-list-files, ipc:sessions:list, ipc:slash-commands:list, ipc:plugins:getOpenComputerUseStatus, ipc:plugins:checkOpenComputerUseUpdate, ipc:plugins:installOpenComputerUse, ipc-handlers.ts, event:task.updated, event:task.deleted, event:task.execution.started, event:task.execution.completed, event:task.execution.log, event:task.stats, event:task.sync.completed, event:task.error, runner.ts, event:object, event:array, event:number, event:string

## 代码信号
- entrypoint:src/electron/main.ts
- ipc:preview-list-directory
- ipc:preview-list-files
- ipc:sessions:list
- ipc:slash-commands:list
- ipc:plugins:getOpenComputerUseStatus
- ipc:plugins:checkOpenComputerUseUpdate
- ipc:plugins:installOpenComputerUse
- event:task.updated
- event:task.deleted
- event:task.execution.started
- event:task.execution.completed
- event:task.execution.log
- event:task.stats
- event:task.sync.completed
- event:task.error
- event:object
- event:array
- event:number
- event:string
- event:json_schema
- event:stream.message
- event:permission.request
- event:session.plan.updated
- database:sessions
- database:messages
- database:messages_session_id
- database:messages_session_created_id

</agent_card>
