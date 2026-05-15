# knowledge-engine

> 负责 Repo Wiki 生成、Markdown 切块、embedding、FTS5/sqlite-vec 索引和聊天 overview 注入。

knowledge-engine 模块包含 19 个被扫描文件，关键入口包括 `src/electron/libs/knowledge/knowledge-repository.ts`, `src/electron/libs/knowledge/knowledge-ui-store.ts`, `src/electron/libs/knowledge/knowledge-types.ts`, `src/electron/libs/knowledge/repowiki/types.ts`, `src/electron/libs/knowledge/knowledge-utils.ts`, `src/electron/libs/knowledge/repowiki/scanner.ts`, `src/electron/libs/knowledge/repowiki/intelligence.ts`, `src/electron/libs/knowledge/repowiki/prompts.ts`。

本地静态分析识别到这些代码信号：database, store，因此本页可以作为后续 Agent 定位接口、存储、事件和运行入口的索引。

## Agent 可用信息

- 定位 knowledge-engine 模块的入口、数据契约和运行风险。
- 在模型没有稳定返回 JSON 时，本页仍由本地代码信号生成，不能再退化为空白说明。

## 优先入口

- `src/electron/libs/knowledge/knowledge-repository.ts`：代码信号：database:knowledge_documents, database:knowledge_chunks, database:knowledge_chunks_fts, database:knowledge_index_runs, database:knowledge_chunk_vectors, database:idx_knowledge_documents_workspace, database:idx_knowledge_documents_source, database:idx_knowledge_chunks_document；导出：`KnowledgeRepository`；关键符号：`Row`, `RepositoryOptions`, `KnowledgeRepository`, `existing`, `expectedDimensionSql`, `expectedPrimaryKeySql`
- `src/electron/libs/knowledge/knowledge-ui-store.ts`：代码信号：database:knowledge_ui_workspaces, database:knowledge_ui_generation, database:knowledge_ui_documents, database:idx_knowledge_ui_workspaces_hidden, database:idx_knowledge_ui_documents_workspace；导出：`KnowledgeUiWorkspace`, `KnowledgeUiGeneration`, `KnowledgeUiDocument`, `KnowledgeUiStore`, `createKnowledgeUiStore`, `handleKnowledgeUiInvoke`；关键符号：`KnowledgeUiWorkspace`, `KnowledgeUiGeneration`, `KnowledgeUiDocument`, `Row`, `GeneratedMarkdownDocument`, `KnowledgeUiStore`
- `src/electron/libs/knowledge/repowiki/scanner.ts`：代码信号：store:scanner；导出：`detectLanguage`, `buildFileTree`, `scanRepoWikiProject`, `parentDirName`；关键符号：`SKIP_DIRS`, `SKIP_PATH_PREFIXES`, `SKIP_EXTS`, `MINIFIED_SOURCE_EXTS`, `LANG_MAP`, `CONFIG_FILES`
- `src/electron/libs/knowledge/repowiki/intelligence.ts`：代码信号：store:intelligence；导出：`buildRepoWikiIntelligence`, `formatRepoWikiIntelligenceForPrompt`, `formatModuleEvidenceForPrompt`；关键符号：`IMPORTANT_DEPENDENCIES`, `buildRepoWikiIntelligence`, `scripts`, `dependencies`, `signals`, `ipcChannels`

## 文件

### `src/electron/libs/knowledge/knowledge-repository.ts`

代码信号：database:knowledge_documents, database:knowledge_chunks, database:knowledge_chunks_fts, database:knowledge_index_runs, database:knowledge_chunk_vectors, database:idx_knowledge_documents_workspace, database:idx_knowledge_documents_source, database:idx_knowledge_chunks_document；导出：`KnowledgeRepository`；关键符号：`Row`, `RepositoryOptions`, `KnowledgeRepository`, `existing`, `expectedDimensionSql`, `expectedPrimaryKeySql`

- `Row` (type) - type Row = Record<string, unknown>;
- `RepositoryOptions` (type) - type RepositoryOptions = {
- `KnowledgeRepository` (class) - export class KnowledgeRepository {
- `existing` (const) - const existing = this.db
- `expectedDimensionSql` (const) - const expectedDimensionSql = `float[${this.embeddingDimension}]`;
- `expectedPrimaryKeySql` (const) - const expectedPrimaryKeySql = "chunk_rowid integer primary key";
- `now` (const) - const now = Date.now();
- `existing` (const) - const existing = this.db
- `id` (const) - const id = existing?.id ? String(existing.id) : crypto.randomUUID();
- `contentHash` (const) - const contentHash = stableHash(input.content);
- `tags` (const) - const tags = serializeTags(input.tags);
- `metadata` (const) - const metadata = stringifyJsonObject(input.metadata);

### `src/electron/libs/knowledge/knowledge-ui-store.ts`

代码信号：database:knowledge_ui_workspaces, database:knowledge_ui_generation, database:knowledge_ui_documents, database:idx_knowledge_ui_workspaces_hidden, database:idx_knowledge_ui_documents_workspace；导出：`KnowledgeUiWorkspace`, `KnowledgeUiGeneration`, `KnowledgeUiDocument`, `KnowledgeUiStore`, `createKnowledgeUiStore`, `handleKnowledgeUiInvoke`；关键符号：`KnowledgeUiWorkspace`, `KnowledgeUiGeneration`, `KnowledgeUiDocument`, `Row`, `GeneratedMarkdownDocument`, `KnowledgeUiStore`

- `KnowledgeUiWorkspace` (type) - export type KnowledgeUiWorkspace = {
- `KnowledgeUiGeneration` (type) - export type KnowledgeUiGeneration = {
- `KnowledgeUiDocument` (type) - export type KnowledgeUiDocument = {
- `Row` (type) - type Row = Record<string, unknown>;
- `GeneratedMarkdownDocument` (type) - type GeneratedMarkdownDocument = {
- `KnowledgeUiStore` (class) - export class KnowledgeUiStore {
- `dir` (const) - const dir = dirname(dbPath);
- `workspaces` (const) - const workspaces = (this.db
- `generationRows` (const) - const generationRows = this.db.prepare("SELECT * FROM knowledge_ui_generation").all() as Row[];
- `generations` (const) - const generations = Object.fromEntries(generationRows.map((row) => [String(row.workspace_key), rowToGeneration(row)]));
- `now` (const) - const now = Date.now();
- `systemKey` (const) - const systemKey = normalizeKey(systemWorkspace);

### `src/electron/libs/knowledge/knowledge-types.ts`

导出：`KnowledgeSourceKind`, `KnowledgeIndexMode`, `KnowledgeSearchMode`, `KnowledgeScopeMode`, `KnowledgeDocument`, `KnowledgeChunk`, `KnowledgeDocumentInput`, `KnowledgeChunkInput`；关键符号：`KnowledgeSourceKind`, `KnowledgeIndexMode`, `KnowledgeSearchMode`, `KnowledgeScopeMode`, `KnowledgeDocument`, `KnowledgeChunk`

- `KnowledgeSourceKind` (type) - export type KnowledgeSourceKind = "repowiki" | "memory" | "manual" | "source";
- `KnowledgeIndexMode` (type) - export type KnowledgeIndexMode = "scan" | "generate" | "refresh";
- `KnowledgeSearchMode` (type) - export type KnowledgeSearchMode = "shallow" | "deep" | "hybrid";
- `KnowledgeScopeMode` (type) - export type KnowledgeScopeMode = "workspace" | "memory" | "all";
- `KnowledgeDocument` (type) - export type KnowledgeDocument = {
- `KnowledgeChunk` (type) - export type KnowledgeChunk = {
- `KnowledgeDocumentInput` (type) - export type KnowledgeDocumentInput = {
- `KnowledgeChunkInput` (type) - export type KnowledgeChunkInput = {
- `KnowledgeUpsertInput` (type) - export type KnowledgeUpsertInput = KnowledgeDocumentInput & {
- `KnowledgeSearchResult` (type) - export type KnowledgeSearchResult = {
- `KnowledgeOverviewEntry` (type) - export type KnowledgeOverviewEntry = {
- `KnowledgeIndexReport` (type) - export type KnowledgeIndexReport = {

### `src/electron/libs/knowledge/repowiki/types.ts`

导出：`RepoWikiCodeSymbol`, `RepoWikiFileSignal`, `RepoWikiFileInfo`, `RepoWikiScriptInfo`, `RepoWikiDependencyInfo`, `RepoWikiHighValueFile`, `RepoWikiRuntimeFlow`, `RepoWikiAgentQuestion`；关键符号：`RepoWikiCodeSymbol`, `RepoWikiFileSignal`, `RepoWikiFileInfo`, `RepoWikiScriptInfo`, `RepoWikiDependencyInfo`, `RepoWikiHighValueFile`

- `RepoWikiCodeSymbol` (type) - export type RepoWikiCodeSymbol = {
- `RepoWikiFileSignal` (type) - export type RepoWikiFileSignal = {
- `RepoWikiFileInfo` (type) - export type RepoWikiFileInfo = {
- `RepoWikiScriptInfo` (type) - export type RepoWikiScriptInfo = {
- `RepoWikiDependencyInfo` (type) - export type RepoWikiDependencyInfo = {
- `RepoWikiHighValueFile` (type) - export type RepoWikiHighValueFile = {
- `RepoWikiRuntimeFlow` (type) - export type RepoWikiRuntimeFlow = {
- `RepoWikiAgentQuestion` (type) - export type RepoWikiAgentQuestion = {
- `RepoWikiProjectIntelligence` (type) - export type RepoWikiProjectIntelligence = {
- `RepoWikiProjectContext` (type) - export type RepoWikiProjectContext = {
- `TechItem` (type) - export type TechItem = {
- `ProjectOverview` (type) - export type ProjectOverview = {

### `src/electron/libs/knowledge/knowledge-utils.ts`

导出：`KNOWLEDGE_SOURCE_EXTENSIONS`, `WalkWorkspaceFile`, `WalkWorkspaceOptions`, `stableHash`, `estimateTokens`, `compactWhitespace`, `parseJsonObject`, `stringifyJsonObject`；关键符号：`KNOWLEDGE_SOURCE_EXTENSIONS`, `DEFAULT_SKIP_DIRS`, `WalkWorkspaceFile`, `WalkWorkspaceOptions`, `stableHash`, `estimateTokens`

- `KNOWLEDGE_SOURCE_EXTENSIONS` (const) - export const KNOWLEDGE_SOURCE_EXTENSIONS = new Set([
- `DEFAULT_SKIP_DIRS` (const) - const DEFAULT_SKIP_DIRS = new Set([
- `WalkWorkspaceFile` (type) - export type WalkWorkspaceFile = {
- `WalkWorkspaceOptions` (type) - export type WalkWorkspaceOptions = {
- `stableHash` (function) - export function stableHash(value: string): string {
- `estimateTokens` (function) - export function estimateTokens(text: string): number {
- `compactWhitespace` (function) - export function compactWhitespace(text: string, maxLength: number): string {
- `compact` (const) - const compact = text.replace(/\s+/g, " ").trim();
- `parseJsonObject` (function) - export function parseJsonObject(value: unknown): Record<string, unknown> {
- `parsed` (const) - const parsed = JSON.parse(value) as unknown;
- `stringifyJsonObject` (function) - export function stringifyJsonObject(value: Record<string, unknown> | undefined): string {
- `serializeTags` (function) - export function serializeTags(tags: string[] | undefined): string {

### `src/electron/libs/knowledge/repowiki/scanner.ts`

代码信号：store:scanner；导出：`detectLanguage`, `buildFileTree`, `scanRepoWikiProject`, `parentDirName`；关键符号：`SKIP_DIRS`, `SKIP_PATH_PREFIXES`, `SKIP_EXTS`, `MINIFIED_SOURCE_EXTS`, `LANG_MAP`, `CONFIG_FILES`

- `SKIP_DIRS` (const) - const SKIP_DIRS = new Set([
- `SKIP_PATH_PREFIXES` (const) - const SKIP_PATH_PREFIXES = [
- `SKIP_EXTS` (const) - const SKIP_EXTS = [
- `MINIFIED_SOURCE_EXTS` (const) - const MINIFIED_SOURCE_EXTS = new Set([".js", ".mjs", ".cjs", ".css"]);
- `LANG_MAP` (const) - const LANG_MAP = new Map<string, string>([
- `CONFIG_FILES` (const) - const CONFIG_FILES = new Set([
- `ENTRYPOINT_NAMES` (const) - const ENTRYPOINT_NAMES = new Set([
- `ENTRYPOINT_DIRS` (const) - const ENTRYPOINT_DIRS = new Set(["cmd", "bin", "scripts", "entrypoints"]);
- `detectLanguage` (function) - export function detectLanguage(path: string): string {
- `name` (const) - const name = basename(path).toLowerCase();
- `buildFileTree` (function) - export function buildFileTree(files: RepoWikiFileInfo[], maxLines = 240): string {
- `entries` (const) - const entries = new Set<string>();

### `src/electron/libs/knowledge/repowiki/intelligence.ts`

代码信号：store:intelligence；导出：`buildRepoWikiIntelligence`, `formatRepoWikiIntelligenceForPrompt`, `formatModuleEvidenceForPrompt`；关键符号：`IMPORTANT_DEPENDENCIES`, `buildRepoWikiIntelligence`, `scripts`, `dependencies`, `signals`, `ipcChannels`

- `IMPORTANT_DEPENDENCIES` (const) - const IMPORTANT_DEPENDENCIES = new Set([
- `buildRepoWikiIntelligence` (function) - export function buildRepoWikiIntelligence(
- `scripts` (const) - const scripts = readPackageScripts(project).slice(0, 28);
- `dependencies` (const) - const dependencies = readPackageDependencies(project).slice(0, 36);
- `signals` (const) - const signals = project.files.flatMap((file) => file.signals.map((signal) => withPath(signal, file.path)));
- `ipcChannels` (const) - const ipcChannels = signals.filter((signal) => signal.kind === "ipc").slice(0, 80);
- `uiIpcCalls` (const) - const uiIpcCalls = signals.filter((signal) => signal.kind === "ui_ipc").slice(0, 80);
- `mcpTools` (const) - const mcpTools = signals.filter((signal) => signal.kind === "mcp_tool").slice(0, 120);
- `mcpServers` (const) - const mcpServers = signals.filter((signal) => signal.kind === "mcp_server").slice(0, 40);
- `databaseTables` (const) - const databaseTables = signals.filter((signal) => signal.kind === "database").slice(0, 80);
- `events` (const) - const events = signals.filter((signal) => signal.kind === "event").slice(0, 80);
- `entrypoints` (const) - const entrypoints = project.files

### `src/electron/libs/knowledge/repowiki/prompts.ts`

导出：`ChatMessage`, `buildOverviewPrompt`, `buildModulePrompt`, `buildArchitecturePrompt`, `buildReadingGuidePrompt`, `extractJson`；关键符号：`ChatMessage`, `buildOverviewPrompt`, `buildModulePrompt`, `buildArchitecturePrompt`, `buildReadingGuidePrompt`, `extractJson`

- `ChatMessage` (type) - export type ChatMessage = {
- `buildOverviewPrompt` (function) - export function buildOverviewPrompt(fileTree: string, keyFiles: string, codeIntelligence: string, language = "zh"): ChatMessage[] {
- `buildModulePrompt` (function) - export function buildModulePrompt(
- `buildArchitecturePrompt` (function) - export function buildArchitecturePrompt(fileTree: string, keyFiles: string, codeIntelligence: string, language = "zh"): ChatMessage[] {
- `buildReadingGuidePrompt` (function) - export function buildReadingGuidePrompt(rankings: string, moduleSummaries: string, codeIntelligence: string, language = "zh"): ChatMessage[] {
- `extractJson` (function) - export function extractJson(text: string): unknown {
- `stripped` (const) - const stripped = text
- `start` (const) - const start = stripped.indexOf(startChar);
- `end` (const) - const end = stripped.lastIndexOf(endChar);
- `languageInstruction` (function) - function languageInstruction(language: string): string {
- `jsonInstruction` (function) - function jsonInstruction(): string {
- `escapeJsonString` (function) - function escapeJsonString(value: string): string {

### `src/electron/libs/knowledge/knowledge-paths.ts`

导出：`KnowledgeWorkspacePaths`, `createWorkspaceScope`, `createWorkspaceHash`, `resolveKnowledgeWorkspacePaths`, `ensureKnowledgeWorkspaceDirectories`；关键符号：`KnowledgeWorkspacePaths`, `createWorkspaceScope`, `createWorkspaceHash`, `resolveKnowledgeWorkspacePaths`, `resolvedRoot`, `workspaceSlug`

- `KnowledgeWorkspacePaths` (type) - export type KnowledgeWorkspacePaths = {
- `createWorkspaceScope` (function) - export function createWorkspaceScope(workspaceRoot: string): string {
- `createWorkspaceHash` (function) - export function createWorkspaceHash(workspaceRoot: string): string {
- `resolveKnowledgeWorkspacePaths` (function) - export function resolveKnowledgeWorkspacePaths(workspaceRoot: string, appDataPath: string): KnowledgeWorkspacePaths {
- `resolvedRoot` (const) - const resolvedRoot = resolve(workspaceRoot);
- `workspaceSlug` (const) - const workspaceSlug = basename(resolvedRoot) || "workspace";
- `workspaceHash` (const) - const workspaceHash = createWorkspaceHash(resolvedRoot);
- `techRoot` (const) - const techRoot = join(resolvedRoot, ".tech");
- `repowikiRoot` (const) - const repowikiRoot = join(techRoot, "repowiki", "zh");
- `repowikiContentDir` (const) - const repowikiContentDir = join(repowikiRoot, "content");
- `repowikiMetaDir` (const) - const repowikiMetaDir = join(repowikiRoot, "meta");
- `memoryDir` (const) - const memoryDir = join(techRoot, "memory");

### `src/electron/libs/knowledge/embedding-client.ts`

导出：`embedTexts`, `embedTextBatches`；关键符号：`OpenAIEmbeddingResponse`, `joinEndpoint`, `normalizedBase`, `sleep`, `normalizeEmbeddingVector`, `normalized`

- `OpenAIEmbeddingResponse` (type) - type OpenAIEmbeddingResponse = {
- `joinEndpoint` (function) - function joinEndpoint(baseURL: string, path: string): string {
- `normalizedBase` (const) - const normalizedBase = baseURL.replace(/\/$/, "");
- `sleep` (function) - function sleep(ms: number): Promise<void> {
- `normalizeEmbeddingVector` (function) - function normalizeEmbeddingVector(vector: unknown, expectedDimension: number): number[] {
- `normalized` (const) - const normalized = vector.map((item) => Number(item));
- `requestEmbeddings` (function) - async function requestEmbeddings(settings: EmbeddingModelSettings, texts: string[]): Promise<number[][]> {
- `response` (const) - const response = await fetch(joinEndpoint(settings.baseURL, "/embeddings"), {
- `rawText` (const) - const rawText = await response.text();
- `byIndex` (const) - const byIndex = new Map<number, number[]>();
- `index` (const) - const index = typeof item.index === "number" ? item.index : fallbackIndex;
- `vector` (const) - const vector = byIndex.get(index);

### `src/electron/libs/knowledge/knowledge-model-settings.ts`

导出：`resolveKnowledgeModelSettings`, `assertEmbeddingConfigured`；关键符号：`ApiConfig`, `DEFAULT_EMBEDDING_DIMENSION`, `DEFAULT_EMBEDDING_BATCH_SIZE`, `DEFAULT_WIKI_MAX_INPUT_TOKENS`, `DEFAULT_WIKI_MAX_OUTPUT_TOKENS`, `normalizePositiveInteger`

- `ApiConfig` (type) - type ApiConfig,
- `DEFAULT_EMBEDDING_DIMENSION` (const) - const DEFAULT_EMBEDDING_DIMENSION = 1536;
- `DEFAULT_EMBEDDING_BATCH_SIZE` (const) - const DEFAULT_EMBEDDING_BATCH_SIZE = 16;
- `DEFAULT_WIKI_MAX_INPUT_TOKENS` (const) - const DEFAULT_WIKI_MAX_INPUT_TOKENS = 16_000;
- `DEFAULT_WIKI_MAX_OUTPUT_TOKENS` (const) - const DEFAULT_WIKI_MAX_OUTPUT_TOKENS = 4_000;
- `normalizePositiveInteger` (function) - function normalizePositiveInteger(value: number | undefined, fallback: number): number {
- `normalized` (const) - const normalized = Math.floor(value);
- `resolveEmbeddingDimension` (function) - function resolveEmbeddingDimension(model: string, configured: number | undefined): number {
- `known` (const) - const known = KNOWN_EMBEDDING_DIMENSIONS.find((entry) => entry.pattern.test(model));
- `isUsableProfile` (function) - function isUsableProfile(profile: ApiConfig): boolean {
- `normalizeCostTier` (function) - function normalizeCostTier(value: string | undefined): WikiModelSettings["costTier"] {
- `resolveKnowledgeModelSettings` (function) - export function resolveKnowledgeModelSettings(): KnowledgeModelSettings {

### `src/electron/libs/knowledge/repowiki/analyzer.ts`

导出：`RepoWikiAnalyzerOptions`, `RepoWikiAnalyzer`；关键符号：`MAX_KEY_FILES_CHARS`, `MAX_MODULES`, `MAX_MODULE_FILES`, `MAX_MODULE_CONTEXT_CHARS`, `MAX_FILE_CONTEXT_CHARS`, `RepoWikiAnalyzerOptions`

- `MAX_KEY_FILES_CHARS` (const) - const MAX_KEY_FILES_CHARS = 44_000;
- `MAX_MODULES` (const) - const MAX_MODULES = 18;
- `MAX_MODULE_FILES` (const) - const MAX_MODULE_FILES = 24;
- `MAX_MODULE_CONTEXT_CHARS` (const) - const MAX_MODULE_CONTEXT_CHARS = 54_000;
- `MAX_FILE_CONTEXT_CHARS` (const) - const MAX_FILE_CONTEXT_CHARS = 4_200;
- `RepoWikiAnalyzerOptions` (type) - export type RepoWikiAnalyzerOptions = {
- `RepoWikiAnalyzer` (class) - export class RepoWikiAnalyzer {
- `progress` (const) - const progress = (message: string) => this.options.onProgress?.(message);
- `language` (const) - const language = this.options.language ?? "zh";
- `keyFilesText` (const) - const keyFilesText = buildKeyFilesContext(project);
- `intelligenceText` (const) - const intelligenceText = formatRepoWikiIntelligenceForPrompt(project);
- `treeHash` (const) - const treeHash = contentHash(`${project.fileTree}\n${keyFilesText}`);

### `src/electron/libs/knowledge/repowiki/engine.ts`

导出：`RepoWikiGenerationResult`, `generateRepoWiki`；关键符号：`RepoWikiGenerationResult`, `generateRepoWiki`, `scan`, `graph`, `project`, `analyzer`

- `RepoWikiGenerationResult` (type) - export type RepoWikiGenerationResult = {
- `generateRepoWiki` (function) - export async function generateRepoWiki(paths: KnowledgeWorkspacePaths, wiki: WikiModelSettings): Promise<RepoWikiGenerationResult> {
- `scan` (const) - const scan = scanRepoWikiProject(paths.workspaceRoot, {
- `graph` (const) - const graph = RepoWikiDependencyGraph.buildFromProject(scan.project);
- `project` (const) - const project = {
- `analyzer` (const) - const analyzer = new RepoWikiAnalyzer(wiki, {
- `wikiData` (const) - const wikiData = await analyzer.analyze(project, graph);
- `builder` (const) - const builder = new RepoWikiBuilder();
- `repoWiki` (const) - const repoWiki = builder.build(project, wikiData, graph);
- `generatedFiles` (const) - const generatedFiles = exportRepoWikiMarkdown(repoWiki, paths.repowikiContentDir, paths.workspaceRoot);

### `src/electron/libs/knowledge/repowiki/graph.ts`

导出：`RepoWikiDependencyGraph`, `getModuleName`；关键符号：`RepoWikiDependencyGraph`, `graph`, `content`, `patterns`, `importPath`, `resolved`

- `RepoWikiDependencyGraph` (class) - export class RepoWikiDependencyGraph {
- `graph` (const) - const graph = new RepoWikiDependencyGraph();
- `content` (const) - const content = file.content || file.preview;
- `patterns` (const) - const patterns = IMPORT_PATTERNS[file.language] ?? [];
- `importPath` (const) - const importPath = match[1];
- `resolved` (const) - const resolved = graph.resolveImport(importPath, file.path, file.language);
- `nodeIds` (const) - const nodeIds = Array.from(this.nodes.keys());
- `damping` (const) - const damping = 0.85;
- `baseScore` (const) - const baseScore = (1 - damping) / nodeIds.length;
- `scores` (const) - let scores = new Map(nodeIds.map((node) => [node, 1 / nodeIds.length]));
- `next` (const) - const next = new Map(nodeIds.map((node) => [node, baseScore]));
- `outgoing` (const) - const outgoing = Array.from(this.edges.get(node) ?? []);

### `src/electron/libs/knowledge/wiki-model-client.ts`

导出：`completeWikiChat`, `generateWikiMarkdown`；关键符号：`OpenAIChatResponse`, `DEFAULT_WIKI_CALL_TIMEOUT_MS`, `joinEndpoint`, `normalizedBase`, `sanitizeWikiMarkdown`, `completeWikiChat`

- `OpenAIChatResponse` (type) - type OpenAIChatResponse = {
- `DEFAULT_WIKI_CALL_TIMEOUT_MS` (const) - const DEFAULT_WIKI_CALL_TIMEOUT_MS = Number(process.env.TECH_CC_HUB_WIKI_CALL_TIMEOUT_MS || 120_000);
- `joinEndpoint` (function) - function joinEndpoint(baseURL: string, path: string): string {
- `normalizedBase` (const) - const normalizedBase = baseURL.replace(/\/$/, "");
- `sanitizeWikiMarkdown` (function) - function sanitizeWikiMarkdown(text: string): string {
- `completeWikiChat` (function) - export async function completeWikiChat(
- `controller` (const) - const controller = new AbortController();
- `timer` (const) - const timer = setTimeout(() => controller.abort(), DEFAULT_WIKI_CALL_TIMEOUT_MS);
- `response` (const) - const response = await fetch(joinEndpoint(settings.baseURL, "/chat/completions"), {
- `rawText` (const) - const rawText = await response.text();
- `text` (const) - const text = sanitizeWikiMarkdown(payload.choices?.[0]?.message?.content || payload.choices?.[0]?.text || "");
- `generateWikiMarkdown` (function) - export async function generateWikiMarkdown(settings: WikiModelSettings, prompt: string): Promise<string> {

### `src/electron/libs/knowledge/knowledge-indexer.ts`

导出：`indexKnowledgeWorkspace`；关键符号：`KnowledgeWorkspacePaths`, `DEFAULT_CHUNK_SIZE`, `DEFAULT_CHUNK_OVERLAP`, `MarkdownFile`, `writeJson`, `extractMarkdownTitle`

- `KnowledgeWorkspacePaths` (type) - type KnowledgeWorkspacePaths,
- `DEFAULT_CHUNK_SIZE` (const) - const DEFAULT_CHUNK_SIZE = 1_800;
- `DEFAULT_CHUNK_OVERLAP` (const) - const DEFAULT_CHUNK_OVERLAP = 220;
- `MarkdownFile` (type) - type MarkdownFile = {
- `writeJson` (function) - function writeJson(path: string, value: unknown): void {
- `extractMarkdownTitle` (function) - function extractMarkdownTitle(content: string, fallback: string): string {
- `firstHeading` (const) - const firstHeading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
- `collectMarkdownFiles` (function) - function collectMarkdownFiles(dir: string, root: string): MarkdownFile[] {
- `walk` (function) - function walk(currentDir: string): void {
- `absolutePath` (const) - const absolutePath = join(currentDir, entry);
- `stats` (const) - const stats = statSync(absolutePath);
- `content` (const) - const content = readFileSync(absolutePath, "utf8");

### `src/electron/libs/knowledge/knowledge-overview.ts`

导出：`buildKnowledgeOverviewPromptAppend`；关键符号：`groupKnowledge`, `grouped`, `list`, `groupMemory`, `grouped`, `list`

- `groupKnowledge` (function) - function groupKnowledge(entries: KnowledgeOverviewEntry[]): Map<string, KnowledgeOverviewEntry[]> {
- `grouped` (const) - const grouped = new Map<string, KnowledgeOverviewEntry[]>();
- `list` (const) - const list = grouped.get(entry.category) ?? [];
- `groupMemory` (function) - function groupMemory(entries: MemoryOverviewEntry[]): Map<string, MemoryOverviewEntry[]> {
- `grouped` (const) - const grouped = new Map<string, MemoryOverviewEntry[]>();
- `list` (const) - const list = grouped.get(entry.category) ?? [];
- `buildKnowledgeOverviewPromptAppend` (function) - export function buildKnowledgeOverviewPromptAppend(projectCwd?: string): string | undefined {
- `settings` (const) - const settings = resolveKnowledgeModelSettings();
- `paths` (const) - const paths = resolveKnowledgeWorkspacePaths(projectCwd, app.getPath("userData"));
- `repo` (const) - const repo = new KnowledgeRepository(paths.knowledgeDbPath, {
- `memoryRepo` (const) - const memoryRepo = new MemoryRepository(paths.memoryDbPath);
- `lines` (const) - const lines = [

### `src/electron/libs/knowledge/repowiki/builder.ts`

导出：`RepoWikiBuilder`；关键符号：`RepoWikiBuilder`, `overview`, `moduleId`, `mermaid`, `buildOverviewPage`, `lines`

- `RepoWikiBuilder` (class) - export class RepoWikiBuilder {
- `overview` (const) - const overview = buildOverviewPage(data.overview, project);
- `moduleId` (const) - const moduleId = `modules/${slugify(module.name || `module-${index + 1}`)}`;
- `mermaid` (const) - const mermaid = graph.toMermaid();
- `buildOverviewPage` (function) - function buildOverviewPage(overview: ProjectOverview, project: RepoWikiProjectContext): string {
- `lines` (const) - const lines = [`# ${overview.name || project.name} 项目概览`, ""];
- `version` (const) - const version = item.version ? ` ${item.version}` : "";
- `category` (const) - const category = item.category ? ` (${item.category})` : "";
- `buildArchitecturePage` (function) - function buildArchitecturePage(architecture: ArchitectureDiagram, project: RepoWikiProjectContext): string {
- `lines` (const) - const lines = ["# 架构", ""];
- `buildModulePage` (function) - function buildModulePage(module: ModuleDoc): string {
- `lines` (const) - const lines = [`# ${module.name}`, ""];

### `src/electron/libs/knowledge/repowiki/exporter.ts`

导出：`exportRepoWikiMarkdown`；关键符号：`exportRepoWikiMarkdown`, `pagePath`, `sidebarPath`, `buildSidebarMarkdown`, `lines`, `writeSidebarItem`

- `exportRepoWikiMarkdown` (function) - export function exportRepoWikiMarkdown(wiki: RepoWiki, outputDir: string, workspaceRoot: string): string[] {
- `pagePath` (const) - const pagePath = join(outputDir, `${page.id}.md`);
- `sidebarPath` (const) - const sidebarPath = join(outputDir, "_sidebar.md");
- `buildSidebarMarkdown` (function) - function buildSidebarMarkdown(wiki: RepoWiki): string {
- `lines` (const) - const lines = [`# ${wiki.projectName}`, ""];
- `writeSidebarItem` (function) - function writeSidebarItem(lines: string[], item: SidebarItem, depth: number): void {
- `indent` (const) - const indent = "  ".repeat(depth);

## 数据与接口契约

- **database:knowledge_documents**：src/electron/libs/knowledge/knowledge-repository.ts:49 - SQLite table
- **database:knowledge_chunks**：src/electron/libs/knowledge/knowledge-repository.ts:64 - SQLite table
- **database:knowledge_chunks_fts**：src/electron/libs/knowledge/knowledge-repository.ts:81 - SQLite table
- **database:knowledge_index_runs**：src/electron/libs/knowledge/knowledge-repository.ts:89 - SQLite table
- **database:knowledge_chunk_vectors**：src/electron/libs/knowledge/knowledge-repository.ts:118 - SQLite table
- **database:idx_knowledge_documents_workspace**：src/electron/libs/knowledge/knowledge-repository.ts:98 - SQLite index
- **database:idx_knowledge_documents_source**：src/electron/libs/knowledge/knowledge-repository.ts:99 - SQLite index
- **database:idx_knowledge_chunks_document**：src/electron/libs/knowledge/knowledge-repository.ts:100 - SQLite index
- **database:idx_knowledge_chunks_workspace**：src/electron/libs/knowledge/knowledge-repository.ts:101 - SQLite index
- **database:knowledge_ui_workspaces**：src/electron/libs/knowledge/knowledge-ui-store.ts:86 - SQLite table
- **database:knowledge_ui_generation**：src/electron/libs/knowledge/knowledge-ui-store.ts:96 - SQLite table
- **database:knowledge_ui_documents**：src/electron/libs/knowledge/knowledge-ui-store.ts:109 - SQLite table
- **database:idx_knowledge_ui_workspaces_hidden**：src/electron/libs/knowledge/knowledge-ui-store.ts:121 - SQLite index
- **database:idx_knowledge_ui_documents_workspace**：src/electron/libs/knowledge/knowledge-ui-store.ts:122 - SQLite index
- **store:scanner**：src/electron/libs/knowledge/repowiki/scanner.ts - UI/runtime state store
- **store:intelligence**：src/electron/libs/knowledge/repowiki/intelligence.ts - UI/runtime state store

## 关键概念

- **database**：knowledge-engine 模块中出现 14 个 database 信号，可用于定位对应接口或运行职责。
- **store**：knowledge-engine 模块中出现 2 个 store 信号，可用于定位对应接口或运行职责。

## 内部关系

- `src/electron/libs/knowledge/knowledge-repository.ts` -> `./knowledge-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-repository.ts` -> `./knowledge-utils.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-ui-store.ts` -> `./knowledge-indexer.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-ui-store.ts` -> `./knowledge-overview.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-ui-store.ts` -> `./knowledge-paths.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-ui-store.ts` -> `./knowledge-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/scanner.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/intelligence.ts` -> `./graph.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/intelligence.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/embedding-client.ts` -> `./knowledge-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-model-settings.ts` -> `../config-store.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-model-settings.ts` -> `./knowledge-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/analyzer.ts` -> `../wiki-model-client.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/analyzer.ts` -> `../knowledge-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/analyzer.ts` -> `./graph.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/analyzer.ts` -> `./intelligence.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/analyzer.ts` -> `./prompts.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/analyzer.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/engine.ts` -> `../knowledge-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/engine.ts` -> `../knowledge-paths.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/engine.ts` -> `./analyzer.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/engine.ts` -> `./builder.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/engine.ts` -> `./exporter.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/engine.ts` -> `./graph.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/engine.ts` -> `./intelligence.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/engine.ts` -> `./scanner.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/engine.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/repowiki/graph.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/wiki-model-client.ts` -> `./knowledge-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/wiki-model-client.ts` -> `./repowiki/prompts.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-indexer.ts` -> `./knowledge-repository.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-indexer.ts` -> `./knowledge-paths.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-indexer.ts` -> `./embedding-client.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-indexer.ts` -> `./knowledge-model-settings.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-indexer.ts` -> `./knowledge-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-indexer.ts` -> `./knowledge-utils.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-indexer.ts` -> `./repowiki/engine.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-overview.ts` -> `./knowledge-model-settings.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-overview.ts` -> `./knowledge-paths.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/knowledge/knowledge-overview.ts` -> `./knowledge-repository.js`：本地相对依赖，需要按路径解析到目标文件

## 运行注意事项

- 涉及 SQLite/FTS/vector schema 的文件变更后，要同时验证迁移、索引行数和重启后的读取。
- 知识库功能依赖 embedding 模型；缺失 embedding 时必须禁止开启，而不是只退回 FTS5。

## 修改风险

- 修改生成或索引链路可能导致 UI 状态、.tech Markdown、AppData SQLite、聊天注入四处不一致。
- schema 字段或索引名变化会破坏旧数据读取，必须保留迁移或重建路径。

## 验证

- npm run qa:knowledge
- npm run qa:knowledge-ui
- npm run qa:knowledge-chat
- npm run transpile:electron
