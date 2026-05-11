import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFigmaDesignAudit,
  buildFigmaDesignPlaybook,
  type FigmaDesignSummaryForAudit,
} from "../../src/electron/libs/mcp-tools/figma-design-intelligence.js";

test("figma design playbook recommends enterprise systems for admin work", () => {
  const playbook = buildFigmaDesignPlaybook({
    domain: "admin",
    includeSources: true,
    maxItems: 4,
  }) as {
    recommendedStack: string[];
    designSystems: Array<{ id: string; source?: string }>;
    sourceNotes?: string[];
  };

  assert.ok(playbook.recommendedStack.includes("Carbon"));
  assert.ok(playbook.designSystems.some((system) => system.id === "carbon"));
  assert.ok(playbook.designSystems.some((system) => system.id === "ant-design"));
  assert.ok(playbook.designSystems.every((system) => typeof system.source === "string"));
  assert.ok(playbook.sourceNotes?.some((note) => note.includes("designsystems.com")));
});

test("figma design audit flags small actions and token sprawl", () => {
  const summary: FigmaDesignSummaryForAudit = {
    nodes: [
      {
        id: "1:1",
        name: "Admin table screen",
        type: "FRAME",
        children: [
          {
            id: "1:2",
            name: "delete icon button",
            type: "FRAME",
            bounds: { width: 24, height: 24 },
          },
          {
            id: "1:3",
            name: "caption",
            type: "TEXT",
            text: { fontSize: 10 },
          },
          {
            id: "1:4",
            name: "filter bar",
            type: "FRAME",
            children: Array.from({ length: 11 }, (_, index) => ({
              id: `1:${index + 10}`,
              name: `filter option ${index + 1}`,
              type: "FRAME",
            })),
          },
        ],
      },
    ],
    tokens: {
      colors: Array.from({ length: 16 }, (_, index) => ({ value: `#0000${index.toString(16).padStart(2, "0")}`, count: 1, usages: [] })),
      typography: Array.from({ length: 11 }, (_, index) => ({ value: `Inter ${index + 10}px`, count: 1, usages: [] })),
      radii: [{ value: 4, count: 3, usages: [] }],
      spacing: [{ value: 8, count: 5, usages: [] }],
      effects: [],
    },
    stats: { visited: 20, emitted: 20, truncated: false },
    warnings: [],
  };

  const audit = buildFigmaDesignAudit(summary, {
    domain: "admin",
    frameworks: ["practical", "laws-of-ux", "token-system"],
  }) as {
    domain: string;
    score: number;
    findings: Array<{ id: string; severity: string }>;
    suggestedDesignSystems: Array<{ id: string }>;
  };

  assert.equal(audit.domain, "admin");
  assert.ok(audit.score < 100);
  assert.ok(audit.findings.some((finding) => finding.id === "small-action-targets" && finding.severity === "high"));
  assert.ok(audit.findings.some((finding) => finding.id === "token-sprawl"));
  assert.ok(audit.findings.some((finding) => finding.id === "too-many-visible-choices"));
  assert.ok(audit.suggestedDesignSystems.some((system) => system.id === "carbon"));
});
