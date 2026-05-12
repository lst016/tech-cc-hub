#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SOURCE_URL = "https://claudelog.com/claude-code-changelog/";
const OUTPUT_FILE = resolve("src/electron/libs/claude-code-compat-registry.ts");

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

function normalizeVersion(input) {
  if (!input) return "";
  const raw = String(input).trim().replace(/^v/i, "");
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return "";
  if (match[1] === "0" && match[2] === "2") return `2.1.${match[3]}`;
  return raw;
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

function extractSections(html) {
  const normalized = decodeHtmlEntities(html)
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<h[1-6][^>]*>/gi, "\n### ")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n");

  const matches = [...normalized.matchAll(/(?:^|\n)\s*#{0,6}\s*(?:Claude Code\s*)?v(2\.1\.(\d+))\b[^\n]*/gi)];
  return matches.map((match, index) => {
    const version = match[1];
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    const body = normalized.slice(start, end);
    const items = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).trim().replace(/\s+/g, " "))
      .filter(Boolean);
    const dateMatch = body.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b/);
    return { version, date: dateMatch?.[0] ?? "", items };
  });
}

function extractCommandItems(items) {
  const commands = new Map();
  for (const item of items) {
    const text = stripTicks(item);
    for (const match of text.matchAll(/\/([a-z][a-z0-9-]*)\b/gi)) {
      addCommand(commands, match[1], text);
    }
    if (/\bclaude\s+agents\b/i.test(text)) {
      addCommand(commands, "agents", text);
    }
    if (/\bclaude\s+plugin\s+details\b/i.test(text)) {
      addCommand(commands, "plugin", text);
    }
  }
  return Array.from(commands.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function addCommand(commands, rawName, description) {
  const name = rawName.trim().replace(/^\/+/, "").toLowerCase();
  if (!name) return;
  if (!commands.has(name)) {
    commands.set(name, { name, description });
  }
}

function buildPromptHints(items) {
  const hints = [];
  const hasGoal = items.some((item) => /\/goal\b/i.test(item));
  const hasScrollSpeed = items.some((item) => /\/scroll-speed\b/i.test(item));
  const hasAgentView = items.some((item) => /\bclaude\s+agents\b|agent view/i.test(item));
  const hasPluginDetails = items.some((item) => /\bplugin details\b|\/plugin\b/i.test(item));
  const hasHookExec = items.some((item) => /\bargs:\s*string\[\]|exec form/i.test(item));
  const hasContinueOnBlock = items.some((item) => /\bcontinueOnBlock\b/i.test(item));
  const hasProjectDir = items.some((item) => /\bCLAUDE_PROJECT_DIR\b/i.test(item));

  if (hasGoal) {
    hints.push("`/goal <goal>` sets or updates a durable completion condition. Restate the goal briefly, use update_plan to track progress, keep later work tied to the goal, and stop only when the goal is satisfied or a real blocker remains.");
  }
  if (hasScrollSpeed) {
    hints.push("`/scroll-speed <slow|normal|fast|number>` is a Claude Code terminal TUI setting. In tech-cc-hub, map it to explicit browser scroll distances or mouse wheel deltas when using browser tools; for chat transcript reading, summarize/navigate instead of pretending to change terminal scroll speed.");
  }
  if (hasAgentView) {
    hints.push("`claude agents` / agent view is a session-and-agent overview. When the user asks for it here, summarize active session, subagent, tool, permission, and blocker state from available session events and progress summaries.");
  }
  if (hasPluginDetails) {
    hints.push("Plugin details should include source, version, status, permissions, configured MCP servers, tool count/tool names, auth mode, update hints, and projected prompt/token impact when available.");
  }
  if (hasHookExec || hasContinueOnBlock) {
    hints.push("Hook `args: string[]` exec form and PostToolUse `continueOnBlock` apply to config-driven Claude Code hooks. tech-cc-hub uses SDK in-process hook callbacks, so keep using structured callbacks and `updatedToolOutput` for PostToolUse output replacement.");
  }
  if (hasProjectDir) {
    hints.push("Stdio MCP servers should receive `CLAUDE_PROJECT_DIR` for the current workspace unless the user explicitly configured that env var.");
  }
  return hints;
}

function renderRegistry(registry) {
  return `import type { SlashCommandItem } from "./slash-command-discovery.js";

// Generated compatibility seed. Refresh with:
//   node scripts/sync-claude-code-compat.mjs

export type ClaudeCodeCompatRegistry = {
  sourceUrl: string;
  sourceVersion: string;
  sourceDate: string;
  generatedAt: string;
  commandItems: SlashCommandItem[];
  promptHints: string[];
};

export const CLAUDE_CODE_COMPAT_REGISTRY: ClaudeCodeCompatRegistry = ${JSON.stringify(registry, null, 2)};

export const CLAUDE_CODE_COMPAT_COMMAND_ITEMS = CLAUDE_CODE_COMPAT_REGISTRY.commandItems;

export function buildClaudeCodeCompatPromptAppend(): string {
  return [
    \`Claude Code v\${CLAUDE_CODE_COMPAT_REGISTRY.sourceVersion} compatibility notes for tech-cc-hub:\`,
    ...CLAUDE_CODE_COMPAT_REGISTRY.promptHints.map((hint) => \`- \${hint}\`),
  ].join("\\n");
}
`;
}

function stripTicks(text) {
  return text.replace(/`/g, "");
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}
