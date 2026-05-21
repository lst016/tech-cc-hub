import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("node index recommendations avoid zero-sized nodes for visual restoration exports", () => {
  const roots: Array<Record<string, unknown>> = [
    frame("1:root", "User detail drawer", { x: 0, y: 0, width: 480, height: 720 }, [
      frame("1:zero", "User account info", { x: 0, y: 0, width: 0, height: 0 }, [
        text("1:zero-title", "title", "User account info"),
      ]),
      frame("1:panel", "User account info panel", { x: 24, y: 24, width: 432, height: 640 }, [
        text("1:panel-title", "title", "User account info"),
      ]),
    ]),
  ];

  const filtered = filterFigmaNodeIndex(buildFigmaNodeIndex(roots, 20), "User account info");

  assert.equal(filtered[0].id, "1:panel");
  assert.equal(filtered.find((entry) => entry.id === "1:zero")?.exportable, false);
  assert.deepEqual(pickRecommendedNodeIds(filtered, ["1:root"]), ["1:panel"]);
});

test("node index marks positive-size entries as exportable", () => {
  const [entry] = buildFigmaNodeIndex([
    frame("1:panel", "Panel", { x: 0, y: 0, width: 320, height: 160 }, []),
  ], 10);

  assert.equal(entry.exportable, true);
});

test("Figma export tool advertises a visual reference lock for implementation", () => {
  const source = readFileSync("src/electron/libs/mcp-tools/figma-rest.ts", "utf8");

  assert.match(source, /visualReferenceLock/);
  assert.match(source, /pending visualReferenceLock/);
  assert.match(source, /maxDifferenceRatio:\s*0\.10/);
});

test("Figma node index returns the component development workflow for large designs", () => {
  const source = readFileSync("src/electron/libs/mcp-tools/figma-rest.ts", "utf8");

  assert.match(source, /FIGMA_COMPONENT_DEVELOPMENT_WORKFLOW_STEPS/);
  assert.match(source, /componentDevelopmentWorkflow/);
  assert.match(source, /exportable=true/);
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
