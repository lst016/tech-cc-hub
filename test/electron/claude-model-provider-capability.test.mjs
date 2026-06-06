// test/electron/claude-model-provider-capability.test.mjs
// Phase 8 of the Claude Code 2.1.161 compatibility workflow.

import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const mod = await import(pathToFileURL("dist-electron/electron/libs/compat-model-provider-capability.js").href);

test("resolveProviderIdForModel: prefixes map to providers", () => {
  assert.equal(mod.resolveProviderIdForModel("claude-opus-4-8"), "anthropic");
  assert.equal(mod.resolveProviderIdForModel("deepseek-coder"), "deepseek");
  assert.equal(mod.resolveProviderIdForModel("gpt-5"), "codex");
  assert.equal(mod.resolveProviderIdForModel("o3-mini"), "codex");
  assert.equal(mod.resolveProviderIdForModel("minimax-m1"), "minimax");
  assert.equal(mod.resolveProviderIdForModel(""), null);
  assert.equal(mod.resolveProviderIdForModel("random-model"), null);
});

test("resolveModelAlias: applies provider-specific alias map", () => {
  assert.equal(mod.resolveModelAlias("anthropic", "claude-opus-4-6[1m]"), "claude-opus-4-6-fast");
  assert.equal(mod.resolveModelAlias("anthropic", "claude-opus-4-8"), "claude-opus-4-8");
  // unknown provider returns the model unchanged
  assert.equal(mod.resolveModelAlias("unknown", "foo"), "foo");
});

test("validateModelEffortProvider: anthropic + xhigh is allowed", () => {
  const out = mod.validateModelEffortProvider("claude-opus-4-8", "xhigh", "anthropic");
  assert.equal(out.ok, true);
});

test("validateModelEffortProvider: deepseek + xhigh is rejected with unsupported-xhigh", () => {
  const out = mod.validateModelEffortProvider("deepseek-coder", "xhigh", "deepseek");
  assert.equal(out.ok, false);
  assert.equal(out.code, "unsupported-effort");
  assert.match(out.reason, /does not support effort/);
});

test("validateModelEffortProvider: codex + low is rejected (out of supported set)", () => {
  const out = mod.validateModelEffortProvider("gpt-5", "low", "codex");
  assert.equal(out.ok, false);
  assert.equal(out.code, "unsupported-effort");
});

test("validateModelEffortProvider: unknown provider => unknown-provider", () => {
  const out = mod.validateModelEffortProvider("claude-opus-4-8", "high", "fictional");
  assert.equal(out.ok, false);
  assert.equal(out.code, "unknown-provider");
});

test("validateModelEffortProvider: auto mode on non-auto provider => unsupported-auto", () => {
  const out = mod.validateModelEffortProvider("gpt-5", "high", "codex", true);
  assert.equal(out.ok, false);
  assert.equal(out.code, "unsupported-auto");
});

test("validateModelEffortProvider: empty model => unknown-model", () => {
  const out = mod.validateModelEffortProvider("", "high", "anthropic");
  assert.equal(out.ok, false);
  assert.equal(out.code, "unknown-model");
});

test("downgradeUnsupportedEffort: returns equivalent when supported", () => {
  assert.equal(mod.downgradeUnsupportedEffort("anthropic", "xhigh"), "xhigh");
  assert.equal(mod.downgradeUnsupportedEffort("codex", "xhigh"), "high");
  assert.equal(mod.downgradeUnsupportedEffort("codex", "low"), "medium");
});

test("downgradeUnsupportedEffort: returns null when provider doesn't support effort at all", () => {
  assert.equal(mod.downgradeUnsupportedEffort("deepseek", "high"), null);
  assert.equal(mod.downgradeUnsupportedEffort("custom", "low"), null);
});

test("downgradeUnsupportedEffort: unknown provider returns null", () => {
  assert.equal(mod.downgradeUnsupportedEffort("unknown", "high"), null);
});
