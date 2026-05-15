# mcp-tools

> 负责暴露给 Agent 的内置 MCP 工具和工具注册元数据。

mcp-tools 模块包含 16 个被扫描文件，关键入口包括 `src/electron/libs/mcp-tools/browser.ts`, `src/electron/libs/mcp-tools/figma-rest.ts`, `src/electron/libs/mcp-tools/design.ts`, `src/electron/libs/mcp-tools/README.md`, `src/electron/libs/mcp-tools/knowledge.ts`, `src/shared/builtin-mcp-registry.ts`, `src/electron/libs/mcp-tools/idea.ts`, `src/electron/libs/mcp-tools/cron.ts`。

本地静态分析识别到这些代码信号：mcp_tool, config, event，因此本页可以作为后续 Agent 定位接口、存储、事件和运行入口的索引。

## Agent 可用信息

- 定位 mcp-tools 模块的入口、数据契约和运行风险。
- 在模型没有稳定返回 JSON 时，本页仍由本地代码信号生成，不能再退化为空白说明。

## 优先入口

- `src/electron/libs/mcp-tools/browser.ts`：代码信号：mcp_tool:http_ping, mcp_tool:diagnose_port, mcp_tool:bash_batch, mcp_tool:browser_open_page, mcp_tool:browser_close_page, mcp_tool:browser_get_state, mcp_tool:browser_navigate, mcp_tool:browser_reload；导出：`BROWSER_TOOL_NAMES`, `BrowserWorkbenchToolHost`, `setBrowserToolHost`, `getBrowserToolNames`, `getBrowserMcpServer`；关键符号：`McpSdkServerConfigWithInstance`, `BROWSER_TOOL_NAMES`, `BrowserWorkbenchToolHost`, `BROWSER_TOOLS_SERVER_NAME`, `BROWSER_MCP_SERVER_VERSION`, `MAX_CAPTURE_SNIPPET`
- `src/electron/libs/mcp-tools/figma-rest.ts`：代码信号：mcp_tool:figma_get_current_user, mcp_tool:figma_get_file_metadata, mcp_tool:figma_read_design, mcp_tool:figma_list_node_index, mcp_tool:figma_match_ui_nodes, mcp_tool:figma_summarize_design, mcp_tool:figma_extract_design_tokens, mcp_tool:figma_get_design_playbook；导出：`getFigmaRestMcpServer`, `FIGMA_REST_TOOL_NAMES`；关键符号：`McpSdkServerConfigWithInstance`, `FigmaLocator`, `FigmaUiMatchNode`, `FIGMA_REST_SERVER_NAME`, `FIGMA_REST_SERVER_VERSION`, `DEFAULT_MAX_BYTES`
- `src/electron/libs/mcp-tools/design.ts`：代码信号：mcp_tool:design_capture_current_view, mcp_tool:design_capture_current_region, mcp_tool:design_inspect_image, mcp_tool:design_compare_current_view, mcp_tool:design_compare_images, mcp_tool:design_compare_current_view_batch, mcp_tool:design_compare_images_batch, mcp_tool:design_read_comparison_report；导出：`DESIGN_TOOL_NAMES`, `DesignToolHost`, `setDesignToolHost`, `getDesignMcpServer`；关键符号：`McpSdkServerConfigWithInstance`, `DESIGN_TOOL_NAMES`, `DesignToolHost`, `ImageSize`, `CapturedImage`, `IgnoreRegion`
- `src/electron/libs/mcp-tools/README.md`：配置文件，会影响构建、开发或模型能力；代码信号：config:src/electron/libs/mcp-tools/README.md
- `src/electron/libs/mcp-tools/knowledge.ts`：代码信号：mcp_tool:knowledge_search, mcp_tool:knowledge_read, mcp_tool:knowledge_explore, mcp_tool:knowledge_index, mcp_tool:memory_update；导出：`KNOWLEDGE_TOOL_NAMES`, `getKnowledgeMcpServer`；关键符号：`McpSdkServerConfigWithInstance`, `KNOWLEDGE_TOOL_NAMES`, `KNOWLEDGE_MCP_SERVER_NAME`, `KNOWLEDGE_MCP_SERVER_VERSION`, `knowledgeMcpServers`, `SEARCH_SCHEMA`
- `src/shared/builtin-mcp-registry.ts`：代码信号：event:builtin；导出：`BuiltinMcpServerName`, `BuiltinMcpIconKey`, `BuiltinMcpToolInfo`, `BuiltinMcpToolGroup`, `BuiltinMcpServerDefinition`, `BUILTIN_MCP_SERVERS`, `getBuiltinMcpServerDefinition`, `listBuiltinMcpServerInfos`；关键符号：`BuiltinMcpServerName`, `BuiltinMcpIconKey`, `BuiltinMcpToolInfo`, `BuiltinMcpToolGroup`, `BuiltinMcpServerDefinition`, `getBuiltinMcpServerDefinition`
- `src/electron/libs/mcp-tools/idea.ts`：代码信号：mcp_tool:idea_status, mcp_tool:idea_open, mcp_tool:idea_focus, mcp_tool:idea_wait_ready；导出：`IDEA_TOOL_NAMES`, `getIdeaMcpServer`；关键符号：`McpSdkServerConfigWithInstance`, `IDEA_TOOL_NAMES`, `IDEA_TOOLS_SERVER_NAME`, `IDEA_MCP_SERVER_VERSION`, `EDITION_SCHEMA`, `IDEA_STATUS_SCHEMA`
- `src/electron/libs/mcp-tools/cron.ts`：代码信号：mcp_tool:create_scheduled_task, mcp_tool:list_scheduled_tasks, mcp_tool:delete_scheduled_task；导出：`CRON_TOOL_NAMES`, `setCronService`, `getCronMcpServer`；关键符号：`McpSdkServerConfigWithInstance`, `CRON_TOOL_NAMES`, `CRON_TOOLS_SERVER_NAME`, `CRON_MCP_SERVER_VERSION`, `setCronService`, `buildScheduleFromInput`

## 文件

### `src/electron/libs/mcp-tools/browser.ts`

代码信号：mcp_tool:http_ping, mcp_tool:diagnose_port, mcp_tool:bash_batch, mcp_tool:browser_open_page, mcp_tool:browser_close_page, mcp_tool:browser_get_state, mcp_tool:browser_navigate, mcp_tool:browser_reload；导出：`BROWSER_TOOL_NAMES`, `BrowserWorkbenchToolHost`, `setBrowserToolHost`, `getBrowserToolNames`, `getBrowserMcpServer`；关键符号：`McpSdkServerConfigWithInstance`, `BROWSER_TOOL_NAMES`, `BrowserWorkbenchToolHost`, `BROWSER_TOOLS_SERVER_NAME`, `BROWSER_MCP_SERVER_VERSION`, `MAX_CAPTURE_SNIPPET`

- `McpSdkServerConfigWithInstance` (type) - type McpSdkServerConfigWithInstance,
- `BROWSER_TOOL_NAMES` (const) - export const BROWSER_TOOL_NAMES = [
- `BrowserWorkbenchToolHost` (type) - export type BrowserWorkbenchToolHost = {
- `BROWSER_TOOLS_SERVER_NAME` (const) - const BROWSER_TOOLS_SERVER_NAME = "tech-cc-hub-browser";
- `BROWSER_MCP_SERVER_VERSION` (const) - const BROWSER_MCP_SERVER_VERSION = "1.0.0";
- `MAX_CAPTURE_SNIPPET` (const) - const MAX_CAPTURE_SNIPPET = 4096;
- `DEFAULT_HTTP_PING_TIMEOUT_MS` (const) - const DEFAULT_HTTP_PING_TIMEOUT_MS = 3000;
- `MAX_HTTP_PING_TIMEOUT_MS` (const) - const MAX_HTTP_PING_TIMEOUT_MS = 15000;
- `DEFAULT_CONSOLE_WAIT_TIMEOUT_MS` (const) - const DEFAULT_CONSOLE_WAIT_TIMEOUT_MS = 10000;
- `MAX_CONSOLE_WAIT_TIMEOUT_MS` (const) - const MAX_CONSOLE_WAIT_TIMEOUT_MS = 60000;
- `CONSOLE_WAIT_INTERVAL_MS` (const) - const CONSOLE_WAIT_INTERVAL_MS = 150;
- `MAX_BATCH_COMMANDS` (const) - const MAX_BATCH_COMMANDS = 20;

### `src/electron/libs/mcp-tools/figma-rest.ts`

代码信号：mcp_tool:figma_get_current_user, mcp_tool:figma_get_file_metadata, mcp_tool:figma_read_design, mcp_tool:figma_list_node_index, mcp_tool:figma_match_ui_nodes, mcp_tool:figma_summarize_design, mcp_tool:figma_extract_design_tokens, mcp_tool:figma_get_design_playbook；导出：`getFigmaRestMcpServer`, `FIGMA_REST_TOOL_NAMES`；关键符号：`McpSdkServerConfigWithInstance`, `FigmaLocator`, `FigmaUiMatchNode`, `FIGMA_REST_SERVER_NAME`, `FIGMA_REST_SERVER_VERSION`, `DEFAULT_MAX_BYTES`

- `McpSdkServerConfigWithInstance` (type) - type McpSdkServerConfigWithInstance,
- `FigmaLocator` (type) - type FigmaLocator,
- `FigmaUiMatchNode` (type) - type FigmaUiMatchNode,
- `FIGMA_REST_SERVER_NAME` (const) - const FIGMA_REST_SERVER_NAME = "tech-cc-hub-figma";
- `FIGMA_REST_SERVER_VERSION` (const) - const FIGMA_REST_SERVER_VERSION = "1.0.0";
- `DEFAULT_MAX_BYTES` (const) - const DEFAULT_MAX_BYTES = 160_000;
- `MAX_RESPONSE_BYTES` (const) - const MAX_RESPONSE_BYTES = 500_000;
- `FIGMA_FILE_LIBRARY_KINDS` (const) - const FIGMA_FILE_LIBRARY_KINDS = ["components", "component_sets", "styles"] as const;
- `FIGMA_VARIABLE_KINDS` (const) - const FIGMA_VARIABLE_KINDS = ["local", "published"] as const;
- `FIGMA_CODE_OUTPUTS` (const) - const FIGMA_CODE_OUTPUTS = ["react", "html"] as const;
- `DEFAULT_SUMMARY_DEPTH` (const) - const DEFAULT_SUMMARY_DEPTH = 4;
- `DEFAULT_SUMMARY_MAX_NODES` (const) - const DEFAULT_SUMMARY_MAX_NODES = 120;

### `src/electron/libs/mcp-tools/design.ts`

代码信号：mcp_tool:design_capture_current_view, mcp_tool:design_capture_current_region, mcp_tool:design_inspect_image, mcp_tool:design_compare_current_view, mcp_tool:design_compare_images, mcp_tool:design_compare_current_view_batch, mcp_tool:design_compare_images_batch, mcp_tool:design_read_comparison_report；导出：`DESIGN_TOOL_NAMES`, `DesignToolHost`, `setDesignToolHost`, `getDesignMcpServer`；关键符号：`McpSdkServerConfigWithInstance`, `DESIGN_TOOL_NAMES`, `DesignToolHost`, `ImageSize`, `CapturedImage`, `IgnoreRegion`

- `McpSdkServerConfigWithInstance` (type) - type McpSdkServerConfigWithInstance,
- `DESIGN_TOOL_NAMES` (const) - export const DESIGN_TOOL_NAMES = [
- `DesignToolHost` (type) - export type DesignToolHost = {
- `ImageSize` (type) - type ImageSize = {
- `CapturedImage` (type) - type CapturedImage = {
- `IgnoreRegion` (type) - type IgnoreRegion = {
- `NormalizedRegion` (type) - type NormalizedRegion = IgnoreRegion & {
- `DiffColorMode` (type) - type DiffColorMode = "highlight" | "directional" | "heatmap";
- `ComparisonSensitivity` (type) - type ComparisonSensitivity = "strict" | "balanced" | "relaxed";
- `DiffTileStats` (type) - type DiffTileStats = {
- `DesignArtifactKind` (type) - type DesignArtifactKind = "current" | "diff" | "comparison" | "comparison-report" | "unknown";
- `DESIGN_TOOLS_SERVER_NAME` (const) - const DESIGN_TOOLS_SERVER_NAME = "tech-cc-hub-design";

### `src/electron/libs/mcp-tools/README.md`

配置文件，会影响构建、开发或模型能力；代码信号：config:src/electron/libs/mcp-tools/README.md

### `src/electron/libs/mcp-tools/knowledge.ts`

代码信号：mcp_tool:knowledge_search, mcp_tool:knowledge_read, mcp_tool:knowledge_explore, mcp_tool:knowledge_index, mcp_tool:memory_update；导出：`KNOWLEDGE_TOOL_NAMES`, `getKnowledgeMcpServer`；关键符号：`McpSdkServerConfigWithInstance`, `KNOWLEDGE_TOOL_NAMES`, `KNOWLEDGE_MCP_SERVER_NAME`, `KNOWLEDGE_MCP_SERVER_VERSION`, `knowledgeMcpServers`, `SEARCH_SCHEMA`

- `McpSdkServerConfigWithInstance` (type) - type McpSdkServerConfigWithInstance,
- `KNOWLEDGE_TOOL_NAMES` (const) - export const KNOWLEDGE_TOOL_NAMES = [
- `KNOWLEDGE_MCP_SERVER_NAME` (const) - const KNOWLEDGE_MCP_SERVER_NAME = "tech-cc-hub-knowledge";
- `KNOWLEDGE_MCP_SERVER_VERSION` (const) - const KNOWLEDGE_MCP_SERVER_VERSION = "1.0.0";
- `knowledgeMcpServers` (const) - const knowledgeMcpServers = new Map<string, McpSdkServerConfigWithInstance>();
- `SEARCH_SCHEMA` (const) - const SEARCH_SCHEMA = {
- `READ_SCHEMA` (const) - const READ_SCHEMA = {
- `EXPLORE_SCHEMA` (const) - const EXPLORE_SCHEMA = {
- `INDEX_SCHEMA` (const) - const INDEX_SCHEMA = {
- `MEMORY_UPDATE_SCHEMA` (const) - const MEMORY_UPDATE_SCHEMA = {
- `resolveWorkspaceRoot` (function) - function resolveWorkspaceRoot(input: string | undefined, defaultWorkspaceRoot: string | undefined): string {
- `workspaceRoot` (const) - const workspaceRoot = input?.trim() || defaultWorkspaceRoot || process.cwd();

### `src/shared/builtin-mcp-registry.ts`

代码信号：event:builtin；导出：`BuiltinMcpServerName`, `BuiltinMcpIconKey`, `BuiltinMcpToolInfo`, `BuiltinMcpToolGroup`, `BuiltinMcpServerDefinition`, `BUILTIN_MCP_SERVERS`, `getBuiltinMcpServerDefinition`, `listBuiltinMcpServerInfos`；关键符号：`BuiltinMcpServerName`, `BuiltinMcpIconKey`, `BuiltinMcpToolInfo`, `BuiltinMcpToolGroup`, `BuiltinMcpServerDefinition`, `getBuiltinMcpServerDefinition`

- `BuiltinMcpServerName` (type) - export type BuiltinMcpServerName =
- `BuiltinMcpIconKey` (type) - export type BuiltinMcpIconKey =
- `BuiltinMcpToolInfo` (type) - export type BuiltinMcpToolInfo = {
- `BuiltinMcpToolGroup` (type) - export type BuiltinMcpToolGroup = {
- `BuiltinMcpServerDefinition` (type) - export type BuiltinMcpServerDefinition = {
- `getBuiltinMcpServerDefinition` (function) - export function getBuiltinMcpServerDefinition(name: string): BuiltinMcpServerDefinition | undefined {
- `listBuiltinMcpServerInfos` (function) - export function listBuiltinMcpServerInfos(): Array<Pick<BuiltinMcpServerDefinition, "name" | "type" | "command" | "args" | "envKeys" | "enabled">> {
- `listBuiltinMcpToolNames` (function) - export function listBuiltinMcpToolNames(): string[] {
- `buildBuiltinMcpPromptHints` (function) - export function buildBuiltinMcpPromptHints(enabledServerNames?: readonly BuiltinMcpServerName[]): string {
- `enabledNames` (const) - const enabledNames = enabledServerNames ? new Set(enabledServerNames) : null;

### `src/electron/libs/mcp-tools/idea.ts`

代码信号：mcp_tool:idea_status, mcp_tool:idea_open, mcp_tool:idea_focus, mcp_tool:idea_wait_ready；导出：`IDEA_TOOL_NAMES`, `getIdeaMcpServer`；关键符号：`McpSdkServerConfigWithInstance`, `IDEA_TOOL_NAMES`, `IDEA_TOOLS_SERVER_NAME`, `IDEA_MCP_SERVER_VERSION`, `EDITION_SCHEMA`, `IDEA_STATUS_SCHEMA`

- `McpSdkServerConfigWithInstance` (type) - type McpSdkServerConfigWithInstance,
- `IDEA_TOOL_NAMES` (const) - export const IDEA_TOOL_NAMES = [
- `IDEA_TOOLS_SERVER_NAME` (const) - const IDEA_TOOLS_SERVER_NAME = "tech-cc-hub-idea";
- `IDEA_MCP_SERVER_VERSION` (const) - const IDEA_MCP_SERVER_VERSION = "1.0.0";
- `EDITION_SCHEMA` (const) - const EDITION_SCHEMA = z.enum(["any", "ultimate", "community"]);
- `IDEA_STATUS_SCHEMA` (const) - const IDEA_STATUS_SCHEMA = {
- `IDEA_OPEN_SCHEMA` (const) - const IDEA_OPEN_SCHEMA = {
- `IDEA_FOCUS_SCHEMA` (const) - const IDEA_FOCUS_SCHEMA = {};
- `IDEA_WAIT_READY_SCHEMA` (const) - const IDEA_WAIT_READY_SCHEMA = {
- `getIdeaMcpServer` (function) - export function getIdeaMcpServer(): McpSdkServerConfigWithInstance {
- `statusHandler` (const) - const statusHandler = tool(
- `status` (const) - const status = await getIdeaStatus();

### `src/electron/libs/mcp-tools/cron.ts`

代码信号：mcp_tool:create_scheduled_task, mcp_tool:list_scheduled_tasks, mcp_tool:delete_scheduled_task；导出：`CRON_TOOL_NAMES`, `setCronService`, `getCronMcpServer`；关键符号：`McpSdkServerConfigWithInstance`, `CRON_TOOL_NAMES`, `CRON_TOOLS_SERVER_NAME`, `CRON_MCP_SERVER_VERSION`, `setCronService`, `buildScheduleFromInput`

- `McpSdkServerConfigWithInstance` (type) - type McpSdkServerConfigWithInstance,
- `CRON_TOOL_NAMES` (const) - export const CRON_TOOL_NAMES = [
- `CRON_TOOLS_SERVER_NAME` (const) - const CRON_TOOLS_SERVER_NAME = "tech-cc-hub-cron";
- `CRON_MCP_SERVER_VERSION` (const) - const CRON_MCP_SERVER_VERSION = "1.0.0";
- `setCronService` (function) - export function setCronService(service: CronService): void {
- `buildScheduleFromInput` (function) - function buildScheduleFromInput(input: {
- `kind` (const) - const kind = input.scheduleKind;
- `desc` (const) - const desc = input.scheduleDescription?.trim() || "";
- `expr` (const) - const expr = input.cronExpression?.trim() || "";
- `seconds` (const) - const seconds = input.everySeconds;
- `ms` (const) - const ms = seconds * 1000;
- `minutes` (const) - const minutes = Math.round(seconds / 60);

### `src/electron/libs/mcp-tools/figma-design-intelligence.ts`

导出：`FIGMA_DESIGN_DOMAINS`, `FIGMA_DESIGN_AUDIT_FRAMEWORKS`, `FigmaDesignDomain`, `FigmaDesignAuditFramework`, `FigmaDesignSummaryForAudit`, `buildFigmaDesignPlaybook`, `buildFigmaDesignAudit`；关键符号：`FIGMA_DESIGN_DOMAINS`, `FIGMA_DESIGN_AUDIT_FRAMEWORKS`, `FigmaDesignDomain`, `FigmaDesignAuditFramework`, `AuditSeverity`, `AuditFinding`

- `FIGMA_DESIGN_DOMAINS` (const) - export const FIGMA_DESIGN_DOMAINS = [
- `FIGMA_DESIGN_AUDIT_FRAMEWORKS` (const) - export const FIGMA_DESIGN_AUDIT_FRAMEWORKS = [
- `FigmaDesignDomain` (type) - export type FigmaDesignDomain = typeof FIGMA_DESIGN_DOMAINS[number];
- `FigmaDesignAuditFramework` (type) - export type FigmaDesignAuditFramework = typeof FIGMA_DESIGN_AUDIT_FRAMEWORKS[number];
- `AuditSeverity` (type) - type AuditSeverity = "high" | "medium" | "low";
- `AuditFinding` (type) - type AuditFinding = {
- `AuditNode` (type) - type AuditNode = {
- `AuditTokenEntry` (type) - type AuditTokenEntry<T extends string | number> = {
- `FigmaDesignSummaryForAudit` (type) - export type FigmaDesignSummaryForAudit = {
- `FlattenedAuditNode` (type) - type FlattenedAuditNode = {
- `DesignSystemProfile` (type) - type DesignSystemProfile = {
- `UX_PRINCIPLES` (const) - const UX_PRINCIPLES = [

### `src/electron/libs/mcp-tools/admin.ts`

代码信号：mcp_tool:set_global_runtime_config；导出：`ADMIN_TOOL_NAMES`, `getAdminMcpServer`；关键符号：`McpSdkServerConfigWithInstance`, `ADMIN_TOOL_NAMES`, `ADMIN_TOOLS_SERVER_NAME`, `ADMIN_MCP_SERVER_VERSION`, `MAX_ENV_KEY_LENGTH`, `MAX_ENV_VALUE_LENGTH`

- `McpSdkServerConfigWithInstance` (type) - type McpSdkServerConfigWithInstance,
- `ADMIN_TOOL_NAMES` (const) - export const ADMIN_TOOL_NAMES = ["set_global_runtime_config"] as const;
- `ADMIN_TOOLS_SERVER_NAME` (const) - const ADMIN_TOOLS_SERVER_NAME = "tech-cc-hub-admin";
- `ADMIN_MCP_SERVER_VERSION` (const) - const ADMIN_MCP_SERVER_VERSION = "1.0.0";
- `MAX_ENV_KEY_LENGTH` (const) - const MAX_ENV_KEY_LENGTH = 128;
- `MAX_ENV_VALUE_LENGTH` (const) - const MAX_ENV_VALUE_LENGTH = 4096;
- `MAX_ENV_ENTRIES` (const) - const MAX_ENV_ENTRIES = 120;
- `MAX_SKILL_NAME_LENGTH` (const) - const MAX_SKILL_NAME_LENGTH = 128;
- `MAX_SKILL_CREDENTIAL_ENTRIES` (const) - const MAX_SKILL_CREDENTIAL_ENTRIES = 80;
- `MAX_DELETE_ITEMS` (const) - const MAX_DELETE_ITEMS = 80;
- `MAX_SYSTEM_PROMPT_EXT_LINES` (const) - const MAX_SYSTEM_PROMPT_EXT_LINES = 40;
- `MAX_SYSTEM_PROMPT_EXT_LINE_LENGTH` (const) - const MAX_SYSTEM_PROMPT_EXT_LINE_LENGTH = 2000;

### `src/electron/libs/mcp-tools/plan.ts`

代码信号：mcp_tool:update_plan；导出：`PLAN_TOOL_NAMES`, `getPlanMcpServer`；关键符号：`McpSdkServerConfigWithInstance`, `PLAN_TOOL_NAMES`, `PLAN_MCP_SERVER_NAME`, `PLAN_MCP_SERVER_VERSION`, `planUpdatedResult`, `PLAN_ITEM_SCHEMA`

- `McpSdkServerConfigWithInstance` (type) - type McpSdkServerConfigWithInstance,
- `PLAN_TOOL_NAMES` (const) - export const PLAN_TOOL_NAMES = [
- `PLAN_MCP_SERVER_NAME` (const) - const PLAN_MCP_SERVER_NAME = "tech-cc-hub-plan";
- `PLAN_MCP_SERVER_VERSION` (const) - const PLAN_MCP_SERVER_VERSION = "1.0.0";
- `planUpdatedResult` (function) - function planUpdatedResult() {
- `PLAN_ITEM_SCHEMA` (const) - const PLAN_ITEM_SCHEMA = z.object({
- `UPDATE_PLAN_SCHEMA` (const) - const UPDATE_PLAN_SCHEMA = {
- `getPlanMcpServer` (function) - export function getPlanMcpServer(): McpSdkServerConfigWithInstance {
- `updatePlanHandler` (const) - const updatePlanHandler = tool(

### `src/electron/libs/mcp-tools/tool-result.ts`

代码信号：event:text；导出：`toTextToolResult`, `toPlainTextToolResult`；关键符号：`toTextToolResult`, `toPlainTextToolResult`

- `toTextToolResult` (function) - export function toTextToolResult(payload: unknown, isError = false): CallToolResult {
- `toPlainTextToolResult` (function) - export function toPlainTextToolResult(text: string, isError = false): CallToolResult {

### `src/electron/libs/mcp-tools/figma-ui-node-matcher.ts`

导出：`FigmaUiMatchNode`, `FigmaUiNodeMatchOptions`, `FigmaUiNodeMapping`, `FigmaUiNodeMatchCandidate`, `matchUiNodesToFigmaNodes`；关键符号：`Bounds`, `FigmaUiMatchNode`, `FigmaUiNodeMatchOptions`, `FigmaUiNodeMapping`, `FigmaUiNodeMatchCandidate`, `matchUiNodesToFigmaNodes`

- `Bounds` (type) - type Bounds = {
- `FigmaUiMatchNode` (type) - export type FigmaUiMatchNode = {
- `FigmaUiNodeMatchOptions` (type) - export type FigmaUiNodeMatchOptions = {
- `FigmaUiNodeMapping` (type) - export type FigmaUiNodeMapping = {
- `FigmaUiNodeMatchCandidate` (type) - export type FigmaUiNodeMatchCandidate = {
- `matchUiNodesToFigmaNodes` (function) - export function matchUiNodesToFigmaNodes(
- `maxMatches` (const) - const maxMatches = clampInteger(options.maxMatchesPerUiNode, 1, 10, 3);
- `minScore` (const) - const minScore = clampInteger(options.minScore, 1, 500, 45);
- `figmaRootBounds` (const) - const figmaRootBounds = options.figmaRootBounds ?? figmaNodes.find((node) => node.bounds)?.bounds;
- `matches` (const) - const matches = figmaNodes
- `stats` (const) - const stats = {
- `scoreUiToFigmaCandidate` (function) - function scoreUiToFigmaCandidate(

### `src/electron/libs/builtin-mcp-servers.ts`

导出：`BUILTIN_MCP_SERVER_FACTORIES`, `BUILTIN_MCP_TOOL_NAMES`, `getBuiltinMcpServers`, `listBuiltinMcpToolNames`；关键符号：`BuiltinMcpServerName`, `BuiltinMcpFactoryContext`, `BuiltinMcpFactory`, `getBuiltinMcpServers`, `context`, `enabledNames`

- `BuiltinMcpServerName` (type) - type BuiltinMcpServerName,
- `BuiltinMcpFactoryContext` (type) - type BuiltinMcpFactoryContext = {
- `BuiltinMcpFactory` (type) - type BuiltinMcpFactory = (context: BuiltinMcpFactoryContext) => McpSdkServerConfigWithInstance;
- `getBuiltinMcpServers` (function) - export function getBuiltinMcpServers(
- `context` (const) - const context = typeof contextOrSessionId === "string"
- `enabledNames` (const) - const enabledNames = enabledServerNames ? new Set(enabledServerNames) : null;
- `server` (const) - const server = BUILTIN_MCP_SERVER_FACTORIES[definition.name](context);
- `listBuiltinMcpToolNames` (function) - export function listBuiltinMcpToolNames(enabledServerNames?: readonly BuiltinMcpServerName[]): string[] {

### `src/electron/libs/mcp-tools/figma-node-index.ts`

导出：`FigmaNodeIndexEntry`, `buildFigmaNodeIndex`, `pickRecommendedNodeIds`, `filterFigmaNodeIndex`；关键符号：`FigmaNodeIndexEntry`, `buildFigmaNodeIndex`, `visit`, `name`, `children`, `text`

- `FigmaNodeIndexEntry` (type) - export type FigmaNodeIndexEntry = {
- `buildFigmaNodeIndex` (function) - export function buildFigmaNodeIndex(roots: Record<string, unknown>[], maxEntries: number): FigmaNodeIndexEntry[] {
- `visit` (const) - const visit = (node: Record<string, unknown>, pathParts: string[]) => {
- `name` (const) - const name = readString(node, "name") || "(unnamed)";
- `children` (const) - const children = getNodeChildren(node);
- `text` (const) - const text = collectFigmaNodeText(node);
- `pickRecommendedNodeIds` (function) - export function pickRecommendedNodeIds(index: FigmaNodeIndexEntry[], currentNodeIds: string[]): string[] {
- `branchCandidates` (const) - const branchCandidates = index
- `rankedCandidates` (const) - const rankedCandidates = [...branchCandidates].sort(compareFigmaRecommendationEntries);
- `hasQueryScores` (const) - const hasQueryScores = rankedCandidates.some((entry) => (entry.matchScore ?? 0) > 0);
- `preferredMatch` (const) - const preferredMatch = rankedCandidates.find((entry) => (entry.matchScore ?? 0) > 0);
- `preferred` (const) - const preferred = branchCandidates.find((entry) => {

### `src/electron/libs/mcp-tools/figma-locator.ts`

导出：`FigmaLocator`, `parseFigmaLocator`, `normalizeNodeId`；关键符号：`FigmaLocator`, `parseFigmaLocator`, `raw`, `parsedNodeIds`, `url`, `segments`

- `FigmaLocator` (type) - export type FigmaLocator = {
- `parseFigmaLocator` (function) - export function parseFigmaLocator(fileKeyOrUrl: string, explicitNodeIds: string[] = []): FigmaLocator {
- `raw` (const) - const raw = fileKeyOrUrl.trim();
- `parsedNodeIds` (const) - const parsedNodeIds = explicitNodeIds.map(normalizeNodeId).filter(Boolean);
- `url` (const) - const url = new URL(raw);
- `segments` (const) - const segments = url.pathname.split("/").filter(Boolean);
- `keySegmentIndex` (const) - const keySegmentIndex = segments.findIndex((segment) => (
- `fileKey` (const) - const fileKey = keySegmentIndex >= 0 ? segments[keySegmentIndex + 1] : "";
- `nodeIdFromUrl` (const) - const nodeIdFromUrl = normalizeNodeId(url.searchParams.get("node-id") ?? "");
- `normalizeNodeId` (function) - export function normalizeNodeId(nodeId: string): string {

## 数据与接口契约

- **mcp_tool:http_ping**：src/electron/libs/mcp-tools/browser.ts:644 - built-in MCP tool
- **mcp_tool:diagnose_port**：src/electron/libs/mcp-tools/browser.ts:657 - built-in MCP tool
- **mcp_tool:bash_batch**：src/electron/libs/mcp-tools/browser.ts:666 - built-in MCP tool
- **mcp_tool:browser_open_page**：src/electron/libs/mcp-tools/browser.ts:685 - built-in MCP tool
- **mcp_tool:browser_close_page**：src/electron/libs/mcp-tools/browser.ts:696 - built-in MCP tool
- **mcp_tool:browser_get_state**：src/electron/libs/mcp-tools/browser.ts:707 - built-in MCP tool
- **mcp_tool:browser_navigate**：src/electron/libs/mcp-tools/browser.ts:718 - built-in MCP tool
- **mcp_tool:browser_reload**：src/electron/libs/mcp-tools/browser.ts:729 - built-in MCP tool
- **mcp_tool:browser_extract_page**：src/electron/libs/mcp-tools/browser.ts:740 - built-in MCP tool
- **mcp_tool:browser_capture_visible**：src/electron/libs/mcp-tools/browser.ts:759 - built-in MCP tool
- **mcp_tool:figma_get_current_user**：src/electron/libs/mcp-tools/figma-rest.ts:828 - built-in MCP tool
- **mcp_tool:figma_get_file_metadata**：src/electron/libs/mcp-tools/figma-rest.ts:849 - built-in MCP tool
- **mcp_tool:figma_read_design**：src/electron/libs/mcp-tools/figma-rest.ts:890 - built-in MCP tool
- **mcp_tool:figma_list_node_index**：src/electron/libs/mcp-tools/figma-rest.ts:935 - built-in MCP tool
- **mcp_tool:figma_match_ui_nodes**：src/electron/libs/mcp-tools/figma-rest.ts:984 - built-in MCP tool
- **mcp_tool:figma_summarize_design**：src/electron/libs/mcp-tools/figma-rest.ts:1037 - built-in MCP tool
- **mcp_tool:figma_extract_design_tokens**：src/electron/libs/mcp-tools/figma-rest.ts:1075 - built-in MCP tool
- **mcp_tool:figma_get_design_playbook**：src/electron/libs/mcp-tools/figma-rest.ts:1108 - built-in MCP tool
- **mcp_tool:figma_audit_design**：src/electron/libs/mcp-tools/figma-rest.ts:1136 - built-in MCP tool
- **mcp_tool:figma_generate_tailwind_code**：src/electron/libs/mcp-tools/figma-rest.ts:1184 - built-in MCP tool
- **mcp_tool:design_capture_current_view**：src/electron/libs/mcp-tools/design.ts:970 - built-in MCP tool
- **mcp_tool:design_capture_current_region**：src/electron/libs/mcp-tools/design.ts:995 - built-in MCP tool
- **mcp_tool:design_inspect_image**：src/electron/libs/mcp-tools/design.ts:1021 - built-in MCP tool
- **mcp_tool:design_compare_current_view**：src/electron/libs/mcp-tools/design.ts:1063 - built-in MCP tool
- **mcp_tool:design_compare_images**：src/electron/libs/mcp-tools/design.ts:1109 - built-in MCP tool
- **mcp_tool:design_compare_current_view_batch**：src/electron/libs/mcp-tools/design.ts:1149 - built-in MCP tool
- **mcp_tool:design_compare_images_batch**：src/electron/libs/mcp-tools/design.ts:1209 - built-in MCP tool
- **mcp_tool:design_read_comparison_report**：src/electron/libs/mcp-tools/design.ts:1259 - built-in MCP tool
- **mcp_tool:design_list_artifacts**：src/electron/libs/mcp-tools/design.ts:1291 - built-in MCP tool
- **mcp_tool:knowledge_search**：src/electron/libs/mcp-tools/knowledge.ts:135 - built-in MCP tool
- **mcp_tool:knowledge_read**：src/electron/libs/mcp-tools/knowledge.ts:193 - built-in MCP tool
- **mcp_tool:knowledge_explore**：src/electron/libs/mcp-tools/knowledge.ts:246 - built-in MCP tool
- **mcp_tool:knowledge_index**：src/electron/libs/mcp-tools/knowledge.ts:282 - built-in MCP tool
- **mcp_tool:memory_update**：src/electron/libs/mcp-tools/knowledge.ts:301 - built-in MCP tool
- **event:builtin**：src/shared/builtin-mcp-registry.ts:35 - typed event payload
- **mcp_tool:idea_status**：src/electron/libs/mcp-tools/idea.ts:56 - built-in MCP tool

## 关键概念

- **mcp_tool**：mcp-tools 模块中出现 74 个 mcp_tool 信号，可用于定位对应接口或运行职责。
- **config**：mcp-tools 模块中出现 1 个 config 信号，可用于定位对应接口或运行职责。
- **event**：mcp-tools 模块中出现 2 个 event 信号，可用于定位对应接口或运行职责。

## 内部关系

- `src/electron/libs/mcp-tools/browser.ts` -> `../../browser-manager.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/browser.ts` -> `./tool-result.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/figma-rest.ts` -> `../config-store.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/figma-rest.ts` -> `../figma-official-plugin.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/figma-rest.ts` -> `./figma-design-intelligence.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/figma-rest.ts` -> `./figma-locator.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/figma-rest.ts` -> `./figma-node-index.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/figma-rest.ts` -> `./figma-ui-node-matcher.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/figma-rest.ts` -> `./tool-result.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/design.ts` -> `../../browser-manager.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/design.ts` -> `../claude-settings.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/design.ts` -> `../design-inspection-dsl.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/design.ts` -> `../design-image-path.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/design.ts` -> `../image-preprocessor.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/design.ts` -> `./tool-result.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/knowledge.ts` -> `../knowledge/embedding-client.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/knowledge.ts` -> `../knowledge/knowledge-indexer.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/knowledge.ts` -> `../knowledge/knowledge-model-settings.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/knowledge.ts` -> `../knowledge/knowledge-paths.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/knowledge.ts` -> `../knowledge/knowledge-repository.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/knowledge.ts` -> `../knowledge/knowledge-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/knowledge.ts` -> `../memory/memory-repository.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/knowledge.ts` -> `../memory/memory-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/knowledge.ts` -> `./tool-result.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/idea.ts` -> `../idea-launcher.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/idea.ts` -> `./tool-result.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/cron.ts` -> `../cron-service.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/cron.ts` -> `../cron-types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/cron.ts` -> `./tool-result.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/admin.ts` -> `../config-store.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/admin.ts` -> `./tool-result.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/plan.ts` -> `./tool-result.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/mcp-tools/figma-ui-node-matcher.ts` -> `./figma-node-index.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/builtin-mcp-servers.ts` -> `../../shared/builtin-mcp-registry.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/builtin-mcp-servers.ts` -> `./mcp-tools/admin.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/builtin-mcp-servers.ts` -> `./mcp-tools/browser.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/builtin-mcp-servers.ts` -> `./mcp-tools/design.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/builtin-mcp-servers.ts` -> `./mcp-tools/cron.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/builtin-mcp-servers.ts` -> `./mcp-tools/figma-rest.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/builtin-mcp-servers.ts` -> `./mcp-tools/idea.js`：本地相对依赖，需要按路径解析到目标文件

## 运行注意事项

- 涉及 MCP tool 的变更要确认 registry、server factory、tool name 和 runner 加载路径一致。

## 修改风险

- 修改该模块时优先跑对应 QA，并确认 UI 与 Electron 运行态不是 stale 状态。

## 验证

- npm run transpile:electron
- 手动启动会话并确认 MCP 工具列表可见
