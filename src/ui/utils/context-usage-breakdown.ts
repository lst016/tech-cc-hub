import type { PromptLedgerSegment, PromptLedgerSourceKind } from "../../shared/prompt-ledger.js";

export type ContextUsageBreakdownCategory = {
  id: string;
  label: string;
  tokens: number;
  sourceKinds?: PromptLedgerSourceKind[];
  fallbackDetail?: string;
};

export type ContextUsageBreakdownItem = {
  id: string;
  label: string;
  tokenEstimate: number;
  chars: number;
  sourceKind?: PromptLedgerSourceKind;
  sourcePath?: string;
  sample: string;
};

export function buildContextUsageBreakdown(
  segments: PromptLedgerSegment[],
  category: ContextUsageBreakdownCategory,
): ContextUsageBreakdownItem[] {
  const matchedSegments = category.sourceKinds?.length
    ? segments.filter((segment) => category.sourceKinds?.includes(segment.sourceKind))
    : [];

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
        sample: segment.sample || segment.text || "",
      }));
  }

  if (category.tokens <= 0) return [];

  return [{
    id: `${category.id}-estimate`,
    label: category.label,
    tokenEstimate: category.tokens,
    chars: 0,
    sample: category.fallbackDetail ?? "这是派生估算项，当前 prompt ledger 里没有对应的原始 segment。",
  }];
}
