import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { syncMacCodeGraphRuntime } = require("../../scripts/after-pack-win-icon.cjs");

function createFixture(arch = 3) {
  const root = mkdtempSync(path.join(tmpdir(), "tech-cc-hub-mac-codegraph-"));
  const projectDir = path.join(root, "project");
  const appOutDir = path.join(root, "out");
  const runtimePackageName = arch === 1 ? "codegraph-darwin-x64" : "codegraph-darwin-arm64";
  const sourceDependencies = path.join(
    projectDir,
    "node_modules",
    "@colbymchenry",
    runtimePackageName,
    "lib",
    "node_modules",
  );
  const packagedRuntimeRoot = path.join(
    appOutDir,
    "tech-cc-hub.app",
    "Contents",
    "Resources",
    "app.asar.unpacked",
    "node_modules",
    "@colbymchenry",
    runtimePackageName,
    "lib",
  );

  for (const relativePath of [
    ["web-tree-sitter", "tree-sitter.cjs"],
    ["tree-sitter-wasms", "package.json"],
    ["picomatch", "index.js"],
  ]) {
    const filePath = path.join(sourceDependencies, ...relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `fixture:${relativePath.join("/")}`);
  }
  mkdirSync(path.join(packagedRuntimeRoot, "dist"), { recursive: true });
  writeFileSync(path.join(packagedRuntimeRoot, "dist", "index.js"), '"use strict";\nmodule.exports = true;\n');

  return {
    root,
    sourceDependencies,
    packagedRuntimeRoot,
    context: {
      arch,
      appOutDir,
      packager: {
        projectDir,
        appInfo: { productFilename: "tech-cc-hub" },
      },
    },
  };
}

test("macOS packaging vendors and activates CodeGraph runtime dependencies", () => {
  const fixture = createFixture();
  try {
    syncMacCodeGraphRuntime(fixture.context);
    syncMacCodeGraphRuntime(fixture.context);

    const vendorRoot = path.join(fixture.packagedRuntimeRoot, "vendor-node-modules");
    assert.equal(existsSync(path.join(vendorRoot, "web-tree-sitter", "tree-sitter.cjs")), true);
    assert.equal(existsSync(path.join(vendorRoot, "tree-sitter-wasms", "package.json")), true);
    assert.equal(existsSync(path.join(vendorRoot, "picomatch", "index.js")), true);

    const entrySource = readFileSync(path.join(fixture.packagedRuntimeRoot, "dist", "index.js"), "utf8");
    assert.match(entrySource, /tech-cc-hub-codegraph-vendor-runtime/);
    assert.match(entrySource, /process\.resourcesPath/);
    assert.match(entrySource, /app\.asar\.unpacked/);
    assert.match(entrySource, /codegraph-darwin-arm64/);
    assert.equal(entrySource.match(/tech-cc-hub-codegraph-vendor-runtime/g)?.length, 1);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("macOS packaging selects the x64 CodeGraph runtime", () => {
  const fixture = createFixture(1);
  try {
    syncMacCodeGraphRuntime(fixture.context);
    const entrySource = readFileSync(path.join(fixture.packagedRuntimeRoot, "dist", "index.js"), "utf8");
    assert.match(entrySource, /codegraph-darwin-x64/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("macOS packaging fails when CodeGraph runtime dependencies are absent", () => {
  const fixture = createFixture();
  try {
    rmSync(fixture.sourceDependencies, { recursive: true, force: true });
    assert.throws(
      () => syncMacCodeGraphRuntime(fixture.context),
      /missing bundled runtime dependencies/,
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("macOS packaging rejects unsupported architectures", () => {
  const fixture = createFixture();
  try {
    assert.throws(
      () => syncMacCodeGraphRuntime({ ...fixture.context, arch: 4 }),
      /unsupported macOS architecture/,
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
