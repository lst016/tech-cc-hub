# pro-workflow

> 负责 24 个文件组成的 pro-workflow 功能域。

pro-workflow 模块包含 24 个被扫描文件，关键入口包括 `pro-workflow/src/db/schema.sql`, `pro-workflow/src/index.ts`, `pro-workflow/.claude-plugin/README.md`, `pro-workflow/config.json`, `pro-workflow/package.json`, `pro-workflow/README.md`, `pro-workflow/skills/llm-council/scripts/council.js`, `pro-workflow/skills/wiki-research-loop/scripts/research-loop.js`。

本地静态分析识别到这些代码信号：database, entrypoint, store, config, event，因此本页可以作为后续 Agent 定位接口、存储、事件和运行入口的索引。

## Agent 可用信息

- 定位 pro-workflow 模块的入口、数据契约和运行风险。
- 在模型没有稳定返回 JSON 时，本页仍由本地代码信号生成，不能再退化为空白说明。

## 优先入口

- `pro-workflow/src/db/schema.sql`：代码信号：database:learnings, database:learnings_fts, database:sessions, database:wikis, database:wiki_pages, database:wiki_sources, database:wiki_claims, database:wiki_seeds
- `pro-workflow/src/index.ts`：入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/src/index.ts, store:index；导出：`initializeDatabase`, `getDefaultDbPath`, `ensureDbDir`, `createStore`, `Learning`, `Session`, `Store`, `searchLearnings`
- `pro-workflow/.claude-plugin/README.md`：配置文件，会影响构建、开发或模型能力；代码信号：config:pro-workflow/.claude-plugin/README.md
- `pro-workflow/config.json`：配置文件，会影响构建、开发或模型能力；代码信号：config:pro-workflow/config.json
- `pro-workflow/package.json`：配置文件，会影响构建、开发或模型能力；代码信号：config:pro-workflow/package.json
- `pro-workflow/README.md`：配置文件，会影响构建、开发或模型能力；代码信号：config:pro-workflow/README.md
- `pro-workflow/skills/llm-council/scripts/council.js`：入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/skills/llm-council/scripts/council.js, event:council, store:council；关键符号：`fs`, `path`, `os`, `https`, `PRO_WORKFLOW_ROOT`, `COUNCIL_ROOT`
- `pro-workflow/skills/wiki-research-loop/scripts/research-loop.js`：入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/skills/wiki-research-loop/scripts/research-loop.js, event:question, store:research-loop；关键符号：`fs`, `path`, `os`, `crypto`, `PRO_WORKFLOW_ROOT`, `SKILL_ROOT`

## 文件

### `pro-workflow/src/db/schema.sql`

代码信号：database:learnings, database:learnings_fts, database:sessions, database:wikis, database:wiki_pages, database:wiki_sources, database:wiki_claims, database:wiki_seeds

### `pro-workflow/src/index.ts`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/src/index.ts, store:index；导出：`initializeDatabase`, `getDefaultDbPath`, `ensureDbDir`, `createStore`, `Learning`, `Session`, `Store`, `searchLearnings`

### `pro-workflow/.claude-plugin/README.md`

配置文件，会影响构建、开发或模型能力；代码信号：config:pro-workflow/.claude-plugin/README.md

### `pro-workflow/config.json`

配置文件，会影响构建、开发或模型能力；代码信号：config:pro-workflow/config.json

### `pro-workflow/package.json`

配置文件，会影响构建、开发或模型能力；代码信号：config:pro-workflow/package.json

### `pro-workflow/README.md`

配置文件，会影响构建、开发或模型能力；代码信号：config:pro-workflow/README.md

### `pro-workflow/skills/llm-council/scripts/council.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/skills/llm-council/scripts/council.js, event:council, store:council；关键符号：`fs`, `path`, `os`, `https`, `PRO_WORKFLOW_ROOT`, `COUNCIL_ROOT`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `os` (const) - const os = require('os');
- `https` (const) - const https = require('https');
- `PRO_WORKFLOW_ROOT` (const) - const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..', '..', '..');
- `COUNCIL_ROOT` (const) - const COUNCIL_ROOT = path.join(os.homedir(), '.pro-workflow', 'council');
- `PROVIDERS` (const) - const PROVIDERS = {
- `pickProvider` (function) - function pickProvider(arg) {
- `postJSON` (function) - function postJSON(urlStr, body, headers, timeoutMs = 120000) {
- `url` (const) - const url = new URL(urlStr);
- `req` (const) - const req = https.request({
- `chunks` (const) - let chunks = '';

### `pro-workflow/skills/wiki-research-loop/scripts/research-loop.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/skills/wiki-research-loop/scripts/research-loop.js, event:question, store:research-loop；关键符号：`fs`, `path`, `os`, `crypto`, `PRO_WORKFLOW_ROOT`, `SKILL_ROOT`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `os` (const) - const os = require('os');
- `crypto` (const) - const crypto = require('crypto');
- `PRO_WORKFLOW_ROOT` (const) - const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..', '..', '..');
- `SKILL_ROOT` (const) - const SKILL_ROOT = path.resolve(__dirname, '..');
- `STOP_FILE` (const) - const STOP_FILE = path.join(os.homedir(), '.pro-workflow', 'STOP');
- `getStore` (function) - function getStore() {
- `distPath` (const) - const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');
- `die` (function) - function die(msg) { console.error(`[research-loop] ${msg}`); process.exit(1); }
- `log` (function) - function log(msg) { console.error(`[research-loop] ${msg}`); }
- `parseArgs` (function) - function parseArgs(argv) {

### `pro-workflow/tsconfig.json`

配置文件，会影响构建、开发或模型能力；代码信号：config:pro-workflow/tsconfig.json

### `pro-workflow/src/db/index.ts`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/src/db/index.ts；导出：`ProWorkflowConfig`, `getDefaultDbPath`, `ensureDbDir`, `initializeDatabase`；关键符号：`ProWorkflowConfig`, `DEFAULT_DB_DIR`, `DEFAULT_DB_PATH`, `getDefaultDbPath`, `ensureDbDir`, `initializeDatabase`

- `ProWorkflowConfig` (interface) - export interface ProWorkflowConfig {
- `DEFAULT_DB_DIR` (const) - const DEFAULT_DB_DIR = path.join(os.homedir(), '.pro-workflow');
- `DEFAULT_DB_PATH` (const) - const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, 'data.db');
- `getDefaultDbPath` (function) - export function getDefaultDbPath(): string {
- `ensureDbDir` (function) - export function ensureDbDir(): void {
- `initializeDatabase` (function) - export function initializeDatabase(dbPath: string = DEFAULT_DB_PATH): Database.Database {
- `db` (const) - const db = new Database(dbPath);
- `candidates` (const) - const candidates = [
- `schemaPath` (const) - const schemaPath = candidates.find(p => fs.existsSync(p));
- `schema` (const) - const schema = fs.readFileSync(schemaPath, 'utf8');
- `db` (const) - const db = initializeDatabase();

### `pro-workflow/scripts/embed-wiki.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/scripts/embed-wiki.js, store:embed-wiki；关键符号：`fs`, `path`, `PRO_WORKFLOW_ROOT`, `getStore`, `distPath`, `getEmbedHelpers`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `PRO_WORKFLOW_ROOT` (const) - const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..');
- `getStore` (function) - function getStore() {
- `distPath` (const) - const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');
- `getEmbedHelpers` (function) - function getEmbedHelpers() {
- `distPath` (const) - const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'search', 'embeddings.js');
- `parseArgs` (function) - function parseArgs(argv) {
- `out` (const) - const out = { _: [] };
- `cmdAll` (function) - async function cmdAll(args) {
- `slug` (const) - const slug = args._[0];
- `helpers` (const) - const helpers = getEmbedHelpers();

### `pro-workflow/scripts/file-changed.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/scripts/file-changed.js, store:file-changed；关键符号：`input`, `filePath`, `importantPatterns`, `isImportant`, `wikiMatch`, `path2`

- `input` (const) - const input = JSON.parse(data);
- `filePath` (const) - const filePath = input.file_path || input.path || '';
- `importantPatterns` (const) - const importantPatterns = [
- `isImportant` (const) - const isImportant = importantPatterns.some(p => p.test(filePath));
- `wikiMatch` (const) - const wikiMatch = filePath.match(/(?:^|\/)\.claude\/wikis\/([^/]+)\/wiki\/.+\.md$/) ||
- `path2` (const) - const path2 = require('path');
- `fs2` (const) - const fs2 = require('fs');
- `distPath` (const) - const distPath = path2.join(__dirname, '..', 'dist', 'db', 'store.js');
- `store` (const) - const store = createStore();
- `slug` (const) - const slug = wikiMatch[1];
- `rel` (const) - const rel = path2.relative(w.root_path, filePath);

### `pro-workflow/scripts/learn-capture.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/scripts/learn-capture.js, store:learn-capture；关键符号：`fs`, `path`, `getStore`, `distPath`, `mod`, `main`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `getStore` (function) - function getStore() {
- `distPath` (const) - const distPath = path.join(__dirname, '..', 'dist', 'db', 'store.js');
- `mod` (const) - const mod = require(distPath);
- `main` (function) - async function main() {
- `input` (const) - const input = JSON.parse(data);
- `response` (const) - const response = input.assistant_response || '';
- `regex` (const) - const regex = /\[LEARN\]\s*([\w][\w\s-]*?)\s*:\s*(.+?)(?:\nMistake:\s*(.+?))?(?:\nCorrection:\s*(.+?))?(?:\nWiki:\s*([A-Za-z0-9_-]+))?(?=\n\[LEARN\]|\n\n|$)/gim;
- `store` (const) - let store = null;
- `count` (const) - let count = 0;
- `lastIndex` (const) - let lastIndex = -1;

### `pro-workflow/scripts/prompt-submit.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/scripts/prompt-submit.js, store:prompt-submit；关键符号：`fs`, `path`, `os`, `getTempDir`, `ensureDir`, `log`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `os` (const) - const os = require('os');
- `getTempDir` (function) - function getTempDir() {
- `ensureDir` (function) - function ensureDir(dir) {
- `log` (function) - function log(msg) {
- `getStore` (function) - function getStore() {
- `distPath` (const) - const distPath = path.join(__dirname, '..', 'dist', 'db', 'store.js');
- `main` (function) - async function main() {
- `input` (const) - const input = JSON.parse(data);
- `prompt` (const) - const prompt = input.prompt || '';
- `sessionId` (const) - const sessionId = input.session_id || 'default';

### `pro-workflow/scripts/quality-gate.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/scripts/quality-gate.js, store:quality-gate；关键符号：`fs`, `path`, `os`, `getTempDir`, `ensureDir`, `log`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `os` (const) - const os = require('os');
- `getTempDir` (function) - function getTempDir() {
- `ensureDir` (function) - function ensureDir(dir) {
- `log` (function) - function log(msg) {
- `getStore` (function) - function getStore() {
- `distPath` (const) - const distPath = path.join(__dirname, '..', 'dist', 'db', 'store.js');
- `getAdaptiveThreshold` (function) - function getAdaptiveThreshold(store) {
- `sessions` (const) - const sessions = store.getRecentSessions(10);
- `totalEdits` (const) - const totalEdits = sessions.reduce((s, sess) => s + sess.edit_count, 0);
- `totalCorrections` (const) - const totalCorrections = sessions.reduce((s, sess) => s + sess.corrections_count, 0);

### `pro-workflow/scripts/research-tick.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/scripts/research-tick.js, store:research-tick；关键符号：`fs`, `path`, `os`, `PRO_WORKFLOW_ROOT`, `STOP_FILE`, `LOOP_SCRIPT`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `os` (const) - const os = require('os');
- `PRO_WORKFLOW_ROOT` (const) - const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..');
- `STOP_FILE` (const) - const STOP_FILE = path.join(os.homedir(), '.pro-workflow', 'STOP');
- `LOOP_SCRIPT` (const) - const LOOP_SCRIPT = path.join(PRO_WORKFLOW_ROOT, 'skills', 'wiki-research-loop', 'scripts', 'research-loop.js');
- `TICK_LOG` (const) - const TICK_LOG = path.join(os.homedir(), '.pro-workflow', 'tick.log');
- `getStore` (function) - function getStore() {
- `distPath` (const) - const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');
- `readWikiConfig` (function) - function readWikiConfig(rootPath) {
- `cfgPath` (const) - const cfgPath = path.join(rootPath, 'wiki.config.md');
- `raw` (const) - const raw = fs.readFileSync(cfgPath, 'utf8');

### `pro-workflow/scripts/session-end.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/scripts/session-end.js, store:session-end；关键符号：`fs`, `path`, `os`, `ensureDir`, `log`, `getDateString`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `os` (const) - const os = require('os');
- `ensureDir` (function) - function ensureDir(dir) {
- `log` (function) - function log(msg) {
- `getDateString` (function) - function getDateString() {
- `now` (const) - const now = new Date();
- `getTimeString` (function) - function getTimeString() {
- `findProjectRoot` (function) - function findProjectRoot() {
- `dir` (const) - let dir = process.cwd();
- `getStore` (function) - function getStore() {
- `distPath` (const) - const distPath = path.join(__dirname, '..', 'dist', 'db', 'store.js');

### `pro-workflow/scripts/session-start.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/scripts/session-start.js, store:session-start；关键符号：`fs`, `path`, `os`, `log`, `findProjectRoot`, `dir`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `os` (const) - const os = require('os');
- `log` (function) - function log(msg) {
- `findProjectRoot` (function) - function findProjectRoot() {
- `dir` (const) - let dir = process.cwd();
- `getStore` (function) - function getStore() {
- `distPath` (const) - const distPath = path.join(__dirname, '..', 'dist', 'db', 'store.js');
- `main` (function) - async function main() {
- `projectRoot` (const) - const projectRoot = findProjectRoot();
- `projectName` (const) - const projectName = path.basename(projectRoot);
- `claudeDir` (const) - const claudeDir = path.join(projectRoot, '.claude');

### `pro-workflow/skills/survey-generator/scripts/build-survey.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/skills/survey-generator/scripts/build-survey.js, store:build-survey；关键符号：`fs`, `path`, `https`, `PRO_WORKFLOW_ROOT`, `COUNCIL`, `parseArgs`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `https` (const) - const https = require('https');
- `PRO_WORKFLOW_ROOT` (const) - const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..', '..', '..');
- `COUNCIL` (const) - const COUNCIL = path.join(PRO_WORKFLOW_ROOT, 'skills', 'llm-council', 'scripts', 'council.js');
- `parseArgs` (function) - function parseArgs(argv) {
- `out` (const) - const out = { _: [] };
- `key` (const) - const key = a.slice(2);
- `next` (const) - const next = argv[i + 1];
- `die` (function) - function die(msg) { console.error(`[survey] ${msg}`); process.exit(1); }
- `getStore` (function) - function getStore() {
- `distPath` (const) - const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');

### `pro-workflow/skills/wiki-builder/scripts/wiki-cli.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/skills/wiki-builder/scripts/wiki-cli.js, store:wiki-cli；关键符号：`fs`, `path`, `os`, `crypto`, `PRO_WORKFLOW_ROOT`, `getStore`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `os` (const) - const os = require('os');
- `crypto` (const) - const crypto = require('crypto');
- `PRO_WORKFLOW_ROOT` (const) - const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..', '..', '..');
- `getStore` (function) - function getStore() {
- `distPath` (const) - const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');
- `mod` (const) - const mod = require(distPath);
- `die` (function) - function die(msg) {
- `parseArgs` (function) - function parseArgs(argv) {
- `out` (const) - const out = { _: [] };
- `key` (const) - const key = a.slice(2);

### `pro-workflow/skills/wiki-query/scripts/query.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/skills/wiki-query/scripts/query.js, store:query；关键符号：`fs`, `path`, `PRO_WORKFLOW_ROOT`, `getStore`, `distPath`, `parseArgs`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `PRO_WORKFLOW_ROOT` (const) - const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..', '..', '..');
- `getStore` (function) - function getStore() {
- `distPath` (const) - const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');
- `parseArgs` (function) - function parseArgs(argv) {
- `out` (const) - const out = { _: [] };
- `key` (const) - const key = a.slice(2);
- `next` (const) - const next = argv[i + 1];
- `cmdSearch` (function) - function cmdSearch(args) {
- `query` (const) - const query = args._[0];
- `limit` (const) - const limit = parseInt(args.limit, 10) || 10;

### `pro-workflow/skills/wiki-viewer/scripts/render.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/skills/wiki-viewer/scripts/render.js, store:render；关键符号：`fs`, `path`, `PRO_WORKFLOW_ROOT`, `getStore`, `distPath`, `die`

- `fs` (const) - const fs = require('fs');
- `path` (const) - const path = require('path');
- `PRO_WORKFLOW_ROOT` (const) - const PRO_WORKFLOW_ROOT = path.resolve(__dirname, '..', '..', '..');
- `getStore` (function) - function getStore() {
- `distPath` (const) - const distPath = path.join(PRO_WORKFLOW_ROOT, 'dist', 'db', 'store.js');
- `die` (function) - function die(msg) { console.error(`[wiki-viewer] ${msg}`); process.exit(1); }
- `parseArgs` (function) - function parseArgs(argv) {
- `out` (const) - const out = { _: [] };
- `key` (const) - const key = a.slice(2);
- `next` (const) - const next = argv[i + 1];
- `escapeHtml` (function) - function escapeHtml(s) {
- `renderMarkdown` (function) - function renderMarkdown(md) {

### `pro-workflow/src/db/store.ts`

代码信号：store:store；导出：`Learning`, `Session`, `WikiFlavor`, `WikiScope`, `Wiki`, `WikiPage`, `WikiSearchHit`, `WikiSeed`；关键符号：`Learning`, `Session`, `WikiFlavor`, `WikiScope`, `Wiki`, `WikiPage`

- `Learning` (interface) - export interface Learning {
- `Session` (interface) - export interface Session {
- `WikiFlavor` (type) - export type WikiFlavor =
- `WikiScope` (type) - export type WikiScope = 'global' | 'project';
- `Wiki` (interface) - export interface Wiki {
- `WikiPage` (interface) - export interface WikiPage {
- `WikiSearchHit` (interface) - export interface WikiSearchHit {
- `WikiSeed` (interface) - export interface WikiSeed {
- `Store` (interface) - export interface Store {
- `createStore` (function) - export function createStore(dbPath: string = getDefaultDbPath()): Store {
- `db` (const) - const db = initializeDatabase(dbPath);
- `addLearningStmt` (const) - const addLearningStmt = db.prepare(`

### `pro-workflow/scripts/commit-validate.js`

入口文件，适合从这里追踪启动链路；代码信号：entrypoint:pro-workflow/scripts/commit-validate.js；关键符号：`TYPES`, `PATTERN`, `MAX_SUMMARY`, `readStdin`, `extractMessage`, `shortFlag`

- `TYPES` (const) - const TYPES = ['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'perf', 'ci', 'style', 'build', 'revert'];
- `PATTERN` (const) - const PATTERN = new RegExp(`^(${TYPES.join('|')})(\\([\\w\\-.,/ ]+\\))?!?: .+`);
- `MAX_SUMMARY` (const) - const MAX_SUMMARY = 72;
- `readStdin` (function) - function readStdin() {
- `extractMessage` (function) - function extractMessage(command) {
- `shortFlag` (const) - const shortFlag = command.match(/(?:^|\s)-m\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+))/);
- `raw` (const) - const raw = shortFlag[1] || shortFlag[2] || shortFlag[3] || '';
- `longFlag` (const) - const longFlag = command.match(/--message(?:=|\s+)(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+))/);
- `raw` (const) - const raw = longFlag[1] || longFlag[2] || longFlag[3] || '';
- `heredocAny` (const) - const heredocAny = command.match(/<<-?\s*'?([A-Za-z_][A-Za-z0-9_]*)'?\s*\n([\s\S]*?)\n\s*\1\s*$/m);
- `afterCommit` (const) - const afterCommit = command.split(/\bcommit\b/)[1] || '';
- `hasExplicitFlag` (const) - const hasExplicitFlag = /(?:-m|--message|-F|--file|--amend)\b/.test(afterCommit);

## 数据与接口契约

- **database:learnings**：pro-workflow/src/db/schema.sql:5 - SQLite table
- **database:learnings_fts**：pro-workflow/src/db/schema.sql:17 - SQLite table
- **database:sessions**：pro-workflow/src/db/schema.sql:45 - SQLite table
- **database:wikis**：pro-workflow/src/db/schema.sql:67 - SQLite table
- **database:wiki_pages**：pro-workflow/src/db/schema.sql:79 - SQLite table
- **database:wiki_sources**：pro-workflow/src/db/schema.sql:92 - SQLite table
- **database:wiki_claims**：pro-workflow/src/db/schema.sql:103 - SQLite table
- **database:wiki_seeds**：pro-workflow/src/db/schema.sql:112 - SQLite table
- **database:wiki_pages_fts**：pro-workflow/src/db/schema.sql:122 - SQLite table
- **database:wiki_embeddings**：pro-workflow/src/db/schema.sql:154 - SQLite table
- **store:index**：pro-workflow/src/index.ts - UI/runtime state store
- **event:council**：pro-workflow/skills/llm-council/scripts/council.js:152 - typed event payload
- **store:council**：pro-workflow/skills/llm-council/scripts/council.js - UI/runtime state store
- **event:question**：pro-workflow/skills/wiki-research-loop/scripts/research-loop.js:245 - typed event payload
- **store:research-loop**：pro-workflow/skills/wiki-research-loop/scripts/research-loop.js - UI/runtime state store
- **store:embed-wiki**：pro-workflow/scripts/embed-wiki.js - UI/runtime state store
- **store:file-changed**：pro-workflow/scripts/file-changed.js - UI/runtime state store
- **store:learn-capture**：pro-workflow/scripts/learn-capture.js - UI/runtime state store
- **store:prompt-submit**：pro-workflow/scripts/prompt-submit.js - UI/runtime state store
- **store:quality-gate**：pro-workflow/scripts/quality-gate.js - UI/runtime state store
- **store:research-tick**：pro-workflow/scripts/research-tick.js - UI/runtime state store
- **store:session-end**：pro-workflow/scripts/session-end.js - UI/runtime state store
- **store:session-start**：pro-workflow/scripts/session-start.js - UI/runtime state store
- **store:build-survey**：pro-workflow/skills/survey-generator/scripts/build-survey.js - UI/runtime state store
- **store:wiki-cli**：pro-workflow/skills/wiki-builder/scripts/wiki-cli.js - UI/runtime state store
- **store:query**：pro-workflow/skills/wiki-query/scripts/query.js - UI/runtime state store
- **store:render**：pro-workflow/skills/wiki-viewer/scripts/render.js - UI/runtime state store
- **store:store**：pro-workflow/src/db/store.ts - UI/runtime state store

## 关键概念

- **database**：pro-workflow 模块中出现 22 个 database 信号，可用于定位对应接口或运行职责。
- **entrypoint**：pro-workflow 模块中出现 17 个 entrypoint 信号，可用于定位对应接口或运行职责。
- **store**：pro-workflow 模块中出现 16 个 store 信号，可用于定位对应接口或运行职责。
- **config**：pro-workflow 模块中出现 5 个 config 信号，可用于定位对应接口或运行职责。
- **event**：pro-workflow 模块中出现 2 个 event 信号，可用于定位对应接口或运行职责。

## 内部关系

- `pro-workflow/src/db/store.ts` -> `./index`：本地相对依赖，需要按路径解析到目标文件

## 运行注意事项

- 涉及 SQLite/FTS/vector schema 的文件变更后，要同时验证迁移、索引行数和重启后的读取。

## 修改风险

- schema 字段或索引名变化会破坏旧数据读取，必须保留迁移或重建路径。

## 验证

- npm run transpile:electron
- npm run build
