#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildPromptHints,
  extractCommandItems,
  extractSections,
  normalizeVersion,
  renderRegistry,
} from "./claude-code-compat-sync-lib.mjs";

const SOURCE_URL = "https://claudelog.com/claude-code-changelog/";
const OUTPUT_FILE = resolve("src/electron/libs/claude/claude-code-compat-registry.ts");

const args = parseArgs(process.argv.slice(2));
const requestedVersion = normalizeVersion(args.version ?? args.v);

const html = await fetchText(SOURCE_URL);
const sections = extractSections(html);
const section = requestedVersion
  ? sections.find((item) => item.version === requestedVersion)
  : sections[0];

if (!section) {
  const suffix = requestedVersion ? ` for v${requestedVersion}` : "";
  console.error(`No Claude Code changelog section found${suffix}.`);
  process.exit(1);
}

const registry = {
  sourceUrl: SOURCE_URL,
  sourceVersion: section.version,
  sourceDate: section.date,
  generatedAt: new Date().toISOString(),
  commandItems: extractCommandItems(section.items),
  promptHints: buildPromptHints(section.items),
};

await writeFile(OUTPUT_FILE, renderRegistry(registry), "utf8");
console.log(`Wrote ${OUTPUT_FILE} from Claude Code v${section.version}.`);

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
