import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { planPhotoshopAssetExports } from "../../src/electron/libs/mcp-tools/photoshop/export-planner.js";
import type { NormalizedPhotoshopLayerTree } from "../../src/electron/libs/mcp-tools/photoshop/types.js";

function readFixture(): NormalizedPhotoshopLayerTree {
  return JSON.parse(readFileSync("test/fixtures/photoshop/web-page-layer-tree.json", "utf8")) as NormalizedPhotoshopLayerTree;
}

test("plans web assets under the design-assets directory", () => {
  const plan = planPhotoshopAssetExports({
    layerTree: readFixture(),
    psdFilePath: "/workspace/design/home.psd",
  });

  assert.equal(plan.exportRoot, "design-assets/home/exports");
  assert.equal(plan.assets.some((asset) => asset.path.startsWith("design-assets/home/exports/")), true);
  assert.equal(plan.assets.some((asset) => asset.id === "logo"), true);
});

test("uses webp for image backgrounds and png for simple assets", () => {
  const plan = planPhotoshopAssetExports({
    layerTree: readFixture(),
    psdFilePath: "/workspace/design/home.psd",
  });

  const logo = plan.assets.find((asset) => asset.id === "logo");
  const heroBg = plan.assets.find((asset) => asset.id === "background-hero-photo");

  assert.equal(logo?.format, "webp");
  assert.equal(heroBg?.format, "webp");
  assert.deepEqual(heroBg?.scale, [1, 2]);
});
