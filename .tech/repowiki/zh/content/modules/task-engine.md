# task-engine

> 负责任务同步、持久化、执行、重试、恢复和独立 workspace 管理。

task-engine 模块包含 12 个被扫描文件，关键入口包括 `src/electron/libs/task/types.ts`, `src/electron/libs/task/repository.ts`, `src/electron/libs/task/index.ts`, `src/electron/libs/task/README.md`, `src/electron/libs/task/executor.ts`, `src/electron/libs/task/provider-registry.ts`, `src/electron/libs/task/providers/lark-provider.ts`, `src/electron/libs/task/settings.ts`。

本地静态分析识别到这些代码信号：event, database, entrypoint, config，因此本页可以作为后续 Agent 定位接口、存储、事件和运行入口的索引。

## Agent 可用信息

- 定位 task-engine 模块的入口、数据契约和运行风险。
- 在模型没有稳定返回 JSON 时，本页仍由本地代码信号生成，不能再退化为空白说明。

## 优先入口

- `src/electron/libs/task/types.ts`：代码信号：event:task.list, event:task.updated, event:task.deleted, event:task.execution.started, event:task.execution.completed, event:task.execution.log, event:task.execution.bundle, event:task.settings；导出：`TaskProviderId`, `ExternalTaskStatus`, `LocalTaskStatus`, `TaskPriority`, `TaskClaimState`, `TaskAgentDriverId`, `TaskReasoningMode`, `TaskExecutionControlAction`；关键符号：`TaskProviderId`, `ExternalTaskStatus`, `LocalTaskStatus`, `TaskPriority`, `TaskClaimState`, `TaskAgentDriverId`
- `src/electron/libs/task/repository.ts`：代码信号：database:tasks, database:task_executions, database:task_execution_logs, database:task_subtasks, database:task_artifacts, database:task_dismissals, database:idx_tasks_provider, database:idx_tasks_local_status；导出：`TaskRepository`；关键符号：`Row`, `TaskRepository`, `tasksTable`, `hasTasksColumns`, `hasExecutionColumns`, `hasChildTables`
- `src/electron/libs/task/index.ts`：入口文件，适合从这里追踪启动链路；代码信号：entrypoint:src/electron/libs/task/index.ts；导出：`TaskExecutor`, `TaskRepository`, `registerTaskProvider`, `getTaskProvider`, `listTaskProviders`, `listTaskProviderStates`, `ensureProvider`, `loadTaskWorkflowConfig`
- `src/electron/libs/task/README.md`：配置文件，会影响构建、开发或模型能力；代码信号：config:src/electron/libs/task/README.md
- `src/electron/libs/task/executor.ts`：代码信号：event:stream.user_prompt, event:task.execution.bundle, event:session.status；导出：`TaskExecutorEvents`, `TaskExecutorOptions`, `TaskExecutor`；关键符号：`TaskExecutorEvents`, `TaskExecutorOptions`, `CompletionResult`, `UsageSnapshot`, `RunningExecution`, `ExecuteOptions`
- `src/electron/libs/task/providers/lark-provider.ts`：代码信号：event:my_tasks, event:open_id；导出：`LarkTaskProvider`；关键符号：`LarkTaskItem`, `LarkCliPayload`, `mapLarkStatus`, `mapLarkPriority`, `LarkProviderConfig`, `LARK_TASK_PAGE_SIZE`

## 文件

### `src/electron/libs/task/types.ts`

代码信号：event:task.list, event:task.updated, event:task.deleted, event:task.execution.started, event:task.execution.completed, event:task.execution.log, event:task.execution.bundle, event:task.settings；导出：`TaskProviderId`, `ExternalTaskStatus`, `LocalTaskStatus`, `TaskPriority`, `TaskClaimState`, `TaskAgentDriverId`, `TaskReasoningMode`, `TaskExecutionControlAction`；关键符号：`TaskProviderId`, `ExternalTaskStatus`, `LocalTaskStatus`, `TaskPriority`, `TaskClaimState`, `TaskAgentDriverId`

- `TaskProviderId` (type) - export type TaskProviderId = "lark" | "tb" | "feishu-project";
- `ExternalTaskStatus` (type) - export type ExternalTaskStatus =
- `LocalTaskStatus` (type) - export type LocalTaskStatus =
- `TaskPriority` (type) - export type TaskPriority = "low" | "medium" | "high" | "urgent";
- `TaskClaimState` (type) - export type TaskClaimState =
- `TaskAgentDriverId` (type) - export type TaskAgentDriverId = "claude" | "codex-app-server";
- `TaskReasoningMode` (type) - export type TaskReasoningMode = "disabled" | "low" | "medium" | "high" | "xhigh";
- `TaskExecutionControlAction` (type) - export type TaskExecutionControlAction = "pause" | "resume" | "cancel" | "cancel-retry";
- `TaskExecutionOptions` (type) - export type TaskExecutionOptions = {
- `ExternalTask` (type) - export type ExternalTask = {
- `StoredTask` (type) - export type StoredTask = ExternalTask & {
- `TaskExecution` (type) - export type TaskExecution = {

### `src/electron/libs/task/repository.ts`

代码信号：database:tasks, database:task_executions, database:task_execution_logs, database:task_subtasks, database:task_artifacts, database:task_dismissals, database:idx_tasks_provider, database:idx_tasks_local_status；导出：`TaskRepository`；关键符号：`Row`, `TaskRepository`, `tasksTable`, `hasTasksColumns`, `hasExecutionColumns`, `hasChildTables`

- `Row` (type) - type Row = Record<string, unknown>;
- `TaskRepository` (class) - export class TaskRepository {
- `tasksTable` (const) - const tasksTable = this.db
- `hasTasksColumns` (const) - const hasTasksColumns = this.hasColumns("tasks", [
- `hasExecutionColumns` (const) - const hasExecutionColumns = this.hasColumns("task_executions", [
- `hasChildTables` (const) - const hasChildTables = this.hasTable("task_subtasks") && this.hasTable("task_artifacts");
- `exists` (const) - const exists = this.db
- `rows` (const) - const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
- `present` (const) - const present = new Set(rows.map((row) => row.name));
- `now` (const) - const now = Date.now();
- `existing` (const) - const existing = this.db
- `currentLocalStatus` (const) - const currentLocalStatus = String(existing.local_status);

### `src/electron/libs/task/index.ts`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:src/electron/libs/task/index.ts；导出：`TaskExecutor`, `TaskRepository`, `registerTaskProvider`, `getTaskProvider`, `listTaskProviders`, `listTaskProviderStates`, `ensureProvider`, `loadTaskWorkflowConfig`

### `src/electron/libs/task/README.md`

配置文件，会影响构建、开发或模型能力；代码信号：config:src/electron/libs/task/README.md

### `src/electron/libs/task/executor.ts`

代码信号：event:stream.user_prompt, event:task.execution.bundle, event:session.status；导出：`TaskExecutorEvents`, `TaskExecutorOptions`, `TaskExecutor`；关键符号：`TaskExecutorEvents`, `TaskExecutorOptions`, `CompletionResult`, `UsageSnapshot`, `RunningExecution`, `ExecuteOptions`

- `TaskExecutorEvents` (type) - export type TaskExecutorEvents = {
- `TaskExecutorOptions` (type) - export type TaskExecutorOptions = {
- `CompletionResult` (type) - type CompletionResult = {
- `UsageSnapshot` (type) - type UsageSnapshot = {
- `RunningExecution` (type) - type RunningExecution = {
- `ExecuteOptions` (type) - type ExecuteOptions = TaskExecutionOptions & {
- `INTERRUPTED_EXECUTION_ERROR` (const) - const INTERRUPTED_EXECUTION_ERROR = "应用已重启，上一轮任务执行进程已中断。";
- `DEFAULT_EXECUTION_TIMEOUT_MS` (const) - const DEFAULT_EXECUTION_TIMEOUT_MS = 30 * 60 * 1000;
- `DEFER_RETRY_MS` (const) - const DEFER_RETRY_MS = 5000;
- `MAX_ARTIFACTS` (const) - const MAX_ARTIFACTS = 80;
- `TaskExecutor` (class) - export class TaskExecutor {
- `loadedWorkflow` (const) - const loadedWorkflow = options.workflowConfig ?? loadTaskWorkflowConfig({

### `src/electron/libs/task/provider-registry.ts`

导出：`registerTaskProvider`, `getTaskProvider`, `listTaskProviders`, `listTaskProviderStates`, `ensureProvider`；关键符号：`registry`, `registerTaskProvider`, `getTaskProvider`, `listTaskProviders`, `listTaskProviderStates`, `validation`

- `registry` (const) - const registry = new Map<TaskProviderId, TaskProvider>();
- `registerTaskProvider` (function) - export function registerTaskProvider(provider: TaskProvider): void {
- `getTaskProvider` (function) - export function getTaskProvider(id: TaskProviderId): TaskProvider | undefined {
- `listTaskProviders` (function) - export function listTaskProviders(): TaskProvider[] {
- `listTaskProviderStates` (function) - export async function listTaskProviderStates(): Promise<TaskProviderState[]> {
- `validation` (const) - const validation = await provider.validateConfig();
- `NoopProvider` (class) - class NoopProvider implements TaskProvider {
- `ensureProvider` (function) - export function ensureProvider(id: TaskProviderId): TaskProvider {
- `existing` (const) - const existing = registry.get(id);
- `fallback` (const) - const fallback = new NoopProvider(id);

### `src/electron/libs/task/providers/lark-provider.ts`

代码信号：event:my_tasks, event:open_id；导出：`LarkTaskProvider`；关键符号：`LarkTaskItem`, `LarkCliPayload`, `mapLarkStatus`, `mapLarkPriority`, `LarkProviderConfig`, `LARK_TASK_PAGE_SIZE`

- `LarkTaskItem` (type) - type LarkTaskItem = {
- `LarkCliPayload` (type) - type LarkCliPayload = {
- `mapLarkStatus` (function) - function mapLarkStatus(status?: string): ExternalTaskStatus {
- `mapLarkPriority` (function) - function mapLarkPriority(priority?: string): ExternalTask["priority"] {
- `LarkProviderConfig` (type) - type LarkProviderConfig = {
- `LARK_TASK_PAGE_SIZE` (const) - const LARK_TASK_PAGE_SIZE = 100;
- `RECENT_SYNC_WINDOW_DAYS` (const) - const RECENT_SYNC_WINDOW_DAYS = 30;
- `RECENT_SYNC_WINDOW_MS` (const) - const RECENT_SYNC_WINDOW_MS = RECENT_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000;
- `isRecord` (function) - function isRecord(value: unknown): value is Record<string, unknown> {
- `asText` (function) - function asText(value: unknown): string | undefined {
- `asNumber` (function) - function asNumber(value: unknown): number | undefined {
- `parsed` (const) - const parsed = Number(value);

### `src/electron/libs/task/settings.ts`

导出：`createDefaultTaskSettings`, `loadTaskSettings`, `saveTaskSettings`, `applyTaskSettingsToWorkflow`；关键符号：`CONFIG_KEY`, `createDefaultTaskSettings`, `workflow`, `loadTaskSettings`, `rootConfig`, `raw`

- `CONFIG_KEY` (const) - const CONFIG_KEY = "tasks";
- `createDefaultTaskSettings` (function) - export function createDefaultTaskSettings(userDataPath?: string): TaskWorkflowSettings {
- `workflow` (const) - const workflow = createDefaultTaskWorkflowConfig(userDataPath);
- `loadTaskSettings` (function) - export function loadTaskSettings(userDataPath?: string): TaskWorkflowSettings {
- `rootConfig` (const) - const rootConfig = loadGlobalRuntimeConfig();
- `raw` (const) - const raw = isRecord(rootConfig[CONFIG_KEY]) ? rootConfig[CONFIG_KEY] : {};
- `saveTaskSettings` (function) - export function saveTaskSettings(settings: Partial<TaskWorkflowSettings>, userDataPath?: string): TaskWorkflowSettings {
- `rootConfig` (const) - const rootConfig = loadGlobalRuntimeConfig();
- `current` (const) - const current = loadTaskSettings(userDataPath);
- `next` (const) - const next = normalizeTaskSettings({ ...current, ...settings }, current);
- `applyTaskSettingsToWorkflow` (function) - export function applyTaskSettingsToWorkflow(workflow: TaskWorkflowConfig, settings: TaskWorkflowSettings): TaskWorkflowConfig {
- `normalizeTaskSettings` (function) - function normalizeTaskSettings(raw: unknown, defaults: TaskWorkflowSettings): TaskWorkflowSettings {

### `src/electron/libs/task/workflow.ts`

导出：`TaskWorkflowConfig`, `createDefaultTaskWorkflowConfig`, `loadTaskWorkflowConfig`, `computeRetryDueAt`；关键符号：`TaskWorkflowConfig`, `DEFAULT_POLLING_INTERVAL_MS`, `DEFAULT_MAX_CONCURRENT_AGENTS`, `DEFAULT_MAX_AUTO_RETRIES`, `DEFAULT_MAX_RETRY_BACKOFF_MS`, `DEFAULT_STALL_TIMEOUT_MS`

- `TaskWorkflowConfig` (type) - export type TaskWorkflowConfig = {
- `DEFAULT_POLLING_INTERVAL_MS` (const) - const DEFAULT_POLLING_INTERVAL_MS = 30000;
- `DEFAULT_MAX_CONCURRENT_AGENTS` (const) - const DEFAULT_MAX_CONCURRENT_AGENTS = 1;
- `DEFAULT_MAX_AUTO_RETRIES` (const) - const DEFAULT_MAX_AUTO_RETRIES = 2;
- `DEFAULT_MAX_RETRY_BACKOFF_MS` (const) - const DEFAULT_MAX_RETRY_BACKOFF_MS = 5 * 60 * 1000;
- `DEFAULT_STALL_TIMEOUT_MS` (const) - const DEFAULT_STALL_TIMEOUT_MS = 5 * 60 * 1000;
- `DEFAULT_HOOK_TIMEOUT_MS` (const) - const DEFAULT_HOOK_TIMEOUT_MS = 30 * 1000;
- `createDefaultTaskWorkflowConfig` (function) - export function createDefaultTaskWorkflowConfig(userDataPath?: string): TaskWorkflowConfig {
- `basePath` (const) - const basePath = userDataPath?.trim() || process.cwd();
- `loadTaskWorkflowConfig` (function) - export function loadTaskWorkflowConfig(options: {
- `config` (const) - const config = createDefaultTaskWorkflowConfig(options.userDataPath);
- `workflowPath` (const) - const workflowPath = findWorkflowPath(options);

### `src/electron/libs/task/providers/feishu-project-provider.ts`

导出：`FeishuProjectTaskProvider`；关键符号：`FeishuProjectWorkItem`, `FeishuProjectCliPayload`, `asText`, `asNumber`, `parsed`, `toEpochMs`

- `FeishuProjectWorkItem` (type) - type FeishuProjectWorkItem = {
- `FeishuProjectCliPayload` (type) - type FeishuProjectCliPayload =
- `asText` (function) - function asText(value: unknown): string | undefined {
- `asNumber` (function) - function asNumber(value: unknown): number | undefined {
- `parsed` (const) - const parsed = Number(value);
- `toEpochMs` (function) - function toEpochMs(value: unknown): number | undefined {
- `parsed` (const) - const parsed = asNumber(value);
- `mapFeishuStatus` (function) - function mapFeishuStatus(status?: string): ExternalTaskStatus {
- `mapFeishuPriority` (function) - function mapFeishuPriority(priority?: string): ExternalTask["priority"] {
- `isRecord` (function) - function isRecord(value: unknown): value is Record<string, unknown> {
- `resolveFeishuProjectConfig` (function) - function resolveFeishuProjectConfig(): { cliCommand: string; workItemType: string; projectKey?: string } {
- `rootConfig` (const) - const rootConfig = loadGlobalRuntimeConfig();

### `src/electron/libs/task/providers/tb-provider.ts`

导出：`TbTaskProvider`；关键符号：`execFileAsync`, `TbTaskItem`, `TbTaskProvider`, `settings`, `settings`, `tasks`

- `execFileAsync` (const) - const execFileAsync = promisify(execFile);
- `TbTaskItem` (type) - type TbTaskItem = {
- `TbTaskProvider` (class) - export class TbTaskProvider implements TaskProvider {
- `settings` (const) - const settings = loadTaskSettings();
- `settings` (const) - const settings = loadTaskSettings();
- `tasks` (const) - const tasks = await this.fetchTasks();
- `settings` (const) - const settings = loadTaskSettings();
- `settings` (const) - const settings = loadTaskSettings();
- `settings` (const) - const settings = loadTaskSettings();
- `args` (const) - const args = splitArgs(renderTemplate(argsTemplate, values));
- `externalId` (const) - const externalId = textValue(item.externalId) ?? textValue(item.id) ?? "";
- `getItems` (function) - function getItems(stdout: string): TbTaskItem[] {

### `src/electron/libs/task/workspace.ts`

导出：`ensureTaskWorkspace`；关键符号：`ensureTaskWorkspace`, `root`, `folderName`, `workspacePath`, `buildWorkspaceFolderName`, `provider`

- `ensureTaskWorkspace` (function) - export function ensureTaskWorkspace(task: StoredTask, config: TaskWorkflowConfig): string {
- `root` (const) - const root = resolve(config.workspace.root);
- `folderName` (const) - const folderName = buildWorkspaceFolderName(task);
- `workspacePath` (const) - const workspacePath = resolve(root, folderName);
- `buildWorkspaceFolderName` (function) - function buildWorkspaceFolderName(task: StoredTask): string {
- `provider` (const) - const provider = sanitizeSegment(task.provider);
- `externalId` (const) - const externalId = sanitizeSegment(task.externalId).slice(0, 48) || sanitizeSegment(task.id).slice(0, 16);
- `title` (const) - const title = sanitizeSegment(task.title).slice(0, 48);
- `sanitizeSegment` (function) - function sanitizeSegment(value: string): string {
- `assertInsideRoot` (function) - function assertInsideRoot(targetPath: string, root: string): void {
- `relation` (const) - const relation = relative(root, targetPath);

## 数据与接口契约

- **event:task.list**：src/electron/libs/task/types.ts:203 - typed event payload
- **event:task.updated**：src/electron/libs/task/types.ts:204 - typed event payload
- **event:task.deleted**：src/electron/libs/task/types.ts:205 - typed event payload
- **event:task.execution.started**：src/electron/libs/task/types.ts:206 - typed event payload
- **event:task.execution.completed**：src/electron/libs/task/types.ts:207 - typed event payload
- **event:task.execution.log**：src/electron/libs/task/types.ts:208 - typed event payload
- **event:task.execution.bundle**：src/electron/libs/task/types.ts:209 - typed event payload
- **event:task.settings**：src/electron/libs/task/types.ts:210 - typed event payload
- **event:task.providers**：src/electron/libs/task/types.ts:211 - typed event payload
- **event:task.stats**：src/electron/libs/task/types.ts:212 - typed event payload
- **database:tasks**：src/electron/libs/task/repository.ts:33 - SQLite table
- **database:task_executions**：src/electron/libs/task/repository.ts:67 - SQLite table
- **database:task_execution_logs**：src/electron/libs/task/repository.ts:88 - SQLite table
- **database:task_subtasks**：src/electron/libs/task/repository.ts:97 - SQLite table
- **database:task_artifacts**：src/electron/libs/task/repository.ts:109 - SQLite table
- **database:task_dismissals**：src/electron/libs/task/repository.ts:120 - SQLite table
- **database:idx_tasks_provider**：src/electron/libs/task/repository.ts:127 - SQLite index
- **database:idx_tasks_local_status**：src/electron/libs/task/repository.ts:128 - SQLite index
- **database:idx_tasks_external_id**：src/electron/libs/task/repository.ts:129 - SQLite index
- **database:idx_tasks_retry_due**：src/electron/libs/task/repository.ts:130 - SQLite index
- **event:stream.user_prompt**：src/electron/libs/task/executor.ts:369 - typed event payload
- **event:task.execution.bundle**：src/electron/libs/task/executor.ts:643 - typed event payload
- **event:session.status**：src/electron/libs/task/executor.ts:683 - typed event payload
- **event:my_tasks**：src/electron/libs/task/providers/lark-provider.ts:206 - typed event payload
- **event:open_id**：src/electron/libs/task/providers/lark-provider.ts:206 - typed event payload

## 关键概念

- **event**：task-engine 模块中出现 24 个 event 信号，可用于定位对应接口或运行职责。
- **database**：task-engine 模块中出现 14 个 database 信号，可用于定位对应接口或运行职责。
- **entrypoint**：task-engine 模块中出现 1 个 entrypoint 信号，可用于定位对应接口或运行职责。
- **config**：task-engine 模块中出现 1 个 config 信号，可用于定位对应接口或运行职责。

## 内部关系

- `src/electron/libs/task/repository.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/executor.ts` -> `./repository.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/executor.ts` -> `./provider-registry.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/executor.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/executor.ts` -> `../runner.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/executor.ts` -> `../claude-settings.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/executor.ts` -> `./workflow.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/executor.ts` -> `./workspace.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/executor.ts` -> `./settings.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/executor.ts` -> `../../types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/executor.ts` -> `../session-store.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/provider-registry.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/providers/lark-provider.ts` -> `../types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/providers/lark-provider.ts` -> `../../claude-settings.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/providers/lark-provider.ts` -> `../../config-store.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/providers/lark-provider.ts` -> `../../external-cli.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/settings.ts` -> `../config-store.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/settings.ts` -> `./workflow.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/settings.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/providers/feishu-project-provider.ts` -> `../types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/providers/feishu-project-provider.ts` -> `../../claude-settings.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/providers/feishu-project-provider.ts` -> `../../config-store.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/providers/feishu-project-provider.ts` -> `../../external-cli.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/providers/tb-provider.ts` -> `../../claude-settings.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/providers/tb-provider.ts` -> `../settings.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/providers/tb-provider.ts` -> `../types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/workspace.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/task/workspace.ts` -> `./workflow.js`：本地相对依赖，需要按路径解析到目标文件

## 运行注意事项

- 涉及 SQLite/FTS/vector schema 的文件变更后，要同时验证迁移、索引行数和重启后的读取。

## 修改风险

- schema 字段或索引名变化会破坏旧数据读取，必须保留迁移或重建路径。

## 验证

- npm run transpile:electron
- npm run qa:smoke
