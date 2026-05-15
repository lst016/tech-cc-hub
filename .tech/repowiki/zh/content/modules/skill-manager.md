# skill-manager

> 负责 11 个文件组成的 skill-manager 功能域。

skill-manager 模块包含 11 个被扫描文件，关键入口包括 `src/electron/libs/skill-manager/ipc-handlers.ts`, `src/electron/libs/skill-manager/db.ts`, `src/electron/libs/skill-manager/index.ts`, `src/electron/libs/skill-manager/scenarios.ts`, `src/electron/libs/skill-manager/sync-engine.ts`, `src/electron/libs/skill-manager/tool-adapters.ts`, `src/electron/libs/skill-manager/types.ts`, `src/electron/libs/skill-manager/installer.ts`。

本地静态分析识别到这些代码信号：ipc, event, database, entrypoint，因此本页可以作为后续 Agent 定位接口、存储、事件和运行入口的索引。

## Agent 可用信息

- 定位 skill-manager 模块的入口、数据契约和运行风险。
- 在模型没有稳定返回 JSON 时，本页仍由本地代码信号生成，不能再退化为空白说明。

## 优先入口

- `src/electron/libs/skill-manager/ipc-handlers.ts`：代码信号：ipc:skills:getManagedSkills, ipc:skills:getSkillsForScenario, ipc:skills:getSkillDocument, ipc:skills:deleteManagedSkill, ipc:skills:deleteManagedSkills, ipc:skills:installLocal, ipc:skills:batchImportFolder, ipc:skills:getAllTags；导出：`handleSkillManagerInvoke`, `initSkillManager`, `registerSkillManagerHandlers`；关键符号：`ToolAdapter`, `initialized`, `SkillIpcHandler`, `skillIpcHandlers`, `registerSkillIpcHandler`, `handleSkillManagerInvoke`
- `src/electron/libs/skill-manager/db.ts`：代码信号：database:skills, database:scenarios, database:scenario_skills, database:scenario_skill_tools, database:skill_targets, database:skill_tags, database:settings, database:idx_scenario_skills_skill；导出：`getDb`, `getAllSkills`, `getSkillById`, `getSkillByCentralPath`, `getSkillBySourceRef`, `insertSkill`, `deleteSkill`, `updateSkillAfterInstall`；关键符号：`getDb`, `userDataPath`, `dbPath`, `migrate`, `getAllSkills`, `database`
- `src/electron/libs/skill-manager/index.ts`：入口文件，适合从这里追踪启动链路；代码信号：entrypoint:src/electron/libs/skill-manager/index.ts；导出：`getDb`, `getAllSkills`, `getSkillById`, `getSkillByCentralPath`, `insertSkill`, `updateSkillAfterInstall`, `updateSkillAfterReinstall`, `updateSkillSourceMetadata`

## 文件

### `src/electron/libs/skill-manager/ipc-handlers.ts`

代码信号：ipc:skills:getManagedSkills, ipc:skills:getSkillsForScenario, ipc:skills:getSkillDocument, ipc:skills:deleteManagedSkill, ipc:skills:deleteManagedSkills, ipc:skills:installLocal, ipc:skills:batchImportFolder, ipc:skills:getAllTags；导出：`handleSkillManagerInvoke`, `initSkillManager`, `registerSkillManagerHandlers`；关键符号：`ToolAdapter`, `initialized`, `SkillIpcHandler`, `skillIpcHandlers`, `registerSkillIpcHandler`, `handleSkillManagerInvoke`

- `ToolAdapter` (type) - type ToolAdapter,
- `initialized` (const) - let initialized = false;
- `SkillIpcHandler` (type) - type SkillIpcHandler = (...args: any[]) => unknown | Promise<unknown>;
- `skillIpcHandlers` (const) - const skillIpcHandlers = new Map<string, SkillIpcHandler>();
- `registerSkillIpcHandler` (function) - function registerSkillIpcHandler(channel: string, handler: SkillIpcHandler): void {
- `handleSkillManagerInvoke` (function) - export async function handleSkillManagerInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
- `handler` (const) - const handler = skillIpcHandlers.get(channel);
- `initSkillManager` (function) - export function initSkillManager(): void {
- `managedSkillToDto` (function) - function managedSkillToDto(skill: ReturnType<typeof getAllSkills>[number]): ManagedSkill {
- `allTargets` (const) - const allTargets = getAllTargets();
- `tagsMap` (const) - const tagsMap = getTagsMap();
- `scenario_ids` (const) - const scenario_ids = getScenariosForSkill(skill.id);

### `src/electron/libs/skill-manager/db.ts`

代码信号：database:skills, database:scenarios, database:scenario_skills, database:scenario_skill_tools, database:skill_targets, database:skill_tags, database:settings, database:idx_scenario_skills_skill；导出：`getDb`, `getAllSkills`, `getSkillById`, `getSkillByCentralPath`, `getSkillBySourceRef`, `insertSkill`, `deleteSkill`, `updateSkillAfterInstall`；关键符号：`getDb`, `userDataPath`, `dbPath`, `migrate`, `getAllSkills`, `database`

- `getDb` (function) - export function getDb(): Database.Database {
- `userDataPath` (const) - const userDataPath = app.getPath("userData");
- `dbPath` (const) - const dbPath = join(userDataPath, "skill-manager.db");
- `migrate` (function) - function migrate(database: Database.Database): void {
- `getAllSkills` (function) - export function getAllSkills(): SkillRecord[] {
- `database` (const) - const database = getDb();
- `getSkillById` (function) - export function getSkillById(id: string): SkillRecord | undefined {
- `database` (const) - const database = getDb();
- `getSkillByCentralPath` (function) - export function getSkillByCentralPath(centralPath: string): SkillRecord | undefined {
- `database` (const) - const database = getDb();
- `getSkillBySourceRef` (function) - export function getSkillBySourceRef(sourceType: string, sourceRef: string): SkillRecord | undefined {
- `database` (const) - const database = getDb();

### `src/electron/libs/skill-manager/index.ts`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:src/electron/libs/skill-manager/index.ts；导出：`getDb`, `getAllSkills`, `getSkillById`, `getSkillByCentralPath`, `insertSkill`, `updateSkillAfterInstall`, `updateSkillAfterReinstall`, `updateSkillSourceMetadata`

### `src/electron/libs/skill-manager/scenarios.ts`

导出：`toScenarioDto`, `getAllScenarioDtos`, `getActiveScenarioDto`, `ensureDefaultScenario`, `createScenario`, `updateScenarioInfo`, `deleteScenarioAndCleanup`, `reorderScenarioList`；关键符号：`SyncMode`, `toScenarioDto`, `getAllScenarioDtos`, `scenarios`, `count`, `getActiveScenarioDto`

- `SyncMode` (type) - type SyncMode,
- `toScenarioDto` (function) - export function toScenarioDto(record: ReturnType<typeof getAllScenarios>[number], skillCount: number): Scenario {
- `getAllScenarioDtos` (function) - export function getAllScenarioDtos(): Scenario[] {
- `scenarios` (const) - const scenarios = getAllScenarios();
- `count` (const) - const count = countSkillsForScenario(s.id);
- `getActiveScenarioDto` (function) - export function getActiveScenarioDto(): Scenario | null {
- `activeId` (const) - const activeId = getActiveScenarioId();
- `count` (const) - const count = countSkillsForScenario(s.id);
- `ensureDefaultScenario` (function) - export function ensureDefaultScenario(): Scenario {
- `activeId` (const) - const activeId = getActiveScenarioId();
- `active` (const) - const active = getScenarioById(activeId);
- `existing` (const) - const existing = getAllScenarios()[0];

### `src/electron/libs/skill-manager/sync-engine.ts`

导出：`SyncMode`, `syncModeForTool`, `targetDirName`, `ensureDstNotInsideSrc`, `isTargetCurrent`, `removeTarget`, `syncSkill`, `SkillMeta`；关键符号：`SyncMode`, `syncModeForTool`, `targetDirName`, `name`, `ensureDstNotInsideSrc`, `srcCanon`

- `SyncMode` (type) - export type SyncMode = "symlink" | "copy";
- `syncModeForTool` (function) - export function syncModeForTool(_toolKey: string, configuredMode?: string | null): SyncMode {
- `targetDirName` (function) - export function targetDirName(centralPath: string, skillName: string): string {
- `name` (const) - const name = basename(centralPath);
- `ensureDstNotInsideSrc` (function) - export function ensureDstNotInsideSrc(src: string, dst: string): void {
- `srcCanon` (const) - const srcCanon = resolve(src);
- `dstCanon` (const) - const dstCanon = resolve(dst);
- `isTargetCurrent` (function) - export function isTargetCurrent(source: string, target: string, mode: SyncMode): boolean {
- `symlinkPointsTo` (function) - function symlinkPointsTo(target: string, source: string): boolean {
- `meta` (const) - const meta = lstatSync(target);
- `linkTarget` (const) - const linkTarget = readlinkSync(target);
- `resolvedLink` (const) - const resolvedLink = resolve(join(target, ".."), linkTarget);

### `src/electron/libs/skill-manager/tool-adapters.ts`

导出：`ToolAdapter`, `CustomToolDef`, `skillsDir`, `isInstalled`, `hasPathOverride`, `allScanDirs`, `additionalExistingScanDirs`, `defaultToolAdapters`；关键符号：`ToolAdapter`, `CustomToolDef`, `home`, `candidatePaths`, `candidates`, `suffix`

- `ToolAdapter` (interface) - export interface ToolAdapter {
- `CustomToolDef` (interface) - export interface CustomToolDef {
- `home` (function) - function home(): string {
- `candidatePaths` (function) - function candidatePaths(relative: string): string[] {
- `candidates` (const) - const candidates = [join(home(), relative)];
- `suffix` (const) - const suffix = relative.slice(".config/".length);
- `configDir` (const) - const configDir = process.env.XDG_CONFIG_HOME || join(home(), ".config");
- `configPath` (const) - const configPath = join(configDir, suffix);
- `selectExistingOrDefault` (function) - function selectExistingOrDefault(paths: string[]): string {
- `skillsDir` (function) - export function skillsDir(adapter: ToolAdapter): string {
- `candidates` (const) - const candidates = candidatePaths(adapter.relative_skills_dir);
- `isInstalled` (function) - export function isInstalled(adapter: ToolAdapter): boolean {

### `src/electron/libs/skill-manager/types.ts`

导出：`ToolInfo`, `ManagedSkill`, `SkillTarget`, `SkillToolToggle`, `SkillDocument`, `SourceSkillDocument`, `Scenario`, `DiscoveredGroup`；关键符号：`ToolInfo`, `ManagedSkill`, `SkillTarget`, `SkillToolToggle`, `SkillDocument`, `SourceSkillDocument`

- `ToolInfo` (interface) - export interface ToolInfo {
- `ManagedSkill` (interface) - export interface ManagedSkill {
- `SkillTarget` (interface) - export interface SkillTarget {
- `SkillToolToggle` (interface) - export interface SkillToolToggle {
- `SkillDocument` (interface) - export interface SkillDocument {
- `SourceSkillDocument` (interface) - export interface SourceSkillDocument {
- `Scenario` (interface) - export interface Scenario {
- `DiscoveredGroup` (interface) - export interface DiscoveredGroup {
- `ScanResult` (interface) - export interface ScanResult {
- `SkillsShSkill` (interface) - export interface SkillsShSkill {
- `BatchImportResult` (interface) - export interface BatchImportResult {
- `BatchDeleteSkillsResult` (interface) - export interface BatchDeleteSkillsResult {

### `src/electron/libs/skill-manager/installer.ts`

导出：`InstallResult`, `installFromLocal`, `installFromGitDir`, `installFromLocalToDestination`, `installSkillDirToDestination`, `resolveLocalSkillName`, `hashLocalSource`；关键符号：`InstallResult`, `installFromLocal`, `installFromGitDir`, `installFromLocalToDestination`, `skillName`, `dest`

- `InstallResult` (interface) - export interface InstallResult {
- `installFromLocal` (function) - export function installFromLocal(source: string, name?: string | null): InstallResult {
- `installFromGitDir` (function) - export function installFromGitDir(source: string, name?: string | null): InstallResult {
- `installFromLocalToDestination` (function) - export function installFromLocalToDestination(
- `skillName` (const) - const skillName = name
- `dest` (const) - const dest = destination || uniqueSkillDest(skillsDir(), skillName, source);
- `installSkillDirToDestination` (function) - export function installSkillDirToDestination(
- `meta` (const) - const meta = parseSkillMd(source);
- `contentHash` (const) - const contentHash = hashDirectory(destination);
- `resolveLocalSkillName` (function) - export function resolveLocalSkillName(source: string, name?: string | null): string {
- `hashLocalSource` (function) - export function hashLocalSource(source: string): string {
- `copySkillDir` (function) - function copySkillDir(src: string, dst: string): void {

### `src/electron/libs/skill-manager/central-repo.ts`

导出：`skillsDir`, `centralRepoBaseDir`, `ensureSkillsDir`, `ensureCentralRepo`, `hashDirectory`, `hashLocalSource`；关键符号：`DEFAULT_CENTRAL_REPO_DIR`, `skillsDir`, `centralRepoBaseDir`, `override`, `ensureSkillsDir`, `dir`

- `DEFAULT_CENTRAL_REPO_DIR` (const) - const DEFAULT_CENTRAL_REPO_DIR = join(homedir(), ".skills-manager");
- `skillsDir` (function) - export function skillsDir(): string {
- `centralRepoBaseDir` (function) - export function centralRepoBaseDir(): string {
- `override` (const) - const override = getSetting("central_repo_path");
- `ensureSkillsDir` (function) - export function ensureSkillsDir(): string {
- `dir` (const) - const dir = skillsDir();
- `ensureCentralRepo` (function) - export function ensureCentralRepo(): string {
- `dir` (const) - const dir = centralRepoBaseDir();
- `hashDirectory` (function) - export function hashDirectory(dirPath: string): string {
- `hash` (const) - const hash = createHash("sha256");
- `files` (const) - const files = collectRegularFiles(dirPath, dirPath);
- `fullPath` (const) - const fullPath = join(dirPath, relPath);

### `src/electron/libs/skill-manager/marketplace.ts`

导出：`LeaderboardType`, `fetchLeaderboard`, `searchSkillssh`, `searchSkillsmp`；关键符号：`SKILLSSH_BASE`, `SKILLSSH_API_BASE`, `LEADERBOARD_CACHE_TTL_MS`, `proxyUrl`, `url`, `fetchWithProxy`

- `SKILLSSH_BASE` (const) - const SKILLSSH_BASE = "https://skills.sh";
- `SKILLSSH_API_BASE` (const) - const SKILLSSH_API_BASE = `${SKILLSSH_BASE}/api`;
- `LEADERBOARD_CACHE_TTL_MS` (const) - const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
- `proxyUrl` (function) - function proxyUrl(): string | undefined {
- `url` (const) - const url = getSetting("proxy_url");
- `fetchWithProxy` (function) - async function fetchWithProxy(url: string): Promise<Response> {
- `proxy` (const) - const proxy = proxyUrl();
- `origProxy` (const) - const origProxy = process.env.HTTPS_PROXY;
- `LeaderboardType` (type) - export type LeaderboardType = "hot" | "trending" | "alltime";
- `fetchLeaderboard` (function) - export async function fetchLeaderboard(board: string): Promise<SkillsShSkill[]> {
- `cacheKey` (const) - const cacheKey = `leaderboard_${board}`;
- `cached` (const) - const cached = getCache(cacheKey, LEADERBOARD_CACHE_TTL_MS);

### `src/electron/libs/skill-manager/scanner.ts`

导出：`scanLocalSkillsWithAdapters`, `scanLocalSkills`, `groupDiscovered`, `matchImportedSkillId`；关键符号：`DiscoveredSkillRecord`, `RECURSIVE_SCAN_SKIP_DIRS`, `isSymlinkToCentral`, `link`, `target`, `central`

- `DiscoveredSkillRecord` (interface) - interface DiscoveredSkillRecord {
- `RECURSIVE_SCAN_SKIP_DIRS` (const) - const RECURSIVE_SCAN_SKIP_DIRS = [
- `isSymlinkToCentral` (function) - function isSymlinkToCentral(path: string): boolean {
- `link` (const) - const link = lstatSync(path);
- `target` (const) - const target = realpathSync(path);
- `central` (const) - const central = realpathSync(centralSkillsDir());
- `collectSkillDirsRecursive` (function) - function collectSkillDirsRecursive(
- `path` (const) - const path = join(dir, entry.name);
- `pushDiscovered` (function) - function pushDiscovered(
- `pathStr` (const) - const pathStr = resolve(path);
- `name` (const) - const name = inferSkillName(path);
- `foundAt` (const) - let foundAt = Date.now();

## 数据与接口契约

- **ipc:skills:getManagedSkills**：src/electron/libs/skill-manager/ipc-handlers.ts:629 - skill manager IPC channel
- **ipc:skills:getSkillsForScenario**：src/electron/libs/skill-manager/ipc-handlers.ts:633 - skill manager IPC channel
- **ipc:skills:getSkillDocument**：src/electron/libs/skill-manager/ipc-handlers.ts:638 - skill manager IPC channel
- **ipc:skills:deleteManagedSkill**：src/electron/libs/skill-manager/ipc-handlers.ts:659 - skill manager IPC channel
- **ipc:skills:deleteManagedSkills**：src/electron/libs/skill-manager/ipc-handlers.ts:675 - skill manager IPC channel
- **ipc:skills:installLocal**：src/electron/libs/skill-manager/ipc-handlers.ts:704 - skill manager IPC channel
- **ipc:skills:batchImportFolder**：src/electron/libs/skill-manager/ipc-handlers.ts:755 - skill manager IPC channel
- **ipc:skills:getAllTags**：src/electron/libs/skill-manager/ipc-handlers.ts:833 - skill manager IPC channel
- **ipc:skills:setSkillTags**：src/electron/libs/skill-manager/ipc-handlers.ts:837 - skill manager IPC channel
- **ipc:skills:getScenarios**：src/electron/libs/skill-manager/ipc-handlers.ts:842 - skill manager IPC channel
- **database:skills**：src/electron/libs/skill-manager/db.ts:29 - SQLite table
- **database:scenarios**：src/electron/libs/skill-manager/db.ts:51 - SQLite table
- **database:scenario_skills**：src/electron/libs/skill-manager/db.ts:61 - SQLite table
- **database:scenario_skill_tools**：src/electron/libs/skill-manager/db.ts:68 - SQLite table
- **database:skill_targets**：src/electron/libs/skill-manager/db.ts:76 - SQLite table
- **database:skill_tags**：src/electron/libs/skill-manager/db.ts:88 - SQLite table
- **database:settings**：src/electron/libs/skill-manager/db.ts:94 - SQLite table
- **database:idx_scenario_skills_skill**：src/electron/libs/skill-manager/db.ts:99 - SQLite index
- **database:idx_skill_targets_skill**：src/electron/libs/skill-manager/db.ts:100 - SQLite index
- **database:idx_skill_tags_skill**：src/electron/libs/skill-manager/db.ts:101 - SQLite index

## 关键概念

- **ipc**：skill-manager 模块中出现 39 个 ipc 信号，可用于定位对应接口或运行职责。
- **event**：skill-manager 模块中出现 1 个 event 信号，可用于定位对应接口或运行职责。
- **database**：skill-manager 模块中出现 10 个 database 信号，可用于定位对应接口或运行职责。
- **entrypoint**：skill-manager 模块中出现 1 个 entrypoint 信号，可用于定位对应接口或运行职责。

## 内部关系

- `src/electron/libs/skill-manager/ipc-handlers.ts` -> `./db.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/ipc-handlers.ts` -> `./central-repo.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/ipc-handlers.ts` -> `./tool-adapters.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/ipc-handlers.ts` -> `./installer.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/ipc-handlers.ts` -> `./sync-engine.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/ipc-handlers.ts` -> `./scenarios.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/ipc-handlers.ts` -> `./scanner.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/ipc-handlers.ts` -> `./marketplace.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/ipc-handlers.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/db.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/scenarios.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/scenarios.ts` -> `./db.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/scenarios.ts` -> `./tool-adapters.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/scenarios.ts` -> `./sync-engine.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/tool-adapters.ts` -> `./db.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/installer.ts` -> `./central-repo.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/installer.ts` -> `./sync-engine.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/central-repo.ts` -> `./db.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/marketplace.ts` -> `./db.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/marketplace.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/scanner.ts` -> `./tool-adapters.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/scanner.ts` -> `./sync-engine.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/scanner.ts` -> `./central-repo.js`：本地相对依赖，需要按路径解析到目标文件
- `src/electron/libs/skill-manager/scanner.ts` -> `./types.js`：本地相对依赖，需要按路径解析到目标文件

## 运行注意事项

- 涉及 SQLite/FTS/vector schema 的文件变更后，要同时验证迁移、索引行数和重启后的读取。
- 涉及 IPC 的变更必须同时检查主进程 handler、preload/renderer invoke 和开发桥路径。

## 修改风险

- schema 字段或索引名变化会破坏旧数据读取，必须保留迁移或重建路径。

## 验证

- npm run transpile:electron
- npm run build
