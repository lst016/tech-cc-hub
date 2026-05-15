# settings-ui

> 负责 24 个文件组成的 settings-ui 功能域。

settings-ui 模块包含 24 个被扫描文件，关键入口包括 `src/ui/components/settings/InstallSkillsView.tsx`, `src/ui/components/settings/PluginsSettingsPage.tsx`, `src/ui/components/settings/MySkillsView.tsx`, `src/ui/components/settings/SkillsManagementPage.tsx`, `src/ui/components/settings/settings-utils.ts`, `src/ui/components/settings/SystemMaintenancePage.tsx`, `src/ui/components/settings/ToolSettingsView.tsx`, `src/ui/components/settings/McpSettingsPage.tsx`。

本地静态分析识别到这些代码信号：ui_ipc, event，因此本页可以作为后续 Agent 定位接口、存储、事件和运行入口的索引。

## Agent 可用信息

- 定位 settings-ui 模块的入口、数据契约和运行风险。
- 在模型没有稳定返回 JSON 时，本页仍由本地代码信号生成，不能再退化为空白说明。

## 优先入口

- `src/ui/components/settings/InstallSkillsView.tsx`：代码信号：ui_ipc:skills:searchSkillssh, ui_ipc:skills:fetchLeaderboard, ui_ipc:skills:scanLocalSkills, ui_ipc:skills:installLocal, ui_ipc:preview-open-dialog, ui_ipc:skills:batchImportFolder, ui_ipc:skills:installSkillssh, ui_ipc:skills:previewGitInstall；导出：`InstallSkillsView`；关键符号：`MARKET_PAGE_SIZE`, `MARKET_SEARCH_STEP`, `MARKET_SEARCH_DEBOUNCE_MS`, `SkillsShSkill`, `GitPreviewResult`, `GitInstallSelection`
- `src/ui/components/settings/PluginsSettingsPage.tsx`：代码信号：ui_ipc:plugins:getOpenComputerUseStatus, ui_ipc:plugins:checkOpenComputerUseUpdate, ui_ipc:plugins:getFigmaOfficialStatus, ui_ipc:plugins:installOpenComputerUse, ui_ipc:plugins:connectFigmaDesktopOfficial, ui_ipc:plugins:connectFigmaPatOfficial, ui_ipc:plugins:updateOpenComputerUse；导出：`PluginsSettingsPage`；关键符号：`PluginStatus`, `PluginUpdateStatus`, `DefaultPlugin`, `OpenComputerUsePermissionStatus`, `FigmaOfficialStatusKind`, `FigmaOfficialMode`
- `src/ui/components/settings/MySkillsView.tsx`：代码信号：ui_ipc:skills:getAllTags, ui_ipc:skills:deleteManagedSkill, ui_ipc:skills:deleteManagedSkills, ui_ipc:skills:removeSkillFromScenario, ui_ipc:skills:addSkillToScenario, ui_ipc:skills:batchUpdateSkills；导出：`MySkillsView`；关键符号：`TAG_COLORS`, `TAG_ACTIVE_COLORS`, `getTagColor`, `idx`, `getTagActiveColor`, `idx`
- `src/ui/components/settings/SkillsManagementPage.tsx`：代码信号：ui_ipc:skills:getManagedSkills, ui_ipc:skills:getScenarios, ui_ipc:skills:getTools, ui_ipc:skills:scanLocalSkills；导出：`SkillsManagementPage`；关键符号：`SkillTab`, `SkillsManagementPage`, `invoke`, `fetchAll`, `tabs`, `Icon`
- `src/ui/components/settings/ToolSettingsView.tsx`：代码信号：ui_ipc:skills:setToolEnabled；导出：`ToolSettingsView`；关键符号：`MAINSTREAM_AGENT_KEYS`, `compactHomePath`, `Props`, `ToolSettingsView`, `invoke`, `installedTools`
- `src/ui/components/settings/McpSettingsPage.tsx`：代码信号：event:mcp.list；导出：`McpSettingsPage`；关键符号：`LucideIcon`, `BuiltinMcpIconKey`, `BuiltinMcpServerDefinition`, `McpServerEntry`, `BuiltinToolInfo`, `BuiltinToolGroup`

## 文件

### `src/ui/components/settings/InstallSkillsView.tsx`

代码信号：ui_ipc:skills:searchSkillssh, ui_ipc:skills:fetchLeaderboard, ui_ipc:skills:scanLocalSkills, ui_ipc:skills:installLocal, ui_ipc:preview-open-dialog, ui_ipc:skills:batchImportFolder, ui_ipc:skills:installSkillssh, ui_ipc:skills:previewGitInstall；导出：`InstallSkillsView`；关键符号：`MARKET_PAGE_SIZE`, `MARKET_SEARCH_STEP`, `MARKET_SEARCH_DEBOUNCE_MS`, `SkillsShSkill`, `GitPreviewResult`, `GitInstallSelection`

- `MARKET_PAGE_SIZE` (const) - const MARKET_PAGE_SIZE = 24;
- `MARKET_SEARCH_STEP` (const) - const MARKET_SEARCH_STEP = 60;
- `MARKET_SEARCH_DEBOUNCE_MS` (const) - const MARKET_SEARCH_DEBOUNCE_MS = 450;
- `SkillsShSkill` (interface) - interface SkillsShSkill {
- `GitPreviewResult` (type) - type GitPreviewResult = {
- `GitInstallSelection` (type) - type GitInstallSelection = {
- `GitInstallResult` (type) - type GitInstallResult = {
- `Props` (interface) - interface Props {
- `getMarketSourceAvatarLabel` (function) - function getMarketSourceAvatarLabel(source: string): string {
- `owner` (const) - const owner = source.split("/")[0]?.replace(/^@/, "").trim();
- `parts` (const) - const parts = owner.split(/[-_\s]+/).filter(Boolean);
- `InstallSkillsView` (function) - export function InstallSkillsView({ skills, tools: _tools, scanResult, onRefresh, onScanResult, onNavigate }: Props) {

### `src/ui/components/settings/PluginsSettingsPage.tsx`

代码信号：ui_ipc:plugins:getOpenComputerUseStatus, ui_ipc:plugins:checkOpenComputerUseUpdate, ui_ipc:plugins:getFigmaOfficialStatus, ui_ipc:plugins:installOpenComputerUse, ui_ipc:plugins:connectFigmaDesktopOfficial, ui_ipc:plugins:connectFigmaPatOfficial, ui_ipc:plugins:updateOpenComputerUse；导出：`PluginsSettingsPage`；关键符号：`PluginStatus`, `PluginUpdateStatus`, `DefaultPlugin`, `OpenComputerUsePermissionStatus`, `FigmaOfficialStatusKind`, `FigmaOfficialMode`

- `PluginStatus` (type) - type PluginStatus = "not-installed" | "needs-permission" | "needs-connect" | "ready" | "update-available";
- `PluginUpdateStatus` (type) - type PluginUpdateStatus = "unknown" | "up-to-date" | "update-available" | "error";
- `DefaultPlugin` (type) - type DefaultPlugin = {
- `OpenComputerUsePermissionStatus` (type) - type OpenComputerUsePermissionStatus = {
- `FigmaOfficialStatusKind` (type) - type FigmaOfficialStatusKind =
- `FigmaOfficialMode` (type) - type FigmaOfficialMode = "remote" | "desktop" | "rest";
- `FigmaOfficialAuthProvider` (type) - type FigmaOfficialAuthProvider = "direct" | "codex" | "pat";
- `PluginInstallResult` (type) - type PluginInstallResult = {
- `PluginRuntimeStatus` (type) - type PluginRuntimeStatus = {
- `PluginGuideSessionRequest` (type) - type PluginGuideSessionRequest = {
- `PluginsSettingsPageProps` (type) - type PluginsSettingsPageProps = {
- `OPEN_COMPUTER_USE_ID` (const) - const OPEN_COMPUTER_USE_ID = "open-computer-use";

### `src/ui/components/settings/MySkillsView.tsx`

代码信号：ui_ipc:skills:getAllTags, ui_ipc:skills:deleteManagedSkill, ui_ipc:skills:deleteManagedSkills, ui_ipc:skills:removeSkillFromScenario, ui_ipc:skills:addSkillToScenario, ui_ipc:skills:batchUpdateSkills；导出：`MySkillsView`；关键符号：`TAG_COLORS`, `TAG_ACTIVE_COLORS`, `getTagColor`, `idx`, `getTagActiveColor`, `idx`

- `TAG_COLORS` (const) - const TAG_COLORS = [
- `TAG_ACTIVE_COLORS` (const) - const TAG_ACTIVE_COLORS = [
- `getTagColor` (function) - function getTagColor(tag: string, allTags: string[]): string {
- `idx` (const) - const idx = allTags.indexOf(tag);
- `getTagActiveColor` (function) - function getTagActiveColor(tag: string, allTags: string[]): string {
- `idx` (const) - const idx = allTags.indexOf(tag);
- `sourceIcon` (function) - function sourceIcon(type: string) {
- `sourceTypeLabel` (function) - function sourceTypeLabel(skill: ManagedSkill): string {
- `canRefresh` (function) - function canRefresh(skill: ManagedSkill): boolean {
- `Props` (interface) - interface Props {
- `MySkillsView` (function) - export function MySkillsView({ skills, scenarios, tools, onRefresh }: Props) {
- `electronApi` (const) - const electronApi = window.electron as typeof window.electron & {

### `src/ui/components/settings/SkillsManagementPage.tsx`

代码信号：ui_ipc:skills:getManagedSkills, ui_ipc:skills:getScenarios, ui_ipc:skills:getTools, ui_ipc:skills:scanLocalSkills；导出：`SkillsManagementPage`；关键符号：`SkillTab`, `SkillsManagementPage`, `invoke`, `fetchAll`, `tabs`, `Icon`

- `SkillTab` (type) - type SkillTab = "dashboard" | "my-skills" | "install" | "tools";
- `SkillsManagementPage` (function) - export function SkillsManagementPage() {
- `invoke` (const) - const invoke = useCallback(
- `fetchAll` (const) - const fetchAll = useCallback(async () => {
- `tabs` (const) - const tabs = useMemo(() => [
- `Icon` (const) - const Icon = tab.icon;
- `active` (const) - const active = activeTab === tab.id;

### `src/ui/components/settings/settings-utils.ts`

导出：`DEEPSEEK_OFFICIAL_BASE_URL`, `DEEPSEEK_OFFICIAL_MODELS`, `createModel`, `createProfile`, `createDeepSeekOfficialProfile`, `createCodexOAuthProfile`, `normalizeProfile`, `getEnabledProfile`；关键符号：`DEFAULT_CONTEXT_WINDOW`, `DEEPSEEK_CONTEXT_WINDOW`, `CODEX_CONTEXT_WINDOW`, `DEEPSEEK_OFFICIAL_BASE_URL`, `DEEPSEEK_OFFICIAL_MODELS`, `createModel`

- `DEFAULT_CONTEXT_WINDOW` (const) - const DEFAULT_CONTEXT_WINDOW = 200_000;
- `DEEPSEEK_CONTEXT_WINDOW` (const) - const DEEPSEEK_CONTEXT_WINDOW = 1_000_000;
- `CODEX_CONTEXT_WINDOW` (const) - const CODEX_CONTEXT_WINDOW = 200_000;
- `DEEPSEEK_OFFICIAL_BASE_URL` (const) - export const DEEPSEEK_OFFICIAL_BASE_URL = "https://api.deepseek.com/anthropic";
- `DEEPSEEK_OFFICIAL_MODELS` (const) - export const DEEPSEEK_OFFICIAL_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;
- `createModel` (function) - export function createModel(): ApiModelConfigProfile {
- `createProfile` (function) - export function createProfile(): ApiConfigProfile {
- `createDeepSeekOfficialProfile` (function) - export function createDeepSeekOfficialProfile(): ApiConfigProfile {
- `models` (const) - const models = DEEPSEEK_OFFICIAL_MODELS.map((name) => ({
- `createCodexOAuthProfile` (function) - export function createCodexOAuthProfile(): ApiConfigProfile {
- `models` (const) - const models = CODEX_OAUTH_MODELS.map((name) => ({
- `normalizePositiveInteger` (function) - function normalizePositiveInteger(value: number | null | undefined): number | undefined {

### `src/ui/components/settings/SystemMaintenancePage.tsx`

导出：`SystemMaintenancePage`；关键符号：`PRESET_TASKS`, `formatBytes`, `units`, `next`, `unitIndex`, `SystemMaintenancePageProps`

- `PRESET_TASKS` (const) - const PRESET_TASKS = [
- `formatBytes` (function) - function formatBytes(value: number): string {
- `units` (const) - const units = ["B", "KB", "MB", "GB"];
- `next` (const) - let next = value;
- `unitIndex` (const) - let unitIndex = 0;
- `SystemMaintenancePageProps` (type) - type SystemMaintenancePageProps = {
- `SystemMaintenancePage` (function) - export function SystemMaintenancePage({
- `mounted` (const) - let mounted = true;
- `unsubscribe` (const) - const unsubscribe = window.electron.onAppUpdateStatus((status) => {
- `updateMeta` (const) - const updateMeta = useMemo(() => {
- `handleUpdateAction` (const) - const handleUpdateAction = async (action: "check" | "download" | "install") => {
- `busyState` (const) - const busyState = action === "check" ? "checking" : action === "download" ? "downloading" : "installing";

### `src/ui/components/settings/ToolSettingsView.tsx`

代码信号：ui_ipc:skills:setToolEnabled；导出：`ToolSettingsView`；关键符号：`MAINSTREAM_AGENT_KEYS`, `compactHomePath`, `Props`, `ToolSettingsView`, `invoke`, `installedTools`

- `MAINSTREAM_AGENT_KEYS` (const) - const MAINSTREAM_AGENT_KEYS = new Set([
- `compactHomePath` (function) - function compactHomePath(path: string) {
- `Props` (interface) - interface Props {
- `ToolSettingsView` (function) - export function ToolSettingsView({ tools, scenarios: _scenarios, onRefresh }: Props) {
- `invoke` (const) - const invoke = useCallback(
- `installedTools` (const) - const installedTools = useMemo(() => tools.filter((t) => t.installed), [tools]);
- `enabledTools` (const) - const enabledTools = useMemo(() => tools.filter((t) => t.installed && t.enabled), [tools]);
- `customTools` (const) - const customTools = useMemo(() => tools.filter((t) => t.is_custom), [tools]);
- `builtInTools` (const) - const builtInTools = useMemo(() => tools.filter((t) => !t.is_custom), [tools]);
- `sortTools` (const) - const sortTools = useCallback((items: typeof tools) =>
- `r2` (const) - const r2 = Number(b.enabled) - Number(a.enabled);
- `displayedBuiltIn` (const) - const displayedBuiltIn = useMemo(() => sortTools(builtInTools), [builtInTools, sortTools]);

### `src/ui/components/settings/McpSettingsPage.tsx`

代码信号：event:mcp.list；导出：`McpSettingsPage`；关键符号：`LucideIcon`, `BuiltinMcpIconKey`, `BuiltinMcpServerDefinition`, `McpServerEntry`, `BuiltinToolInfo`, `BuiltinToolGroup`

- `LucideIcon` (type) - type LucideIcon,
- `BuiltinMcpIconKey` (type) - type BuiltinMcpIconKey,
- `BuiltinMcpServerDefinition` (type) - type BuiltinMcpServerDefinition,
- `McpServerEntry` (type) - type McpServerEntry = McpServerInfo & {
- `BuiltinToolInfo` (type) - type BuiltinToolInfo = {
- `BuiltinToolGroup` (type) - type BuiltinToolGroup = {
- `McpTab` (type) - type McpTab = "builtin" | "external";
- `BuiltinServerMeta` (type) - type BuiltinServerMeta = {
- `ElectronClient` (type) - type ElectronClient = {
- `getElectron` (function) - function getElectron(): ElectronClient | null {
- `McpSettingsPage` (function) - export function McpSettingsPage() {
- `electron` (const) - const electron = getElectron();

### `src/ui/components/settings/model-routing-utils.ts`

导出：`ModelSlotPatch`, `SharedModelRoutingState`, `buildSharedModelRoutingState`, `applySharedModelRoutingPatch`；关键符号：`DEFAULT_CONTEXT_WINDOW`, `ModelSlotPatch`, `SharedModelRoutingState`, `buildSharedModelRoutingState`, `enabledCount`, `routedProfiles`

- `DEFAULT_CONTEXT_WINDOW` (const) - const DEFAULT_CONTEXT_WINDOW = 200_000;
- `ModelSlotPatch` (type) - export type ModelSlotPatch = Partial<Pick<ApiConfigProfile, "model" | "expertModel" | "smallModel" | "analysisModel" | "imageModel" | "embeddingModel" | "wikiModel">>;
- `SharedModelRoutingState` (type) - export type SharedModelRoutingState = {
- `buildSharedModelRoutingState` (function) - export function buildSharedModelRoutingState(profiles: ApiConfigProfile[]): SharedModelRoutingState {
- `enabledCount` (const) - const enabledCount = profiles.filter((profile) => profile.enabled).length;
- `routedProfiles` (const) - const routedProfiles = getEnabledProfiles(profiles);
- `availableModels` (const) - const availableModels = getAvailableModelsForProfiles(routedProfiles);
- `primaryProfile` (const) - const primaryProfile = routedProfiles[0];
- `mainModel` (const) - const mainModel = pickAvailableModel(primaryProfile?.model, availableModels) || availableModels[0] || "";
- `applySharedModelRoutingPatch` (function) - export function applySharedModelRoutingPatch(profiles: ApiConfigProfile[], patch: ModelSlotPatch): ApiConfigProfile[] {
- `routedIds` (const) - const routedIds = new Set(state.routedProfileIds);
- `routedProfiles` (const) - const routedProfiles = profiles.filter((profile) => routedIds.has(profile.id));

### `src/ui/components/settings/skill-icons.tsx`

导出：`ScenarioIconOption`, `SCENARIO_ICON_OPTIONS`, `getScenarioIconOption`；关键符号：`ScenarioIconOption`, `SCENARIO_ICON_MAP`, `getScenarioIconOption`, `key`

- `ScenarioIconOption` (interface) - export interface ScenarioIconOption {
- `SCENARIO_ICON_MAP` (const) - const SCENARIO_ICON_MAP = new Map(SCENARIO_ICON_OPTIONS.map((o) => [o.key, o]));
- `getScenarioIconOption` (function) - export function getScenarioIconOption(scenario?: Pick<Scenario, "name" | "description" | "icon"> | string | null): ScenarioIconOption {
- `key` (const) - const key = typeof scenario === "string" ? scenario : (scenario?.icon || "briefcase");

### `src/ui/components/settings/ChannelsSettingsPage.tsx`

导出：`ChannelGuideSessionRequest`, `getChannelSettingsSummary`, `ChannelsSettingsPage`；关键符号：`ChannelsSettingsPageProps`, `ChannelGuideSessionRequest`, `ChannelStatus`, `ChannelDefinition`, `CHANNEL_BY_ID`, `isRecord`

- `ChannelsSettingsPageProps` (type) - type ChannelsSettingsPageProps = {
- `ChannelGuideSessionRequest` (type) - export type ChannelGuideSessionRequest = {
- `ChannelStatus` (type) - type ChannelStatus = "stopped" | "running" | "error";
- `ChannelDefinition` (type) - type ChannelDefinition = {
- `CHANNEL_BY_ID` (const) - const CHANNEL_BY_ID = new Map(CHANNEL_DEFINITIONS.map((definition) => [definition.id, definition]));
- `isRecord` (function) - function isRecord(value: unknown): value is Record<string, unknown> {
- `parseJsonObject` (function) - function parseJsonObject(rawText: string): Record<string, unknown> | null {
- `parsed` (const) - const parsed = JSON.parse(rawText) as unknown;
- `asText` (function) - function asText(value: unknown): string | undefined {
- `asTransport` (function) - function asTransport(value: unknown, fallback: ChannelTransportMode): ChannelTransportMode {
- `readChannelRuntimeConfig` (function) - function readChannelRuntimeConfig(rootConfig: Record<string, unknown> | null): ChannelRuntimeConfig {
- `rawChannels` (const) - const rawChannels = isRecord(rootConfig?.channels) ? rootConfig.channels : {};

### `src/ui/components/settings/SettingsSheet.tsx`

导出：`SettingsStatusTone`, `SettingsPageDefinition`, `SettingsSheet`；关键符号：`SettingsStatusTone`, `SettingsPageDefinition`, `SettingsSheetProps`, `SettingsSheet`, `closeOnEscape`, `active`

- `SettingsStatusTone` (type) - export type SettingsStatusTone = "error" | "success" | "info";
- `SettingsPageDefinition` (type) - export type SettingsPageDefinition = {
- `SettingsSheetProps` (type) - type SettingsSheetProps = {
- `SettingsSheet` (function) - export function SettingsSheet({
- `closeOnEscape` (const) - const closeOnEscape = (event: KeyboardEvent) => {
- `active` (const) - const active = page.id === activePageId;

### `src/ui/components/settings/plugin-toast-messages.ts`

导出：`PluginActionToastMessage`, `buildPluginActionToastMessage`；关键符号：`PluginActionToastInput`, `PluginActionToastMessage`, `buildPluginActionToastMessage`, `details`

- `PluginActionToastInput` (type) - type PluginActionToastInput = {
- `PluginActionToastMessage` (type) - export type PluginActionToastMessage = {
- `buildPluginActionToastMessage` (function) - export function buildPluginActionToastMessage(result: PluginActionToastInput): PluginActionToastMessage {
- `details` (const) - const details = [

### `src/ui/components/settings/skill-utils.ts`

导出：`cn`；关键符号：`cn`

- `cn` (function) - export function cn(...classes: (string | false | null | undefined)[]): string {

### `src/ui/components/settings/CodeEditor.tsx`

导出：`CodeEditor`；关键符号：`CodeEditorProps`, `CodeEditor`, `lineNumbersRef`, `lines`, `syncLineNumbersScroll`, `textarea`

- `CodeEditorProps` (type) - type CodeEditorProps = {
- `CodeEditor` (function) - export function CodeEditor({
- `lineNumbersRef` (const) - const lineNumbersRef = useRef<HTMLDivElement>(null);
- `lines` (const) - const lines = useMemo(() => {
- `syncLineNumbersScroll` (const) - const syncLineNumbersScroll = (nextScrollTop: number) => {
- `textarea` (const) - const textarea = event.currentTarget;
- `start` (const) - const start = textarea.selectionStart ?? 0;
- `end` (const) - const end = textarea.selectionEnd ?? 0;
- `nextValue` (const) - const nextValue = `${value.slice(0, start)}  ${value.slice(end)}`;

### `src/ui/components/settings/ConfirmDialog.tsx`

导出：`ConfirmDialog`；关键符号：`Props`, `ConfirmDialog`, `handleConfirm`

- `Props` (interface) - interface Props {
- `ConfirmDialog` (function) - export function ConfirmDialog({
- `handleConfirm` (const) - const handleConfirm = async () => {

### `src/ui/components/settings/SyncDots.tsx`

导出：`SyncDots`；关键符号：`shortLabel`, `words`, `word`, `DotState`, `Dot`, `Props`

- `shortLabel` (function) - function shortLabel(displayName: string, key: string): string {
- `words` (const) - const words = displayName.trim().split(/\s+/).filter(Boolean);
- `word` (const) - const word = words[0] || key;
- `DotState` (type) - type DotState = "synced" | "available" | "orphan";
- `Dot` (interface) - interface Dot {
- `Props` (interface) - interface Props {
- `SyncDots` (function) - export function SyncDots({ skill, tools, limit, size = "md", className }: Props) {
- `installed` (const) - const installed = tools.filter((t) => t.installed);
- `installedKeys` (const) - const installedKeys = new Set(installed.map((t) => t.key));
- `syncedKeys` (const) - const syncedKeys = new Set(skill.targets.map((t) => t.tool));
- `known` (const) - const known = tools.find((t) => t.key === target.tool);
- `visible` (const) - const visible = typeof limit === "number" ? dots.slice(0, limit) : dots;

### `src/ui/components/settings/SkillDashboard.tsx`

导出：`SkillDashboard`；关键符号：`Props`, `SkillDashboard`, `activeScenario`, `scenarioSkills`, `installed`, `total`

- `Props` (interface) - interface Props {
- `SkillDashboard` (function) - export function SkillDashboard({ skills, scenarios, tools, onNavigate }: Props) {
- `activeScenario` (const) - const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0] ?? null;
- `scenarioSkills` (const) - const scenarioSkills = activeScenario
- `installed` (const) - const installed = tools.filter((t) => t.installed).length;
- `total` (const) - const total = tools.length;
- `synced` (const) - const synced = scenarioSkills.filter((s) => s.targets.length > 0).length;
- `scenarioIcon` (const) - const scenarioIcon = getScenarioIconOption(activeScenario);
- `ScenarioIcon` (const) - const ScenarioIcon = scenarioIcon.icon;
- `icon` (const) - const icon = getScenarioIconOption(s);
- `Icon` (const) - const Icon = icon.icon;
- `active` (const) - const active = s.id === activeScenario?.id;

### `src/ui/components/settings/AboutPage.tsx`

导出：`AboutPage`；关键符号：`PRESET_TASKS`, `formatBytes`, `units`, `next`, `unitIndex`, `ABOUT_LINKS`

- `PRESET_TASKS` (const) - const PRESET_TASKS = [
- `formatBytes` (function) - function formatBytes(value: number): string {
- `units` (const) - const units = ["B", "KB", "MB", "GB"];
- `next` (const) - let next = value;
- `unitIndex` (const) - let unitIndex = 0;
- `ABOUT_LINKS` (const) - const ABOUT_LINKS = [
- `AboutPageProps` (type) - type AboutPageProps = {
- `AboutPage` (function) - export function AboutPage({ onStartMaintenanceSession, onClose }: AboutPageProps) {
- `mounted` (const) - let mounted = true;
- `unsubscribe` (const) - const unsubscribe = window.electron.onAppUpdateStatus((status) => {
- `updateMeta` (const) - const updateMeta = useMemo(() => {
- `handleUpdateAction` (const) - const handleUpdateAction = async (action: "check" | "download" | "install") => {

### `src/ui/components/settings/AgentRulesSettingsPage.tsx`

导出：`AgentRulesSettingsPage`；关键符号：`AgentRulesSettingsPageProps`, `AgentRulesSettingsPage`, `systemMarkdown`, `userAgentsPath`, `userClaudeRoot`, `handleTabChange`

- `AgentRulesSettingsPageProps` (type) - type AgentRulesSettingsPageProps = {
- `AgentRulesSettingsPage` (function) - export function AgentRulesSettingsPage({
- `systemMarkdown` (const) - const systemMarkdown = documents?.systemDefaultMarkdown ?? "";
- `userAgentsPath` (const) - const userAgentsPath = documents?.userAgentsPath ?? "~/.claude/CLAUDE.md";
- `userClaudeRoot` (const) - const userClaudeRoot = documents?.userClaudeRoot ?? "~/.claude";
- `handleTabChange` (const) - const handleTabChange = (tab: "system" | "user") => {

### `src/ui/components/settings/ApiProfilesSettingsPage.tsx`

导出：`ApiProfilesSettingsPage`；关键符号：`ApiProfilesSettingsPageProps`, `DEFAULT_IMPORTED_CONTEXT_WINDOW`, `DEEPSEEK_CONTEXT_WINDOW`, `DEEPSEEK_MODELS_ENDPOINT`, `ModelImportStatus`, `ApiProviderMode`

- `ApiProfilesSettingsPageProps` (type) - type ApiProfilesSettingsPageProps = {
- `DEFAULT_IMPORTED_CONTEXT_WINDOW` (const) - const DEFAULT_IMPORTED_CONTEXT_WINDOW = 200_000;
- `DEEPSEEK_CONTEXT_WINDOW` (const) - const DEEPSEEK_CONTEXT_WINDOW = 1_000_000;
- `DEEPSEEK_MODELS_ENDPOINT` (const) - const DEEPSEEK_MODELS_ENDPOINT = "https://api.deepseek.com/models";
- `ModelImportStatus` (type) - type ModelImportStatus = {
- `ApiProviderMode` (type) - type ApiProviderMode = NonNullable<ApiConfigProfile["provider"]>;
- `CreateProfileOption` (type) - type CreateProfileOption = {
- `ApiProfileTestResult` (type) - type ApiProfileTestResult = {
- `isDeepSeekBaseURL` (function) - function isDeepSeekBaseURL(baseURL: string | undefined): boolean {
- `getProviderMode` (function) - function getProviderMode(profile: ApiConfigProfile): ApiProviderMode {
- `buildModelsEndpoint` (function) - function buildModelsEndpoint(baseURL: string, provider: ApiProviderMode = "custom"): string {
- `url` (const) - const url = new URL(baseURL.trim());

### `src/ui/components/settings/GlobalJsonSettingsPage.tsx`

导出：`GlobalJsonSettingsPage`；关键符号：`GLOBAL_JSON_PLACEHOLDER`, `GlobalJsonSettingsPageProps`, `GlobalJsonSettingsPage`

- `GLOBAL_JSON_PLACEHOLDER` (const) - const GLOBAL_JSON_PLACEHOLDER = JSON.stringify(
- `GlobalJsonSettingsPageProps` (type) - type GlobalJsonSettingsPageProps = {
- `GlobalJsonSettingsPage` (function) - export function GlobalJsonSettingsPage({

### `src/ui/components/settings/ModelRoutingSettingsPage.tsx`

导出：`ModelRoutingSettingsPage`；关键符号：`ModelSlotPatch`, `ModelRoutingSettingsPageProps`, `ModelRoutingSettingsPage`, `hasProfiles`, `routedLabel`, `routedNames`

- `ModelSlotPatch` (type) - type ModelSlotPatch,
- `ModelRoutingSettingsPageProps` (type) - type ModelRoutingSettingsPageProps = {
- `ModelRoutingSettingsPage` (function) - export function ModelRoutingSettingsPage({ profiles, onChange }: ModelRoutingSettingsPageProps) {
- `hasProfiles` (const) - const hasProfiles = profiles.length > 0;
- `routedLabel` (const) - const routedLabel = state.enabledCount > 0
- `routedNames` (const) - const routedNames = state.routedProfileNames.join(" / ");
- `patchRouting` (const) - const patchRouting = (patch: ModelSlotPatch) => {

### `src/ui/components/settings/OverviewSettingsPage.tsx`

导出：`OverviewSettingsPage`；关键符号：`OverviewSettingsPageProps`, `OverviewCardProps`, `OverviewCard`, `OverviewSettingsPage`

- `OverviewSettingsPageProps` (type) - type OverviewSettingsPageProps = {
- `OverviewCardProps` (type) - type OverviewCardProps = {
- `OverviewCard` (function) - function OverviewCard({ eyebrow, title, description, meta }: OverviewCardProps) {
- `OverviewSettingsPage` (function) - export function OverviewSettingsPage({ profiles, enabledProfile }: OverviewSettingsPageProps) {

## 数据与接口契约

- **ui_ipc:skills:searchSkillssh**：src/ui/components/settings/InstallSkillsView.tsx:146 - renderer IPC invoke
- **ui_ipc:skills:fetchLeaderboard**：src/ui/components/settings/InstallSkillsView.tsx:147 - renderer IPC invoke
- **ui_ipc:skills:scanLocalSkills**：src/ui/components/settings/InstallSkillsView.tsx:175 - renderer IPC invoke
- **ui_ipc:skills:installLocal**：src/ui/components/settings/InstallSkillsView.tsx:197 - renderer IPC invoke
- **ui_ipc:preview-open-dialog**：src/ui/components/settings/InstallSkillsView.tsx:211 - renderer IPC invoke
- **ui_ipc:skills:batchImportFolder**：src/ui/components/settings/InstallSkillsView.tsx:238 - renderer IPC invoke
- **ui_ipc:skills:installSkillssh**：src/ui/components/settings/InstallSkillsView.tsx:305 - renderer IPC invoke
- **ui_ipc:skills:previewGitInstall**：src/ui/components/settings/InstallSkillsView.tsx:327 - renderer IPC invoke
- **ui_ipc:skills:cleanupGitPreview**：src/ui/components/settings/InstallSkillsView.tsx:343 - renderer IPC invoke
- **ui_ipc:skills:confirmGitInstall**：src/ui/components/settings/InstallSkillsView.tsx:361 - renderer IPC invoke
- **ui_ipc:plugins:getOpenComputerUseStatus**：src/ui/components/settings/PluginsSettingsPage.tsx:369 - renderer IPC invoke
- **ui_ipc:plugins:checkOpenComputerUseUpdate**：src/ui/components/settings/PluginsSettingsPage.tsx:371 - renderer IPC invoke
- **ui_ipc:plugins:getFigmaOfficialStatus**：src/ui/components/settings/PluginsSettingsPage.tsx:380 - renderer IPC invoke
- **ui_ipc:plugins:installOpenComputerUse**：src/ui/components/settings/PluginsSettingsPage.tsx:419 - renderer IPC invoke
- **ui_ipc:plugins:connectFigmaDesktopOfficial**：src/ui/components/settings/PluginsSettingsPage.tsx:444 - renderer IPC invoke
- **ui_ipc:plugins:connectFigmaPatOfficial**：src/ui/components/settings/PluginsSettingsPage.tsx:477 - renderer IPC invoke
- **ui_ipc:plugins:updateOpenComputerUse**：src/ui/components/settings/PluginsSettingsPage.tsx:568 - renderer IPC invoke
- **ui_ipc:skills:getAllTags**：src/ui/components/settings/MySkillsView.tsx:101 - renderer IPC invoke
- **ui_ipc:skills:deleteManagedSkill**：src/ui/components/settings/MySkillsView.tsx:181 - renderer IPC invoke
- **ui_ipc:skills:deleteManagedSkills**：src/ui/components/settings/MySkillsView.tsx:197 - renderer IPC invoke
- **ui_ipc:skills:removeSkillFromScenario**：src/ui/components/settings/MySkillsView.tsx:215 - renderer IPC invoke
- **ui_ipc:skills:addSkillToScenario**：src/ui/components/settings/MySkillsView.tsx:218 - renderer IPC invoke
- **ui_ipc:skills:batchUpdateSkills**：src/ui/components/settings/MySkillsView.tsx:255 - renderer IPC invoke
- **ui_ipc:skills:getManagedSkills**：src/ui/components/settings/SkillsManagementPage.tsx:37 - renderer IPC invoke
- **ui_ipc:skills:getScenarios**：src/ui/components/settings/SkillsManagementPage.tsx:38 - renderer IPC invoke
- **ui_ipc:skills:getTools**：src/ui/components/settings/SkillsManagementPage.tsx:39 - renderer IPC invoke
- **ui_ipc:skills:scanLocalSkills**：src/ui/components/settings/SkillsManagementPage.tsx:40 - renderer IPC invoke
- **ui_ipc:skills:setToolEnabled**：src/ui/components/settings/ToolSettingsView.tsx:78 - renderer IPC invoke
- **event:mcp.list**：src/ui/components/settings/McpSettingsPage.tsx:333 - typed event payload

## 关键概念

- **ui_ipc**：settings-ui 模块中出现 28 个 ui_ipc 信号，可用于定位对应接口或运行职责。
- **event**：settings-ui 模块中出现 1 个 event 信号，可用于定位对应接口或运行职责。

## 内部关系

- `src/ui/components/settings/InstallSkillsView.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/InstallSkillsView.tsx` -> `./skill-utils`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/PluginsSettingsPage.tsx` -> `./plugin-toast-messages`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/MySkillsView.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/MySkillsView.tsx` -> `./SyncDots`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/MySkillsView.tsx` -> `./ConfirmDialog`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/MySkillsView.tsx` -> `./skill-utils`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/SkillsManagementPage.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/SkillsManagementPage.tsx` -> `./SkillDashboard`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/SkillsManagementPage.tsx` -> `./MySkillsView`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/SkillsManagementPage.tsx` -> `./InstallSkillsView`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/SkillsManagementPage.tsx` -> `./ToolSettingsView`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/SkillsManagementPage.tsx` -> `./skill-utils`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/settings-utils.ts` -> `../../types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/settings-utils.ts` -> `../../../shared/codex-oauth.js`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/SystemMaintenancePage.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/ToolSettingsView.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/ToolSettingsView.tsx` -> `./skill-utils`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/McpSettingsPage.tsx` -> `../../../shared/builtin-mcp-registry`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/McpSettingsPage.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/model-routing-utils.ts` -> `../../types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/model-routing-utils.ts` -> `./settings-utils.js`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/skill-icons.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/ChannelsSettingsPage.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/ChannelsSettingsPage.tsx` -> `../../../shared/lark-runtime-defaults.js`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/SyncDots.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/SyncDots.tsx` -> `./skill-utils`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/SkillDashboard.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/SkillDashboard.tsx` -> `./skill-icons`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/AboutPage.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/AgentRulesSettingsPage.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/AgentRulesSettingsPage.tsx` -> `./CodeEditor`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/ApiProfilesSettingsPage.tsx` -> `../../types`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/ApiProfilesSettingsPage.tsx` -> `../../dev-electron-shim`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/ApiProfilesSettingsPage.tsx` -> `./ChannelsSettingsPage`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/ApiProfilesSettingsPage.tsx` -> `../../../shared/codex-oauth`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/ApiProfilesSettingsPage.tsx` -> `./settings-utils`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/GlobalJsonSettingsPage.tsx` -> `./CodeEditor`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/GlobalJsonSettingsPage.tsx` -> `../../../shared/lark-runtime-defaults.js`：本地相对依赖，需要按路径解析到目标文件
- `src/ui/components/settings/ModelRoutingSettingsPage.tsx` -> `../ModelSelect`：本地相对依赖，需要按路径解析到目标文件

## 运行注意事项

- 涉及 IPC 的变更必须同时检查主进程 handler、preload/renderer invoke 和开发桥路径。

## 修改风险

- 修改该模块时优先跑对应 QA，并确认 UI 与 Electron 运行态不是 stale 状态。

## 验证

- npm run build
- npm run qa:chat-ui
