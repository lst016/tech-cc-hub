# test/electron/figma-rest-node-index.test.ts

> 模块：`test` · 语言：`typescript` · 行数：81

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `frame@56`
- `text@71`
- `locator@12`
- `rawIndex@46`
- `filtered@48`

## 依赖输入

- `node:assert/strict`
- `node:test`
- `../../src/electron/libs/mcp-tools/figma-locator.js`
- `../../src/electron/libs/mcp-tools/figma-node-index.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import { parseFigmaLocator } from "../../src/electron/libs/mcp-tools/figma-locator.js";
import {
  buildFigmaNodeIndex,
  filterFigmaNodeIndex,
  pickRecommendedNodeIds,
} from "../../src/electron/libs/mcp-tools/figma-node-index.js";

test("parses node-id from Figma URLs without manual node input", () => {
  const locator = parseFigmaLocator("https://www.figma.com/design/PLSsKlccWZojMIHdrIhB66/v1.13.0?node-id=3-17395&m=dev");

  assert.equal(locator.fileKey, "PLSsKlccWZojMIHdrIhB66");
  assert.deepEqual(locator.nodeIds, ["3:17395"]);
});

test("node index searches descendant text and ranks the matching frame before duplicate frame names", () => {
  const roots: Array<Record<string, unknown>> = [
    frame("3:17395", "通知营销", { x: 1967, y: 3490, width: 1440, height: 2047 }, [
      frame("3:17510", "Frame 1152", { x: 24, y: 984, width: 767, height: 696 }, [
        frame("3:17514", "Frame 1149", { x: 12, y: 12, width: 743, height: 120 }, [
          frame("3:17516", "Frame 1149", { x: 40, y: 0, width: 703, height: 120 }, [
            text("3:17519", "title", "快速回复"),
          ]),
        ]),
        frame("3:17524", "Frame 1150", { x: 12, y: 144, width: 743, height: 120 }, [
          frame("3:17526", "Frame 1149", { x: 40, y: 0, width: 703, height: 120 }, [
            text("3:17529", "title", "拨打电话号码"),
          ]),
        ]),
        frame("3:17542", "Frame 1151", { x: 12, y: 276, width: 743, height: 190 }, [
          frame("3:17544", "Frame 1149", { x: 40, y: 0, width: 703, height: 190 }, [
            text("3:17547", "title", "访问网站"),
          ]),
        ]),
        frame("103:12171", "Frame 1152", { x: 12, y: 478, width: 743, height: 120 }, [
          frame("103:12173", "Frame 1149", { x: 40, y: 0, width: 703, height: 120 }, [
            text("103:12176", "title", "复制优惠码"),
            text("103:12181", "title", "优惠码示例"),
          ]),
        ]),
      ]),
    ]),
  ];

  const rawIndex = buildFigmaNodeIndex(roots, 80);
  const filtered = filterFigmaNodeIndex(rawIndex, "复制|copy|优惠|coupon");

  assert.equal(filtered[0].id, "103:12173");
  assert.deepEqual(filtered[0].matchTerms, ["复制", "优惠"]);
  assert.ok(filtered[0].text?.includes("复制优惠码"));
  assert.equal(filtered.some((entry) => entry.id === "3:17526"), false);
  assert.deepEqual(pickRecommendedNodeIds(filtered, ["3:17395"]), ["103:12173"]);
});

function frame(
  id: string,
  name: string,
  absoluteBoundingBox: { x: number; y: number; width: number; height: number },
  children: Array<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    id,
    name,
    type: "FRAME",
    absoluteBoundingBox,
    children,
  };
}

function text(id: string, name: string, characters: string): Record<string, unknown> {
  return {
    id,
    name,
    type: "TEXT",
    characters,
    absoluteBoundingBox: { x: 0, y: 0, width: 56, height: 22 },
  };
}

```
