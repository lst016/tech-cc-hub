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
const agentCardsRoot = path.join(workspaceRoot, ".tech/repowiki/zh/agent-cards");
const metadataPath = path.join(workspaceRoot, ".tech/repowiki/zh/meta/repowiki-metadata.json");
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

function containsPlaceholderBody(markdown) {
  const withoutCodeFences = markdown.replace(/```[\s\S]*?```/g, "");
  return /(^|\n)\s*(后续接入真实|未生成正文|当前没有真实 Repo Wiki 正文|生成后会出现 Repo Wiki 目录|模型未返回结构化说明)([。.\n]|$)/.test(withoutCodeFences);
}

const report = readJson(reportPath);
if (report.success !== true) fail(`Index report is not successful: ${report.error || report.message || "unknown"}`);
if (report.vectorStoreReady !== true) fail("Index report says sqlite-vec is not ready");
if (!Number.isFinite(report.indexedDocuments) || report.indexedDocuments < 60) fail(`Repo Wiki did not index enough topic pages/cards: ${report.indexedDocuments}`);
if (!Number.isFinite(report.indexedChunks) || report.indexedChunks < 300) fail(`Indexed chunks are too shallow for Agent usage: ${report.indexedChunks}`);
if (!Array.isArray(report.generatedFiles) || report.generatedFiles.length < 60) fail("Generated Repo Wiki is not a rich topic wiki");

const metadata = readJson(metadataPath);
const wikiCatalogs = Array.isArray(metadata.wiki_catalogs) ? metadata.wiki_catalogs : [];
if (wikiCatalogs.length < 40) fail(`Repo Wiki catalog is too small for coding assistance: ${wikiCatalogs.length}`);
if (wikiCatalogs.length > 80) fail(`Repo Wiki catalog looks like a source mirror, not a topic wiki: ${wikiCatalogs.length}`);
if (!wikiCatalogs.some((catalog) => /知识库|知识引擎|Repo Wiki|Knowledge Engine|knowledge-engine/i.test(`${catalog.name || ""} ${catalog.title || ""} ${catalog.description || ""}`))) {
  fail("Repo Wiki catalog is missing a knowledge-engine topic");
}
if (!wikiCatalogs.some((catalog) => Number(catalog.layer_level || 0) >= 2 || String(catalog.section_path || "").split("/").filter(Boolean).length >= 2)) {
  fail("Repo Wiki catalog does not contain nested module/topic sections");
}

const wikiFiles = walkMarkdown(wikiRoot);
if (wikiFiles.length < 40) fail(`Repo Wiki markdown page count is too low for coding assistance: ${wikiFiles.length}`);
if (wikiFiles.length > 80) fail(`Repo Wiki markdown page count is too high for the default reading surface: ${wikiFiles.length}`);
const maxWikiPathDepth = wikiFiles.reduce((max, file) => {
  const relativePath = path.relative(wikiRoot, file).replaceAll(path.sep, "/");
  return Math.max(max, relativePath.split("/").length);
}, 0);
if (maxWikiPathDepth < 3) fail(`Repo Wiki markdown paths are too flat: max depth ${maxWikiPathDepth}`);

let citePages = 0;
let mermaidPages = 0;
let longPages = 0;
for (const file of wikiFiles) {
  const wiki = readFileSync(file, "utf8");
  if (!wiki.trim().startsWith("# ")) fail(`Generated wiki markdown does not start with a heading: ${file}`);
  if (/^\s*```/.test(wiki)) fail(`Generated wiki markdown is wrapped in a code fence: ${file}`);
  if (/<think>/i.test(wiki)) fail(`Generated wiki markdown still contains model thinking tags: ${file}`);
  if (containsPlaceholderBody(wiki)) {
    fail(`Generated wiki markdown contains placeholder text: ${file}`);
  }
  if (wiki.includes("<cite>")) citePages += 1;
  if (/```mermaid/.test(wiki)) mermaidPages += 1;
  if (wiki.split(/\r?\n/).length >= 180) longPages += 1;
}
if (citePages < Math.ceil(wikiFiles.length * 0.6)) fail(`Too few pages contain cite evidence: ${citePages}/${wikiFiles.length}`);
if (mermaidPages < Math.max(2, Math.floor(wikiFiles.length * 0.25))) fail(`Too few pages contain Mermaid diagrams: ${mermaidPages}/${wikiFiles.length}`);
if (longPages < Math.ceil(wikiFiles.length * 0.6)) fail(`Too few pages are substantial enough: ${longPages}/${wikiFiles.length}`);

if (!existsSync(agentCardsRoot)) fail(`Missing Agent Cards directory: ${agentCardsRoot}`);
const agentCardFiles = walkMarkdown(agentCardsRoot);
if (agentCardFiles.length < 8) fail(`Agent Cards are too shallow for coding assistance: ${agentCardFiles.length}`);
const agentCardIndex = path.join(agentCardsRoot, "_index.json");
const agentCards = readJson(agentCardIndex);
if (!Array.isArray(agentCards.cards) || agentCards.cards.length !== agentCardFiles.length) {
  fail(`Agent Card index mismatch: files=${agentCardFiles.length}, index=${Array.isArray(agentCards.cards) ? agentCards.cards.length : "missing"}`);
}
for (const expected of ["运行链路", "模块改造入口", "验证命令与质量门槛"]) {
  if (!agentCards.cards.some((card) => String(card.title || "").includes(expected))) {
    fail(`Agent Cards missing useful card: ${expected}`);
  }
}
for (const card of agentCards.cards) {
  if (!Array.isArray(card.entryFiles) || card.entryFiles.length === 0) fail(`Agent Card has no entry files: ${card.title}`);
  if (!Array.isArray(card.validation) || card.validation.length === 0) fail(`Agent Card has no validation path: ${card.title}`);
  if (!Array.isArray(card.risks) || card.risks.length === 0) fail(`Agent Card has no risk notes: ${card.title}`);
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
const indexedAgentCards = Number(sqlite(indexDbPath, "select count(*) from knowledge_documents where source_kind = 'agent_card';"));
if (indexedAgentCards !== agentCardFiles.length) fail(`Indexed Agent Card count mismatch: ${indexedAgentCards}/${agentCardFiles.length}`);

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
if (!Number.isFinite(uiDocs) || uiDocs < 40) fail(`UI DB does not contain enough generated wiki pages: ${uiDocs}`);

console.log(JSON.stringify({
  ok: true,
  workspaceRoot,
  reportPath,
  metadataPath,
  wikiPages: wikiFiles.length,
  catalogPages: wikiCatalogs.length,
  citePages,
  mermaidPages,
  agentCards: agentCardFiles.length,
  uiDbPath,
  indexDbPath,
  indexedDocuments: indexCounts[0],
  indexedChunks: indexCounts[1],
  ftsRows: indexCounts[2],
  vectorRows: indexCounts[3],
  indexedAgentCards,
  uiDocuments: uiDocs,
}, null, 2));
console.log("KNOWLEDGE_ENGINE_QA_OK");
