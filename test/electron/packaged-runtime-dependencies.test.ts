import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type PackageLike = {
  version?: string;
  dependencies?: Record<string, string>;
  packages?: Record<string, { dependencies?: Record<string, string> }>;
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
