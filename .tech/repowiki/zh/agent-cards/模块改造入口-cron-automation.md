# 模块改造入口：cron-automation

<agent_card id="module-cron-automation" kind="module">

## 什么时候用
当任务落在 cron-automation 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `src/electron/libs/cron-db.ts`: 包含 SQLite/FTS/vector schema 或索引写入
- `src/electron/libs/cron-ipc-handlers.ts`: 定义或调用跨进程接口

## 相关文件
- `src/electron/libs/cron-db.ts`
- `src/electron/libs/cron-ipc-handlers.ts`

## 改代码指南
- 先确认需求是否真的属于 cron-automation，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build
- npm run qa:knowledge

## 风险点
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。

## 检索关键词
cron-automation, cron-db.ts, database:cron_jobs, database:idx_cron_jobs_conversation, database:idx_cron_jobs_next_run, cron-ipc-handlers.ts, ipc:cron:list-jobs, ipc:cron:list-jobs-by-conversation, ipc:cron:get-job, ipc:cron:add-job, ipc:cron:update-job, ipc:cron:remove-job, ipc:cron:run-now

## 代码信号
- database:cron_jobs
- database:idx_cron_jobs_conversation
- database:idx_cron_jobs_next_run
- ipc:cron:list-jobs
- ipc:cron:list-jobs-by-conversation
- ipc:cron:get-job
- ipc:cron:add-job
- ipc:cron:update-job
- ipc:cron:remove-job
- ipc:cron:run-now

</agent_card>
