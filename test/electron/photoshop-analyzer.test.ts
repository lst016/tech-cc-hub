import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { analyzeWebPsdLayerTree } from "../../src/electron/libs/mcp-tools/photoshop/analyzer.js";
import type { NormalizedPhotoshopLayerTree } from "../../src/electron/libs/mcp-tools/photoshop/types.js";

function readFixture(): NormalizedPhotoshopLayerTree {
  return JSON.parse(readFileSync("test/fixtures/photoshop/web-page-layer-tree.json", "utf8")) as NormalizedPhotoshopLayerTree;
}

test("analyzes webpage PSD sections from naming and geometry", () => {
  const result = analyzeWebPsdLayerTree(readFixture());

  assert.deepEqual(result.page.sections.map((section) => section.id), ["header", "hero", "content-block"]);
  assert.equal(result.page.sections[0]?.confidence, 0.86);
  assert.equal(result.page.sections[2]?.needsReview, true);
  assert.deepEqual(result.page.sections[2]?.source, ["geometry"]);
});

test("extracts component candidates with confidence metadata", () => {
  const result = analyzeWebPsdLayerTree(readFixture());
  const hero = result.page.sections.find((section) => section.id === "hero");

  assert.ok(hero);
  assert.equal(hero.components.some((component) => component.type === "button"), true);
  assert.equal(hero.components.every((component) => component.confidence > 0), true);
  assert.equal(hero.components.every((component) => component.source.length > 0), true);
});
