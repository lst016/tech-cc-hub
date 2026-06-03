#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildPromptHints,
  buildSyncReport,
  classifyCompatFacts,
  extractClaudelogSections,
  extractOfficialSections,
  extractCommandItems,
  normalizeVersion,
  renderRegistry,
  sha256Digest,
} from "./claude-code-compat-sync-lib.mjs";

const OFFICIAL_SOURCE_URL = "https://code.claude.com/docs/en/changelog";
const CLAUDELOG_SOURCE_URL = "https://claudelog.com/claude-code-changelog/";
const OUTPUT_FILE = resolve("src/electron/libs/claude/claude-code-compat-registry.ts");
const REPORT_FILE = resolve(".tmp/claude-code-compat-sync-report.json");

const SOURCES = {
  official: { url: OFFICIAL_SOURCE_URL, parser: extractOfficialSections },
  claudelog: { url: CLAUDELOG_SOURCE_URL, parser: extractClaudelogSections },
  file: { url: null, parser: extractOfficialSections },
};

const args = parseArgs(process.argv.slice(2));
const sourceName = String(args.source ?? "official").toLowerCase();
const sourceConfig = SOURCES[sourceName];
if (!sourceConfig) {
  console.error(`Unknown --source ${sourceName}. Expected one of: ${Object.keys(SOURCES).join(", ")}.`);
  process.exit(2);
}
const requestedVersion = normalizeVersion(args.version ?? args.v);
const filePath = args.file ? resolve(String(args.file)) : null;
if (sourceName === "file" && !filePath) {
  console.error("--source file requires --file <path>.");
  process.exit(2);
}

const sourceUrl = sourceName === "file" ? `file://${filePath}` : sourceConfig.url;
const fetchedAt = new Date().toISOString();
const sourceText = sourceName === "file" ? await readFile(filePath, "utf8") : await fetchText(sourceUrl);
const sourceDigest = sha256Digest(sourceText);
const sections = sourceConfig.parser(sourceText);
const section = requestedVersion
  ? sections.find((item) => item.version === requestedVersion)
  : sections[0];

const report = {
  source: sourceName,
  sourceUrl,
  fetchedAt,
  sourceDigest,
  requestedVersion: requestedVersion || null,
  fetchedVersion: section?.version ?? null,
  fetchedDate: section?.date ?? null,
  sectionCount: sections.length,
  commandCount: 0,
  hintCount: 0,
  newCommands: [],
  renamedCommands: [],
  status: "ok",
  note: null,
};

if (!section) {
  const suffix = requestedVersion ? ` for v${requestedVersion}` : "";
  report.status = "no-section";
  report.note = `No Claude Code changelog section found${suffix}.`;
  await writeReport(report);
  console.error(report.note);
  process.exit(1);
}

const commandItems = extractCommandItems(section.items);
const promptHints = buildPromptHints(section.items);
const facts = classifyCompatFacts(section.version, section.date, section.items);
report.commandCount = commandItems.length;
report.hintCount = promptHints.length;
report.factCount = facts.length;
report.newCommands = commandItems.map((item) => item.name);

const registry = {
  sourceUrl,
  sourceVersion: section.version,
  sourceDate: section.date,
  generatedAt: fetchedAt,
  sourceDigest,
  commandItems,
  promptHints,
  facts,
};

const rendered = renderRegistry(registry);
if (!isUtf8Clean(rendered)) {
  report.status = "encoding-error";
  report.note = "Rendered registry contains non-UTF-8 bytes; refusing to overwrite.";
  await writeReport(report);
  console.error(report.note);
  process.exit(1);
}

await writeFile(OUTPUT_FILE, rendered, "utf8");
await writeReport(report);
// Sidecar JSON: the Phase 2 gate in scripts/claude-code-compat-2161-workflow.mjs
// reads this instead of parsing the generated TS file. Keeps the workflow
// runner simple and avoids loading TS at runtime.
await writeFile(resolve(".tmp/claude-code-compat-facts.json"), JSON.stringify(facts, null, 2), "utf8");
console.log(`Wrote ${OUTPUT_FILE} from ${sourceName} v${section.version} (digest ${sourceDigest.slice(0, 12)}, ${facts.length} facts).`);

async function writeReport(payload) {
  await mkdir(resolve(".tmp"), { recursive: true });
  await writeFile(REPORT_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function isUtf8Clean(text) {
  const buffer = Buffer.from(text, "utf8");
  return buffer.toString("utf8") === text;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq >= 0) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      out[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "tech-cc-hub-claude-compat-sync/1.0",
      accept: "text/html, text/plain;q=0.9, */*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  return response.text();
}
