# shared-contracts

> 负责 15 个文件组成的 shared-contracts 功能域。

shared-contracts 模块包含 15 个被扫描文件，关键入口包括 `src/shared/attachments.ts`, `src/shared/activity-rail-model.ts`, `src/shared/prompt-ledger.ts`, `src/shared/runner-status.ts`, `src/shared/workflow-markdown.ts`, `src/shared/runner-prompt.ts`, `src/shared/plan-progress.ts`, `src/shared/codex-oauth.ts`。

本地静态分析识别到这些代码信号：event, store，因此本页可以作为后续 Agent 定位接口、存储、事件和运行入口的索引。

## Agent 可用信息

- 定位 shared-contracts 模块的入口、数据契约和运行风险。
- 在模型没有稳定返回 JSON 时，本页仍由本地代码信号生成，不能再退化为空白说明。

## 优先入口

- `src/shared/attachments.ts`：代码信号：event:user_prompt, event:text, event:image, event:base64, store:attachments；导出：`TEXT_ATTACHMENT_PROMPT_CHAR_LIMIT`, `AttachmentLike`, `StoredUserPromptMessage`, `createStoredUserPromptMessage`, `estimateAttachmentPromptChars`, `resolveImageAttachmentSrc`, `isInlineImageAttachmentData`, `buildAnthropicPromptContentBlocks`；关键符号：`BASE64_IMAGE_DATA_PATTERN`, `DATA_URL_PREFIX_PATTERN`, `URL_PREFIX_PATTERN`, `TEXT_ATTACHMENT_PROMPT_CHAR_LIMIT`, `AttachmentLike`, `StoredUserPromptMessage`
- `src/shared/activity-rail-model.ts`：代码信号：event:user_prompt；导出：`ActivityRailTone`, `ActivityRailLayer`, `ActivityRailFilterKey`, `ActivityStageKind`, `ActivityTaskStepStatus`, `ActivityPlanStepStatus`, `ActivityMetricStatus`, `ActivityNodeKind`；关键符号：`ActivityRailTone`, `ActivityRailLayer`, `ActivityRailFilterKey`, `ActivityStageKind`, `ActivityTaskStepStatus`, `ActivityPlanStepStatus`
- `src/shared/prompt-ledger.ts`：代码信号：event:prompt_ledger；导出：`PromptLedgerSourceKind`, `PromptLedgerSource`, `PromptLedgerAttachmentSource`, `PromptLedgerBucket`, `PromptLedgerSegmentKind`, `PromptLedgerRiskKind`, `PromptLedgerSegment`, `PromptLedgerMessage`；关键符号：`PromptLedgerSourceKind`, `PromptLedgerSource`, `PromptLedgerAttachmentSource`, `PromptLedgerBucket`, `PromptLedgerSegmentKind`, `PromptLedgerRiskKind`

## 文件

### `src/shared/attachments.ts`

代码信号：event:user_prompt, event:text, event:image, event:base64, store:attachments；导出：`TEXT_ATTACHMENT_PROMPT_CHAR_LIMIT`, `AttachmentLike`, `StoredUserPromptMessage`, `createStoredUserPromptMessage`, `estimateAttachmentPromptChars`, `resolveImageAttachmentSrc`, `isInlineImageAttachmentData`, `buildAnthropicPromptContentBlocks`；关键符号：`BASE64_IMAGE_DATA_PATTERN`, `DATA_URL_PREFIX_PATTERN`, `URL_PREFIX_PATTERN`, `TEXT_ATTACHMENT_PROMPT_CHAR_LIMIT`, `AttachmentLike`, `StoredUserPromptMessage`

- `BASE64_IMAGE_DATA_PATTERN` (const) - const BASE64_IMAGE_DATA_PATTERN = /^[A-Za-z0-9+/=\s]+$/;
- `DATA_URL_PREFIX_PATTERN` (const) - const DATA_URL_PREFIX_PATTERN = /^data:/i;
- `URL_PREFIX_PATTERN` (const) - const URL_PREFIX_PATTERN = /^(blob:|https?:|file:)/i;
- `TEXT_ATTACHMENT_PROMPT_CHAR_LIMIT` (const) - export const TEXT_ATTACHMENT_PROMPT_CHAR_LIMIT = 120_000;
- `AttachmentLike` (type) - export type AttachmentLike = {
- `StoredUserPromptMessage` (type) - export type StoredUserPromptMessage<TAttachment> = {
- `createStoredUserPromptMessage` (function) - export function createStoredUserPromptMessage<TAttachment>(
- `estimateAttachmentPromptChars` (function) - export function estimateAttachmentPromptChars(attachment: AttachmentLike): number {
- `priorityLine` (const) - const priorityLine = `${formatAttachmentName(attachment)} (${attachment.kind}, ${attachment.mimeType || "unknown"}${typeof attachment.size === "number" ? `, ${attachment.size} byte...
- `runtimeImageData` (const) - const runtimeImageData = attachment.runtimeData?.trim();
- `normalizedSummary` (const) - const normalizedSummary = attachment.summaryText?.trim();
- `normalizedText` (const) - const normalizedText = (attachment.summaryText ?? attachment.data).trim();

### `src/shared/activity-rail-model.ts`

代码信号：event:user_prompt；导出：`ActivityRailTone`, `ActivityRailLayer`, `ActivityRailFilterKey`, `ActivityStageKind`, `ActivityTaskStepStatus`, `ActivityPlanStepStatus`, `ActivityMetricStatus`, `ActivityNodeKind`；关键符号：`ActivityRailTone`, `ActivityRailLayer`, `ActivityRailFilterKey`, `ActivityStageKind`, `ActivityTaskStepStatus`, `ActivityPlanStepStatus`

- `ActivityRailTone` (type) - export type ActivityRailTone = "neutral" | "info" | "success" | "warning" | "error";
- `ActivityRailLayer` (type) - export type ActivityRailLayer = "上下文" | "工具" | "结果" | "流程";
- `ActivityRailFilterKey` (type) - export type ActivityRailFilterKey = "all" | "attention" | "context" | "tool" | "result" | "flow";
- `ActivityStageKind` (type) - export type ActivityStageKind = "inspect" | "implement" | "verify" | "deliver" | "plan" | "other";
- `ActivityTaskStepStatus` (type) - export type ActivityTaskStepStatus = "pending" | "running" | "completed";
- `ActivityPlanStepStatus` (type) - export type ActivityPlanStepStatus = "pending" | "running" | "completed" | "drifted";
- `ActivityMetricStatus` (type) - export type ActivityMetricStatus = "neutral" | "running" | "success" | "failure";
- `ActivityNodeKind` (type) - export type ActivityNodeKind =
- `ActivityToolProvenance` (type) - export type ActivityToolProvenance =
- `ActivityExecutionMetrics` (type) - export type ActivityExecutionMetrics = {
- `ActivityDetailRow` (type) - export type ActivityDetailRow = {
- `ActivityDetailSection` (type) - export type ActivityDetailSection = {

### `src/shared/prompt-ledger.ts`

代码信号：event:prompt_ledger；导出：`PromptLedgerSourceKind`, `PromptLedgerSource`, `PromptLedgerAttachmentSource`, `PromptLedgerBucket`, `PromptLedgerSegmentKind`, `PromptLedgerRiskKind`, `PromptLedgerSegment`, `PromptLedgerMessage`；关键符号：`PromptLedgerSourceKind`, `PromptLedgerSource`, `PromptLedgerAttachmentSource`, `PromptLedgerBucket`, `PromptLedgerSegmentKind`, `PromptLedgerRiskKind`

- `PromptLedgerSourceKind` (type) - export type PromptLedgerSourceKind =
- `PromptLedgerSource` (type) - export type PromptLedgerSource = {
- `PromptLedgerAttachmentSource` (type) - export type PromptLedgerAttachmentSource = {
- `PromptLedgerBucket` (type) - export type PromptLedgerBucket = {
- `PromptLedgerSegmentKind` (type) - export type PromptLedgerSegmentKind =
- `PromptLedgerRiskKind` (type) - export type PromptLedgerRiskKind =
- `PromptLedgerSegment` (type) - export type PromptLedgerSegment = {
- `PromptLedgerMessage` (type) - export type PromptLedgerMessage = {
- `PromptLedgerBuildInput` (type) - export type PromptLedgerBuildInput = {
- `BucketDraft` (type) - type BucketDraft = Omit<PromptLedgerBucket, "ratio">;
- `SegmentDraft` (type) - type SegmentDraft = Omit<PromptLedgerSegment, "ratio">;
- `HISTORY_TOOL_OUTPUT_LIMIT` (const) - const HISTORY_TOOL_OUTPUT_LIMIT = 120;

### `src/shared/runner-status.ts`

导出：`isSuccessfulRunnerResult`, `shouldSuppressRunnerErrorAfterSuccessfulResult`；关键符号：`isSuccessfulRunnerResult`, `shouldSuppressRunnerErrorAfterSuccessfulResult`

- `isSuccessfulRunnerResult` (function) - export function isSuccessfulRunnerResult(message: { type?: unknown; subtype?: unknown }): boolean {
- `shouldSuppressRunnerErrorAfterSuccessfulResult` (function) - export function shouldSuppressRunnerErrorAfterSuccessfulResult(hasEmittedSuccessfulResult: boolean): boolean {

### `src/shared/workflow-markdown.ts`

导出：`WORKFLOW_SCOPE_VALUES`, `WORKFLOW_MODE_VALUES`, `WORKFLOW_ENTRY_VALUES`, `WORKFLOW_EXECUTOR_VALUES`, `WORKFLOW_INTENT_VALUES`, `WORKFLOW_USER_ACTION_VALUES`, `WORKFLOW_RUNTIME_FIELD_NAMES`, `WorkflowScope`；关键符号：`WORKFLOW_SCOPE_VALUES`, `WORKFLOW_MODE_VALUES`, `WORKFLOW_ENTRY_VALUES`, `WORKFLOW_EXECUTOR_VALUES`, `WORKFLOW_INTENT_VALUES`, `WORKFLOW_USER_ACTION_VALUES`

- `WORKFLOW_SCOPE_VALUES` (const) - export const WORKFLOW_SCOPE_VALUES = ["system", "user", "project", "session"] as const;
- `WORKFLOW_MODE_VALUES` (const) - export const WORKFLOW_MODE_VALUES = ["single-thread"] as const;
- `WORKFLOW_ENTRY_VALUES` (const) - export const WORKFLOW_ENTRY_VALUES = ["manual"] as const;
- `WORKFLOW_EXECUTOR_VALUES` (const) - export const WORKFLOW_EXECUTOR_VALUES = ["primary-agent"] as const;
- `WORKFLOW_INTENT_VALUES` (const) - export const WORKFLOW_INTENT_VALUES = ["inspect", "implement", "verify", "deliver", "other"] as const;
- `WORKFLOW_USER_ACTION_VALUES` (const) - export const WORKFLOW_USER_ACTION_VALUES = ["run", "skip", "edit", "retry"] as const;
- `WORKFLOW_RUNTIME_FIELD_NAMES` (const) - export const WORKFLOW_RUNTIME_FIELD_NAMES = [
- `WorkflowScope` (type) - export type WorkflowScope = (typeof WORKFLOW_SCOPE_VALUES)[number];
- `WorkflowMode` (type) - export type WorkflowMode = (typeof WORKFLOW_MODE_VALUES)[number];
- `WorkflowEntry` (type) - export type WorkflowEntry = (typeof WORKFLOW_ENTRY_VALUES)[number];
- `WorkflowExecutor` (type) - export type WorkflowExecutor = (typeof WORKFLOW_EXECUTOR_VALUES)[number];
- `WorkflowIntent` (type) - export type WorkflowIntent = (typeof WORKFLOW_INTENT_VALUES)[number];

### `src/shared/runner-prompt.ts`

导出：`buildRunnerPromptContentBlocks`；关键符号：`buildRunnerPromptContentBlocks`

- `buildRunnerPromptContentBlocks` (function) - export function buildRunnerPromptContentBlocks(prompt: string, attachments: AttachmentLike[]): Array<Record<string, unknown>> {

### `src/shared/plan-progress.ts`

导出：`PlanStepStatus`, `PlanItemArg`, `UpdatePlanArgs`, `SessionPlanSource`, `SessionPlanSnapshot`, `normalizePlanStepStatus`, `normalizeUpdatePlanArgs`, `normalizeTodoWriteArgs`；关键符号：`PlanStepStatus`, `PlanItemArg`, `UpdatePlanArgs`, `SessionPlanSource`, `SessionPlanSnapshot`, `isRecord`

- `PlanStepStatus` (type) - export type PlanStepStatus = "pending" | "in_progress" | "completed";
- `PlanItemArg` (type) - export type PlanItemArg = {
- `UpdatePlanArgs` (type) - export type UpdatePlanArgs = {
- `SessionPlanSource` (type) - export type SessionPlanSource = "update_plan" | "todo_write";
- `SessionPlanSnapshot` (type) - export type SessionPlanSnapshot = UpdatePlanArgs & {
- `isRecord` (function) - function isRecord(value: unknown): value is Record<string, unknown> {
- `normalizePlanStepStatus` (function) - export function normalizePlanStepStatus(value: unknown): PlanStepStatus | null {
- `normalizePlanItem` (function) - function normalizePlanItem(input: unknown, fallbackIndex: number): PlanItemArg | null {
- `rawStep` (const) - const rawStep =
- `step` (const) - const step = typeof rawStep === "string" ? rawStep.trim() : String(rawStep).trim();
- `status` (const) - const status = normalizePlanStepStatus(input.status) ?? "pending";
- `normalizeUpdatePlanArgs` (function) - export function normalizeUpdatePlanArgs(input: unknown): UpdatePlanArgs | null {

### `src/shared/codex-oauth.ts`

导出：`CODEX_OAUTH_BASE_URL`, `CODEX_OAUTH_COMPACT_MODEL_SUFFIX`, `CODEX_OAUTH_DEFAULT_MODEL`, `CODEX_OAUTH_SMALL_MODEL`, `withCodexCompactModelSuffix`, `extractCodexModelIdsFromCache`, `mergeCodexModelIds`, `CODEX_OAUTH_MODELS`；关键符号：`CODEX_OAUTH_BASE_URL`, `CODEX_OAUTH_COMPACT_MODEL_SUFFIX`, `CODEX_OAUTH_DEFAULT_MODEL`, `CODEX_OAUTH_SMALL_MODEL`, `CODEX_BASE_MODELS`, `withCodexCompactModelSuffix`

- `CODEX_OAUTH_BASE_URL` (const) - export const CODEX_OAUTH_BASE_URL = "https://chatgpt.com";
- `CODEX_OAUTH_COMPACT_MODEL_SUFFIX` (const) - export const CODEX_OAUTH_COMPACT_MODEL_SUFFIX = "-openai-compact";
- `CODEX_OAUTH_DEFAULT_MODEL` (const) - export const CODEX_OAUTH_DEFAULT_MODEL = "gpt-5.5";
- `CODEX_OAUTH_SMALL_MODEL` (const) - export const CODEX_OAUTH_SMALL_MODEL = "gpt-5.3-codex-spark";
- `CODEX_BASE_MODELS` (const) - const CODEX_BASE_MODELS = [
- `withCodexCompactModelSuffix` (function) - export function withCodexCompactModelSuffix(models: readonly string[]): string[] {
- `normalizedModels` (const) - const normalizedModels = normalizeCodexBaseModelIds(models);
- `normalizeCodexBaseModelIds` (function) - function normalizeCodexBaseModelIds(models: readonly string[]): string[] {
- `extractCodexModelIdsFromCache` (function) - export function extractCodexModelIdsFromCache(payload: unknown): string[] {
- `models` (const) - const models = (payload as { models?: unknown }).models;
- `slug` (const) - const slug = (item as { slug?: unknown }).slug;
- `visibility` (const) - const visibility = (item as { visibility?: unknown }).visibility;

### `src/shared/lark-runtime-defaults.ts`

导出：`LARK_CLI_COMMAND_ENV`, `LARK_CLI_PROFILE_ENV`, `LARK_CLI_SKILL_ENV_KEYS`, `LARK_CLI_SYSTEM_PROMPT_EXT`, `DEFAULT_LARK_CHANNEL_CONFIG`, `ensureLarkCliRuntimeDefaults`；关键符号：`LARK_CLI_COMMAND_ENV`, `LARK_CLI_PROFILE_ENV`, `LARK_CLI_SKILL_ENV_KEYS`, `LARK_CLI_SYSTEM_PROMPT_EXT`, `DEFAULT_LARK_CHANNEL_CONFIG`, `isRecord`

- `LARK_CLI_COMMAND_ENV` (const) - export const LARK_CLI_COMMAND_ENV = "LARK_CLI_COMMAND";
- `LARK_CLI_PROFILE_ENV` (const) - export const LARK_CLI_PROFILE_ENV = "LARK_CLI_PROFILE";
- `LARK_CLI_SKILL_ENV_KEYS` (const) - export const LARK_CLI_SKILL_ENV_KEYS = [
- `LARK_CLI_SYSTEM_PROMPT_EXT` (const) - export const LARK_CLI_SYSTEM_PROMPT_EXT = [
- `DEFAULT_LARK_CHANNEL_CONFIG` (const) - export const DEFAULT_LARK_CHANNEL_CONFIG = {
- `isRecord` (function) - function isRecord(value: unknown): value is Record<string, unknown> {
- `asNonEmptyString` (function) - function asNonEmptyString(value: unknown): string | undefined {
- `collectCredentialEnvNames` (function) - function collectCredentialEnvNames(value: unknown): string[] {
- `mergeCredentialEnv` (function) - function mergeCredentialEnv(
- `merged` (const) - const merged = Array.from(new Set([
- `mergeSystemPromptExt` (function) - function mergeSystemPromptExt(current: unknown, line: string): string[] {
- `existing` (const) - const existing = typeof current === "string"

### `src/shared/model-provider-routing.ts`

导出：`SharedApiProviderMode`, `isCodexModelName`, `isDeepSeekModelName`, `isModelCompatibleWithApiProvider`, `pickProviderCompatibleModel`；关键符号：`SharedApiProviderMode`, `isCodexModelName`, `normalized`, `isDeepSeekModelName`, `isModelCompatibleWithApiProvider`, `normalized`

- `SharedApiProviderMode` (type) - export type SharedApiProviderMode = "custom" | "deepseek" | "codex";
- `isCodexModelName` (function) - export function isCodexModelName(modelName: string): boolean {
- `normalized` (const) - const normalized = stripCodexCompactSuffix(modelName).toLowerCase();
- `isDeepSeekModelName` (function) - export function isDeepSeekModelName(modelName: string): boolean {
- `isModelCompatibleWithApiProvider` (function) - export function isModelCompatibleWithApiProvider(
- `normalized` (const) - const normalized = modelName.trim();
- `pickProviderCompatibleModel` (function) - export function pickProviderCompatibleModel(
- `primary` (const) - const primary = primaryModel?.trim();
- `fallback` (const) - const fallback = fallbackModel?.trim();
- `stripCodexCompactSuffix` (function) - function stripCodexCompactSuffix(modelName: string): string {
- `normalized` (const) - const normalized = modelName.trim();

### `src/shared/workflow-selector.ts`

导出：`WorkflowSelectionContext`, `WorkflowSelectionCandidate`, `WorkflowSelectionResult`, `selectWorkflowCandidates`；关键符号：`WorkflowSelectionContext`, `WorkflowSelectionCandidate`, `WorkflowSelectionResult`, `selectWorkflowCandidates`, `normalizedPrompt`, `normalizedTags`

- `WorkflowSelectionContext` (type) - export type WorkflowSelectionContext = {
- `WorkflowSelectionCandidate` (type) - export type WorkflowSelectionCandidate = {
- `WorkflowSelectionResult` (type) - export type WorkflowSelectionResult = {
- `selectWorkflowCandidates` (function) - export function selectWorkflowCandidates(
- `normalizedPrompt` (const) - const normalizedPrompt = normalizeText(context.prompt);
- `normalizedTags` (const) - const normalizedTags = new Set((context.tags ?? []).map(normalizeText).filter(Boolean));
- `normalizedPaths` (const) - const normalizedPaths = collectContextPaths(context);
- `candidates` (const) - const candidates = documents
- `candidate` (const) - const candidate = scoreWorkflowDocument(
- `recommendedWorkflowId` (const) - const recommendedWorkflowId = candidates[0]?.document.workflowId;
- `topCandidate` (const) - const topCandidate = candidates[0];
- `secondCandidate` (const) - const secondCandidate = candidates[1];

### `src/shared/preview-quick-open.ts`

导出：`PreviewQuickOpenEntry`, `scorePreviewQuickOpenEntry`, `filterPreviewQuickOpenEntries`；关键符号：`PreviewQuickOpenEntry`, `RankedPreviewQuickOpenEntry`, `normalizePathForQuickOpen`, `scorePreviewQuickOpenEntry`, `tokens`, `relativePath`

- `PreviewQuickOpenEntry` (type) - export type PreviewQuickOpenEntry = {
- `RankedPreviewQuickOpenEntry` (type) - type RankedPreviewQuickOpenEntry = {
- `normalizePathForQuickOpen` (function) - function normalizePathForQuickOpen(value: string): string {
- `scorePreviewQuickOpenEntry` (function) - export function scorePreviewQuickOpenEntry(entry: PreviewQuickOpenEntry, query: string): number | null {
- `tokens` (const) - const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
- `relativePath` (const) - const relativePath = normalizePathForQuickOpen(entry.relativePath);
- `name` (const) - const name = entry.name.toLowerCase();
- `score` (const) - let score = relativePath.length / 100;
- `pathIndex` (const) - const pathIndex = relativePath.indexOf(token);
- `nameIndex` (const) - const nameIndex = name.indexOf(token);
- `filterPreviewQuickOpenEntries` (function) - export function filterPreviewQuickOpenEntries(
- `score` (const) - const score = scorePreviewQuickOpenEntry(entry, query);

### `src/shared/slash-commands.ts`

导出：`extractSlashCommandsFromMessages`, `mergeSlashCommandLists`；关键符号：`SlashCommandLikeMessage`, `extractSlashCommandsFromMessages`, `mergeSlashCommandLists`, `merged`, `normalized`, `key`

- `SlashCommandLikeMessage` (type) - type SlashCommandLikeMessage = {
- `extractSlashCommandsFromMessages` (function) - export function extractSlashCommandsFromMessages(messages?: SlashCommandLikeMessage[]): string[] | undefined {
- `mergeSlashCommandLists` (function) - export function mergeSlashCommandLists(...lists: Array<readonly unknown[] | undefined>): string[] | undefined {
- `merged` (const) - const merged = new Map<string, string>();
- `normalized` (const) - const normalized = normalizeSlashCommandName(value);
- `key` (const) - const key = normalized.toLowerCase();
- `commands` (const) - const commands = Array.from(merged.values()).sort((left, right) => left.localeCompare(right));
- `normalizeSlashCommandName` (function) - function normalizeSlashCommandName(value: string): string | null {
- `normalized` (const) - const normalized = value.trim().replace(/^\/+/, "").replace(/\.+/g, ".").replace(/^\.+|\.+$/g, "");

### `src/shared/channel-config.ts`

导出：`ChannelChatToggleConfig`, `isChannelChatEnabled`；关键符号：`ChannelChatToggleConfig`, `isChannelChatEnabled`

- `ChannelChatToggleConfig` (type) - export type ChannelChatToggleConfig = {
- `isChannelChatEnabled` (function) - export function isChannelChatEnabled(config: ChannelChatToggleConfig | null | undefined): boolean {

### `src/shared/lark-channel.ts`

typescript 文件，4 行；用于 src/shared 功能域。

## 数据与接口契约

- **event:user_prompt**：src/shared/attachments.ts:20 - typed event payload
- **event:text**：src/shared/attachments.ts:126 - typed event payload
- **event:image**：src/shared/attachments.ts:154 - typed event payload
- **event:base64**：src/shared/attachments.ts:156 - typed event payload
- **store:attachments**：src/shared/attachments.ts - UI/runtime state store
- **event:user_prompt**：src/shared/activity-rail-model.ts:82 - typed event payload
- **event:prompt_ledger**：src/shared/prompt-ledger.ts:79 - typed event payload

## 关键概念

- **event**：shared-contracts 模块中出现 6 个 event 信号，可用于定位对应接口或运行职责。
- **store**：shared-contracts 模块中出现 1 个 store 信号，可用于定位对应接口或运行职责。

## 内部关系

- `src/shared/activity-rail-model.ts` -> `./prompt-ledger.js`：本地相对依赖，需要按路径解析到目标文件
- `src/shared/runner-prompt.ts` -> `./attachments.js`：本地相对依赖，需要按路径解析到目标文件
- `src/shared/model-provider-routing.ts` -> `./codex-oauth.js`：本地相对依赖，需要按路径解析到目标文件
- `src/shared/workflow-selector.ts` -> `./workflow-markdown.js`：本地相对依赖，需要按路径解析到目标文件

## 修改风险

- runner prompt 拼装顺序改变会影响所有新会话的工具、规则和知识库可见性。

## 验证

- npm run transpile:electron
- npm run build
