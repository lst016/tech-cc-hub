import type { PromptLedgerSegment, PromptLedgerSourceKind } from "../../shared/prompt-ledger.js";

export type ContextUsageSourceCategory =
  | "system"
  | "project"
  | "skill"
  | "workflow"
  | "memory"
  | "messages"
  | "tool_payload"
  | "tool_definitions"
  | "plugin"
  | "mcp"
  | "subagent"
  | "unattributed";

export type ContextUsageBreakdownCategory = {
  id: string;
  label: string;
  tokens: number;
  sourceKinds?: PromptLedgerSourceKind[];
  sourceCategories?: ContextUsageSourceCategory[];
  fallbackDetail?: string;
};

export type ContextUsageBreakdownItem = {
  id: string;
  label: string;
  tokenEstimate: number;
  chars: number;
  sourceKind?: PromptLedgerSourceKind;
  sourcePath?: string;
  usageCategories: ContextUsageSourceCategory[];
  sample: string;
};

export type ContextUsageDriverGroup = {
  id: ContextUsageSourceCategory;
  label: string;
  tokens: number;
  itemCount: number;
  items: ContextUsageBreakdownItem[];
};

export type ContextUsageSourceSummaryRow = {
  id: ContextUsageSourceCategory;
  label: string;
  tokens: number;
  itemCount: number;
  estimated: boolean;
  sourceIds: string[];
};

const CONTEXT_USAGE_DRIVER_LABELS: Record<ContextUsageSourceCategory, string> = {
  system: "System",
  project: "Project",
  skill: "Skill",
  workflow: "Workflow",
  memory: "Memory",
  messages: "Messages",
  tool_payload: "Tool",
  tool_definitions: "Tool Definitions",
  plugin: "Plugin",
  mcp: "MCP",
  subagent: "Subagent",
  unattributed: "Derived",
};

const CONTEXT_USAGE_DRIVER_PRIORITY: ContextUsageSourceCategory[] = [
  "plugin",
  "mcp",
  "subagent",
  "tool_definitions",
  "skill",
  "memory",
  "messages",
  "system",
  "project",
  "workflow",
  "tool_payload",
  "unattributed",
];

export function buildContextUsageBreakdown(
  segments: PromptLedgerSegment[],
  category: ContextUsageBreakdownCategory,
): ContextUsageBreakdownItem[] {
  const matchedSegments = segments.filter((segment) => matchesBreakdownCategory(segment, category));

  if (matchedSegments.length > 0) {
    return matchedSegments
      .slice()
      .sort((left, right) => right.tokenEstimate - left.tokenEstimate)
      .map((segment) => ({
        id: segment.id,
        label: segment.label,
        tokenEstimate: segment.tokenEstimate,
        chars: segment.chars,
        sourceKind: segment.sourceKind,
        sourcePath: segment.sourcePath,
        usageCategories: deriveContextUsageSourceCategories(segment),
        sample: segment.sample || segment.text || "",
      }));
  }

  if (category.tokens <= 0) return [];

  return [{
    id: `${category.id}-estimate`,
    label: category.label,
    tokenEstimate: category.tokens,
    chars: 0,
    usageCategories: category.sourceCategories?.length ? [...category.sourceCategories] : ["unattributed"],
    sample: category.fallbackDetail ?? "This is a derived estimate because the current prompt ledger has no matching source segment.",
  }];
}

export function deriveContextUsageSourceCategories(
  segment: Pick<PromptLedgerSegment, "sourceKind" | "label" | "sample" | "text" | "sourcePath" | "toolName">,
): ContextUsageSourceCategory[] {
  const categories = new Set<ContextUsageSourceCategory>();
  const haystack = [
    segment.label,
    segment.sample,
    segment.text,
    segment.sourcePath,
    segment.toolName,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();

  switch (segment.sourceKind) {
    case "system":
      categories.add("system");
      break;
    case "project":
      categories.add("project");
      break;
    case "skill":
      categories.add("skill");
      break;
    case "workflow":
      categories.add("workflow");
      break;
    case "memory":
      categories.add("memory");
      break;
    case "history":
    case "current":
    case "attachment":
      categories.add("messages");
      break;
    case "tool":
      categories.add("tool_payload");
      break;
    default:
      break;
  }

  if (/\bplugin\b|\.claude-plugin|installed_plugins\.json|enabledplugins|plugin\.json|\/plugin\b/i.test(haystack)) {
    categories.add("plugin");
  }

  if (/\bmcp\b|mcp__|managed-mcp\.json|\.mcp\.json|modelcontextprotocol/i.test(haystack)) {
    categories.add("mcp");
  }

  if (/\bsubagent\b|\bsub-agent\b|\bteammate\b|\bagent teams\b|\bclaude agents\b|teamcreate|sendmessage|taskcreate|background session/i.test(haystack)) {
    categories.add("subagent");
  }

  if (segment.sourceKind === "tool" && /\btool\b.*\bdefinition\b|\bschema\b|\ballowed tool\b|\btool names?\b/i.test(haystack)) {
    categories.add("tool_definitions");
  }

  if (categories.size === 0) {
    categories.add("unattributed");
  }

  return Array.from(categories);
}

export function pickPrimaryContextUsageCategory(
  categories: ContextUsageSourceCategory[],
): ContextUsageSourceCategory {
  for (const candidate of CONTEXT_USAGE_DRIVER_PRIORITY) {
    if (categories.includes(candidate)) {
      return candidate;
    }
  }
  return "unattributed";
}

export function buildContextUsageDriverGroups(
  items: ContextUsageBreakdownItem[],
): ContextUsageDriverGroup[] {
  const groups = new Map<ContextUsageSourceCategory, ContextUsageDriverGroup>();

  for (const item of items) {
    const primaryCategory = pickPrimaryContextUsageCategory(item.usageCategories);
    const existing = groups.get(primaryCategory);

    if (existing) {
      existing.tokens += item.tokenEstimate;
      existing.itemCount += 1;
      existing.items.push(item);
      continue;
    }

    groups.set(primaryCategory, {
      id: primaryCategory,
      label: CONTEXT_USAGE_DRIVER_LABELS[primaryCategory],
      tokens: item.tokenEstimate,
      itemCount: 1,
      items: [item],
    });
  }

  return Array.from(groups.values())
    .sort((left, right) => right.tokens - left.tokens)
    .map((group) => ({
      ...group,
      items: group.items.slice().sort((left, right) => right.tokenEstimate - left.tokenEstimate),
    }));
}

export function buildContextUsageSourceSummaryRows(
  segments: PromptLedgerSegment[],
): ContextUsageSourceSummaryRow[] {
  const breakdownItems = segments.map((segment) => ({
    id: segment.id,
    label: segment.label,
    tokenEstimate: segment.tokenEstimate,
    chars: segment.chars,
    sourceKind: segment.sourceKind,
    sourcePath: segment.sourcePath,
    usageCategories: deriveContextUsageSourceCategories(segment),
    sample: segment.sample || segment.text || "",
  }));

  return buildContextUsageDriverGroups(breakdownItems).map((group) => ({
    id: group.id,
    label: group.label,
    tokens: group.tokens,
    itemCount: group.itemCount,
    estimated: false,
    sourceIds: group.items.map((item) => item.id),
  }));
}

function matchesBreakdownCategory(
  segment: PromptLedgerSegment,
  category: ContextUsageBreakdownCategory,
): boolean {
  if (category.sourceKinds?.includes(segment.sourceKind)) {
    return true;
  }

  if (!category.sourceCategories?.length) {
    return false;
  }

  const derivedCategories = deriveContextUsageSourceCategories(segment);
  return category.sourceCategories.some((candidate) => derivedCategories.includes(candidate));
}
