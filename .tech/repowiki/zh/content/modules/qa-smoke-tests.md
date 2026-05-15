# qa-smoke-tests

> 负责 8 个文件组成的 qa-smoke-tests 功能域。

qa-smoke-tests 模块包含 8 个被扫描文件，关键入口包括 `scripts/qa/knowledge-chat-injection-smoke.mjs`, `scripts/qa/knowledge-engine-smoke.mjs`, `scripts/qa/knowledge-ui-smoke.cjs`, `scripts/qa/browser-workbench-smoke.mjs`, `scripts/qa/chat-ui-smoke.cjs`, `scripts/qa/electron-autostart-smoke.sh`, `scripts/qa/preview-workbench-smoke.cjs`, `scripts/qa/window-id-tools.sh`。

本地静态分析识别到这些代码信号：event，因此本页可以作为后续 Agent 定位接口、存储、事件和运行入口的索引。

## Agent 可用信息

- 定位 qa-smoke-tests 模块的入口、数据契约和运行风险。
- 在模型没有稳定返回 JSON 时，本页仍由本地代码信号生成，不能再退化为空白说明。

## 优先入口

- `scripts/qa/knowledge-chat-injection-smoke.mjs`：代码信号：event:session.start；关键符号：`BRIDGE_ORIGIN`, `WORKSPACE_ROOT`, `TIMEOUT_MS`, `EXPECTED_TITLE`, `EXPECTED_REPLY`, `fail`

## 文件

### `scripts/qa/knowledge-chat-injection-smoke.mjs`

代码信号：event:session.start；关键符号：`BRIDGE_ORIGIN`, `WORKSPACE_ROOT`, `TIMEOUT_MS`, `EXPECTED_TITLE`, `EXPECTED_REPLY`, `fail`

- `BRIDGE_ORIGIN` (const) - const BRIDGE_ORIGIN = process.env.TECH_CC_HUB_DEV_BRIDGE_ORIGIN || "http://127.0.0.1:4317";
- `WORKSPACE_ROOT` (const) - const WORKSPACE_ROOT = process.env.KNOWLEDGE_QA_WORKSPACE || process.cwd();
- `TIMEOUT_MS` (const) - const TIMEOUT_MS = Number(process.env.KNOWLEDGE_CHAT_QA_TIMEOUT_MS || 150000);
- `EXPECTED_TITLE` (const) - const EXPECTED_TITLE = "tech-cc-hub 项目概览";
- `EXPECTED_REPLY` (const) - const EXPECTED_REPLY = "KNOWLEDGE_INJECTION_OK";
- `fail` (function) - function fail(message) {
- `callBridge` (function) - async function callBridge(method, ...args) {
- `response` (const) - const response = await fetch(`${BRIDGE_ORIGIN}/rpc/${encodeURIComponent(method)}`, {
- `payload` (const) - const payload = await response.json();
- `extractAssistantText` (function) - function extractAssistantText(message) {
- `content` (const) - const content = message.message?.content;
- `pieces` (const) - const pieces = [];

### `scripts/qa/knowledge-engine-smoke.mjs`

关键符号：`workspaceRoot`, `appDataRoot`, `fail`, `readJson`, `sqlite`, `latestKnowledgeDb`

- `workspaceRoot` (const) - const workspaceRoot = path.resolve(process.env.KNOWLEDGE_QA_WORKSPACE || process.cwd());
- `appDataRoot` (const) - const appDataRoot = process.env.TECH_CC_HUB_APP_DATA
- `fail` (function) - function fail(message) {
- `readJson` (function) - function readJson(filePath) {
- `sqlite` (function) - function sqlite(dbPath, sql) {
- `latestKnowledgeDb` (function) - function latestKnowledgeDb() {
- `root` (const) - const root = path.join(appDataRoot, "knowledge");
- `candidates` (const) - const candidates = readdirSync(root)
- `reportPath` (const) - const reportPath = path.join(workspaceRoot, ".tech/reports/index-state.json");
- `wikiRoot` (const) - const wikiRoot = path.join(workspaceRoot, ".tech/repowiki/zh/content");
- `wikiPath` (const) - const wikiPath = path.join(wikiRoot, "index.md");
- `uiDbPath` (const) - const uiDbPath = path.join(appDataRoot, "knowledge/knowledge-ui.sqlite");

### `scripts/qa/knowledge-ui-smoke.cjs`

关键符号：`path`, `DEFAULT_URL`, `CHROME_PATH`, `SCREENSHOT_PATH`, `clickIfVisible`, `main`

- `path` (const) - const path = require('node:path');
- `DEFAULT_URL` (const) - const DEFAULT_URL = process.env.KNOWLEDGE_UI_QA_URL || 'http://localhost:4173/';
- `CHROME_PATH` (const) - const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
- `SCREENSHOT_PATH` (const) - const SCREENSHOT_PATH = process.env.KNOWLEDGE_UI_QA_SCREENSHOT
- `clickIfVisible` (function) - async function clickIfVisible(locator) {
- `main` (function) - async function main() {
- `browser` (const) - const browser = await chromium.launch({
- `page` (const) - const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
- `logs` (const) - const logs = [];
- `repoWikiTab` (const) - const repoWikiTab = page.getByRole('button', { name: /Repo Wiki/ }).first();
- `workspaceButton` (const) - const workspaceButton = page.getByRole('button', { name: /tech-cc-hub/ }).first();
- `generatedDoc` (const) - const generatedDoc = page.getByRole('button', { name: /tech-cc-hub 项目概览/ }).first();

### `scripts/qa/browser-workbench-smoke.mjs`

关键符号：`sleep`, `waitForIdle`, `deadline`, `makeFixture`, `dir`, `first`

- `sleep` (const) - const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));
- `waitForIdle` (const) - const waitForIdle = async (manager, timeoutMs = 8000) => {
- `deadline` (const) - const deadline = Date.now() + timeoutMs;
- `makeFixture` (const) - const makeFixture = () => {
- `dir` (const) - const dir = join(tmpdir(), "tech-cc-hub-browser-smoke");
- `first` (const) - const first = join(dir, "first.html");
- `second` (const) - const second = join(dir, "second.html");
- `run` (const) - const run = async () => {
- `window` (const) - const window = new BrowserWindow({
- `manager` (const) - const manager = new BrowserWorkbenchManager(window);
- `fixture` (const) - const fixture = makeFixture();
- `checks` (const) - const checks = [];

### `scripts/qa/chat-ui-smoke.cjs`

关键符号：`DEFAULT_URL`, `CHROME_PATH`, `main`, `browser`, `page`, `logs`

- `DEFAULT_URL` (const) - const DEFAULT_URL = process.env.CHAT_UI_QA_URL || 'http://localhost:4173/';
- `CHROME_PATH` (const) - const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
- `main` (function) - async function main() {
- `browser` (const) - const browser = await chromium.launch({
- `page` (const) - const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
- `logs` (const) - const logs = [];
- `textarea` (const) - const textarea = page.locator('textarea').last();
- `mentionVisible` (const) - const mentionVisible = await page.getByText('@ 文件提及', { exact: true }).isVisible().catch(() => false);
- `bodyText` (const) - const bodyText = await page.locator('body').innerText({ timeout: 8000 });
- `textareaValues` (const) - const textareaValues = await page.locator('textarea').evaluateAll((nodes) => nodes.map((node) => node.value));
- `slashVisible` (const) - const slashVisible = await page.getByText('可用 Slash 命令', { exact: true }).isVisible().catch(() => false);
- `fatalLogs` (const) - const fatalLogs = logs.filter((line) => (

### `scripts/qa/electron-autostart-smoke.sh`

shell 文件，117 行；用于 scripts/qa 功能域。

### `scripts/qa/preview-workbench-smoke.cjs`

关键符号：`DEFAULT_URL`, `CHROME_PATH`, `main`, `browser`, `page`, `logs`

- `DEFAULT_URL` (const) - const DEFAULT_URL = process.env.PREVIEW_QA_URL || 'http://localhost:4173/';
- `CHROME_PATH` (const) - const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
- `main` (function) - async function main() {
- `browser` (const) - const browser = await chromium.launch({
- `page` (const) - const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
- `logs` (const) - const logs = [];
- `explorer` (const) - const explorer = page.locator('.native-explorer').first();
- `editor` (const) - const editor = page.locator('.monaco-editor').first();
- `loadingVisible` (const) - const loadingVisible = await page.getByText('Loading...', { exact: true }).isVisible().catch(() => false);
- `box` (const) - const box = await editor.boundingBox();
- `bodyText` (const) - const bodyText = await page.locator('body').innerText({ timeout: 8000 });
- `textareaValues` (const) - const textareaValues = await page.locator('textarea').evaluateAll((nodes) => nodes.map((node) => node.value));

### `scripts/qa/window-id-tools.sh`

shell 文件，51 行；用于 scripts/qa 功能域。

## 数据与接口契约

- **event:session.start**：scripts/qa/knowledge-chat-injection-smoke.mjs:99 - typed event payload

## 关键概念

- **event**：qa-smoke-tests 模块中出现 1 个 event 信号，可用于定位对应接口或运行职责。

## 内部关系

- `scripts/qa/browser-workbench-smoke.mjs` -> `../../dist-electron/electron/browser-manager.js`：本地相对依赖，需要按路径解析到目标文件

## 修改风险

- 修改该模块时优先跑对应 QA，并确认 UI 与 Electron 运行态不是 stale 状态。

## 验证

- npm run transpile:electron
- npm run build
