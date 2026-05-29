import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("preview read allows absolute files outside the active workspace without widening tree browsing", () => {
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const viteSource = readFileSync("vite.config.ts", "utf8");

  assert.match(mainSource, /if \(!isAbsolute\(rawPath\) && !isPathInsideRoot\(rootPath, realPath\)\)/);
  assert.match(viteSource, /allowAbsoluteOutsideRoot\?: boolean/);
  assert.match(viteSource, /options\.allowAbsoluteOutsideRoot && isAbsolute\(rawPath\)/);
  assert.match(viteSource, /__tech_preview\/read[\s\S]*allowAbsoluteOutsideRoot: true/);
  assert.doesNotMatch(viteSource, /__tech_preview\/list[\s\S]{0,260}allowAbsoluteOutsideRoot: true/);
});

test("preview pane retries external absolute files from their containing directory", () => {
  const paneSource = readFileSync("src/ui/components/AionWorkspacePreviewPane.tsx", "utf8");

  assert.match(paneSource, /function isAbsolutePreviewPath\(path: string\)/);
  assert.match(paneSource, /async function readPreviewFileWithFallback\(workspace: string, path: string\)/);
  assert.match(paneSource, /window\.electron\.readPreviewFile\(\{ cwd: containingDirectory, path \}\)/);
  assert.match(paneSource, /readPreviewFileWithFallback\(workspace, existing\.path\)/);
  assert.match(paneSource, /readPreviewFileWithFallback\(workspace, path\)/);
});
