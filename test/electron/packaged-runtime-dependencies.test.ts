import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

type PackageLike = {
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>;
};

type BuilderConfigLike = {
  files?: string[];
  extraResources?: Array<string | { from?: string; to?: string; filter?: string[] }>;
  asarUnpack?: string[];
};

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as PackageLike;
}

test("main-process MCP SDK import is declared as a packaged runtime dependency", () => {
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const mainSource = readFileSync("src/electron/main.ts", "utf8");

  assert.match(mainSource, /@modelcontextprotocol\/sdk\/client\/index\.js/);
  assert.equal(packageJson.dependencies?.["@modelcontextprotocol/sdk"], "^1.29.0");
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages?.[""]?.dependencies?.["@modelcontextprotocol/sdk"], packageJson.dependencies?.["@modelcontextprotocol/sdk"]);
});

test("better-sqlite3 is explicitly included and unpacked for packaged startup", () => {
  const packageJson = readJson("package.json");
  const builderConfig = readJson("electron-builder.json") as BuilderConfigLike;

  assert.ok(packageJson.dependencies?.["better-sqlite3"]);
  assert.ok(builderConfig.files?.includes("node_modules/better-sqlite3/**/*"));
  assert.ok(builderConfig.asarUnpack?.includes("node_modules/better-sqlite3/**/*"));
});

test("official Codex login runtime is pinned and unpacked with the desktop app", () => {
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const builderConfig = readJson("electron-builder.json") as BuilderConfigLike;
  const packageWinSafe = readFileSync("scripts/package-win-safe.mjs", "utf8");

  assert.equal(packageJson.dependencies?.["@openai/codex"], "0.144.3");
  assert.equal(packageLock.packages?.[""]?.dependencies?.["@openai/codex"], "0.144.3");
  assert.equal(packageLock.packages?.["node_modules/@openai/codex-darwin-arm64"]?.version, "0.144.3-darwin-arm64");
  assert.equal(packageLock.packages?.["node_modules/@openai/codex-darwin-x64"]?.version, "0.144.3-darwin-x64");
  assert.ok(builderConfig.files?.includes("node_modules/@openai/codex/**/*"));
  assert.ok(builderConfig.files?.includes("node_modules/@openai/codex-*/**/*"));
  assert.ok(builderConfig.asarUnpack?.includes("node_modules/@openai/codex/**/*"));
  assert.ok(builderConfig.asarUnpack?.includes("node_modules/@openai/codex-*/**/*"));
  assert.match(packageWinSafe, /validatePackagedCodexLoginRuntime/);
  assert.match(packageWinSafe, /"codex",\s*\n\s*"node_modules",\s*\n\s*"@openai",\s*\n\s*"codex"/);
  assert.match(packageWinSafe, /Codex bundled login runtime/);
});

test("Windows releases reject packaged startup package-resolution failures", () => {
  const packagedSmoke = readFileSync("scripts/qa/packaged-smoke.cjs", "utf8");
  const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");

  assert.match(packagedSmoke, /Cannot find \(\?:module\|package\)/);
  assert.match(packagedSmoke, /maxRetries:/);
  assert.match(packagedSmoke, /retryDelay:/);
  assert.match(packagedSmoke, /bestEffort/);
  assert.match(releaseWorkflow, /npm run qa:packaged/);
});

test("tag releases publish the matching checked-in release notes", () => {
  const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");

  assert.match(releaseWorkflow, /body_path: doc\/90-releases\/\$\{\{ github\.ref_name \}\}\.md/);
});

test("CodeGraph bundled runtime dependencies are kept in Windows packages", () => {
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const builderConfig = readJson("electron-builder.json") as BuilderConfigLike;
  const packageWinSafe = readFileSync("scripts/package-win-safe.mjs", "utf8");
  const managedCodeGraph = readFileSync("src/electron/libs/codegraph/managed-codegraph.ts", "utf8");
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const packagedSmoke = readFileSync("scripts/qa/packaged-smoke.cjs", "utf8");

  assert.equal(packageJson.dependencies?.["@colbymchenry/codegraph"], "1.2.0");
  assert.equal(packageLock.packages?.[""]?.dependencies?.["@colbymchenry/codegraph"], packageJson.dependencies?.["@colbymchenry/codegraph"]);
  assert.equal(packageJson.scripts?.["qa:packaged"], "node scripts/qa/packaged-smoke.cjs");
  assert.ok(builderConfig.files?.includes("node_modules/@colbymchenry/codegraph/**/*"));
  assert.ok(builderConfig.files?.includes("node_modules/@colbymchenry/codegraph-*/**/*"));
  assert.ok(builderConfig.asarUnpack?.includes("node_modules/@colbymchenry/codegraph/**/*"));
  assert.ok(builderConfig.asarUnpack?.includes("node_modules/@colbymchenry/codegraph-*/**/*"));
  assert.match(packageWinSafe, /validatePackagedCodeGraphRuntime/);
  assert.match(packageWinSafe, /syncPackagedCodeGraphRuntimeDeps/);
  assert.match(packageWinSafe, /cpSync/);
  assert.match(packageWinSafe, /web-tree-sitter/);
  assert.match(packageWinSafe, /tree-sitter-wasms/);
  assert.match(managedCodeGraph, /getManagedCodeGraphRuntimeInfo/);
  assert.match(managedCodeGraph, /resolvePackagedUnpackedCodeGraphRuntime/);
  assert.match(managedCodeGraph, /app\.asar\.unpacked/);
  assert.match(managedCodeGraph, /web-tree-sitter/);
  assert.match(mainSource, /TECH_CC_HUB_USER_DATA_DIR/);
  assert.match(mainSource, /\[startup\] environment/);
  assert.match(packagedSmoke, /PACKAGED_SMOKE_OK/);
  assert.match(packagedSmoke, /TECH_CC_HUB_USER_DATA_DIR/);
  assert.match(packagedSmoke, /Cannot find module/);
});

test("CodeGraph bundled runtime dependencies are repaired during macOS packaging", () => {
  const afterPack = readFileSync("scripts/after-pack-win-icon.cjs", "utf8");

  assert.match(afterPack, /syncMacCodeGraphRuntime/);
  assert.match(afterPack, /vendor-node-modules/);
  assert.match(afterPack, /process\.resourcesPath/);
  assert.match(afterPack, /app\.asar\.unpacked/);
  assert.match(afterPack, /web-tree-sitter/);
  assert.match(afterPack, /tree-sitter-wasms/);
  assert.match(afterPack, /picomatch/);
});

test("Canvas plugin runtime is bundled by the host project without private node_modules", () => {
  const packageJson = readJson("package.json");
  const builderConfig = readJson("electron-builder.json") as BuilderConfigLike;
  const packageWinSafe = readFileSync("scripts/package-win-safe.mjs", "utf8");
  const canvasManifest = readJson("plugins/codex-canvas/tech-cc-hub.plugin.json") as {
    start?: { args?: string[] };
  };
  const canvasResource = builderConfig.extraResources?.find((resource) => (
    typeof resource !== "string" && resource.from === "plugins/codex-canvas" && resource.to === "plugins/codex-canvas"
  ));
  const canvasDependenciesResource = builderConfig.extraResources?.find((resource) => (
    typeof resource !== "string"
    && resource.from === "plugins/codex-canvas/node_modules"
    && resource.to === "plugins/codex-canvas/node_modules"
  ));

  assert.equal(
    packageJson.scripts?.["prepare:workspace-plugins"],
    "node scripts/build-canvas-plugin-runtime.mjs",
  );
  assert.equal(packageJson.devDependencies?.["ag-psd"], "^31.0.0");
  assert.equal(packageJson.devDependencies?.["cross-spawn"], "^7.0.6");
  assert.equal(packageJson.devDependencies?.pngjs, "^7.0.0");
  assert.ok(canvasResource);
  assert.equal(canvasDependenciesResource, undefined);
  assert.ok(canvasManifest.start?.args?.includes("dist/codex-canvas.mjs"));
  assert.ok(existsSync("scripts/build-canvas-plugin-runtime.mjs"));
  assert.match(packageWinSafe, /npm", \["run", "prepare:workspace-plugins"\]/);
  assert.match(packageWinSafe, /validatePackagedCanvasRuntime/);
});
