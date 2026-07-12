import test from "node:test";
import assert from "node:assert/strict";

import { resolveStructuredOutputIntent } from "../../src/shared/structured-output.js";

test("explicit runtime output format overrides prompt inference", () => {
  assert.equal(resolveStructuredOutputIntent("json", "普通回复即可"), "explicit");
  assert.equal(resolveStructuredOutputIntent("none", "请用 JSON 输出"), "none");
});

test("current user prompt can explicitly request structured output", () => {
  assert.equal(resolveStructuredOutputIntent(undefined, "请用 JSON 格式返回结果"), "prompt");
  assert.equal(resolveStructuredOutputIntent(undefined, "请按 JSON Schema 输出"), "prompt");
  assert.equal(resolveStructuredOutputIntent(undefined, "Return the response as JSON"), "prompt");
  assert.equal(resolveStructuredOutputIntent(undefined, "Respond with JSON"), "prompt");
  assert.equal(resolveStructuredOutputIntent(undefined, "Output JSON"), "prompt");
  assert.equal(resolveStructuredOutputIntent(undefined, "Use structured output for this response"), "prompt");
});

test("historical tool names and changelog identifiers do not imply structured output", () => {
  assert.equal(resolveStructuredOutputIntent(undefined, "StructuredOutput: {\"steps\": []}"), "none");
  assert.equal(resolveStructuredOutputIntent(undefined, "terminal_reason=structured_output_retry_exhausted"), "none");
  assert.equal(resolveStructuredOutputIntent(undefined, "分析新增的 JSON schema 支持"), "none");
});
