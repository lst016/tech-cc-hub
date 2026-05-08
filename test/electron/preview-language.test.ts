import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPreviewMonacoModelPath,
  normalizeMonacoLanguage,
} from "../../src/ui/utils/preview-language.js";

test("normalizes jsx and tsx files to Monaco language ids", () => {
  assert.equal(normalizeMonacoLanguage(undefined, "AdminPhoneController.tsx"), "typescript");
  assert.equal(normalizeMonacoLanguage(undefined, "Widget.jsx"), "javascript");
  assert.equal(normalizeMonacoLanguage("tsx"), "typescript");
  assert.equal(normalizeMonacoLanguage("jsx"), "javascript");
});

test("builds file URI model paths that preserve jsx and tsx extensions", () => {
  assert.equal(
    buildPreviewMonacoModelPath("D:\\workspace\\app\\src\\Widget.tsx"),
    "file:///D:/workspace/app/src/Widget.tsx",
  );
  assert.equal(
    buildPreviewMonacoModelPath("D:\\workspace\\app\\src\\Widget.jsx"),
    "file:///D:/workspace/app/src/Widget.jsx",
  );
});

test("encodes model path characters that would break URI parsing", () => {
  assert.equal(
    buildPreviewMonacoModelPath("D:\\workspace\\my app\\src\\Widget#preview.tsx"),
    "file:///D:/workspace/my%20app/src/Widget%23preview.tsx",
  );
});
