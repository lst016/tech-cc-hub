import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildContextUsageBreakdown } from "../../src/ui/utils/context-usage-breakdown.js";
import type { PromptLedgerSegment } from "../../src/shared/prompt-ledger.js";

const segment = (input: Partial<PromptLedgerSegment> & Pick<PromptLedgerSegment, "id" | "label" | "sourceKind" | "tokenEstimate">): PromptLedgerSegment => ({
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
      segment({ id: "system", label: "系统预设", sourceKind: "system", tokenEstimate: 30 }),
      segment({ id: "project", label: "项目 CLAUDE.md", sourceKind: "project", tokenEstimate: 967 }),
      segment({ id: "message", label: "当前输入", sourceKind: "current", tokenEstimate: 120 }),
    ], {
      id: "system",
      label: "系统提示",
      tokens: 997,
      sourceKinds: ["system", "project", "workflow"],
    });

    assert.deepEqual(items.map((item) => item.label), ["项目 CLAUDE.md", "系统预设"]);
  });

  it("returns a fallback item for derived estimates without ledger segments", () => {
    const items = buildContextUsageBreakdown([], {
      id: "tool-definitions",
      label: "工具定义估算",
      tokens: 1_560,
      fallbackDetail: "按已出现工具种类估算。",
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.tokenEstimate, 1_560);
    assert.equal(items[0]?.sample, "按已出现工具种类估算。");
  });
});
