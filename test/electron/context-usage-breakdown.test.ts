import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildContextUsageBreakdown,
  buildContextUsageDriverGroups,
  buildContextUsageSourceSummaryRows,
  deriveContextUsageSourceCategories,
  pickPrimaryContextUsageCategory,
} from "../../src/ui/utils/context-usage-breakdown.js";
import type { PromptLedgerSegment } from "../../src/shared/prompt-ledger.js";

const segment = (
  input: Partial<PromptLedgerSegment> & Pick<PromptLedgerSegment, "id" | "label" | "sourceKind" | "tokenEstimate">,
): PromptLedgerSegment => ({
  bucketId: input.bucketId ?? input.id,
  segmentKind: input.segmentKind ?? "source",
  chars: input.chars ?? input.tokenEstimate * 3,
  ratio: input.ratio ?? 0,
  sample: input.sample ?? `${input.label} sample`,
  risks: input.risks ?? [],
  ...input,
});

describe("context usage breakdown", () => {
  it("returns prompt segments matching the selected source kinds", () => {
    const items = buildContextUsageBreakdown([
      segment({ id: "system", label: "System preset", sourceKind: "system", tokenEstimate: 30 }),
      segment({ id: "project", label: "Project CLAUDE.md", sourceKind: "project", tokenEstimate: 967 }),
      segment({ id: "message", label: "Current input", sourceKind: "current", tokenEstimate: 120 }),
    ], {
      id: "system",
      label: "System prompts",
      tokens: 997,
      sourceKinds: ["system", "project", "workflow"],
    });

    assert.deepEqual(items.map((item) => item.label), ["Project CLAUDE.md", "System preset"]);
  });

  it("returns a fallback item for derived estimates without ledger segments", () => {
    const items = buildContextUsageBreakdown([], {
      id: "tool-definitions",
      label: "Tool definition estimate",
      tokens: 1_560,
      fallbackDetail: "Estimated from discovered tool definitions.",
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.tokenEstimate, 1_560);
    assert.equal(items[0]?.sample, "Estimated from discovered tool definitions.");
    assert.deepEqual(items[0]?.usageCategories, ["unattributed"]);
  });

  it("matches segments by derived source categories such as plugin and MCP", () => {
    const items = buildContextUsageBreakdown([
      segment({
        id: "plugin-mcp",
        label: "Plugin MCP config",
        sourceKind: "tool",
        tokenEstimate: 210,
        sample: "Read .mcp.json from plugin.json and /plugin details",
        sourcePath: ".claude-plugin/plugin.json",
      }),
      segment({
        id: "plain-tool",
        label: "Tool payload",
        sourceKind: "tool",
        tokenEstimate: 90,
        sample: "ordinary tool payload",
      }),
    ], {
      id: "plugins",
      label: "Plugins",
      tokens: 210,
      sourceCategories: ["plugin", "mcp"],
    });

    assert.deepEqual(items.map((item) => item.id), ["plugin-mcp"]);
    assert.ok(items[0]?.usageCategories.includes("plugin"));
    assert.ok(items[0]?.usageCategories.includes("mcp"));
  });

  it("derives subagent and system categories from segment content", () => {
    assert.deepEqual(
      deriveContextUsageSourceCategories(segment({
        id: "subagent",
        label: "Claude agents teammate summary",
        sourceKind: "tool",
        tokenEstimate: 120,
        sample: "Subagent progress from claude agents and TeamCreate",
      })),
      ["tool_payload", "subagent"],
    );

    assert.deepEqual(
      deriveContextUsageSourceCategories(segment({
        id: "system",
        label: "System prompt",
        sourceKind: "system",
        tokenEstimate: 50,
      })),
      ["system"],
    );
  });

  it("picks a stable primary usage driver without double counting", () => {
    assert.equal(
      pickPrimaryContextUsageCategory(["tool_payload", "plugin", "mcp"]),
      "plugin",
    );
    assert.equal(
      pickPrimaryContextUsageCategory(["tool_payload", "subagent"]),
      "subagent",
    );
    assert.equal(
      pickPrimaryContextUsageCategory(["unattributed"]),
      "unattributed",
    );
  });

  it("groups breakdown items into non-overlapping source drivers", () => {
    const groups = buildContextUsageDriverGroups([
      {
        id: "plugin",
        label: "Plugin MCP config",
        tokenEstimate: 210,
        chars: 640,
        sourceKind: "tool",
        usageCategories: ["tool_payload", "plugin", "mcp"],
        sample: "Plugin details and managed mcp config",
      },
      {
        id: "subagent",
        label: "Claude agents teammate summary",
        tokenEstimate: 160,
        chars: 480,
        sourceKind: "tool",
        usageCategories: ["tool_payload", "subagent"],
        sample: "Subagent progress",
      },
      {
        id: "plain",
        label: "Tool payload",
        tokenEstimate: 90,
        chars: 270,
        sourceKind: "tool",
        usageCategories: ["tool_payload"],
        sample: "Plain tool payload",
      },
    ]);

    assert.deepEqual(groups.map((group) => group.id), ["plugin", "subagent", "tool_payload"]);
    assert.equal(groups[0]?.tokens, 210);
    assert.equal(groups[1]?.tokens, 160);
    assert.equal(groups[2]?.tokens, 90);
    assert.deepEqual(groups[0]?.items.map((item) => item.id), ["plugin"]);
    assert.deepEqual(groups[1]?.items.map((item) => item.id), ["subagent"]);
    assert.deepEqual(groups[2]?.items.map((item) => item.id), ["plain"]);
  });

  it("builds reusable source summary rows from prompt ledger segments", () => {
    const rows = buildContextUsageSourceSummaryRows([
      segment({
        id: "skill",
        label: "Skill instructions",
        sourceKind: "skill",
        tokenEstimate: 70,
      }),
      segment({
        id: "plugin-mcp",
        label: "Plugin MCP config",
        sourceKind: "tool",
        tokenEstimate: 210,
        sample: "Read .mcp.json from plugin.json and /plugin details",
        sourcePath: ".claude-plugin/plugin.json",
      }),
      segment({
        id: "subagent",
        label: "Claude agents teammate summary",
        sourceKind: "tool",
        tokenEstimate: 160,
        sample: "Subagent progress from claude agents and TeamCreate",
      }),
      segment({
        id: "message",
        label: "Current input",
        sourceKind: "current",
        tokenEstimate: 40,
      }),
    ]);

    assert.deepEqual(rows.map((row) => row.id), ["plugin", "subagent", "skill", "messages"]);
    assert.deepEqual(rows.map((row) => row.tokens), [210, 160, 70, 40]);
    assert.deepEqual(rows[0]?.sourceIds, ["plugin-mcp"]);
    assert.equal(rows[0]?.estimated, false);
    assert.equal(rows[0]?.itemCount, 1);
  });
});
