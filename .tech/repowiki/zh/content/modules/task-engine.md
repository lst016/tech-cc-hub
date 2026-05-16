# task-engine

> task-engine 模块包含 28 个高价值文件。

模型未返回稳定 JSON 时，RepoWiki 会保留源码扫描得到的文件、符号、依赖和运行信号，避免生成空泛模块页。

## 文件

### `src/electron/libs/task/repository.ts`

源码文件。运行信号：create table: tasks、create table: task_executions、create table: task_execution_logs、create table: task_subtasks、create table: task_artifacts；依赖：better-sqlite3、./types.js

- `asOptionalString` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `asOptionalNumber` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `parseJsonObject` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `TaskRepository` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `tasksTable` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `hasTasksColumns` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `hasExecutionColumns` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `hasChildTables` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `exists` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `rows` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `present` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `now` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `existing` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `currentLocalStatus` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `nextLocalStatus` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs
- `id` (symbol) - create table: tasks, create table: task_executions, create table: task_execution_logs

### `src/electron/libs/task/index.ts`

入口文件

### `src/electron/libs/cron-db.ts`

源码文件。运行信号：create table: cron_jobs；依赖：better-sqlite3、electron、path、fs、./cron-types.js

- `getCronDb` (symbol) - create table: cron_jobs
- `migrate` (symbol) - create table: cron_jobs
- `jobToRow` (symbol) - create table: cron_jobs
- `rowToJob` (symbol) - create table: cron_jobs
- `insertCronJob` (symbol) - create table: cron_jobs
- `updateCronJob` (symbol) - create table: cron_jobs
- `deleteCronJob` (symbol) - create table: cron_jobs
- `getCronJobById` (symbol) - create table: cron_jobs
- `listAllCronJobs` (symbol) - create table: cron_jobs
- `listCronJobsByConversation` (symbol) - create table: cron_jobs
- `listEnabledCronJobs` (symbol) - create table: cron_jobs
- `deleteCronJobsByConversation` (symbol) - create table: cron_jobs
- `userDataPath` (symbol) - create table: cron_jobs
- `dbPath` (symbol) - create table: cron_jobs
- `database` (symbol) - create table: cron_jobs
- `row` (symbol) - create table: cron_jobs

### `src/electron/libs/task/README.md`

配置文件

### `src/electron/libs/cron-service.ts`

源码文件。依赖：croner、./cron-types.js、./cron-repository.js、./cron-event-emitter.js、./cron-executor.js

- `CronService` (symbol)
- `jobs` (symbol)
- `now` (symbol)
- `jobId` (symbol)
- `existing` (symbol)
- `updated` (symbol)
- `job` (symbol)
- `job` (symbol)
- `conversationId` (symbol)
- `timer` (symbol)
- `nextRun` (symbol)
- `timer` (symbol)
- `delay` (symbol)
- `timer` (symbol)
- `timer` (symbol)
- `retryTimer` (symbol)

### `src/electron/libs/task/executor.ts`

源码文件。依赖：fs、path、./repository.js、./provider-registry.js、./types.js

- `parseSubtasks` (symbol)
- `snapshotWorkspace` (symbol)
- `collectArtifacts` (symbol)
- `walkWorkspace` (symbol)
- `shouldSkipPath` (symbol)
- `numberValue` (symbol)
- `TaskExecutor` (symbol)
- `INTERRUPTED_EXECUTION_ERROR` (symbol)
- `DEFAULT_EXECUTION_TIMEOUT_MS` (symbol)
- `DEFER_RETRY_MS` (symbol)
- `MAX_ARTIFACTS` (symbol)
- `loadedWorkflow` (symbol)
- `provider` (symbol)
- `tasks` (symbol)
- `stored` (symbol)
- `message` (symbol)

### `src/electron/libs/task/providers/feishu-project-provider.ts`

源码文件。依赖：../types.js、../../claude-settings.js、../../config-store.js、../../external-cli.js

- `asText` (symbol)
- `asNumber` (symbol)
- `toEpochMs` (symbol)
- `mapFeishuStatus` (symbol)
- `mapFeishuPriority` (symbol)
- `isRecord` (symbol)
- `resolveFeishuProjectConfig` (symbol)
- `getItems` (symbol)
- `FeishuProjectTaskProvider` (symbol)
- `parsed` (symbol)
- `parsed` (symbol)
- `rootConfig` (symbol)
- `envConfig` (symbol)
- `cliCommand` (symbol)
- `workItemType` (symbol)
- `projectKey` (symbol)

### `src/electron/libs/task/providers/lark-provider.ts`

源码文件。依赖：../types.js、../../claude-settings.js、../../config-store.js、../../external-cli.js

- `mapLarkStatus` (symbol)
- `mapLarkPriority` (symbol)
- `isRecord` (symbol)
- `asText` (symbol)
- `asNumber` (symbol)
- `isTruthyCompletion` (symbol)
- `toEpochMs` (symbol)
- `getTaskActivityTime` (symbol)
- `resolveLarkChannelConfig` (symbol)
- `getNestedItems` (symbol)
- `formatCliError` (symbol)
- `LarkTaskProvider` (symbol)
- `LARK_TASK_PAGE_SIZE` (symbol)
- `RECENT_SYNC_WINDOW_DAYS` (symbol)
- `RECENT_SYNC_WINDOW_MS` (symbol)
- `parsed` (symbol)

### `src/electron/libs/task/providers/tb-provider.ts`

源码文件。依赖：child_process、util、../../claude-settings.js、../settings.js、../types.js

- `getItems` (symbol)
- `renderTemplate` (symbol)
- `splitArgs` (symbol)
- `mapStatus` (symbol)
- `mapPriority` (symbol)
- `textValue` (symbol)
- `numberValue` (symbol)
- `isRecord` (symbol)
- `TbTaskProvider` (symbol)
- `execFileAsync` (symbol)
- `settings` (symbol)
- `settings` (symbol)
- `tasks` (symbol)
- `settings` (symbol)
- `settings` (symbol)
- `settings` (symbol)

### `src/electron/libs/task/types.ts`

源码文件

- `TaskProviderId` (symbol)
- `ExternalTaskStatus` (symbol)
- `LocalTaskStatus` (symbol)
- `TaskPriority` (symbol)
- `TaskClaimState` (symbol)
- `TaskAgentDriverId` (symbol)
- `TaskReasoningMode` (symbol)
- `TaskExecutionControlAction` (symbol)
- `TaskExecutionOptions` (symbol)
- `ExternalTask` (symbol)
- `StoredTask` (symbol)
- `TaskExecution` (symbol)
- `TaskExecutionLog` (symbol)
- `TaskFilter` (symbol)
- `TaskStats` (symbol)
- `TaskSubtaskStatus` (symbol)

### `src/electron/libs/task/workflow.ts`

源码文件。依赖：fs、path

- `createDefaultTaskWorkflowConfig` (symbol)
- `loadTaskWorkflowConfig` (symbol)
- `computeRetryDueAt` (symbol)
- `findWorkflowPath` (symbol)
- `extractFrontMatter` (symbol)
- `parseSimpleFrontMatter` (symbol)
- `applyFlatConfig` (symbol)
- `DEFAULT_POLLING_INTERVAL_MS` (symbol)
- `DEFAULT_MAX_CONCURRENT_AGENTS` (symbol)
- `DEFAULT_MAX_AUTO_RETRIES` (symbol)
- `DEFAULT_MAX_RETRY_BACKOFF_MS` (symbol)
- `DEFAULT_STALL_TIMEOUT_MS` (symbol)
- `DEFAULT_HOOK_TIMEOUT_MS` (symbol)
- `basePath` (symbol)
- `config` (symbol)
- `workflowPath` (symbol)

### `src/electron/libs/task/settings.ts`

源码文件。依赖：../config-store.js、./workflow.js、./types.js

- `createDefaultTaskSettings` (symbol)
- `loadTaskSettings` (symbol)
- `saveTaskSettings` (symbol)
- `applyTaskSettingsToWorkflow` (symbol)
- `normalizeTaskSettings` (symbol)
- `intValue` (symbol)
- `textValue` (symbol)
- `isRecord` (symbol)
- `isReasoningMode` (symbol)
- `CONFIG_KEY` (symbol)
- `workflow` (symbol)
- `rootConfig` (symbol)
- `raw` (symbol)
- `rootConfig` (symbol)
- `current` (symbol)
- `next` (symbol)

### `src/electron/libs/cron-ipc-handlers.ts`

源码文件。运行信号：ipcMain.handle: cron:list-jobs、ipcMain.handle: cron:list-jobs-by-conversation、ipcMain.handle: cron:get-job、ipcMain.handle: cron:add-job、ipcMain.handle: cron:update-job；依赖：electron、./cron-types.js、./cron-service.js、./cron-event-emitter.js

- `registerCronIpcHandlers` (symbol) - ipcMain.handle: cron:list-jobs, ipcMain.handle: cron:list-jobs-by-conversation, ipcMain.handle: cron:get-job
- `IpcCronEventEmitter` (symbol) - ipcMain.handle: cron:list-jobs, ipcMain.handle: cron:list-jobs-by-conversation, ipcMain.handle: cron:get-job
- `conversationId` (symbol) - ipcMain.handle: cron:list-jobs, ipcMain.handle: cron:list-jobs-by-conversation, ipcMain.handle: cron:get-job

### `src/electron/libs/cron-executor.ts`

源码文件。依赖：./cron-types.js

- `CronBusyGuard` (symbol)
- `CronJobExecutor` (symbol)
- `state` (symbol)
- `callbacks` (symbol)
- `existing` (symbol)
- `start` (symbol)
- `pollInterval` (symbol)
- `now` (symbol)
- `conversationId` (symbol)
- `text` (symbol)
- `rawText` (symbol)
- `ICronJobExecutor` (symbol)
- `ConversationState` (symbol)
- `IdleCallback` (symbol)

### `src/electron/libs/task/workspace.ts`

源码文件。依赖：fs、path、./types.js、./workflow.js

- `ensureTaskWorkspace` (symbol)
- `buildWorkspaceFolderName` (symbol)
- `sanitizeSegment` (symbol)
- `assertInsideRoot` (symbol)
- `root` (symbol)
- `folderName` (symbol)
- `workspacePath` (symbol)
- `provider` (symbol)
- `externalId` (symbol)
- `title` (symbol)
- `relation` (symbol)

### `src/electron/libs/task/provider-registry.ts`

源码文件。依赖：./types.js

- `registerTaskProvider` (symbol)
- `getTaskProvider` (symbol)
- `listTaskProviders` (symbol)
- `listTaskProviderStates` (symbol)
- `ensureProvider` (symbol)
- `NoopProvider` (symbol)
- `registry` (symbol)
- `validation` (symbol)
- `existing` (symbol)
- `fallback` (symbol)

### `src/types/cron.ts`

源码文件

- `CronSchedule` (symbol)
- `CronJob` (symbol)
- `CreateCronJobParams` (symbol)

### `src/electron/libs/cron-repository.ts`

源码文件。依赖：./cron-types.js、./cron-db.js

- `CronRepository` (symbol)
- `ICronRepository` (symbol)

### `src/electron/libs/cron-event-emitter.ts`

源码文件。依赖：./cron-types.js

- `ICronEventEmitter` (symbol)

### `src/electron/libs/cron-types.ts`

源码文件

- `CronJobRow` (symbol)

### `pro-workflow/scripts/task-created.js`

入口文件

- `data` (symbol)
- `input` (symbol)
- `description` (symbol)

### `pro-workflow/scripts/task-completed.js`

入口文件

- `data` (symbol)
- `input` (symbol)

### `test/electron/task-repository.test.ts`

源码文件。依赖：node:test、node:assert/strict、better-sqlite3、../../src/electron/libs/task/repository.js、../../src/electron/libs/task/types.js

- `createRepo` (symbol)
- `createTask` (symbol)
- `repo` (symbol)
- `task` (symbol)
- `execution` (symbol)
- `stored` (symbol)
- `bundle` (symbol)
- `repo` (symbol)
- `task` (symbol)
- `retrying` (symbol)
- `failed` (symbol)
- `recovered` (symbol)
- `paused` (symbol)

### `doc/40-product/1.0.0/40-delivery/components/CMP-007-TaskGraphCanvas.md`

源码文件

### `doc/40-product/1.0.0/40-delivery/components/CMP-008-TaskNodeCard.md`

源码文件

### `doc/40-product/1.0.0/40-delivery/components/CMP-010-TaskInspectorDrawer.md`

源码文件

### `doc/40-product/1.0.0/40-delivery/components/CMP-012-TaskResultPanel.md`

源码文件

### `doc/40-product/1.0.0/40-delivery/controllers/CTR-003-TaskController.md`

源码文件

## 关键概念

- **确定性文档**: 该模块页由 RepoWiki fallback 从真实源码元数据生成；具体细节见左侧文件页。
