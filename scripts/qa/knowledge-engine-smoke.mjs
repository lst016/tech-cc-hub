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
  path.join("modules", "knowledge-engine.md"),
  path.join("modules", "mcp-tools.md"),
]) {
  if (!existsSync(path.join(wikiRoot, required))) fail(`Missing required Agent-useful page: ${required}`);
}
for (const file of wikiFiles) {
  const wiki = readFileSync(file, "utf8");
  if (!wiki.trim().startsWith("# ")) fail(`Generated wiki markdown does not start with a heading: ${file}`);
  if (/^\s*```/.test(wiki)) fail(`Generated wiki markdown is wrapped in a code fence: ${file}`);
  if (/<think>/i.test(wiki)) fail(`Generated wiki markdown still contains model thinking tags: ${file}`);
  if (/后续接入真实|未生成正文|当前没有真实 Repo Wiki 正文|生成后会出现 Repo Wiki 目录|模型未返回结构化说明/.test(wiki)) {
    fail(`Generated wiki markdown contains placeholder text: ${file}`);
  }
}

const indexWiki = readFileSync(path.join(wikiRoot, "index.md"), "utf8");
for (const expected of ["Agent 快速定位", "关键工作流", "验证命令", "knowledge-indexer.ts", "knowledge-repository.ts"]) {
  if (!indexWiki.includes(expected)) fail(`Project overview is not Agent-useful; missing: ${expected}`);
}
const playbook = readFileSync(path.join(wikiRoot, "agent-playbook.md"), "utf8");
for (const expected of ["为什么知识库功能必须有 embedding 模型", "高价值文件", "Agent 如何在聊天里看到知识库"]) {
  if (!playbook.includes(expected)) fail(`Agent playbook missing useful section: ${expected}`);
}
const knowledgeModule = readFileSync(path.join(wikiRoot, "modules", "knowledge-engine.md"), "utf8");
for (const expected of ["Repo Wiki 生成", "embedding", "knowledge_documents", "KnowledgeRepository", "knowledge-overview.ts"]) {
  if (!knowledgeModule.includes(expected)) fail(`Knowledge module page is too shallow; missing: ${expected}`);
}
const apiSurface = readFileSync(path.join(wikiRoot, "api-surface.md"), "utf8");
for (const expected of ["knowledge:run-generation", "browser_open_page", "knowledge_documents", "Renderer 调用", "MCP Tool"]) {
  if (!apiSurface.includes(expected)) fail(`API surface page is too shallow; missing: ${expected}`);
}

const indexCounts = sqlite(
  indexDbPath,
  "select (select count(*) from knowledge_documents), (select count(*) from knowledge_chunks), (select count(*) from knowledge_chunks_fts), (select count(*) from knowledge_chunk_vectors_rowids);",
).split("|").map((value) => Number(value));
if (indexCounts.length !== 4 || indexCounts.some((value) => !Number.isFinite(value) || value < 1)) {
  fail(`Invalid index DB counts: ${indexCounts.join("|")}`);
}
if (indexCounts[1] !== indexCounts[2] || indexCounts[1] !== indexCounts[3]) {
  fail(`Chunk/FTS/vector row counts differ: ${indexCounts.join("|")}`);
}

const escapedWorkspace = workspaceRoot.replaceAll("'", "''");
const uiGeneration = sqlite(
  uiDbPath,
  `select status, completed, total, failed from knowledge_ui_generation where workspace_key = '${escapedWorkspace}';`,
).split("|");
if (uiGeneration[0] !== "completed") fail(`UI generation status is not completed: ${uiGeneration.join("|")}`);
if (Number(uiGeneration[1]) !== Number(uiGeneration[2]) || Number(uiGeneration[3]) !== 0) {
  fail(`UI generation counters are invalid: ${uiGeneration.join("|")}`);
}

const uiDocs = Number(sqlite(
  uiDbPath,
  `select count(*) from knowledge_ui_documents where workspace_key = '${escapedWorkspace}' and length(content) > 100 and content not like '%后续接入真实%' and content not like '%未生成正文%' and content not like '%当前没有真实 Repo Wiki 正文%' and content not like '%生成后会出现 Repo Wiki 目录%';`,
));
if (!Number.isFinite(uiDocs) || uiDocs < 5) fail(`UI DB does not contain enough generated wiki pages: ${uiDocs}`);

console.log(JSON.stringify({
  ok: true,
  workspaceRoot,
  reportPath,
  wikiPath,
  wikiPages: wikiFiles.length,
  uiDbPath,
  indexDbPath,
  indexedDocuments: indexCounts[0],
  indexedChunks: indexCounts[1],
  ftsRows: indexCounts[2],
  vectorRows: indexCounts[3],
  uiDocuments: uiDocs,
}, null, 2));
console.log("KNOWLEDGE_ENGINE_QA_OK");
