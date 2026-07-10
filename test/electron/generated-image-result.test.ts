import test from "node:test";
import assert from "node:assert/strict";

import {
  parseGeneratedImageResult,
  buildContinueEditingReference,
} from "../../src/ui/utils/generated-image-result.js";

test("parseGeneratedImageResult parses standard generate success result", () => {
  const raw = JSON.stringify({
    action: "image_generate",
    success: true,
    mode: "generate",
    model: "gpt-image-2",
    profileName: "Gateway",
    artifacts: [{ path: "C:\\img\\a.png", mimeType: "image/png", sizeBytes: 123456 }],
    outputHint: "Generated image saved locally.",
  });

  const result = parseGeneratedImageResult(raw);
  assert.equal(result.isImageGeneration, true);
  if (result.isImageGeneration && result.success) {
    assert.equal(result.mode, "generate");
    assert.equal(result.model, "gpt-image-2");
    assert.equal(result.profileName, "Gateway");
    assert.equal(result.artifacts.length, 1);
    assert.equal(result.artifacts[0]?.path, "C:\\img\\a.png");
    assert.equal(result.artifacts[0]?.mimeType, "image/png");
  }
});

test("parseGeneratedImageResult parses edit result with multiple artifacts", () => {
  const raw = JSON.stringify({
    action: "image_generate",
    success: true,
    mode: "edit",
    artifacts: [
      { path: "/img/a.png" },
      { path: "/img/b.png" },
    ],
  });

  const result = parseGeneratedImageResult(raw);
  assert.equal(result.isImageGeneration, true);
  if (result.isImageGeneration && result.success) {
    assert.equal(result.mode, "edit");
    assert.equal(result.artifacts.length, 2);
    assert.equal(result.artifacts[0]?.path, "/img/a.png");
    assert.equal(result.artifacts[1]?.path, "/img/b.png");
  }
});

test("parseGeneratedImageResult parses error result", () => {
  const raw = JSON.stringify({
    action: "image_generate",
    success: false,
    code: "NOT_CONFIGURED",
    message: "尚未配置生图模型。",
  });

  const result = parseGeneratedImageResult(raw);
  assert.equal(result.isImageGeneration, true);
  if (result.isImageGeneration && !result.success) {
    assert.equal(result.code, "NOT_CONFIGURED");
    assert.match(result.message ?? "", /尚未配置/);
  }
});

test("parseGeneratedImageResult rejects plain tool JSON without image_generate action", () => {
  const raw = JSON.stringify({ success: true, files: ["a.ts"] });
  const result = parseGeneratedImageResult(raw);
  assert.equal(result.isImageGeneration, false);
});

test("parseGeneratedImageResult safely degrades on truncated JSON", () => {
  const raw = '{"action":"image_generate","success":true,"artifacts":[{"path":"C:\\img';
  const result = parseGeneratedImageResult(raw);
  assert.equal(result.isImageGeneration, false);
});

test("parseGeneratedImageResult safely degrades on plain text", () => {
  const result = parseGeneratedImageResult("just some plain text");
  assert.equal(result.isImageGeneration, false);
});

test("parseGeneratedImageResult safely degrades on empty or undefined", () => {
  assert.equal(parseGeneratedImageResult("").isImageGeneration, false);
  assert.equal(parseGeneratedImageResult(undefined).isImageGeneration, false);
  assert.equal(parseGeneratedImageResult(null).isImageGeneration, false);
});

test("parseGeneratedImageResult ignores success result with no artifacts", () => {
  const raw = JSON.stringify({ action: "image_generate", success: true, mode: "generate", artifacts: [] });
  const result = parseGeneratedImageResult(raw);
  assert.equal(result.isImageGeneration, false);
});

test("parseGeneratedImageResult extracts JSON object from surrounding noise", () => {
  const raw = `prefix noise {"action":"image_generate","success":true,"mode":"generate","artifacts":[{"path":"/x.png"}]} trailing`;
  const result = parseGeneratedImageResult(raw);
  assert.equal(result.isImageGeneration, true);
});

test("buildContinueEditingReference writes absolute path reference", () => {
  const ref = buildContinueEditingReference([{ path: "C:\\img\\a.png" }]);
  assert.match(ref, /继续编辑/);
  assert.match(ref, /C:\\img\\a\.png/);
});

test("buildContinueEditingReference returns empty for no artifacts", () => {
  assert.equal(buildContinueEditingReference([]), "");
});
