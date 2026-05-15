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
const wikiPath = path.join(workspaceRoot, ".tech/repowiki/zh/content/00-project-overview.md");
const uiDbPath = path.join(appDataRoot, "knowledge/knowledge-ui.sqlite");
const indexDbPath = latestKnowledgeDb();

const report = readJson(reportPath);
if (report.success !== true) fail(`Index report is not successful: ${report.error || report.message || "unknown"}`);
if (report.vectorStoreReady !== true) fail("Index report says sqlite-vec is not ready");
if (!Number.isFinite(report.indexedDocuments) || report.indexedDocuments < 1) fail("No indexed documents in report");
if (!Number.isFinite(report.indexedChunks) || report.indexedChunks < 1) fail("No indexed chunks in report");
if (!Array.isArray(report.generatedFiles) || report.generatedFiles.length < 1) fail("No generated Repo Wiki files in report");

if (!existsSync(wikiPath)) fail(`Missing generated wiki markdown: ${wikiPath}`);
const wiki = readFileSync(wikiPath, "utf8");
if (!wiki.trim().startsWith("# ")) fail("Generated wiki markdown does not start with a heading");
if (/^\s*```/.test(wiki)) fail("Generated wiki markdown is wrapped in a code fence");
if (/<think>/i.test(wiki)) fail("Generated wiki markdown still contains model thinking tags");
if (/后续接入真实|未生成正文|占位/.test(wiki)) fail("Generated wiki markdown contains placeholder text");

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
  `select count(*) from knowledge_ui_documents where workspace_key = '${escapedWorkspace}' and length(content) > 100 and content not like '%后续接入真实%' and content not like '%未生成正文%' and content not like '%占位%';`,
));
if (!Number.isFinite(uiDocs) || uiDocs < 1) fail("UI DB does not contain real generated wiki content");

console.log(JSON.stringify({
  ok: true,
  workspaceRoot,
  reportPath,
  wikiPath,
  uiDbPath,
  indexDbPath,
  indexedDocuments: indexCounts[0],
  indexedChunks: indexCounts[1],
  ftsRows: indexCounts[2],
  vectorRows: indexCounts[3],
  uiDocuments: uiDocs,
}, null, 2));
console.log("KNOWLEDGE_ENGINE_QA_OK");
