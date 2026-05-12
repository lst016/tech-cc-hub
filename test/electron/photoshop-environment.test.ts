import assert from "node:assert/strict";
import test from "node:test";

import { checkPhotoshopEnvironment } from "../../src/electron/libs/mcp-tools/photoshop/environment.js";

test("reports parser fallback when Photoshop is unavailable", async () => {
  const result = await checkPhotoshopEnvironment({
    platform: "darwin",
    findPhotoshop: async () => null,
    canUseParserFallback: async () => true,
  });

  assert.equal(result.platform, "macos");
  assert.equal(result.photoshop.available, false);
  assert.equal(result.parserFallback.available, true);
  assert.equal(result.capabilityMatrix.listLayers, "fallback");
  assert.equal(result.recommendedMode, "parser");
});

test("reports Windows Photoshop automation when available", async () => {
  const result = await checkPhotoshopEnvironment({
    platform: "win32",
    findPhotoshop: async () => ({ running: true, version: "25.0", executablePath: "C:\\Program Files\\Adobe\\Photoshop.exe", channel: "com" }),
    canUseParserFallback: async () => true,
  });

  assert.equal(result.platform, "windows");
  assert.equal(result.photoshop.available, true);
  assert.equal(result.photoshop.automationChannel, "com");
  assert.equal(result.capabilityMatrix.exportLayer, "available");
  assert.equal(result.recommendedMode, "photoshop");
});
