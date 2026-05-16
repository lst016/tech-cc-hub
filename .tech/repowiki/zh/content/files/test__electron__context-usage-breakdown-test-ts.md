# test/electron/context-usage-breakdown.test.ts

> 模块：`test` · 语言：`typescript` · 行数：46

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `segment@6`
- `items@19`
- `items@34`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/ui/utils/context-usage-breakdown.js`
- `../../src/shared/prompt-ledger.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

```
