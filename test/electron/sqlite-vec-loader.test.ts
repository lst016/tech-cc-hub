import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { resolveSqliteVecLoadablePath } from "../../src/electron/libs/knowledge/sqlite-vec-loader.js";

test("sqlite-vec loader uses app.asar.unpacked when sqlite-vec resolves inside app.asar", () => {
  const loadablePath = "C:\\Users\\lushengtao\\AppData\\Local\\Programs\\tech-cc-hub\\resources\\app.asar\\node_modules\\sqlite-vec-windows-x64\\vec0.dll";
  const expectedPath = "C:\\Users\\lushengtao\\AppData\\Local\\Programs\\tech-cc-hub\\resources\\app.asar.unpacked\\node_modules\\sqlite-vec-windows-x64\\vec0.dll";

  const resolvedPath = resolveSqliteVecLoadablePath(loadablePath, {
    pathExists: (path) => path === expectedPath,
  });

  assert.equal(resolvedPath, expectedPath);
});

test("sqlite-vec loader can rebuild the unpacked path from process resources", () => {
  const resourcesPath = "D:\\tool\\tech-cc-hub\\dist\\win-unpacked\\resources";
  const loadablePath = "C:\\snapshot\\tech-cc-hub\\resources\\app.asar\\node_modules\\sqlite-vec-windows-x64\\vec0.dll";
  const expectedPath = join(resourcesPath, "app.asar.unpacked", "node_modules", "sqlite-vec-windows-x64", "vec0.dll");

  const resolvedPath = resolveSqliteVecLoadablePath(loadablePath, {
    resourcesPath,
    pathExists: (path) => path === expectedPath,
  });

  assert.equal(resolvedPath, expectedPath);
});
