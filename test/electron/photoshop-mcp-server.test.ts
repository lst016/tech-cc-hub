import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  handlePhotoshopCheckEnvironment,
  handlePsdGenerateWebManifest,
  handlePsdReadWorkflowGuidance,
  handlePsdValidateWebManifest,
} from "../../src/electron/libs/mcp-tools/photoshop/server.js";
import type { NormalizedPhotoshopLayerTree } from "../../src/electron/libs/mcp-tools/photoshop/types.js";

function readFixture(): NormalizedPhotoshopLayerTree {
  return JSON.parse(readFileSync("test/fixtures/photoshop/web-page-layer-tree.json", "utf8")) as NormalizedPhotoshopLayerTree;
}

test("guidance includes safe editing and future code targets", () => {
  const guidance = handlePsdReadWorkflowGuidance();

  assert.deepEqual(guidance.codeTargets, ["html-css-js", "react-tailwind"]);
  assert.equal(guidance.safeEditing.some((item) => item.includes("dryRun=true")), true);
});

test("manifest handler emits code targets and sections", () => {
  const manifest = handlePsdGenerateWebManifest({
    layerTree: readFixture(),
    filePath: "/workspace/design/home.psd",
  });

  assert.deepEqual(manifest.codeTargets, ["html-css-js", "react-tailwind"]);
  assert.equal(manifest.page.sections.length >= 2, true);
  assert.equal(manifest.assets.length >= 1, true);
});

test("manifest validation flags low-confidence inferred sections", () => {
  const manifest = handlePsdGenerateWebManifest({
    layerTree: readFixture(),
    filePath: "/workspace/design/home.psd",
  });
  const validation = handlePsdValidateWebManifest({ manifest });

  assert.equal(validation.valid, true);
  assert.equal(validation.warnings.some((item) => item.includes("low confidence")), true);
});

test("environment handler returns diagnostics without requiring Photoshop", async () => {
  const result = await handlePhotoshopCheckEnvironment();

  assert.equal(typeof result.photoshop.available, "boolean");
  assert.ok(result.parserFallback.capabilities.length > 0);
});
