# test/electron/figma-ui-node-matcher.test.ts

> 模块：`test` · 语言：`typescript` · 行数：64

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `node@52`
- `result@13`
- `result@37`

## 依赖输入

- `node:assert/strict`
- `node:test`
- `../../src/electron/libs/mcp-tools/figma-ui-node-matcher.js`
- `../../src/electron/libs/mcp-tools/figma-node-index.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import { matchUiNodesToFigmaNodes } from "../../src/electron/libs/mcp-tools/figma-ui-node-matcher.js";
import type { FigmaNodeIndexEntry } from "../../src/electron/libs/mcp-tools/figma-node-index.js";

test("maps rendered UI nodes to Figma nodes with text and role hints", () => {
  const figmaNodes: FigmaNodeIndexEntry[] = [
    node("3:17526", "Frame 1149", "拨打电话号码 区号 电话号码", { x: 2299, y: 4784, width: 703, height: 120 }),
    node("3:17544", "Frame 1149", "访问网站 URL 类型 网站网址", { x: 2299, y: 4916, width: 703, height: 190 }),
    node("103:12173", "Frame 1149", "复制优惠码 优惠码示例", { x: 2299, y: 5118, width: 703, height: 120 }),
  ];

  const result = matchUiNodesToFigmaNodes([
    {
      tagName: "button",
      role: "button",
      text: "复制优惠码",
      selector: "button.copy-code",
      boundingBox: { x: 92, y: 520, width: 679, height: 32 },
      componentStack: ["ButtonEditor", "CopyCodeButton"],
    },
  ], figmaNodes);

  assert.equal(result.mappings[0].confidence, "high");
  assert.equal(result.mappings[0].matches[0].nodeId, "103:12173");
  assert.ok(result.mappings[0].matches[0].reasons.includes("text-substring"));
  assert.equal(result.stats.highConfidence, 1);
});

test("uses geometry when UI and Figma text are generic", () => {
  const figmaNodes: FigmaNodeIndexEntry[] = [
    node("root", "通知营销", undefined, { x: 1967, y: 3490, width: 1440, height: 2047 }),
    node("left-card", "Frame 1149", "标题", { x: 1991, y: 4000, width: 300, height: 80 }),
    node("target-input", "input 输入框", undefined, { x: 2059, y: 4474, width: 679, height: 32 }),
  ];

  const result = matchUiNodesToFigmaNodes([
    {
      tagName: "input",
      selector: "input[name='couponCode']",
      boundingBox: { x: 92, y: 984, width: 679, height: 32 },
    },
  ], figmaNodes, {
    uiViewport: { x: 0, y: 0, width: 1440, height: 2047 },
    figmaRootBounds: figmaNodes[0].bounds,
  });

  assert.equal(result.mappings[0].matches[0].nodeId, "target-input");
  assert.ok(result.mappings[0].matches[0].reasons.includes("geometry"));
});

function node(id: string, name: string, text: string | undefined, bounds: NonNullable<FigmaNodeIndexEntry["bounds"]>): FigmaNodeIndexEntry {
  return {
    id,
    name,
    type: "FRAME",
    path: `通知营销 / ${name}`,
    text,
    bounds,
    childCount: 1,
  };
}

```
