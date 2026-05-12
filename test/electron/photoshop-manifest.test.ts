import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyPhotoshopWebManifest,
  validatePhotoshopWebManifest,
} from "../../src/electron/libs/mcp-tools/photoshop/manifest.js";

test("validates a page-structure photoshop web manifest", () => {
  const manifest = createEmptyPhotoshopWebManifest({
    filePath: "/workspace/design/home.psd",
    pageName: "Home",
    width: 1440,
    height: 3200,
    platform: "macos",
    automationChannel: "parser",
    fallbackUsed: true,
    createdAt: "2026-05-12T10:20:00.000Z",
  });
  manifest.page.sections.push({
    id: "hero",
    name: "Hero",
    bounds: { x: 0, y: 0, width: 1440, height: 720 },
    confidence: 0.8,
    source: ["layer-name"],
    needsReview: false,
    components: [],
  });

  const result = validatePhotoshopWebManifest(manifest);
  assert.equal(result.success, true);
});

test("requires confidence, source, and needsReview on inferred sections", () => {
  const manifest = createEmptyPhotoshopWebManifest({
    filePath: "/workspace/design/home.psd",
    pageName: "Home",
    width: 1440,
    height: 3200,
  });
  manifest.page.sections.push({
    id: "hero",
    name: "Hero",
    bounds: { x: 0, y: 0, width: 1440, height: 720 },
    components: [],
  } as never);

  const result = validatePhotoshopWebManifest(manifest);
  assert.equal(result.success, false);
});
