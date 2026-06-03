import { createHash } from "node:crypto";

export function normalizeVersion(input) {
  if (!input) return "";
  const raw = String(input).trim().replace(/^v/i, "");
  const match = raw.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return "";
  if (match[1] === "0" && match[2] === "2") return `2.1.${match[3]}`;
  return raw;
}

const HTML_PRELUDE = String.raw`<\!\-\-.*?\-\->`;
const HTML_SCRIPT = String.raw`<\s*script[\s\S]*?<\s*\/\s*script\s*>`;

export function decodeHtmlEntities(input) {
  return String(input)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCharCode(parseInt(dec, 10)));
}

function safeFromCharCode(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function stripHtml(input) {
  return String(input)
    .replace(/\r\n/g, "\n")
    .replace(new RegExp(HTML_SCRIPT, "gi"), "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<code[^>]*>/gi, "`")
    .replace(/<\/code>/gi, "`")
    .replace(/<h[1-6][^>]*>/gi, "\n### ")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(new RegExp(HTML_PRELUDE, "gi"), "")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function parseStrippedSections(text) {
  const normalized = decodeHtmlEntities(stripHtml(text));
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

// classifyCompatFacts lives in src/electron/libs/claude/claude-code-compat-facts.ts
// (canonical TypeScript source). sync-claude-code-compat.mjs does not yet invoke
// it; Phase 2 will wire the runtime classification in by either (a) compiling
// the .ts to .js alongside the lib, or (b) running the script via tsx/ts-node.
// Until then this re-export is intentionally absent.

export function extractOfficialSections(html) {
  return parseStrippedSections(html);
}

export function extractClaudelogSections(html) {
  return parseStrippedSections(html);
}

// Backwards-compatible alias for older callers/tests that referenced the old
// generic name. The behavior is identical to the official parser today; the
// source-plumbing layer in sync-claude-code-compat.mjs selects which one to
// invoke based on --source.
export const extractSections = extractOfficialSections;

export function sha256Digest(input) {
  return createHash("sha256").update(String(input), "utf8").digest("hex");
}

export function buildSyncReport({
  source,
  sourceUrl,
  fetchedAt,
  sourceDigest,
  section,
  commandItems,
  promptHints,
}) {
  return {
    source,
    sourceUrl,
    fetchedAt,
    sourceDigest,
    fetchedVersion: section?.version ?? null,
    fetchedDate: section?.date ?? null,
    commandCount: commandItems.length,
    hintCount: promptHints.length,
    newCommands: commandItems.map((item) => item.name),
    renamedCommands: [],
    status: "ok",
    note: null,
  };
}

export function extractCommandItems(items) {
  const commands = new Map();
  for (const item of items) {
    const text = stripTicks(item);

    for (const match of item.matchAll(/`\/([a-z][a-z0-9-]*)\b[^`]*`/gi)) {
      addCommand(commands, match[1], text);
    }

    const leadingCommand = item.match(/^(?:`)?\/([a-z][a-z0-9-]*)\b/i);
    if (leadingCommand?.[1]) {
      addCommand(commands, leadingCommand[1], text);
    }

    const addedOrRenamedMatches = item.matchAll(/\b(?:added|renamed)\s+`\/([a-z][a-z0-9-]*)\b[^`]*`/gi);
    for (const match of addedOrRenamedMatches) {
      addCommand(commands, match[1], text);
    }

    if (/\bclaude\s+agents\b/i.test(text)) {
      addCommand(commands, "agents", text);
    }
  }
  return Array.from(commands.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function buildPromptHints(items) {
  const hints = [];
  const hasGoal = items.some((item) => /\/goal\b/i.test(item));
  const hasScrollSpeed = items.some((item) => /\/scroll-speed\b/i.test(item));
  const hasAgentView = items.some((item) => /\bclaude\s+agents\b|agent view/i.test(item));
  const hasPluginDetails = items.some((item) => /\bplugin details\b|\/plugin\b/i.test(item));
  const hasHookExec = items.some((item) => /\bargs:\s*string\[\]|exec form/i.test(item));
  const hasContinueOnBlock = items.some((item) => /\bcontinueOnBlock\b/i.test(item));
  const hasProjectDir = items.some((item) => /\bCLAUDE_PROJECT_DIR\b/i.test(item));
  const hasUsageBreakdown = items.some((item) => /\/usage\b.*per-category breakdown|per-MCP-server cost/i.test(item));
  const hasCodeReviewRename = items.some((item) => /renamed\s+`?\/simplify`?\s+to\s+`?\/code-review`?/i.test(item));
  const hasUsageCreditsRename = items.some((item) => /\/extra-usage\b.*\/usage-credits|usage credits/i.test(item));
  const hasDynamicWorkflows = items.some((item) => /\bdynamic workflows\b|\/workflows\b|workflow status row/i.test(item));
  const hasUltracode = items.some((item) => /\bultracode\b|standing dynamic-workflow orchestration/i.test(item));

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
  if (hasUsageBreakdown) {
    hints.push("`/usage` in current Claude Code exposes a per-category breakdown such as skills, subagents, plugins, and per-MCP-server cost. In tech-cc-hub, prefer source-level usage breakdowns over only prompt-ledger totals when the UI has enough evidence.");
  }
  if (hasCodeReviewRename) {
    hints.push("`/code-review` is the current Claude Code review surface focused on correctness findings. Treat `/simplify` as historical wording; prefer review-style behavior and naming in user-facing explanations. Split oversized code or diff input into bounded review chunks, then summarize cross-chunk findings instead of loading everything at once.");
  }
  if (hasUsageCreditsRename) {
    hints.push("`/usage-credits` is the current Claude Code label for what older builds called `/extra-usage`. Prefer the new name in UI copy while keeping old-name compatibility where needed.");
  }
  if (hasDynamicWorkflows) {
    hints.push("Dynamic workflows let Claude create and run workflow plans across many background agents. For broad multi-lane tasks in tech-cc-hub, prefer an explicit workflow plan, keep progress visible in the task/workflow status surface, and avoid spawning large agent trees for small reversible edits.");
  }
  if (hasUltracode) {
    hints.push("`ultracode` is a session-scoped xhigh dynamic-workflow orchestration mode. Use it only when the user's request is explicitly large, parallel, or workflow-oriented; keep ordinary edits on the normal runner path.");
  }
  if (hasHookExec || hasContinueOnBlock) {
    hints.push("Hook `args: string[]` exec form and PostToolUse `continueOnBlock` apply to config-driven Claude Code hooks. tech-cc-hub uses SDK in-process hook callbacks, so keep using structured callbacks and `updatedToolOutput` for PostToolUse output replacement.");
  }
  if (hasProjectDir) {
    hints.push("Stdio MCP servers should receive `CLAUDE_PROJECT_DIR` for the current workspace unless the user explicitly configured that env var.");
  }
  return hints;
}

export function renderRegistry(registry) {
  const localPromptHints = [
    "`/code-review` should split oversized code or diff input into bounded review chunks, review each chunk for correctness, security, and regression findings, then summarize cross-chunk risks instead of loading everything at once.",
  ];

  return `import type { SlashCommandItem } from "../slash-command-discovery.js";
import type { ClaudeCodeCompatFact } from "./claude-code-compat-facts.js";
import { buildClaudeAgentTeamsPromptHint } from "../../../shared/claude-agent-teams.js";

// Generated compatibility seed. Refresh with:
//   node scripts/sync-claude-code-compat.mjs

export type ClaudeCodeCompatRegistry = {
  sourceUrl: string;
  sourceVersion: string;
  sourceDate: string;
  generatedAt: string;
  sourceDigest?: string;
  commandItems: SlashCommandItem[];
  promptHints: string[];
  facts: ClaudeCodeCompatFact[];
};

export const CLAUDE_CODE_COMPAT_REGISTRY: ClaudeCodeCompatRegistry = ${JSON.stringify(registry, null, 2)};

export const CLAUDE_CODE_COMPAT_COMMAND_ITEMS = CLAUDE_CODE_COMPAT_REGISTRY.commandItems;

const CLAUDE_CODE_LOCAL_COMPAT_PROMPT_HINTS = ${JSON.stringify(localPromptHints, null, 2)};

export function buildClaudeCodeCompatPromptAppend(): string {
  return [
    \`Claude Code v\${CLAUDE_CODE_COMPAT_REGISTRY.sourceVersion} compatibility notes for tech-cc-hub:\`,
    ...CLAUDE_CODE_LOCAL_COMPAT_PROMPT_HINTS.map((hint) => \`- \${hint}\`),
    ...CLAUDE_CODE_COMPAT_REGISTRY.promptHints.map((hint) => \`- \${hint}\`),
    ...buildClaudeAgentTeamsPromptHint().split("\\n").map((hint) => \`- \${hint}\`),
  ].join("\\n");
}
`;
}

function addCommand(commands, rawName, description) {
  const name = rawName.trim().replace(/^\/+/, "").toLowerCase();
  if (!name) return;
  if (!commands.has(name)) {
    commands.set(name, { name, description });
  }
}

function stripTicks(text) {
  return text.replace(/`/g, "");
}

// classifyCompatFacts — JS port of the canonical TypeScript classifier at
// src/electron/libs/claude/claude-code-compat-facts.ts. We keep a JS copy here
// because sync-claude-code-compat.mjs is run as a plain Node script and cannot
// import .ts files without a loader. When Phase 2 promotion happens, this JS
// port should be deleted and the script switched to tsx/ts-node or the .ts
// file should be compiled alongside the lib.

const COMPAT_FACT_CATEGORY_RULES = [
  {
    category: "security",
    pattern: /\b(secret|redact|exfiltrat|permission|sudo|rm\s+-rf|api[_-]?key|token|password|authorization)\b/i,
    severity: "guardrail",
    targets: ["runner", "release-gate", "docs"],
  },
  {
    category: "runtime",
    pattern: /\b(background session|background agent|workflow|resume|detach|stale|wait(?:ing)? input|blocked|isolated worktree|claude agents|agent view)\b/i,
    severity: "breaking-risk",
    targets: ["session-state", "activity-rail", "runner"],
  },
  {
    category: "plugin",
    pattern: /\b(plugin|plugin\.json|marketplace|defaultEnabled|plugin dependencies|mcp server|lsp server|tool name)\b/i,
    severity: "compat",
    targets: ["plugin-manager", "settings-ui", "docs"],
  },
  {
    category: "platform",
    pattern: /\b(windows|wsl|powershell|ime|clipboard|unc path|\.bat|\.cmd|\.ps1)\b/i,
    severity: "compat",
    platforms: ["windows"],
    targets: ["qa", "docs"],
  },
  {
    category: "model",
    pattern: /\b(opus|sonnet|effort|xhigh|fast mode|bedrock|vertex|foundry|model alias|claude-opus|claude-sonnet)\b/i,
    severity: "compat",
    targets: ["runner", "settings-ui"],
  },
  {
    category: "observability",
    pattern: /\b(otel|telemetry|usage breakdown|per-mcp-server cost|event buffer|log event)\b/i,
    severity: "info",
    targets: ["activity-rail", "docs"],
  },
  {
    category: "command",
    pattern: /\b(\/[a-z][a-z0-9-]*|claude\s+agents|slash command|renamed\s+`?\/|added\s+`?\/)\b/i,
    severity: "info",
    targets: ["slash-catalog"],
  },
];

function compatFactSlug(input, maxLen) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen) || "fact";
}

export function buildCompatFactId(version, rawText) {
  return `${version}#${compatFactSlug(rawText, 40)}`;
}

function classifyCompatFact(version, date, rawText) {
  const text = String(rawText || "").trim();
  for (const rule of COMPAT_FACT_CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      return {
        id: buildCompatFactId(version, text),
        version,
        date,
        category: rule.category,
        severity: rule.severity,
        title: text.length > 80 ? text.slice(0, 77) + "..." : text,
        summary: text,
        rawText: text,
        platformTags: rule.platforms,
        productTargets: rule.targets,
        implemented: false,
        testIds: [],
      };
    }
  }
  return {
    id: buildCompatFactId(version, text),
    version,
    date,
    category: "ui-copy",
    severity: "info",
    title: text.length > 80 ? text.slice(0, 77) + "..." : text,
    summary: text,
    rawText: text,
    productTargets: ["docs"],
    implemented: false,
    testIds: [],
  };
}

export function classifyCompatFacts(version, date, items) {
  const seen = new Set();
  const out = [];
  if (!Array.isArray(items)) return out;
  for (const item of items) {
    const fact = classifyCompatFact(version, date, item);
    if (seen.has(fact.id)) continue;
    seen.add(fact.id);
    out.push(fact);
  }
  return out;
}
