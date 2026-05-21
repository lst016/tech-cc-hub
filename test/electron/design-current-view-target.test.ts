import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const designToolSource = readFileSync("src/electron/libs/mcp-tools/design.ts", "utf8");

test("design_compare_current_view accepts selector target for element-level diff", () => {
  const compareToolStart = designToolSource.indexOf('"design_compare_current_view"');
  const compareToolEnd = designToolSource.indexOf('const compareElementTool = tool(', compareToolStart);
  const compareToolSource = designToolSource.slice(compareToolStart, compareToolEnd);

  assert.match(compareToolSource, /target:\s*z\.string\(\)\.trim\(\)\.min\(1\)\.optional\(\)/);
  assert.match(compareToolSource, /captureCurrentElement\(resolvedSessionId/);
  assert.match(compareToolSource, /target selector took precedence/);
  assert.match(compareToolSource, /For component-level parity, rerun with target/);
});

test("design_inspect_image retries with a non-strict summary when strict JSON returns empty", () => {
  const inspectToolStart = designToolSource.indexOf('"design_inspect_image"');
  const inspectToolEnd = designToolSource.indexOf('const compareTool = tool(', inspectToolStart);
  const inspectToolSource = designToolSource.slice(inspectToolStart, inspectToolEnd);

  assert.match(inspectToolSource, /usedNonStrictFallback/);
  assert.match(inspectToolSource, /strictPrompt:\s*false/);
  assert.match(inspectToolSource, /!inspectionText\?\.trim\(\)/);
});

test("codex image preprocessing sends responses instructions", () => {
  const source = readFileSync("src/electron/libs/image-preprocessor.ts", "utf8");
  const codexStart = source.indexOf("async function summarizeImageBase64WithCodexResponses");
  const codexSource = source.slice(codexStart, source.indexOf("summarizeImageBase64WithAnthropicMessages", codexStart));

  assert.match(codexSource, /instructions:/);
  assert.match(codexSource, /precise visual inspection assistant/);
});
