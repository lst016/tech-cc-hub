# electron

> 负责 24 个文件组成的 electron 功能域。

electron 模块包含 24 个被扫描文件，关键入口包括 `src/electron/libs/codex-oauth.ts`, `src/electron/types.ts`, `src/electron/libs/learning-store.ts`, `src/electron/libs/note-types.ts`, `src/electron/tsconfig.json`, `src/electron/libs/memory/memory-repository.ts`, `src/electron/libs/image-preprocessor.ts`, `src/electron/libs/figma-official-plugin.ts`。

本地静态分析识别到这些代码信号：event, database, config，因此本页可以作为后续 Agent 定位接口、存储、事件和运行入口的索引。

## Agent 可用信息

- 定位 electron 模块的入口、数据契约和运行风险。
- 在模型没有稳定返回 JSON 时，本页仍由本地代码信号生成，不能再退化为空白说明。

## 优先入口

- `src/electron/libs/codex-oauth.ts`：代码信号：event:text, event:tool_use, event:message, event:codex, event:output_text, event:message_start, event:content_block_start, event:content_block_delta；导出：`CodexOAuthCredential`, `CodexStoredOAuthCredential`, `CodexOAuthFlow`, `CodexTokenResult`, `CodexResponsesStreamEvent`, `AnthropicMessagesRequest`, `CodexResponsesRequest`, `AnthropicContentBlock`；关键符号：`CodexOAuthCredential`, `CodexStoredOAuthCredential`, `CodexOAuthFlow`, `CodexTokenResult`, `CodexResponsesStreamEvent`, `AnthropicMessagesRequest`
- `src/electron/types.ts`：代码信号：event:user_prompt, event:builtin, event:stream.message, event:stream.user_prompt, event:session.status, event:session.plan.updated, event:session.workflow, event:session.workflow.catalog；导出：`RuntimeReasoningMode`, `AgentRunSurface`, `ApiModelConfig`, `ApiProviderMode`, `ApiConfig`, `ApiConfigSettings`, `RuntimeOverrides`, `ChannelProviderId`；关键符号：`RuntimeReasoningMode`, `AgentRunSurface`, `ApiModelConfig`, `ApiProviderMode`, `ApiConfig`, `ApiConfigSettings`
- `src/electron/libs/learning-store.ts`：代码信号：database:learnings, database:learnings_fts, database:learnings_sessions, database:idx_learnings_category, database:idx_learnings_project, database:idx_learnings_created_at, database:idx_learnings_sessions_project, database:idx_learnings_sessions_started_at；导出：`Learning`, `LearningStoreOptions`, `LearningStore`；关键符号：`Learning`, `LearningStoreOptions`, `LearningStore`, `stmt`, `row`, `sanitizedQuery`
- `src/electron/libs/note-types.ts`：代码信号：event:note.list, event:note.created, event:note.updated, event:note.deleted, event:note.error, event:note.create, event:note.get, event:note.update；导出：`Note`, `NoteCreateInput`, `NoteUpdateInput`, `NoteServerEvent`, `NoteClientEvent`；关键符号：`Note`, `NoteCreateInput`, `NoteUpdateInput`, `NoteServerEvent`, `NoteClientEvent`
- `src/electron/tsconfig.json`：配置文件，会影响构建、开发或模型能力；代码信号：config:src/electron/tsconfig.json
- `src/electron/libs/memory/memory-repository.ts`：代码信号：database:memories, database:memories_fts, database:idx_memories_scope, database:idx_memories_category, database:idx_memories_updated；导出：`MemoryRepository`；关键符号：`Row`, `serializeTags`, `parseTags`, `compact`, `normalized`, `MemoryRepository`
- `src/electron/libs/image-preprocessor.ts`：代码信号：event:input_text, event:input_image, event:text, event:image, event:base64, event:image_url；导出：`preprocessImageAttachments`, `summarizeLocalImageFile`, `summarizeBase64Image`；关键符号：`CodexOAuthCredential`, `IMAGE_SUMMARY_MAX_TOKENS`, `preprocessImageAttachments`, `imageAttachments`, `imageModel`, `summarizeLocalImageFile`
- `src/electron/libs/figma-official-plugin.ts`：代码信号：event:http, event:desktop-mcp, event:figma-rest-api；导出：`FIGMA_OFFICIAL_PLUGIN_ID`, `FIGMA_MCP_SERVER_NAME`, `FIGMA_MCP_URL`, `FIGMA_DESKTOP_MCP_URL`, `FIGMA_REST_API_URL`, `FIGMA_REST_TOOL_NAMES`, `FigmaOfficialConnectionMode`, `FigmaOfficialOAuthProvider`；关键符号：`FIGMA_OFFICIAL_PLUGIN_ID`, `FIGMA_MCP_SERVER_NAME`, `FIGMA_MCP_URL`, `FIGMA_DESKTOP_MCP_URL`, `FIGMA_REST_API_URL`, `FIGMA_REST_TOOL_NAMES`

## 文件

### `src/electron/libs/codex-oauth.ts`

代码信号：event:text, event:tool_use, event:message, event:codex, event:output_text, event:message_start, event:content_block_start, event:content_block_delta；导出：`CodexOAuthCredential`, `CodexStoredOAuthCredential`, `CodexOAuthFlow`, `CodexTokenResult`, `CodexResponsesStreamEvent`, `AnthropicMessagesRequest`, `CodexResponsesRequest`, `AnthropicContentBlock`；关键符号：`CodexOAuthCredential`, `CodexStoredOAuthCredential`, `CodexOAuthFlow`, `CodexTokenResult`, `CodexResponsesStreamEvent`, `AnthropicMessagesRequest`

- `CodexOAuthCredential` (type) - export type CodexOAuthCredential = {
- `CodexStoredOAuthCredential` (type) - export type CodexStoredOAuthCredential = {
- `CodexOAuthFlow` (type) - export type CodexOAuthFlow = {
- `CodexTokenResult` (type) - export type CodexTokenResult = {
- `CodexResponsesStreamEvent` (type) - export type CodexResponsesStreamEvent = {
- `AnthropicMessagesRequest` (type) - export type AnthropicMessagesRequest = {
- `CodexResponsesRequest` (type) - export type CodexResponsesRequest = {
- `AnthropicContentBlock` (type) - export type AnthropicContentBlock =
- `AnthropicMessageResponse` (type) - export type AnthropicMessageResponse = {
- `CODEX_OAUTH_CLIENT_ID` (const) - const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
- `CODEX_OAUTH_AUTHORIZE_URL` (const) - const CODEX_OAUTH_AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
- `CODEX_OAUTH_TOKEN_URL` (const) - const CODEX_OAUTH_TOKEN_URL = "https://auth.openai.com/oauth/token";

### `src/electron/types.ts`

代码信号：event:user_prompt, event:builtin, event:stream.message, event:stream.user_prompt, event:session.status, event:session.plan.updated, event:session.workflow, event:session.workflow.catalog；导出：`RuntimeReasoningMode`, `AgentRunSurface`, `ApiModelConfig`, `ApiProviderMode`, `ApiConfig`, `ApiConfigSettings`, `RuntimeOverrides`, `ChannelProviderId`；关键符号：`RuntimeReasoningMode`, `AgentRunSurface`, `ApiModelConfig`, `ApiProviderMode`, `ApiConfig`, `ApiConfigSettings`

- `RuntimeReasoningMode` (type) - export type RuntimeReasoningMode = "disabled" | "low" | "medium" | "high" | "xhigh";
- `AgentRunSurface` (type) - export type AgentRunSurface = "development" | "maintenance";
- `ApiModelConfig` (type) - export type ApiModelConfig = {
- `ApiProviderMode` (type) - export type ApiProviderMode = "custom" | "deepseek" | "codex";
- `ApiConfig` (type) - export type ApiConfig = {
- `ApiConfigSettings` (type) - export type ApiConfigSettings = {
- `RuntimeOverrides` (type) - export type RuntimeOverrides = {
- `ChannelProviderId` (type) - export type ChannelProviderId =
- `PromptAttachment` (type) - export type PromptAttachment = {
- `UserPromptMessage` (type) - export type UserPromptMessage = {
- `StreamMessage` (type) - export type StreamMessage = (SDKMessage | UserPromptMessage | PromptLedgerMessage) & {
- `SessionStatus` (type) - export type SessionStatus = "idle" | "running" | "completed" | "error";

### `src/electron/libs/learning-store.ts`

代码信号：database:learnings, database:learnings_fts, database:learnings_sessions, database:idx_learnings_category, database:idx_learnings_project, database:idx_learnings_created_at, database:idx_learnings_sessions_project, database:idx_learnings_sessions_started_at；导出：`Learning`, `LearningStoreOptions`, `LearningStore`；关键符号：`Learning`, `LearningStoreOptions`, `LearningStore`, `stmt`, `row`, `sanitizedQuery`

- `Learning` (interface) - export interface Learning {
- `LearningStoreOptions` (interface) - export interface LearningStoreOptions {
- `LearningStore` (class) - export class LearningStore {
- `stmt` (const) - const stmt = this.db.prepare(`
- `row` (const) - const row = this.db.prepare("SELECT * FROM learnings WHERE id = ?").get(id) as Learning | undefined;
- `sanitizedQuery` (const) - const sanitizedQuery = this.sanitizeQuery(query);
- `sql` (const) - let sql = `
- `learning` (const) - const learning = this.getLearning(learningId);
- `keywords` (const) - const keywords = this.extractKeywords(learning.rule);
- `query` (const) - const query = keywords.join(" OR ");
- `results` (const) - const results = this.searchLearnings(query, { limit: limit + 1 });
- `STOPWORDS` (const) - const STOPWORDS = new Set([

### `src/electron/libs/note-types.ts`

代码信号：event:note.list, event:note.created, event:note.updated, event:note.deleted, event:note.error, event:note.create, event:note.get, event:note.update；导出：`Note`, `NoteCreateInput`, `NoteUpdateInput`, `NoteServerEvent`, `NoteClientEvent`；关键符号：`Note`, `NoteCreateInput`, `NoteUpdateInput`, `NoteServerEvent`, `NoteClientEvent`

- `Note` (type) - export type Note = {
- `NoteCreateInput` (type) - export type NoteCreateInput = {
- `NoteUpdateInput` (type) - export type NoteUpdateInput = {
- `NoteServerEvent` (type) - export type NoteServerEvent =
- `NoteClientEvent` (type) - export type NoteClientEvent =

### `src/electron/tsconfig.json`

配置文件，会影响构建、开发或模型能力；代码信号：config:src/electron/tsconfig.json

### `src/electron/libs/memory/memory-repository.ts`

代码信号：database:memories, database:memories_fts, database:idx_memories_scope, database:idx_memories_category, database:idx_memories_updated；导出：`MemoryRepository`；关键符号：`Row`, `serializeTags`, `parseTags`, `compact`, `normalized`, `MemoryRepository`

- `Row` (type) - type Row = Record<string, unknown>;
- `serializeTags` (function) - function serializeTags(tags: string[] | undefined): string {
- `parseTags` (function) - function parseTags(value: unknown): string[] {
- `compact` (function) - function compact(text: string, maxLength: number): string {
- `normalized` (const) - const normalized = text.replace(/\s+/g, " ").trim();
- `MemoryRepository` (class) - export class MemoryRepository {
- `now` (const) - const now = Date.now();
- `id` (const) - const id = crypto.randomUUID();
- `row` (const) - const row = this.db.prepare("SELECT rowid FROM memories WHERE id = ?").get(id) as { rowid?: number } | undefined;
- `rowid` (const) - const rowid = Number(row?.rowid);
- `existing` (const) - const existing = this.getByTitle(input.title, input.scope);
- `existing` (const) - const existing = this.get(id);

### `src/electron/libs/image-preprocessor.ts`

代码信号：event:input_text, event:input_image, event:text, event:image, event:base64, event:image_url；导出：`preprocessImageAttachments`, `summarizeLocalImageFile`, `summarizeBase64Image`；关键符号：`CodexOAuthCredential`, `IMAGE_SUMMARY_MAX_TOKENS`, `preprocessImageAttachments`, `imageAttachments`, `imageModel`, `summarizeLocalImageFile`

- `CodexOAuthCredential` (type) - type CodexOAuthCredential,
- `IMAGE_SUMMARY_MAX_TOKENS` (const) - const IMAGE_SUMMARY_MAX_TOKENS = 1600;
- `preprocessImageAttachments` (function) - export async function preprocessImageAttachments(options: {
- `imageAttachments` (const) - const imageAttachments = attachments.filter((attachment) => attachment.kind === "image");
- `imageModel` (const) - const imageModel = config?.imageModel?.trim();
- `summarizeLocalImageFile` (function) - export async function summarizeLocalImageFile(options: {
- `imageModel` (const) - const imageModel = config?.imageModel?.trim();
- `mimeType` (const) - const mimeType = getImageMimeType(filePath);
- `buffer` (const) - const buffer = await readFile(filePath);
- `summarizeBase64Image` (function) - export async function summarizeBase64Image(options: {
- `imageModel` (const) - const imageModel = config?.imageModel?.trim();
- `summarizeImageBase64WithModel` (function) - async function summarizeImageBase64WithModel(options: {

### `src/electron/libs/figma-official-plugin.ts`

代码信号：event:http, event:desktop-mcp, event:figma-rest-api；导出：`FIGMA_OFFICIAL_PLUGIN_ID`, `FIGMA_MCP_SERVER_NAME`, `FIGMA_MCP_URL`, `FIGMA_DESKTOP_MCP_URL`, `FIGMA_REST_API_URL`, `FIGMA_REST_TOOL_NAMES`, `FigmaOfficialConnectionMode`, `FigmaOfficialOAuthProvider`；关键符号：`FIGMA_OFFICIAL_PLUGIN_ID`, `FIGMA_MCP_SERVER_NAME`, `FIGMA_MCP_URL`, `FIGMA_DESKTOP_MCP_URL`, `FIGMA_REST_API_URL`, `FIGMA_REST_TOOL_NAMES`

- `FIGMA_OFFICIAL_PLUGIN_ID` (const) - export const FIGMA_OFFICIAL_PLUGIN_ID = "figma-official";
- `FIGMA_MCP_SERVER_NAME` (const) - export const FIGMA_MCP_SERVER_NAME = "figma";
- `FIGMA_MCP_URL` (const) - export const FIGMA_MCP_URL = "https://mcp.figma.com/mcp";
- `FIGMA_DESKTOP_MCP_URL` (const) - export const FIGMA_DESKTOP_MCP_URL = "http://127.0.0.1:3845/mcp";
- `FIGMA_REST_API_URL` (const) - export const FIGMA_REST_API_URL = "https://api.figma.com/v1";
- `FIGMA_REST_TOOL_NAMES` (const) - export const FIGMA_REST_TOOL_NAMES = [
- `FigmaOfficialConnectionMode` (type) - export type FigmaOfficialConnectionMode = "remote" | "desktop" | "rest";
- `FigmaOfficialOAuthProvider` (type) - export type FigmaOfficialOAuthProvider = "direct" | "codex" | "pat";
- `FigmaOfficialPluginStatusKind` (type) - export type FigmaOfficialPluginStatusKind =
- `FigmaOfficialPluginStatus` (type) - export type FigmaOfficialPluginStatus = {
- `FigmaOfficialPluginActionResult` (type) - export type FigmaOfficialPluginActionResult = FigmaOfficialPluginStatus & {
- `FigmaOfficialAuthState` (type) - export type FigmaOfficialAuthState = "needs-auth" | "auth-expired" | "ready";

### `src/electron/libs/config-store.ts`

导出：`ApiType`, `ApiProviderMode`, `ApiModelConfig`, `ApiConfig`, `ApiConfigSettings`, `GlobalRuntimeConfig`, `loadApiConfigSettings`, `saveApiConfigSettings`；关键符号：`ApiType`, `ApiProviderMode`, `ApiModelConfig`, `ApiConfig`, `ApiConfigSettings`, `GlobalRuntimeConfig`

- `ApiType` (type) - export type ApiType = "anthropic";
- `ApiProviderMode` (type) - export type ApiProviderMode = "custom" | "deepseek" | "codex";
- `ApiModelConfig` (type) - export type ApiModelConfig = {
- `ApiConfig` (type) - export type ApiConfig = {
- `ApiConfigSettings` (type) - export type ApiConfigSettings = {
- `GlobalRuntimeConfig` (type) - export type GlobalRuntimeConfig = Record<string, unknown>;
- `DEFAULT_MODEL` (const) - const DEFAULT_MODEL = "claude-sonnet-4-5";
- `DEFAULT_CONTEXT_WINDOW` (const) - const DEFAULT_CONTEXT_WINDOW = 200_000;
- `DEEPSEEK_OFFICIAL_BASE_URL` (const) - const DEEPSEEK_OFFICIAL_BASE_URL = "https://api.deepseek.com/anthropic";
- `CONFIG_FILE_NAME` (const) - const CONFIG_FILE_NAME = "api-config.json";
- `GLOBAL_CONFIG_FILE_NAME` (const) - const GLOBAL_CONFIG_FILE_NAME = "agent-runtime.json";
- `getConfigPath` (function) - function getConfigPath(): string {

### `src/electron/libs/note-repository.ts`

代码信号：database:notes, database:idx_notes_updated；导出：`NoteRepository`；关键符号：`NoteRepository`, `rows`, `row`, `now`, `id`, `existing`

- `NoteRepository` (class) - export class NoteRepository {
- `rows` (const) - const rows = this.db
- `row` (const) - const row = this.db
- `now` (const) - const now = Date.now();
- `id` (const) - const id = crypto.randomUUID();
- `existing` (const) - const existing = this.get(id);
- `now` (const) - const now = Date.now();
- `title` (const) - const title = input.title ?? existing.title;
- `content` (const) - const content = input.content ?? existing.content;
- `existing` (const) - const existing = this.get(id);

### `src/electron/libs/external-mcp-servers.ts`

代码信号：event:stdio, event:http, event:external；导出：`ExternalMcpServerInfo`, `getExternalMcpServers`, `parseExternalMcpServers`, `listExternalMcpServerInfos`, `isConfiguredExternalMcpTool`；关键符号：`ExternalMcpStdioServer`, `ExternalMcpHttpServer`, `ExternalMcpServer`, `ExternalMcpParseOptions`, `ExternalMcpServerInfo`, `getExternalMcpServers`

- `ExternalMcpStdioServer` (type) - type ExternalMcpStdioServer = {
- `ExternalMcpHttpServer` (type) - type ExternalMcpHttpServer = {
- `ExternalMcpServer` (type) - type ExternalMcpServer = ExternalMcpStdioServer | ExternalMcpHttpServer;
- `ExternalMcpParseOptions` (type) - type ExternalMcpParseOptions = {
- `ExternalMcpServerInfo` (type) - export type ExternalMcpServerInfo = {
- `getExternalMcpServers` (function) - export function getExternalMcpServers(
- `parseExternalMcpServers` (function) - export function parseExternalMcpServers(
- `parsed` (const) - const parsed = parseExternalMcpServer(value, options);
- `listExternalMcpServerInfos` (function) - export function listExternalMcpServerInfos(config: unknown): ExternalMcpServerInfo[] {
- `parsed` (const) - const parsed = parseExternalMcpServer(value);
- `isConfiguredExternalMcpTool` (function) - export function isConfiguredExternalMcpTool(toolName: string, config: unknown): boolean {
- `serverNames` (const) - const serverNames = Object.keys(parseExternalMcpServers(config));

### `src/electron/libs/claude-code-compat-registry.ts`

导出：`ClaudeCodeCompatRegistry`, `CLAUDE_CODE_COMPAT_REGISTRY`, `CLAUDE_CODE_COMPAT_COMMAND_ITEMS`, `buildClaudeCodeCompatPromptAppend`；关键符号：`ClaudeCodeCompatRegistry`, `CLAUDE_CODE_COMPAT_COMMAND_ITEMS`, `buildClaudeCodeCompatPromptAppend`

- `ClaudeCodeCompatRegistry` (type) - export type ClaudeCodeCompatRegistry = {
- `CLAUDE_CODE_COMPAT_COMMAND_ITEMS` (const) - export const CLAUDE_CODE_COMPAT_COMMAND_ITEMS = CLAUDE_CODE_COMPAT_REGISTRY.commandItems;
- `buildClaudeCodeCompatPromptAppend` (function) - export function buildClaudeCodeCompatPromptAppend(): string {

### `src/electron/libs/attachment-store.ts`

导出：`StoredImageAttachmentReference`, `persistImageAttachmentReference`, `rehydrateStoredImageAttachment`；关键符号：`ATTACHMENT_ROOT_DIRNAME`, `StoredImageAttachmentReference`, `persistImageAttachmentReference`, `inlineData`, `buffer`, `rootDir`

- `ATTACHMENT_ROOT_DIRNAME` (const) - const ATTACHMENT_ROOT_DIRNAME = "prompt-attachments";
- `StoredImageAttachmentReference` (type) - export type StoredImageAttachmentReference = {
- `persistImageAttachmentReference` (function) - export async function persistImageAttachmentReference(attachment: PromptAttachment): Promise<StoredImageAttachmentReference | null> {
- `inlineData` (const) - const inlineData = attachment.runtimeData ?? attachment.data;
- `buffer` (const) - const buffer = decodeInlineImageData(inlineData);
- `rootDir` (const) - const rootDir = join(app.getPath("userData"), ATTACHMENT_ROOT_DIRNAME);
- `filePath` (const) - const filePath = join(rootDir, `${attachment.id}${resolveAttachmentExtension(attachment)}`);
- `rehydrateStoredImageAttachment` (function) - export async function rehydrateStoredImageAttachment(attachment: PromptAttachment): Promise<PromptAttachment | null> {
- `storagePath` (const) - const storagePath = attachment.storagePath || resolveStoragePathFromUri(attachment.storageUri);
- `fileBuffer` (const) - const fileBuffer = await readFile(storagePath);
- `resolveAttachmentExtension` (function) - function resolveAttachmentExtension(attachment: PromptAttachment): string {
- `fromMimeType` (const) - const fromMimeType = MIME_EXTENSION_MAP[attachment.mimeType.toLowerCase()];

### `src/electron/libs/runner-reuse.ts`

导出：`RunnerReuseKeyInput`, `buildRunnerReuseKey`, `canReuseRunner`；关键符号：`RunnerReuseKeyInput`, `RunnerReuseDescriptor`, `buildRunnerReuseKey`, `canReuseRunner`, `existing`, `requested`

- `RunnerReuseKeyInput` (type) - export type RunnerReuseKeyInput = {
- `RunnerReuseDescriptor` (type) - type RunnerReuseDescriptor = {
- `buildRunnerReuseKey` (function) - export function buildRunnerReuseKey(input: RunnerReuseKeyInput): string {
- `canReuseRunner` (function) - export function canReuseRunner(existingKey: string | undefined, requestedKey: string): boolean {
- `existing` (const) - const existing = parseRunnerReuseKey(existingKey);
- `requested` (const) - const requested = parseRunnerReuseKey(requestedKey);
- `buildRunnerReuseDescriptor` (function) - function buildRunnerReuseDescriptor(input: RunnerReuseKeyInput): RunnerReuseDescriptor {
- `runSurface` (const) - const runSurface = input.runtime?.runSurface ?? input.runSurface ?? "development";
- `agentId` (const) - const agentId = input.runtime?.agentId ?? input.agentId;
- `profile` (const) - const profile = resolveRuntimeEfficiencyProfile({
- `normalizeKeyPart` (function) - function normalizeKeyPart(value: string | undefined): string {
- `parseRunnerReuseKey` (function) - function parseRunnerReuseKey(value: string | undefined): RunnerReuseDescriptor | null {

### `src/electron/libs/runner-error.ts`

导出：`stringifyRunnerError`, `normalizeRunnerError`；关键符号：`stringifyRunnerError`, `base`, `cause`, `normalizeRunnerError`, `raw`, `normalized`

- `stringifyRunnerError` (function) - export function stringifyRunnerError(error: unknown): string {
- `base` (const) - const base = error.message?.trim() || error.name;
- `cause` (const) - const cause = "cause" in error ? stringifyRunnerError((error as Error & { cause?: unknown }).cause) : "";
- `normalizeRunnerError` (function) - export function normalizeRunnerError(
- `raw` (const) - const raw = stringifyRunnerError(error).trim();
- `normalized` (const) - const normalized = raw.toLowerCase();
- `quotedRequestedModel` (const) - const quotedRequestedModel = requestedModel ? `「${requestedModel}」` : "当前模型";
- `hasModelContext` (const) - const hasModelContext =
- `modelUnavailable` (const) - const modelUnavailable =
- `guidance` (const) - const guidance = buildFigmaAuthGuidance(globalRuntimeConfig);
- `buildFigmaAuthGuidance` (function) - function buildFigmaAuthGuidance(globalRuntimeConfig: unknown): string {
- `status` (const) - const status = getFigmaOfficialPluginStatusFromConfig(globalRuntimeConfig);

### `src/electron/libs/auto-updater-fallback.ts`

导出：`GitHubReleaseAssetLike`, `GitHubReleaseLike`, `ReleaseFallbackInfo`, `ReleaseUpdatePlan`, `isMissingPlatformUpdateMetadataError`, `normalizeAppVersion`, `compareAppVersions`, `getPlatformUpdateMetadataCandidates`；关键符号：`GitHubReleaseAssetLike`, `GitHubReleaseLike`, `ReleaseFallbackInfo`, `ReleaseUpdatePlan`, `isMissingPlatformUpdateMetadataError`, `message`

- `GitHubReleaseAssetLike` (type) - export type GitHubReleaseAssetLike = {
- `GitHubReleaseLike` (type) - export type GitHubReleaseLike = {
- `ReleaseFallbackInfo` (type) - export type ReleaseFallbackInfo = {
- `ReleaseUpdatePlan` (type) - export type ReleaseUpdatePlan = {
- `isMissingPlatformUpdateMetadataError` (function) - export function isMissingPlatformUpdateMetadataError(error: unknown): boolean {
- `message` (const) - const message = error instanceof Error ? error.message : String(error);
- `normalizeAppVersion` (function) - export function normalizeAppVersion(value: string | undefined): string {
- `compareAppVersions` (function) - export function compareAppVersions(left: string | undefined, right: string | undefined): number {
- `leftParts` (const) - const leftParts = normalizeAppVersion(left).split('.').map((part) => Number.parseInt(part, 10));
- `rightParts` (const) - const rightParts = normalizeAppVersion(right).split('.').map((part) => Number.parseInt(part, 10));
- `length` (const) - const length = Math.max(leftParts.length, rightParts.length, 3);
- `leftPart` (const) - const leftPart = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;

### `src/electron/libs/claude-settings.ts`

导出：`getClaudeCodePath`, `getCurrentApiConfig`, `getConfiguredModelNames`, `getRoutableModelNames`, `getApiConfigForModel`, `ResolvedApiConfigForModel`, `resolveApiConfigForModel`, `resolveImagePreprocessApiConfig`；关键符号：`ApiConfig`, `ApiModelConfig`, `GlobalRuntimeConfig`, `isUsableConfig`, `getEnabledUsableApiConfigs`, `resolveSystemClaudePath`

- `ApiConfig` (type) - type ApiConfig,
- `ApiModelConfig` (type) - type ApiModelConfig,
- `GlobalRuntimeConfig` (type) - type GlobalRuntimeConfig,
- `isUsableConfig` (function) - function isUsableConfig(config: ApiConfig | null | undefined): config is ApiConfig {
- `getEnabledUsableApiConfigs` (function) - function getEnabledUsableApiConfigs(): ApiConfig[] {
- `resolveSystemClaudePath` (function) - function resolveSystemClaudePath(): string | null {
- `candidates` (const) - const candidates = [
- `resolvedPath` (const) - const resolvedPath = resolveNativeClaudePath(candidate);
- `path` (const) - const path = result.stdout.trim();
- `resolvedPath` (const) - const resolvedPath = resolveNativeClaudePath(path);
- `getPathsFromEnvironment` (function) - function getPathsFromEnvironment(): string[] {
- `pathValue` (const) - const pathValue = process.env.PATH ?? "";

### `src/electron/libs/idea-launcher.ts`

导出：`IdeaEdition`, `IdeaLauncherKind`, `IdeaInstallation`, `RunningIdeaProcess`, `IdeaStatus`, `IdeaOpenInput`, `IdeaOpenResult`, `IdeaFocusResult`；关键符号：`Dirent`, `Stats`, `IdeaEdition`, `IdeaLauncherKind`, `IdeaInstallation`, `RunningIdeaProcess`

- `Dirent` (type) - type Dirent,
- `Stats` (type) - type Stats,
- `IdeaEdition` (type) - export type IdeaEdition = "ultimate" | "community" | "any";
- `IdeaLauncherKind` (type) - export type IdeaLauncherKind = "toolbox-script" | "executable" | "mac-app";
- `IdeaInstallation` (type) - export type IdeaInstallation = {
- `RunningIdeaProcess` (type) - export type RunningIdeaProcess = {
- `IdeaStatus` (type) - export type IdeaStatus = {
- `IdeaOpenInput` (type) - export type IdeaOpenInput = {
- `IdeaOpenResult` (type) - export type IdeaOpenResult = {
- `IdeaFocusResult` (type) - export type IdeaFocusResult = {
- `IdeaWaitReadyInput` (type) - export type IdeaWaitReadyInput = {
- `IdeaWaitReadyResult` (type) - export type IdeaWaitReadyResult = {

### `src/electron/libs/learning-hooks.ts`

导出：`createLearnCaptureHook`, `createCorrectionDetectionHook`, `createQualityGateHook`, `createCorrectionTrackingHook`, `createSecretScanHook`, `createGitBlastRadiusHook`, `createCommitValidateHook`, `createToolCallBudgetHook`；关键符号：`getLearningStore`, `userDataPath`, `dbPath`, `SECRET_PATTERNS`, `SECRET_ALLOWLIST`, `scanForSecrets`

- `getLearningStore` (function) - function getLearningStore(): LearningStore | null {
- `userDataPath` (const) - const userDataPath = app.getPath("userData");
- `dbPath` (const) - const dbPath = join(userDataPath, "learning-store.db");
- `SECRET_PATTERNS` (const) - const SECRET_PATTERNS = [
- `SECRET_ALLOWLIST` (const) - const SECRET_ALLOWLIST = [
- `scanForSecrets` (function) - function scanForSecrets(content: string): { name: string; snippet: string; line: number } | null {
- `snippet` (const) - const snippet = m[0];
- `matchIndex` (const) - const matchIndex = m.index ?? 0;
- `line` (const) - const line = content.slice(0, matchIndex).split("\n").length;
- `lineEndIndex` (const) - const lineEndIndex = content.indexOf("\n", matchIndex);
- `wholeLine` (const) - const wholeLine = content.slice(
- `GIT_PREFIX` (const) - const GIT_PREFIX = /\bgit(?:\s+(?:-[cC]\s+\S+|--\S+(?:=\S+)?|-[a-zA-Z]+))*\s+/;

### `src/electron/libs/tool-output-sanitizer.ts`

代码信号：event:text；导出：`InlineBase64ToolImage`, `OversizedTextToolOutput`, `TextToolOutputBlock`, `createTextToolOutputBlocks`, `extractInlineBase64ImageFromToolResponse`, `buildToolImageReplacementText`, `buildOversizedTextToolOutputReplacement`, `stripInlineBase64ImagesFromMessage`；关键符号：`InlineBase64ToolImage`, `OversizedTextToolOutput`, `TextToolOutputBlock`, `DEFAULT_MAX_TEXT_TOOL_OUTPUT_CHARS`, `TEXT_TOOL_OUTPUT_HEAD_CHARS`, `TEXT_TOOL_OUTPUT_TAIL_CHARS`

- `InlineBase64ToolImage` (type) - export type InlineBase64ToolImage = {
- `OversizedTextToolOutput` (type) - export type OversizedTextToolOutput = {
- `TextToolOutputBlock` (type) - export type TextToolOutputBlock = {
- `DEFAULT_MAX_TEXT_TOOL_OUTPUT_CHARS` (const) - const DEFAULT_MAX_TEXT_TOOL_OUTPUT_CHARS = 18_000;
- `TEXT_TOOL_OUTPUT_HEAD_CHARS` (const) - const TEXT_TOOL_OUTPUT_HEAD_CHARS = 9_000;
- `TEXT_TOOL_OUTPUT_TAIL_CHARS` (const) - const TEXT_TOOL_OUTPUT_TAIL_CHARS = 4_000;
- `createTextToolOutputBlocks` (function) - export function createTextToolOutputBlocks(text: string): TextToolOutputBlock[] {
- `extractInlineBase64ImageFromToolResponse` (function) - export function extractInlineBase64ImageFromToolResponse(toolResponse: unknown): InlineBase64ToolImage | null {
- `contentBlocks` (const) - const contentBlocks = getContentBlocks(toolResponse);
- `base64Data` (const) - const base64Data = block.source.data.replace(/\s+/g, "");
- `buildToolImageReplacementText` (function) - export function buildToolImageReplacementText(options: {
- `lines` (const) - const lines = [

### `src/electron/libs/channel-workspace.ts`

导出：`ChannelProviderId`, `ChannelInboundMessage`, `ChannelWorkspace`, `ChannelReplyTarget`, `getChannelsRoot`, `ensureChannelWorkspace`, `recordChannelInboundMessage`, `recordChannelOutboundMessage`；关键符号：`ChannelProviderId`, `ChannelInboundMessage`, `ChannelWorkspace`, `ChannelReplyTarget`, `sanitizePathSegment`, `normalized`

- `ChannelProviderId` (type) - export type ChannelProviderId =
- `ChannelInboundMessage` (type) - export type ChannelInboundMessage = {
- `ChannelWorkspace` (type) - export type ChannelWorkspace = {
- `ChannelReplyTarget` (type) - export type ChannelReplyTarget = {
- `sanitizePathSegment` (function) - function sanitizePathSegment(value: string): string {
- `normalized` (const) - const normalized = value
- `getChannelConversationId` (function) - function getChannelConversationId(message: ChannelInboundMessage): string {
- `buildReadme` (function) - function buildReadme(workspace: ChannelWorkspace): string {
- `getChannelsRoot` (function) - export function getChannelsRoot(): string {
- `ensureChannelWorkspace` (function) - export function ensureChannelWorkspace(message: ChannelInboundMessage): ChannelWorkspace {
- `provider` (const) - const provider = message.provider;
- `conversationId` (const) - const conversationId = getChannelConversationId(message);

### `src/electron/libs/system-prompt-presets.ts`

导出：`buildBrowserWorkbenchPromptAppend`, `buildAdminConfigPromptAppend`, `buildToolCallOptimizationPromptAppend`, `extractFeishuDocumentUrls`, `buildFeishuDocumentFetchPromptAppend`, `buildGlobalRuntimeSystemPromptExtAppend`, `buildBuiltinMcpRegistryPromptAppend`, `buildClaudeCode2139FeaturePromptAppend`；关键符号：`BuiltinMcpServerName`, `FEISHU_DOC_URL_PATTERN`, `FEISHU_DOC_URL_TRAILING_PUNCTUATION`, `MAX_FEISHU_DOC_URL_HINTS`, `buildBrowserWorkbenchPromptAppend`, `buildAdminConfigPromptAppend`

- `BuiltinMcpServerName` (type) - type BuiltinMcpServerName,
- `FEISHU_DOC_URL_PATTERN` (const) - const FEISHU_DOC_URL_PATTERN = /https?:\/\/[^\s<>"'`]*feishu\.cn\/(?:wiki|docx|docs)\/[^\s<>"'`]*/gi;
- `FEISHU_DOC_URL_TRAILING_PUNCTUATION` (const) - const FEISHU_DOC_URL_TRAILING_PUNCTUATION = /[),.;，。；、]+$/;
- `MAX_FEISHU_DOC_URL_HINTS` (const) - const MAX_FEISHU_DOC_URL_HINTS = 3;
- `buildBrowserWorkbenchPromptAppend` (function) - export function buildBrowserWorkbenchPromptAppend(): string {
- `buildAdminConfigPromptAppend` (function) - export function buildAdminConfigPromptAppend(): string {
- `buildToolCallOptimizationPromptAppend` (function) - export function buildToolCallOptimizationPromptAppend(): string {
- `extractFeishuDocumentUrls` (function) - export function extractFeishuDocumentUrls(text: string): string[] {
- `matches` (const) - const matches = text.match(FEISHU_DOC_URL_PATTERN) ?? [];
- `urls` (const) - const urls = matches
- `buildFeishuDocumentFetchPromptAppend` (function) - export function buildFeishuDocumentFetchPromptAppend(
- `urls` (const) - const urls = extractFeishuDocumentUrls(prompt);

### `src/electron/libs/memory/memory-types.ts`

导出：`MemoryCategory`, `MEMORY_CATEGORIES`, `MemoryScope`, `MemoryEntry`, `MemoryCreateInput`, `MemoryUpdateInput`, `MemorySearchMode`, `MemorySearchResult`；关键符号：`MemoryCategory`, `MemoryScope`, `MemoryEntry`, `MemoryCreateInput`, `MemoryUpdateInput`, `MemorySearchMode`

- `MemoryCategory` (type) - export type MemoryCategory =
- `MemoryScope` (type) - export type MemoryScope = "global" | `workspace:${string}`;
- `MemoryEntry` (type) - export type MemoryEntry = {
- `MemoryCreateInput` (type) - export type MemoryCreateInput = {
- `MemoryUpdateInput` (type) - export type MemoryUpdateInput = Partial<Omit<MemoryCreateInput, "scope">> & {
- `MemorySearchMode` (type) - export type MemorySearchMode = "fetch" | "shallow" | "deep" | "explore";
- `MemorySearchResult` (type) - export type MemorySearchResult = {
- `MemoryOverviewEntry` (type) - export type MemoryOverviewEntry = {

### `src/electron/libs/claude-project-memory.ts`

导出：`ClaudeProjectMemoryOptions`, `ClaudeProjectMemoryDocument`, `ClaudeProjectMemoryBundle`, `getUserClaudeRoot`, `toClaudeProjectSlug`, `getClaudeProjectMemoryDir`, `loadClaudeProjectMemory`, `buildClaudeProjectMemoryPromptAppend`；关键符号：`DEFAULT_MAX_MEMORY_CHARS`, `DEFAULT_MAX_FILE_CHARS`, `MEMORY_DIR_NAME`, `ClaudeProjectMemoryOptions`, `ClaudeProjectMemoryDocument`, `ClaudeProjectMemoryBundle`

- `DEFAULT_MAX_MEMORY_CHARS` (const) - const DEFAULT_MAX_MEMORY_CHARS = 20_000;
- `DEFAULT_MAX_FILE_CHARS` (const) - const DEFAULT_MAX_FILE_CHARS = 8_000;
- `MEMORY_DIR_NAME` (const) - const MEMORY_DIR_NAME = "memory";
- `ClaudeProjectMemoryOptions` (type) - export type ClaudeProjectMemoryOptions = {
- `ClaudeProjectMemoryDocument` (type) - export type ClaudeProjectMemoryDocument = {
- `ClaudeProjectMemoryBundle` (type) - export type ClaudeProjectMemoryBundle = {
- `getUserClaudeRoot` (function) - export function getUserClaudeRoot(): string {
- `toClaudeProjectSlug` (function) - export function toClaudeProjectSlug(cwd: string): string {
- `normalized` (const) - const normalized = cwd.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
- `windowsMatch` (const) - const windowsMatch = normalized.match(/^([A-Za-z]):\/?(.*)$/);
- `drive` (const) - const drive = windowsMatch[1].toUpperCase();
- `rest` (const) - const rest = windowsMatch[2]

## 数据与接口契约

- **event:text**：src/electron/libs/codex-oauth.ts:95 - typed event payload
- **event:tool_use**：src/electron/libs/codex-oauth.ts:96 - typed event payload
- **event:message**：src/electron/libs/codex-oauth.ts:100 - typed event payload
- **event:codex**：src/electron/libs/codex-oauth.ts:265 - typed event payload
- **event:output_text**：src/electron/libs/codex-oauth.ts:358 - typed event payload
- **event:message_start**：src/electron/libs/codex-oauth.ts:372 - typed event payload
- **event:content_block_start**：src/electron/libs/codex-oauth.ts:387 - typed event payload
- **event:content_block_delta**：src/electron/libs/codex-oauth.ts:393 - typed event payload
- **event:text_delta**：src/electron/libs/codex-oauth.ts:395 - typed event payload
- **event:input_json_delta**：src/electron/libs/codex-oauth.ts:408 - typed event payload
- **event:user_prompt**：src/electron/types.ts:78 - typed event payload
- **event:builtin**：src/electron/types.ts:174 - typed event payload
- **event:stream.message**：src/electron/types.ts:185 - typed event payload
- **event:stream.user_prompt**：src/electron/types.ts:186 - typed event payload
- **event:session.status**：src/electron/types.ts:187 - typed event payload
- **event:session.plan.updated**：src/electron/types.ts:188 - typed event payload
- **event:session.workflow**：src/electron/types.ts:189 - typed event payload
- **event:session.workflow.catalog**：src/electron/types.ts:190 - typed event payload
- **event:session.list**：src/electron/types.ts:191 - typed event payload
- **event:session.history**：src/electron/types.ts:192 - typed event payload
- **database:learnings**：src/electron/libs/learning-store.ts:31 - SQLite table
- **database:learnings_fts**：src/electron/libs/learning-store.ts:44 - SQLite table
- **database:learnings_sessions**：src/electron/libs/learning-store.ts:84 - SQLite table
- **database:idx_learnings_category**：src/electron/libs/learning-store.ts:78 - SQLite index
- **database:idx_learnings_project**：src/electron/libs/learning-store.ts:79 - SQLite index
- **database:idx_learnings_created_at**：src/electron/libs/learning-store.ts:80 - SQLite index
- **database:idx_learnings_sessions_project**：src/electron/libs/learning-store.ts:94 - SQLite index
- **database:idx_learnings_sessions_started_at**：src/electron/libs/learning-store.ts:95 - SQLite index
- **event:note.list**：src/electron/libs/note-types.ts:24 - typed event payload
- **event:note.created**：src/electron/libs/note-types.ts:25 - typed event payload
- **event:note.updated**：src/electron/libs/note-types.ts:26 - typed event payload
- **event:note.deleted**：src/electron/libs/note-types.ts:27 - typed event payload
- **event:note.error**：src/electron/libs/note-types.ts:28 - typed event payload
- **event:note.create**：src/electron/libs/note-types.ts:32 - typed event payload
- **event:note.get**：src/electron/libs/note-types.ts:33 - typed event payload
- **event:note.update**：src/electron/libs/note-types.ts:34 - typed event payload

## 关键概念

- **event**：electron 模块中出现 79 个 event 信号，可用于定位对应接口或运行职责。
- **database**：electron 模块中出现 15 个 database 信号，可用于定位对应接口或运行职责。
- **config**：electron 模块中出现 1 个 config 信号，可用于定位对应接口或运行职责。

## 内部关系

- `src/electron/libs/codex-oauth.ts` -> `../../shared/codex-oauth.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/types.ts` -> `../shared/prompt-ledger.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/types.ts` -> `../shared/plan-progress.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/types.ts` -> `../shared/workflow-markdown.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/types.ts` -> `./libs/note-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/memory/memory-repository.ts` -> `./memory-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/image-preprocessor.ts` -> `../types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/image-preprocessor.ts` -> `./config-store.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/image-preprocessor.ts` -> `./attachment-store.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/image-preprocessor.ts` -> `./codex-oauth.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/image-preprocessor.ts` -> `./image-preprocessor-core.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/config-store.ts` -> `../../shared/codex-oauth.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/note-repository.ts` -> `./note-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/claude-code-compat-registry.ts` -> `./slash-command-discovery.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/attachment-store.ts` -> `../types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/attachment-store.ts` -> `../../shared/attachments.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/runner-reuse.ts` -> `../../shared/builtin-mcp-registry.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/runner-reuse.ts` -> `../types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/runner-reuse.ts` -> `./runtime-efficiency.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/runner-error.ts` -> `./figma-official-plugin.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/claude-settings.ts` -> `../../shared/codex-oauth.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/claude-settings.ts` -> `../../shared/model-provider-routing.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/claude-settings.ts` -> `./config-store.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/claude-settings.ts` -> `./codex-anthropic-proxy.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/learning-hooks.ts` -> `./learning-store.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/tool-output-sanitizer.ts` -> `../types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/system-prompt-presets.ts` -> `../../shared/prompt-ledger.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/system-prompt-presets.ts` -> `../../shared/builtin-mcp-registry.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/system-prompt-presets.ts` -> `./claude-code-compat-registry.js`：本地相对依赖，需要按路径解析到目标文件

## 运行注意事项

- 涉及 SQLite/FTS/vector schema 的文件变更后，要同时验证迁移、索引行数和重启后的读取。

## 修改风险

- runner prompt 拼装顺序改变会影响所有新会话的工具、规则和知识库可见性。
- schema 字段或索引名变化会破坏旧数据读取，必须保留迁移或重建路径。

## 验证

- npm run transpile:electron
- npm run build
