import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  handlePsdGenerateProjectManifest,
  handlePsdGenerateWebManifest,
  handlePsdPlanVisualRepairLoop,
} from "../../src/electron/libs/mcp-tools/photoshop/server.js";
import type { NormalizedPhotoshopLayerTree } from "../../src/electron/libs/mcp-tools/photoshop/types.js";

function buildManifest(pageName = "Home") {
  const layerTree = JSON.parse(readFileSync("test/fixtures/photoshop/web-page-layer-tree.json", "utf8")) as NormalizedPhotoshopLayerTree;
  layerTree.document.name = pageName;
  return handlePsdGenerateWebManifest({
    layerTree,
    filePath: `/workspace/design/${pageName.toLowerCase()}.psd`,
  });
}

test("plans a visual repair loop using photoshop, browser, and design tools", () => {
  const plan = handlePsdPlanVisualRepairLoop({
    manifest: buildManifest(),
    referenceImagePath: "/workspace/design/home-preview.png",
    candidateUrl: "http://localhost:4173",
  });

  assert.equal(plan.manifestSummary.sectionCount > 0, true);
  assert.deepEqual(plan.steps.map((step) => step.tool), [
    "mcp__tech-cc-hub-photoshop__photoshop_export_document_preview",
    "mcp__tech-cc-hub-browser__browser_open_page",
    "mcp__tech-cc-hub-design__design_compare_current_view",
    "mcp__tech-cc-hub-design__design_read_comparison_report",
  ]);
});

test("aggregates multiple page manifests into a project manifest", () => {
  const project = handlePsdGenerateProjectManifest({
    manifests: [buildManifest("Home"), buildManifest("Pricing")],
  });

  assert.equal(project.pages.length, 2);
  assert.deepEqual(project.codeTargets, ["html-css-js", "react-tailwind"]);
  assert.equal(project.sharedAssets.length > 0, true);
});
