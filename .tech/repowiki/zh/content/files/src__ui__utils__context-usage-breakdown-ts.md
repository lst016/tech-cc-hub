# src/ui/utils/context-usage-breakdown.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：54

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildContextUsageBreakdown@20`
- `matchedSegments@25`
- `ContextUsageBreakdownCategory@2`
- `ContextUsageBreakdownItem@10`

## 依赖输入

- `../../shared/prompt-ledger.js`

## 对外暴露

- `ContextUsageBreakdownCategory`
- `ContextUsageBreakdownItem`
- `buildContextUsageBreakdown`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

```
