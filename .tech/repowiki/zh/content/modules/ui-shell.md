# ui-shell

> 负责 24 个文件组成的 ui-shell 功能域。

ui-shell 模块包含 24 个被扫描文件，关键入口包括 `src/ui/App.tsx`, `src/ui/types.ts`, `src/ui/components/TaskPanel.tsx`, `src/ui/components/PromptInput.tsx`, `src/ui/dev-electron-shim.ts`, `src/ui/components/git/index.ts`, `src/ui/components/EventCard.tsx`, `src/ui/pages/cron/useCronJobs.ts`。

本地静态分析识别到这些代码信号：entrypoint, ui_ipc, event, store，因此本页可以作为后续 Agent 定位接口、存储、事件和运行入口的索引。

## Agent 可用信息

- 定位 ui-shell 模块的入口、数据契约和运行风险。
- 在模型没有稳定返回 JSON 时，本页仍由本地代码信号生成，不能再退化为空白说明。

## 优先入口

- `src/ui/App.tsx`：入口文件，适合从这里追踪启动链路；代码信号：entrypoint:src/ui/App.tsx, ui_ipc:sessions:list, ui_ipc:shell:openExternal, event:separator, event:message, event:process_group, event:session.history, event:session.list；关键符号：`DevElectronRuntimeSource`, `SCROLL_THRESHOLD`, `INITIAL_HISTORY_LIMIT`, `HISTORY_PAGE_LIMIT`, `MIN_CENTER_WIDTH`, `MIN_SIDEBAR_WIDTH`
- `src/ui/types.ts`：代码信号：event:user_prompt, event:stream.message, event:stream.user_prompt, event:session.status, event:session.plan.updated, event:session.workflow, event:session.workflow.catalog, event:session.list；导出：`ApiModelConfigProfile`, `ApiProviderMode`, `ApiConfigProfile`, `ApiConfigSettings`, `RuntimeReasoningMode`, `RuntimePermissionMode`, `AgentRunSurface`, `ManagedSkill`；关键符号：`ApiModelConfigProfile`, `ApiProviderMode`, `ApiConfigProfile`, `ApiConfigSettings`, `RuntimeReasoningMode`, `RuntimePermissionMode`
- `src/ui/components/TaskPanel.tsx`：代码信号：event:task.list, event:task.stats, event:task.settings.get, event:task.providers, event:task.execution.logs, event:task.sync, event:task.execute, event:task.control；导出：`TaskPanel`；关键符号：`Props`, `isRecord`, `getAssigneeCount`, `members`, `getProviderLabel`, `formatShortId`
- `src/ui/components/PromptInput.tsx`：代码信号：ui_ipc:slash-commands:list, event:browser_annotations, event:browser_annotation, event:text, event:code_references, event:message_references, event:file_references, event:session.start；导出：`usePromptActions`, `PromptInput`；关键符号：`CodeReferenceDraft`, `FileReferenceDraft`, `MessageReferenceDraft`, `PermissionRequest`, `AddPromptAttachmentDetail`, `DEFAULT_ALLOWED_TOOLS`
- `src/ui/dev-electron-shim.ts`：代码信号：event:session.list, event:session.history, event:user_prompt, event:agent.list, event:mcp.list, event:builtin；导出：`DEV_BRIDGE_READY_EVENT`, `DEV_BROWSER_PREVIEW_FLAG`, `DevElectronRuntimeSource`, `getDevElectronRuntimeSource`, `installDevElectronShim`；关键符号：`browserPreviewSessionId`, `browserPreviewCwd`, `browserPreviewSlashCommands`, `browserPreviewSlashCommandNames`, `DEV_BACKEND_BRIDGE_ORIGIN`, `BRIDGE_BOOT_RETRY_COUNT`
- `src/ui/components/git/index.ts`：入口文件，适合从这里追踪启动链路；代码信号：entrypoint:src/ui/components/git/index.ts；导出：`GitWorkbenchPanel`
- `src/ui/components/EventCard.tsx`：代码信号：event:user_prompt, event:tool_use, event:tool_result, store:EventCard；导出：`isMarkdown`, `MessageCard`；关键符号：`MessageContent`, `ToolResultContent`, `ToolStatus`, `SystemInitMessage`, `AskUserQuestionInput`, `BrowserAnnotationsPayload`
- `src/ui/pages/cron/useCronJobs.ts`：代码信号：ui_ipc:cron:update-job, ui_ipc:cron:remove-job, ui_ipc:cron:list-jobs-by-conversation, ui_ipc:cron:list-jobs；导出：`useCronJobs`, `useAllCronJobs`；关键符号：`ElectronAPI`, `getElectron`, `CronJobActionsResult`, `useCronJobActions`, `pauseJob`, `updated`

## 文件

### `src/ui/App.tsx`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:src/ui/App.tsx, ui_ipc:sessions:list, ui_ipc:shell:openExternal, event:separator, event:message, event:process_group, event:session.history, event:session.list；关键符号：`DevElectronRuntimeSource`, `SCROLL_THRESHOLD`, `INITIAL_HISTORY_LIMIT`, `HISTORY_PAGE_LIMIT`, `MIN_CENTER_WIDTH`, `MIN_SIDEBAR_WIDTH`

- `DevElectronRuntimeSource` (type) - type DevElectronRuntimeSource,
- `SCROLL_THRESHOLD` (const) - const SCROLL_THRESHOLD = 50;
- `INITIAL_HISTORY_LIMIT` (const) - const INITIAL_HISTORY_LIMIT = 400;
- `HISTORY_PAGE_LIMIT` (const) - const HISTORY_PAGE_LIMIT = 200;
- `MIN_CENTER_WIDTH` (const) - const MIN_CENTER_WIDTH = 300;
- `MIN_SIDEBAR_WIDTH` (const) - const MIN_SIDEBAR_WIDTH = 250;
- `MIN_ACTIVITY_RAIL_WIDTH` (const) - const MIN_ACTIVITY_RAIL_WIDTH = 400;
- `GlobalRuntimeConfig` (type) - type GlobalRuntimeConfig = Record<string, unknown>;
- `RenderEntry` (type) - type RenderEntry =
- `isRecord` (function) - function isRecord(value: unknown): value is Record<string, unknown> {
- `getMessageContentItems` (function) - function getMessageContentItems(message: StreamMessage): unknown[] {
- `envelope` (const) - const envelope = message as { message?: unknown };

### `src/ui/types.ts`

代码信号：event:user_prompt, event:stream.message, event:stream.user_prompt, event:session.status, event:session.plan.updated, event:session.workflow, event:session.workflow.catalog, event:session.list；导出：`ApiModelConfigProfile`, `ApiProviderMode`, `ApiConfigProfile`, `ApiConfigSettings`, `RuntimeReasoningMode`, `RuntimePermissionMode`, `AgentRunSurface`, `ManagedSkill`；关键符号：`ApiModelConfigProfile`, `ApiProviderMode`, `ApiConfigProfile`, `ApiConfigSettings`, `RuntimeReasoningMode`, `RuntimePermissionMode`

- `ApiModelConfigProfile` (type) - export type ApiModelConfigProfile = {
- `ApiProviderMode` (type) - export type ApiProviderMode = "custom" | "deepseek" | "codex";
- `ApiConfigProfile` (type) - export type ApiConfigProfile = {
- `ApiConfigSettings` (type) - export type ApiConfigSettings = {
- `RuntimeReasoningMode` (type) - export type RuntimeReasoningMode = "disabled" | "low" | "medium" | "high" | "xhigh";
- `RuntimePermissionMode` (type) - export type RuntimePermissionMode = "default" | "bypassPermissions" | "plan";
- `AgentRunSurface` (type) - export type AgentRunSurface = "development" | "maintenance";
- `ManagedSkill` (type) - export type ManagedSkill = {
- `SkillTarget` (type) - export type SkillTarget = {
- `SkillToolToggle` (type) - export type SkillToolToggle = {
- `ToolInfo` (type) - export type ToolInfo = {
- `Scenario` (type) - export type Scenario = {

### `src/ui/components/TaskPanel.tsx`

代码信号：event:task.list, event:task.stats, event:task.settings.get, event:task.providers, event:task.execution.logs, event:task.sync, event:task.execute, event:task.control；导出：`TaskPanel`；关键符号：`Props`, `isRecord`, `getAssigneeCount`, `members`, `getProviderLabel`, `formatShortId`

- `Props` (type) - type Props = {
- `isRecord` (function) - function isRecord(value: unknown): value is Record<string, unknown> {
- `getAssigneeCount` (function) - function getAssigneeCount(task: UiTask): number {
- `members` (const) - const members = task.sourceData?.members;
- `getProviderLabel` (function) - function getProviderLabel(task: UiTask): string {
- `formatShortId` (function) - function formatShortId(id: string): string {
- `formatDate` (function) - function formatDate(value?: number): string | null {
- `date` (const) - const date = new Date(value);
- `formatTime` (function) - function formatTime(value: number): string {
- `formatDateTime` (function) - function formatDateTime(value?: number): string | null {
- `date` (const) - const date = new Date(value);
- `formatCost` (function) - function formatCost(value?: number): string {

### `src/ui/components/PromptInput.tsx`

代码信号：ui_ipc:slash-commands:list, event:browser_annotations, event:browser_annotation, event:text, event:code_references, event:message_references, event:file_references, event:session.start；导出：`usePromptActions`, `PromptInput`；关键符号：`CodeReferenceDraft`, `FileReferenceDraft`, `MessageReferenceDraft`, `PermissionRequest`, `AddPromptAttachmentDetail`, `DEFAULT_ALLOWED_TOOLS`

- `CodeReferenceDraft` (type) - type CodeReferenceDraft,
- `FileReferenceDraft` (type) - type FileReferenceDraft,
- `MessageReferenceDraft` (type) - type MessageReferenceDraft,
- `PermissionRequest` (type) - type PermissionRequest,
- `AddPromptAttachmentDetail` (type) - type AddPromptAttachmentDetail,
- `DEFAULT_ALLOWED_TOOLS` (const) - const DEFAULT_ALLOWED_TOOLS = "*";
- `MAX_ROWS` (const) - const MAX_ROWS = 12;
- `LINE_HEIGHT` (const) - const LINE_HEIGHT = 21;
- `MAX_HEIGHT` (const) - const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT;
- `SLASH_PREVIEW_LIMIT` (const) - const SLASH_PREVIEW_LIMIT = 8;
- `SLASH_QUERY_LIMIT` (const) - const SLASH_QUERY_LIMIT = 16;
- `FILE_MENTION_PREVIEW_LIMIT` (const) - const FILE_MENTION_PREVIEW_LIMIT = 10;

### `src/ui/dev-electron-shim.ts`

代码信号：event:session.list, event:session.history, event:user_prompt, event:agent.list, event:mcp.list, event:builtin；导出：`DEV_BRIDGE_READY_EVENT`, `DEV_BROWSER_PREVIEW_FLAG`, `DevElectronRuntimeSource`, `getDevElectronRuntimeSource`, `installDevElectronShim`；关键符号：`browserPreviewSessionId`, `browserPreviewCwd`, `browserPreviewSlashCommands`, `browserPreviewSlashCommandNames`, `DEV_BACKEND_BRIDGE_ORIGIN`, `BRIDGE_BOOT_RETRY_COUNT`

- `browserPreviewSessionId` (const) - const browserPreviewSessionId = "browser-preview-session";
- `browserPreviewCwd` (const) - const browserPreviewCwd = "/Users/lst01/Desktop/学习/tech-cc-hub";
- `browserPreviewSlashCommands` (const) - const browserPreviewSlashCommands = [
- `browserPreviewSlashCommandNames` (const) - const browserPreviewSlashCommandNames = browserPreviewSlashCommands.map((command) => command.name);
- `DEV_BACKEND_BRIDGE_ORIGIN` (const) - const DEV_BACKEND_BRIDGE_ORIGIN = "/__dev_bridge";
- `BRIDGE_BOOT_RETRY_COUNT` (const) - const BRIDGE_BOOT_RETRY_COUNT = 20;
- `BRIDGE_BOOT_RETRY_DELAY_MS` (const) - const BRIDGE_BOOT_RETRY_DELAY_MS = 250;
- `BRIDGE_HEALTH_TIMEOUT_MS` (const) - const BRIDGE_HEALTH_TIMEOUT_MS = 500;
- `DEV_BRIDGE_READY_EVENT` (const) - export const DEV_BRIDGE_READY_EVENT = "tech-cc-hub:dev-bridge-ready";
- `DEV_BROWSER_PREVIEW_FLAG` (const) - export const DEV_BROWSER_PREVIEW_FLAG = "__tech_cc_hub_browser_preview";
- `DEV_SHIM_MARKER` (const) - const DEV_SHIM_MARKER = "__techCCHubDevShim";
- `DevElectronRuntimeSource` (type) - export type DevElectronRuntimeSource = "bridge" | "fallback" | "electron";

### `src/ui/components/git/index.ts`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:src/ui/components/git/index.ts；导出：`GitWorkbenchPanel`

### `src/ui/components/EventCard.tsx`

代码信号：event:user_prompt, event:tool_use, event:tool_result, store:EventCard；导出：`isMarkdown`, `MessageCard`；关键符号：`MessageContent`, `ToolResultContent`, `ToolStatus`, `SystemInitMessage`, `AskUserQuestionInput`, `BrowserAnnotationsPayload`

- `MessageContent` (type) - type MessageContent = SDKAssistantMessage["message"]["content"][number];
- `ToolResultContent` (type) - type ToolResultContent = SDKUserMessage["message"]["content"][number];
- `ToolStatus` (type) - type ToolStatus = "pending" | "success" | "error";
- `SystemInitMessage` (type) - type SystemInitMessage = SDKMessage & {
- `AskUserQuestionInput` (type) - type AskUserQuestionInput = {
- `BrowserAnnotationsPayload` (type) - type BrowserAnnotationsPayload = {
- `BrowserAnnotationSourceCandidate` (type) - type BrowserAnnotationSourceCandidate = {
- `BrowserAnnotationSummary` (type) - type BrowserAnnotationSummary = {
- `toolStatusMap` (const) - const toolStatusMap = new Map<string, ToolStatus>();
- `toolStatusListeners` (const) - const toolStatusListeners = new Set<() => void>();
- `MAX_VISIBLE_LINES` (const) - const MAX_VISIBLE_LINES = 8;
- `cx` (const) - const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

### `src/ui/pages/cron/useCronJobs.ts`

代码信号：ui_ipc:cron:update-job, ui_ipc:cron:remove-job, ui_ipc:cron:list-jobs-by-conversation, ui_ipc:cron:list-jobs；导出：`useCronJobs`, `useAllCronJobs`；关键符号：`ElectronAPI`, `getElectron`, `CronJobActionsResult`, `useCronJobActions`, `pauseJob`, `updated`

- `ElectronAPI` (type) - type ElectronAPI = any;
- `getElectron` (function) - function getElectron(): ElectronAPI {
- `CronJobActionsResult` (interface) - interface CronJobActionsResult {
- `useCronJobActions` (function) - function useCronJobActions(
- `pauseJob` (const) - const pauseJob = useCallback(async (jobId: string) => {
- `updated` (const) - const updated = await getElectron().invoke("cron:update-job", { jobId, updates: { enabled: false } });
- `resumeJob` (const) - const resumeJob = useCallback(async (jobId: string) => {
- `updated` (const) - const updated = await getElectron().invoke("cron:update-job", { jobId, updates: { enabled: true } });
- `deleteJob` (const) - const deleteJob = useCallback(async (jobId: string) => {
- `updateJob` (const) - const updateJob = useCallback(async (jobId: string, updates: Partial<CronJob>) => {
- `updated` (const) - const updated = await getElectron().invoke("cron:update-job", { jobId, updates });
- `useCronJobs` (function) - export function useCronJobs(conversationId?: string) {

### `src/ui/components/DecisionPanel.tsx`

代码信号：store:DecisionPanel；导出：`DecisionPanel`；关键符号：`AskUserQuestionInput`, `DecisionPanel`, `input`, `questions`, `figmaAuthUrl`, `allowFreeformAnswer`

- `AskUserQuestionInput` (type) - type AskUserQuestionInput = {
- `DecisionPanel` (function) - export function DecisionPanel({
- `input` (const) - const input = request.input as AskUserQuestionInput | null;
- `questions` (const) - const questions = input?.questions ?? [];
- `figmaAuthUrl` (const) - const figmaAuthUrl = typeof input?.figmaAuthUrl === "string" ? input.figmaAuthUrl : "";
- `allowFreeformAnswer` (const) - const allowFreeformAnswer = !figmaAuthUrl;
- `toggleOption` (const) - const toggleOption = (qIndex: number, optionLabel: string, multiSelect?: boolean) => {
- `current` (const) - const current = prev[qIndex] ?? [];
- `next` (const) - const next = current.includes(optionLabel)
- `buildAnswers` (const) - const buildAnswers = () => {
- `selected` (const) - const selected = selectedOptions[qIndex] ?? [];
- `otherText` (const) - const otherText = allowFreeformAnswer ? otherInputs[qIndex]?.trim() ?? "" : "";

### `src/ui/components/AionWorkspacePreviewPane.tsx`

代码信号：event:module, event:directory, store:AionWorkspacePreviewPane；导出：`AionWorkspacePreviewPane`；关键符号：`PreviewQuickOpenEntry`, `MonacoWorkerEnvironment`, `MonacoTypeScriptDefaults`, `MonacoTypeScriptRuntime`, `monacoGlobal`, `previewMonacoDefaultsConfigured`

- `PreviewQuickOpenEntry` (type) - type PreviewQuickOpenEntry,
- `MonacoWorkerEnvironment` (type) - type MonacoWorkerEnvironment = typeof self & {
- `MonacoTypeScriptDefaults` (type) - type MonacoTypeScriptDefaults = {
- `MonacoTypeScriptRuntime` (type) - type MonacoTypeScriptRuntime = {
- `monacoGlobal` (const) - const monacoGlobal = self as MonacoWorkerEnvironment;
- `previewMonacoDefaultsConfigured` (const) - let previewMonacoDefaultsConfigured = false;
- `ROOT_DEPTH` (const) - const ROOT_DEPTH = 0;
- `AionWorkspacePreviewPaneProps` (type) - type AionWorkspacePreviewPaneProps = {
- `PreviewEntry` (type) - type PreviewEntry = {
- `PreviewQuickOpenResponse` (type) - type PreviewQuickOpenResponse = {
- `DirectoryState` (type) - type DirectoryState = {
- `PreviewContentType` (type) - type PreviewContentType = 'code' | 'html' | 'image';

### `src/ui/components/git/GitBranchStashPanel.tsx`

导出：`GitBranchStashPanel`；关键符号：`BranchStashMode`, `MaybePromise`, `GitBranchStashPanel`, `localBranches`, `remoteBranches`, `disabled`

- `BranchStashMode` (type) - type BranchStashMode = "branches" | "stashes";
- `MaybePromise` (type) - type MaybePromise<T> = T | Promise<T>;
- `GitBranchStashPanel` (function) - export function GitBranchStashPanel({
- `localBranches` (const) - const localBranches = useMemo(() => branches.filter((branch) => !branch.remote), [branches]);
- `remoteBranches` (const) - const remoteBranches = useMemo(() => branches.filter((branch) => branch.remote), [branches]);
- `disabled` (const) - const disabled = Boolean(actionBusy);
- `BranchGroup` (function) - function BranchGroup({
- `current` (const) - const current = branch.name === currentBranch || branch.current;

### `src/ui/components/git/GitCommitDetailPanel.tsx`

导出：`GitCommitDetailPanel`；关键符号：`GitCommitDetailPanel`, `diffHtml`, `diff`

- `GitCommitDetailPanel` (function) - export function GitCommitDetailPanel({
- `diffHtml` (const) - const diffHtml = useMemo(() => {
- `diff` (const) - const diff = detail?.diff?.trim();

### `src/ui/components/git/GitHistoryPanel.tsx`

导出：`GitHistoryPanel`；关键符号：`GRAPH_COLORS`, `GRAPH_LANE_WIDTH`, `GRAPH_LEFT_OFFSET`, `GRAPH_ROW_HEIGHT`, `GitHistoryPanel`, `branchOptions`

- `GRAPH_COLORS` (const) - const GRAPH_COLORS = ["#4d91ff", "#f4bf37", "#db4b93", "#22c55e", "#b16cff", "#38bdf8"];
- `GRAPH_LANE_WIDTH` (const) - const GRAPH_LANE_WIDTH = 14;
- `GRAPH_LEFT_OFFSET` (const) - const GRAPH_LEFT_OFFSET = 12;
- `GRAPH_ROW_HEIGHT` (const) - const GRAPH_ROW_HEIGHT = 28;
- `GitHistoryPanel` (function) - export function GitHistoryPanel({
- `branchOptions` (const) - const branchOptions = useMemo(() => buildBranchOptions(branches, currentBranch), [branches, currentBranch]);
- `visibleHistory` (const) - const visibleHistory = useMemo(() => {
- `maxLane` (const) - const maxLane = visibleHistory.reduce((max, commit) => Math.max(max, commit.graphLane), 0);
- `graphWidth` (const) - const graphWidth = Math.max(78, GRAPH_LEFT_OFFSET + (maxLane + 2) * GRAPH_LANE_WIDTH);
- `laneRanges` (const) - const laneRanges = useMemo(() => buildLaneRanges(visibleHistory), [visibleHistory]);
- `CommitRow` (function) - function CommitRow({
- `refs` (const) - const refs = normalizeRefs(commit.refs);

### `src/ui/hooks/useIPC.ts`

导出：`useIPC`；关键符号：`useIPC`, `unsubscribeRef`, `unsubscribe`, `sendEvent`

- `useIPC` (function) - export function useIPC(onEvent: (event: ServerEvent) => void) {
- `unsubscribeRef` (const) - const unsubscribeRef = useRef<(() => void) | null>(null);
- `unsubscribe` (const) - const unsubscribe = window.electron.onServerEvent((event: ServerEvent) => {
- `sendEvent` (const) - const sendEvent = useCallback((event: ClientEvent) => {

### `src/ui/components/git/GitWorkbenchPanel.tsx`

导出：`GitWorkbenchPanel`；关键符号：`GitWorkbenchTab`, `GitWorkbenchPanel`, `workbench`, `snapshot`, `logMode`, `tabCounts`

- `GitWorkbenchTab` (type) - type GitWorkbenchTab = "changes" | "log" | "branches" | "stashes";
- `GitWorkbenchPanel` (function) - export function GitWorkbenchPanel({ cwd }: { cwd?: string }) {
- `workbench` (const) - const workbench = useGitWorkbench(cwd);
- `snapshot` (const) - const snapshot = workbench.snapshot;
- `logMode` (const) - const logMode = activeTab === "log";
- `tabCounts` (const) - const tabCounts = useMemo(() => {
- `files` (const) - const files = snapshot?.files ?? [];
- `closeConfirm` (const) - const closeConfirm = () => setConfirm(null);
- `confirmAndClose` (const) - const confirmAndClose = (state: GitConfirmDialogState) => {
- `Icon` (const) - const Icon = tab.icon;
- `active` (const) - const active = activeTab === tab.id;
- `GitEmptyState` (function) - function GitEmptyState({

### `src/ui/components/PreviewPanel.tsx`

导出：`PreviewPanel`；关键符号：`PreviewFile`, `PreviewTab`, `PreviewPanelProps`, `IMAGE_EXTENSIONS`, `isImageFile`, `ext`

- `PreviewFile` (type) - type PreviewFile = {
- `PreviewTab` (type) - type PreviewTab = PreviewFile & {
- `PreviewPanelProps` (type) - type PreviewPanelProps = {
- `IMAGE_EXTENSIONS` (const) - const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"]);
- `isImageFile` (function) - function isImageFile(filePath: string): boolean {
- `ext` (const) - const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
- `detectLanguage` (function) - function detectLanguage(filePath: string): string | undefined {
- `ext` (const) - const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
- `fileNameFromPath` (function) - function fileNameFromPath(filePath: string): string {
- `highlightCode` (function) - function highlightCode(code: string, language?: string): string {
- `PreviewPanel` (function) - export function PreviewPanel({ files, activeFileId, onClose, onSelectFile }: PreviewPanelProps) {
- `imgRef` (const) - const imgRef = useRef<HTMLImageElement>(null);

### `src/ui/components/cron/ScheduledTasksPage.tsx`

代码信号：ui_ipc:cron:run-now, ui_ipc:cron:remove-job, store:ScheduledTasksPage；关键符号：`ScheduledTasksPageProps`, `formatWorkspaceName`, `parts`, `sessions`, `archivedSessions`, `allSessions`

- `ScheduledTasksPageProps` (interface) - interface ScheduledTasksPageProps {
- `formatWorkspaceName` (function) - function formatWorkspaceName(cwd?: string) {
- `parts` (const) - const parts = cwd.split(/[\\/]+/).filter(Boolean);
- `sessions` (const) - const sessions = useAppStore((s) => s.sessions);
- `archivedSessions` (const) - const archivedSessions = useAppStore((s) => s.archivedSessions);
- `allSessions` (const) - const allSessions = useMemo(() => ({ ...archivedSessions, ...sessions }), [sessions, archivedSessions]);
- `conversationMap` (const) - const conversationMap = useMemo(() => {
- `map` (const) - const map = new Map<string, { cwd?: string; title: string }>();
- `workspaceGroups` (const) - const workspaceGroups = useMemo(() => {
- `groups` (const) - const groups = new Map<string, { cwd?: string; jobs: CronJob[] }>();
- `convId` (const) - const convId = job.metadata.conversationId;
- `existing` (const) - const existing = groups.get("__system__");

### `src/ui/main.tsx`

关键符号：`bootstrap`

- `bootstrap` (function) - async function bootstrap() {

### `src/ui/events.ts`

导出：`PROMPT_FOCUS_EVENT`, `PROMPT_SUBMIT_EVENT`, `PROMPT_SENT_EVENT`, `PREVIEW_OPEN_FILE_EVENT`, `OPEN_BROWSER_WORKBENCH_URL_EVENT`, `ADD_PROMPT_ATTACHMENT_EVENT`, `PreviewOpenFileDetail`, `OpenBrowserWorkbenchUrlDetail`；关键符号：`PROMPT_FOCUS_EVENT`, `PROMPT_SUBMIT_EVENT`, `PROMPT_SENT_EVENT`, `PREVIEW_OPEN_FILE_EVENT`, `OPEN_BROWSER_WORKBENCH_URL_EVENT`, `ADD_PROMPT_ATTACHMENT_EVENT`

- `PROMPT_FOCUS_EVENT` (const) - export const PROMPT_FOCUS_EVENT = "techcc:prompt-focus";
- `PROMPT_SUBMIT_EVENT` (const) - export const PROMPT_SUBMIT_EVENT = "techcc:prompt-submit";
- `PROMPT_SENT_EVENT` (const) - export const PROMPT_SENT_EVENT = "techcc:prompt-sent";
- `PREVIEW_OPEN_FILE_EVENT` (const) - export const PREVIEW_OPEN_FILE_EVENT = "techcc:preview-open-file";
- `OPEN_BROWSER_WORKBENCH_URL_EVENT` (const) - export const OPEN_BROWSER_WORKBENCH_URL_EVENT = "tech-cc-hub:open-browser-workbench-url";
- `ADD_PROMPT_ATTACHMENT_EVENT` (const) - export const ADD_PROMPT_ATTACHMENT_EVENT = "techcc:add-prompt-attachment";
- `PreviewOpenFileDetail` (type) - export type PreviewOpenFileDetail = {
- `OpenBrowserWorkbenchUrlDetail` (type) - export type OpenBrowserWorkbenchUrlDetail = {
- `AddPromptAttachmentDetail` (type) - export type AddPromptAttachmentDetail = {

### `src/ui/components/ModelSelect.tsx`

导出：`ModelOption`, `MODEL_GROUP_DEFINITIONS`, `ModelSelect`, `buildGroupedModelOptions`, `getModelSearchScore`, `getFuzzySubsequenceScore`, `isFuzzySubsequence`；关键符号：`ModelOption`, `ModelGroup`, `ScoredModelOption`, `ScoredModelGroup`, `ModelGroupDefinition`, `ModelSelectVariant`

- `ModelOption` (type) - export type ModelOption = {
- `ModelGroup` (type) - type ModelGroup = {
- `ScoredModelOption` (type) - type ScoredModelOption = ModelOption & {
- `ScoredModelGroup` (type) - type ScoredModelGroup = Omit<ModelGroup, "options"> & {
- `ModelGroupDefinition` (type) - type ModelGroupDefinition = {
- `ModelSelectVariant` (type) - type ModelSelectVariant = "settings" | "composer";
- `ModelSelectPlacement` (type) - type ModelSelectPlacement = "bottom" | "top";
- `ModelSelectProps` (type) - type ModelSelectProps = {
- `ModelSelect` (function) - export function ModelSelect({
- `labelId` (const) - const labelId = useId();
- `listboxId` (const) - const listboxId = useId();
- `containerRef` (const) - const containerRef = useRef<HTMLDivElement>(null);

### `src/ui/components/cron/CreateTaskDialog.tsx`

代码信号：ui_ipc:cron:update-job, ui_ipc:cron:add-job；关键符号：`CreateTaskDialogProps`, `FrequencyType`, `ExecutionMode`, `WEEKDAYS`, `parseCronExpr`, `parts`

- `CreateTaskDialogProps` (interface) - interface CreateTaskDialogProps {
- `FrequencyType` (type) - type FrequencyType = "manual" | "hourly" | "daily" | "weekdays" | "weekly" | "custom";
- `ExecutionMode` (type) - type ExecutionMode = "new_conversation" | "existing";
- `WEEKDAYS` (const) - const WEEKDAYS = [
- `parseCronExpr` (function) - function parseCronExpr(expr: string): { frequency: FrequencyType; time: string; weekday: string } {
- `parts` (const) - const parts = expr.trim().split(/\s+/);
- `hh` (const) - const hh = String(hour).padStart(2, "0");
- `mm` (const) - const mm = String(min).padStart(2, "0");
- `dayUpper` (const) - const dayUpper = dow.toUpperCase();
- `matched` (const) - const matched = WEEKDAYS.find((d) => d.value === dayUpper);
- `hh` (const) - const hh = String(hour).padStart(2, "0");
- `mm` (const) - const mm = String(min).padStart(2, "0");

### `src/ui/components/git/git-ui-utils.ts`

导出：`fileStatusLabel`, `fileStatusClassName`, `shortenPath`, `repoDisplayName`, `formatAheadBehind`, `formatRelativeTime`；关键符号：`fileStatusLabel`, `fileStatusClassName`, `shortenPath`, `parts`, `fileName`, `parent`

- `fileStatusLabel` (function) - export function fileStatusLabel(status: UiGitChangedFile["status"]) {
- `fileStatusClassName` (function) - export function fileStatusClassName(status: UiGitChangedFile["status"]) {
- `shortenPath` (function) - export function shortenPath(path: string, maxLength = 54) {
- `parts` (const) - const parts = path.split("/");
- `fileName` (const) - const fileName = parts.pop() ?? path;
- `parent` (const) - const parent = parts.pop();
- `prefix` (const) - const prefix = parent ? `.../${parent}/` : ".../";
- `budget` (const) - const budget = Math.max(12, maxLength - prefix.length);
- `repoDisplayName` (function) - export function repoDisplayName(status?: UiGitRepoStatus | null) {
- `formatAheadBehind` (function) - export function formatAheadBehind(status?: UiGitRepoStatus | null) {
- `parts` (const) - const parts = [];
- `formatRelativeTime` (function) - export function formatRelativeTime(value: string) {

### `src/ui/utils/activity-workspace-tabs.ts`

导出：`ActivityRailTab`, `ActivityWorkspaceTab`, `ActivityWorkspaceTabItem`, `buildActivityWorkspaceTabs`, `shouldShowCreateBrowserTab`；关键符号：`ActivityRailTab`, `ActivityWorkspaceTab`, `ActivityWorkspaceTabItem`, `buildActivityWorkspaceTabs`, `shouldShowCreateBrowserTab`

- `ActivityRailTab` (type) - export type ActivityRailTab = "trace" | "usage" | "preview" | "git";
- `ActivityWorkspaceTab` (type) - export type ActivityWorkspaceTab = "browser" | ActivityRailTab;
- `ActivityWorkspaceTabItem` (type) - export type ActivityWorkspaceTabItem = {
- `buildActivityWorkspaceTabs` (function) - export function buildActivityWorkspaceTabs(input: {
- `shouldShowCreateBrowserTab` (function) - export function shouldShowCreateBrowserTab(showBrowserTab: boolean): boolean {

### `src/ui/components/BrowserWorkbenchPage.tsx`

代码信号：store:BrowserWorkbenchPage；导出：`BrowserWorkbenchPage`；关键符号：`BrowserWorkbenchPageProps`, `AnnotationTool`, `isBrowserPreviewRuntime`, `hasBrowserWorkbenchRuntime`, `LocalBrowserTarget`, `RECENT_LOCAL_BROWSER_TARGETS_KEY`

- `BrowserWorkbenchPageProps` (type) - type BrowserWorkbenchPageProps = {
- `AnnotationTool` (type) - type AnnotationTool = "screenshot" | "page";
- `isBrowserPreviewRuntime` (const) - const isBrowserPreviewRuntime = () => (
- `hasBrowserWorkbenchRuntime` (const) - const hasBrowserWorkbenchRuntime = () => (
- `LocalBrowserTarget` (type) - type LocalBrowserTarget = {
- `RECENT_LOCAL_BROWSER_TARGETS_KEY` (const) - const RECENT_LOCAL_BROWSER_TARGETS_KEY = "tech-cc-hub:browser-workbench:recent-local-targets";
- `COMMON_LOCAL_BROWSER_PORTS` (const) - const COMMON_LOCAL_BROWSER_PORTS = [3000, 4173, 5173, 8000, 8001, 8080];
- `MAX_LOCAL_BROWSER_TARGETS` (const) - const MAX_LOCAL_BROWSER_TARGETS = 5;
- `MAX_RECENT_LOCAL_BROWSER_TARGETS` (const) - const MAX_RECENT_LOCAL_BROWSER_TARGETS = 5;
- `LocalTargetStatus` (type) - type LocalTargetStatus = "checking" | "online" | "offline";
- `probeLocalTarget` (function) - async function probeLocalTarget(url: string, timeoutMs = 1400): Promise<LocalTargetStatus> {
- `controller` (const) - const controller = new AbortController();

## 数据与接口契约

- **ui_ipc:sessions:list**：src/ui/App.tsx:721 - renderer IPC invoke
- **ui_ipc:shell:openExternal**：src/ui/App.tsx:1474 - renderer IPC invoke
- **event:separator**：src/ui/App.tsx:46 - typed event payload
- **event:message**：src/ui/App.tsx:47 - typed event payload
- **event:process_group**：src/ui/App.tsx:48 - typed event payload
- **event:session.history**：src/ui/App.tsx:580 - typed event payload
- **event:session.list**：src/ui/App.tsx:725 - typed event payload
- **event:session.create**：src/ui/App.tsx:997 - typed event payload
- **event:session.delete**：src/ui/App.tsx:1041 - typed event payload
- **event:session.archive**：src/ui/App.tsx:1045 - typed event payload
- **event:user_prompt**：src/ui/types.ts:270 - typed event payload
- **event:stream.message**：src/ui/types.ts:328 - typed event payload
- **event:stream.user_prompt**：src/ui/types.ts:329 - typed event payload
- **event:session.status**：src/ui/types.ts:330 - typed event payload
- **event:session.plan.updated**：src/ui/types.ts:331 - typed event payload
- **event:session.workflow**：src/ui/types.ts:332 - typed event payload
- **event:session.workflow.catalog**：src/ui/types.ts:333 - typed event payload
- **event:session.list**：src/ui/types.ts:334 - typed event payload
- **event:session.history**：src/ui/types.ts:335 - typed event payload
- **event:session.archived**：src/ui/types.ts:336 - typed event payload
- **event:task.list**：src/ui/components/TaskPanel.tsx:242 - typed event payload
- **event:task.stats**：src/ui/components/TaskPanel.tsx:243 - typed event payload
- **event:task.settings.get**：src/ui/components/TaskPanel.tsx:244 - typed event payload
- **event:task.providers**：src/ui/components/TaskPanel.tsx:245 - typed event payload
- **event:task.execution.logs**：src/ui/components/TaskPanel.tsx:295 - typed event payload
- **event:task.sync**：src/ui/components/TaskPanel.tsx:438 - typed event payload
- **event:task.execute**：src/ui/components/TaskPanel.tsx:452 - typed event payload
- **event:task.control**：src/ui/components/TaskPanel.tsx:459 - typed event payload
- **event:task.delete**：src/ui/components/TaskPanel.tsx:468 - typed event payload
- **event:task.settings.update**：src/ui/components/TaskPanel.tsx:483 - typed event payload
- **ui_ipc:slash-commands:list**：src/ui/components/PromptInput.tsx:808 - renderer IPC invoke
- **event:browser_annotations**：src/ui/components/PromptInput.tsx:144 - typed event payload
- **event:browser_annotation**：src/ui/components/PromptInput.tsx:148 - typed event payload
- **event:text**：src/ui/components/PromptInput.tsx:163 - typed event payload
- **event:code_references**：src/ui/components/PromptInput.tsx:393 - typed event payload
- **event:message_references**：src/ui/components/PromptInput.tsx:445 - typed event payload

## 关键概念

- **entrypoint**：ui-shell 模块中出现 2 个 entrypoint 信号，可用于定位对应接口或运行职责。
- **ui_ipc**：ui-shell 模块中出现 11 个 ui_ipc 信号，可用于定位对应接口或运行职责。
- **event**：ui-shell 模块中出现 87 个 event 信号，可用于定位对应接口或运行职责。
- **store**：ui-shell 模块中出现 8 个 store 信号，可用于定位对应接口或运行职责。

## 内部关系

- `src/ui/App.tsx` -> `./hooks/useIPC`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/App.tsx` -> `./hooks/useMessageWindow`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/App.tsx` -> `./store/useAppStore`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/App.tsx` -> `./types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/App.tsx` -> `./components/Sidebar`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/App.tsx` -> `./components/StartSessionModal`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/App.tsx` -> `./components/SettingsModal`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/App.tsx` -> `./components/TooltipButton`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/App.tsx` -> `./components/UpdateToast`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/App.tsx` -> `./components/PromptInput`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/App.tsx` -> `./components/EventCard`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/App.tsx` -> `./components/ActivityRail`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/types.ts` -> `../shared/plan-progress.js`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/types.ts` -> `../shared/prompt-ledger.js`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/types.ts` -> `../shared/workflow-markdown.js`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/types.ts` -> `../electron/libs/git/types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/TaskPanel.tsx` -> `../store/taskStore`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/TaskPanel.tsx` -> `../store/useAppStore`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/TaskPanel.tsx` -> `./settings/settings-utils`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/TaskPanel.tsx` -> `../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/PromptInput.tsx` -> `../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/PromptInput.tsx` -> `../store/useAppStore`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/PromptInput.tsx` -> `../utils/clipboard`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/PromptInput.tsx` -> `../utils/browser-annotation-reset`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/PromptInput.tsx` -> `../utils/slash-command-input`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/PromptInput.tsx` -> `../events`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/PromptInput.tsx` -> `./ComposerContextCard`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/PromptInput.tsx` -> `./DecisionPanel`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/PromptInput.tsx` -> `./ModelSelect`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/PromptInput.tsx` -> `./settings/settings-utils`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/dev-electron-shim.ts` -> `./types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/EventCard.tsx` -> `../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/EventCard.tsx` -> `../store/useAppStore`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/EventCard.tsx` -> `../render/markdown`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/EventCard.tsx` -> `./DecisionPanel`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/EventCard.tsx` -> `../../shared/attachments`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/EventCard.tsx` -> `../utils/clipboard`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/EventCard.tsx` -> `../events`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/EventCard.tsx` -> `../utils/code-reference-prompt`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/pages/cron/useCronJobs.ts` -> `../../../types/cron.js`：本地相对依赖，需要按路径解析到目标文件

## 运行注意事项

- 涉及 IPC 的变更必须同时检查主进程 handler、preload/renderer invoke 和开发桥路径。

## 修改风险

- 修改该模块时优先跑对应 QA，并确认 UI 与 Electron 运行态不是 stale 状态。

## 验证

- npm run build
- npm run qa:chat-ui
