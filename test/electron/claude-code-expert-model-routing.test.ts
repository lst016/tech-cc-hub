import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Claude Code Opus and expert routes map to the configured expert model", () => {
  const claudeSettingsSource = readFileSync("src/electron/libs/claude-settings.ts", "utf8");
  const runnerSource = readFileSync("src/electron/libs/runner.ts", "utf8");
  const utilSource = readFileSync("src/electron/libs/util.ts", "utf8");
  const commitMessageSource = readFileSync("src/electron/libs/git/commit-message.ts", "utf8");

  assert.match(claudeSettingsSource, /const expertModel = normalizeExpertModelForApiConfig/);
  assert.match(claudeSettingsSource, /ANTHROPIC_DEFAULT_OPUS_MODEL: expertModel/);
  assert.match(claudeSettingsSource, /ANTHROPIC_REASONING_MODEL: expertModel/);
  assert.match(claudeSettingsSource, /pickProviderOwnedModelForApiConfig/);
  assert.match(claudeSettingsSource, /const routedOwner = getApiConfigForModel\(pickedModel\)/);
  assert.match(claudeSettingsSource, /CLAUDE_CODE_OPUS_MODEL_OVERRIDE_KEYS/);
  assert.match(claudeSettingsSource, /"opus"/);
  assert.match(claudeSettingsSource, /"claude-opus-4-6"/);
  assert.match(claudeSettingsSource, /modelOverrides: buildClaudeCodeOpusModelOverrides\(expertModel\)/);
  assert.match(claudeSettingsSource, /env: buildClaudeCodeSettingsEnv\(config, selectedModel\)/);
  assert.match(claudeSettingsSource, /ANTHROPIC_AUTH_TOKEN: anthropicAuthToken/);
  assert.match(claudeSettingsSource, /ANTHROPIC_BASE_URL: anthropicBaseURL/);

  assert.match(runnerSource, /const sdkModelSettings = buildClaudeCodeModelSettings\(config, effectiveModel\);/);
  assert.match(runnerSource, /settings: sdkModelSettings,/);
  assert.match(runnerSource, /sdkExpertModel/);
  assert.match(runnerSource, /settingsEnvBaseURL: sdkModelSettings\.env\?\.ANTHROPIC_BASE_URL/);

  assert.match(utilSource, /settings: buildClaudeCodeModelSettings\(apiConfig, requestedModel\),/);
  assert.match(commitMessageSource, /settings: buildClaudeCodeModelSettings\(apiConfig, requestedModel\),/);
});
