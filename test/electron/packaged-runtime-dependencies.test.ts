import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type PackageLike = {
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  packages?: Record<string, { dependencies?: Record<string, string> }>;
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

test("Canvas plugin runtime is copied outside app.asar with its own locked dependencies", () => {
  const packageJson = readJson("package.json");
  const builderConfig = readJson("electron-builder.json") as BuilderConfigLike;
  const packageWinSafe = readFileSync("scripts/package-win-safe.mjs", "utf8");
  const canvasResource = builderConfig.extraResources?.find((resource) => (
    typeof resource !== "string" && resource.from === "plugins/codex-canvas" && resource.to === "plugins/codex-canvas"
  ));

  assert.equal(packageJson.scripts?.["prepare:workspace-plugins"], "npm --prefix plugins/codex-canvas ci --ignore-scripts");
  assert.ok(canvasResource);
  assert.ok(typeof canvasResource !== "string" && canvasResource.filter?.includes("node_modules/**/*"));
  assert.match(packageWinSafe, /npm", \["run", "prepare:workspace-plugins"\]/);
});
