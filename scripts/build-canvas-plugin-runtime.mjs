#!/usr/bin/env node
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = path.join(projectRoot, "plugins", "codex-canvas");
const entryPoint = path.join(pluginRoot, "bin", "codex-canvas.mjs");
const outputFile = path.join(pluginRoot, "dist", "codex-canvas.mjs");

if (!existsSync(entryPoint)) {
  throw new Error(`Canvas plugin entry is missing: ${path.relative(projectRoot, entryPoint)}`);
}

mkdirSync(path.dirname(outputFile), { recursive: true });
await build({
  entryPoints: [entryPoint],
  outfile: outputFile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  legalComments: "none",
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});

if (!existsSync(outputFile) || statSync(outputFile).size <= 0) {
  throw new Error(`Canvas bundled runtime was not produced: ${path.relative(projectRoot, outputFile)}`);
}

console.log(`[canvas-runtime] built ${path.relative(projectRoot, outputFile)}`);
