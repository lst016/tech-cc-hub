// src/electron/libs/claude/claude-code-compat-facts.ts
// -----------------------------------------------------------------------------
// Claude Code Compatibility Fact Taxonomy
// -----------------------------------------------------------------------------
// Phase 2 of the Claude Code 2.1.161 compatibility workflow.
// Each changelog item is normalized into one or more ClaudeCodeCompatFact
// records, classified by category and severity, and tagged with the product
// surfaces that need to react to the change.
// -----------------------------------------------------------------------------

export type ClaudeCodeCompatFactCategory =
  | "command"
  | "runtime"
  | "security"
  | "platform"
  | "plugin"
  | "model"
  | "observability"
  | "ui-copy";

export type ClaudeCodeCompatFactSeverity =
  | "info"
  | "compat"
  | "guardrail"
  | "breaking-risk";

export type ClaudeCodeCompatPlatformTag = "windows" | "wsl" | "macos" | "linux" | "browser";

export type ClaudeCodeCompatProductTarget =
  | "slash-catalog"
  | "runner"
  | "session-state"
  | "plugin-manager"
  | "settings-ui"
  | "activity-rail"
  | "qa"
  | "release-gate"
  | "docs";

export interface ClaudeCodeCompatFact {
  id: string;
  version: string;
  date: string;
  category: ClaudeCodeCompatFactCategory;
  severity: ClaudeCodeCompatFactSeverity;
  title: string;
  summary: string;
  rawText: string;
  commandNames?: string[];
  envKeys?: string[];
  configKeys?: string[];
  platformTags?: ClaudeCodeCompatPlatformTag[];
  productTargets: ClaudeCodeCompatProductTarget[];
  implemented: boolean;
  testIds: string[];
}

// Category inference rules. First match wins; keep order priority-stable.
const CATEGORY_RULES: Array<{
  category: ClaudeCodeCompatFactCategory;
  pattern: RegExp;
  severity: ClaudeCodeCompatFactSeverity;
  platforms?: ClaudeCodeCompatPlatformTag[];
  targets: ClaudeCodeCompatProductTarget[];
}> = [
  {
    category: "security",
    pattern: /\b(secret|redact|exfiltrat|permission|sudo|rm\s+-rf|api[_-]?key|token|password|authorization)\b/i,
    severity: "guardrail",
    targets: ["runner", "release-gate", "docs"],
  },
  {
    category: "runtime",
    pattern: /\b(background session|background agent|workflow|resume|detach|stale|wait[ing]? input|blocked|isolated worktree|claude agents|agent view)\b/i,
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
    pattern: /\b(windows|wsl|powershell|ime|clipboard|unc path|\\\.bat|\\\.cmd|\\\.ps1)\b/i,
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

function slugify(input: string, maxLen: number): string {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen) || "fact";
}

export function buildFactId(version: string, rawText: string): string {
  return `${version}#${slugify(rawText, 40)}`;
}

export function classifyCompatFact(
  version: string,
  date: string,
  rawText: string,
): ClaudeCodeCompatFact {
  const text = String(rawText || "").trim();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      return {
        id: buildFactId(version, text),
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
    id: buildFactId(version, text),
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

export function classifyCompatFacts(
  version: string,
  date: string,
  items: string[],
): ClaudeCodeCompatFact[] {
  const seen = new Set<string>();
  const out: ClaudeCodeCompatFact[] = [];
  for (const item of items) {
    const fact = classifyCompatFact(version, date, item);
    if (seen.has(fact.id)) continue;
    seen.add(fact.id);
    out.push(fact);
  }
  return out;
}
