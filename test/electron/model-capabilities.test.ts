import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  canMainModelReadImages,
  isLikelyImageUnderstandingModel,
} from "../../src/shared/models/model-capabilities.js";

test("model capability detection identifies image-understanding main models", () => {
  for (const model of ["gpt-4o", "gpt-5.5", "gemini-3.1-pro-preview", "qwen2.5-vl", "glm-4v", "grok-2-vision"]) {
    assert.equal(isLikelyImageUnderstandingModel(model), true, model);
    assert.equal(canMainModelReadImages(model), true, model);
  }
});

test("model capability detection excludes non-vision generators and coder models", () => {
  for (const model of ["text-embedding-3-large", "gpt-image-1", "qwen-coder", "MiniMax-M2.7-highspeed"]) {
    assert.equal(isLikelyImageUnderstandingModel(model), false, model);
    assert.equal(canMainModelReadImages(model), false, model);
  }
});

test("runner routes image Read policy through the selected main model capability", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.match(source, /canMainModelReadImages/);
  assert.match(source, /mainModelName: effectiveModel/);
  assert.match(source, /shouldPreprocessImageRead\(config, filePath, effectiveModel\)/);
  assert.match(source, /shouldPreprocessImageRead\(config, filePath, mainModelName\)/);
});

test("runner keeps preprocessing enabled before direct image fallback", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.match(source, /void mainModelName;\s*[\s\S]*return Boolean\(config\?\.imageModel\?\.trim\(\)\);/);
  assert.match(source, /Image preprocessing failed; the selected main model supports image understanding/);
});
