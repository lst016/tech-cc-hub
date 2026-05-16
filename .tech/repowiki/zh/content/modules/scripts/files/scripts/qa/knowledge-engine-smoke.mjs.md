# scripts/qa/knowledge-engine-smoke.mjs

> 模块：`scripts` · 语言：`javascript` · 行数：149

## 文件职责

验证knowledge引擎索引状态、Repo Wiki生成质量和sqlite-vec可用性

## 关键符号

- `latestKnowledgeDb@0 - 查找最新的knowledge.sqlite数据库文件`
- `walkMarkdown@0 - 递归遍历目录收集所有markdown文件`
- `sqlite@0 - 通过sqlite3 CLI执行SQL查询并返回结果`

## 依赖输入

- `node:child_process`
- `node:fs`
- `node:os`
- `node:path`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const workspaceRoot = path.resolve(process.env.KNOWLEDGE_QA_WORKSPACE || process.cwd());
const appDataRoot = process.env.TECH_CC_HUB_APP_DATA
  || (process.platform === "darwin"
    ? path.join(os.homedir(), "Library/Application Support/tech-cc-hub")
    : path.join(os.homedir(), ".tech-cc-hub"));

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  if (!existsSync(filePath)) fail(`Missing JSON file: ${filePath}`);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sqlite(dbPath, sql) {
  if (!existsSync(dbPath)) fail(`Missing SQLite DB: ${dbPath}`);
  return execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8" }).trim();
}

function latestKnowledgeDb() {
  const root = path.join(appDataRoot, "knowledge");
  if (!existsSync(root)) fail(`Missing knowledge app-data dir: ${root}`);
  const candidates = readdirSync(root)
    .map((entry) => path.join(root, entry, "knowledge.sqlite"))
    .filter(existsSync)
    .map((filePath) => ({ filePath, mtimeMs: statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (candidates.length === 0) fail(`No knowledge.sqlite DB found under ${root}`);
  return candidates[0].filePath;
}

const reportPath = path.join(workspaceRoot, ".tech/reports/index-state.json");
const wikiRoot = path.join(workspaceRoot, ".tech/repowiki/zh/content");
const wikiPath = path.join(wikiRoot, "index.md");
const uiDbPath = path.join(appDataRoot, "knowledge/knowledge-ui.sqlite");
const indexDbPath = latestKnowledgeDb();

function walkMarkdown(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const filePath = path.join(dir, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      files.push(...walkMarkdown(filePath));
    } else if (stats.isFile() && entry.endsWith(".md") && entry !== "_sidebar.md") {
      files.push(filePath);
    }
  }
  return files;
}

const report = readJson(reportPath);
if (report.success !== true) fail(`Index report is not successful: ${report.error || report.message || "unknown"}`);
if (report.vectorStoreReady !== true) fail("Index report says sqlite-vec is not ready");
if (!Number.isFinite(report.indexedDocuments) || report.indexedDocuments < 20) fail(`Repo Wiki did not index enough pages: ${report.indexedDocuments}`);
if (!Number.isFinite(report.indexedChunks) || report.indexedChunks < 80) fail(`Indexed chunks are too shallow for Agent usage: ${report.indexedChunks}`);
if (!Array.isArray(report.generatedFiles) || report.generatedFiles.length < 20) fail("Generated Repo Wiki is not a rich multi-page wiki");

if (!existsSync(wikiPath)) fail(`Missing generated wiki markdown: ${wikiPath}`);
const wikiFiles = walkMarkdown(wikiRoot);
if (wikiFiles.length < 20) fail(`Repo Wiki markdown page count is too low: ${wikiFiles.length}`);
if (!wikiFiles.some((file) => file.includes(`${path.sep}modules${path.sep}`))) fail("Repo Wiki did not generate module pages");
for (const required of [
  "agent-playbook.md",
  "runtime-flows.md",
  "api-surface.md",
  path.join("modules", "knowledge-engine", "index.md"),
  path.join("modules", "mcp-tools", "index.md"),
  path.join("modules", "knowledge-engine", "files", "src", "electron", "libs", "knowledge", "knowledge-indexer.ts.md"),
]) {
  if (!existsSync(path.join(wikiRoot, required))) fail(`Missing required Agent-useful page: ${required}`);
}
for (const file of wikiFiles) {
  const wiki = readFileSync(file, "utf8");
  if (!wiki.trim().startsWith("# ")) fail(`Generated wiki markdown does not start with a heading: ${file}`);
  if (/^\s*```/.test(wiki)) fail(`Generated wiki markdown is wrapped in a code fence: ${file}`);
  if (/&lt;think&gt;/i.test(wiki)) fail(`Generated wiki markdown still contains model thinking tags: ${file}`);
  if (/后&#8203;续接入真实|未&#8203;生成正文|当&#8203;前没有真实 Repo Wiki 正文|生&#8203;成后会出现 Repo Wiki 目录|模&#8203;型未返回结构化说明/.test(wiki)) {
    fail(`Generated wiki markdown contains placeholder text: ${file}`);
  }
}

const indexWiki = readFileSync(path.join
... (truncated)
```
