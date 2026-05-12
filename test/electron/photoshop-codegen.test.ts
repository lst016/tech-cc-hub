import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { generateNativeWebProject, generateReactTailwindProject } from "../../src/electron/libs/mcp-tools/photoshop/codegen.js";
import { handlePsdGenerateWebManifest } from "../../src/electron/libs/mcp-tools/photoshop/server.js";
import type { NormalizedPhotoshopLayerTree } from "../../src/electron/libs/mcp-tools/photoshop/types.js";

function buildManifest() {
  const layerTree = JSON.parse(readFileSync("test/fixtures/photoshop/web-page-layer-tree.json", "utf8")) as NormalizedPhotoshopLayerTree;
  return handlePsdGenerateWebManifest({
    layerTree,
    filePath: "/workspace/design/home.psd",
  });
}

test("generates native HTML CSS JS draft files from a Photoshop manifest", () => {
  const result = generateNativeWebProject(buildManifest());

  assert.equal(result.target, "html-css-js");
  assert.deepEqual(result.files.map((file) => file.path), ["index.html", "styles.css", "main.js", "photoshop-manifest.json"]);
  assert.match(result.files.find((file) => file.path === "index.html")?.content ?? "", /<main class="page">/);
  assert.match(result.files.find((file) => file.path === "styles.css")?.content ?? "", /--page-max-width/);
});

test("generates React Tailwind draft files from a Photoshop manifest", () => {
  const result = generateReactTailwindProject(buildManifest());

  assert.equal(result.target, "react-tailwind");
  assert.equal(result.files.some((file) => file.path === "PhotoshopGeneratedPage.tsx"), true);
  assert.match(result.files.find((file) => file.path === "PhotoshopGeneratedPage.tsx")?.content ?? "", /export default function PhotoshopGeneratedPage/);
});
