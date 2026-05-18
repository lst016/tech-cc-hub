import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Claude Code receives an explicit model option for custom gateways", () => {
  const claudeSettingsSource = readFileSync("src/electron/libs/claude-settings.ts", "utf8");
  const runnerSource = readFileSync("src/electron/libs/runner.ts", "utf8");
  const functionMatch = claudeSettingsSource.match(
    /export function getClaudeCodeModelOption\([\s\S]*?\r?\n}\r?\n\r?\nexport function normalizeAnthropicBaseUrlForClaudeCode/,
  );

  assert.ok(functionMatch, "getClaudeCodeModelOption function should be present");

  const functionSource = functionMatch[0];
  assert.match(functionSource, /return normalizedModel;/);
  assert.match(functionSource, /void config;/);
  assert.doesNotMatch(functionSource, /new URL\(config\.baseURL\)/);
  assert.doesNotMatch(functionSource, /api\.anthropic\.com/);
  assert.match(runnerSource, /const sdkModelOption = getClaudeCodeModelOption\(config, effectiveModel\);/);
  assert.match(runnerSource, /model: sdkModelOption,/);
});
