import test from "node:test";
import assert from "node:assert/strict";

import { resolveAppAssetPath } from "./pathResolverCore.js";

test("resolveAppAssetPath keeps production assets inside the app root", () => {
  const resolved = resolveAppAssetPath("D:\\tool\\tech-cc-hub", "dist-electron/electron/preload.cjs");

  assert.equal(resolved, "D:\\tool\\tech-cc-hub\\dist-electron\\electron\\preload.cjs");
});
