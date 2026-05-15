import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("runner injects enabled Claude Code plugins into Agent SDK sessions", () => {
  const source = readFileSync("src/electron/libs/runner.ts", "utf8");

  assert.match(source, /resolveEnabledClaudeCodeSdkPlugins\(\)/);
  assert.match(source, /plugins:\s*sdkPlugins\.length > 0 \? sdkPlugins : undefined/);
  assert.match(source, /isClaudeCodePluginMcpTool\(toolName, sdkPluginMcpServerNames\)/);
  assert.match(source, /maybeRunFigmaGuideOAuth\(q,/);
  assert.match(source, /mcpAuthenticate\(figmaServer\.name\)/);
});

test("runner enables Claude Code auto truncation for oversized resumed contexts", () => {
  const source = readFileSync("src/electron/libs/runner.ts", "utf8");

  assert.match(source, /CLAUDE_CODE_AUTO_TRUNCATE_ARGS/);
  assert.match(source, /"allow-auto-truncate": null/);
  assert.match(source, /extraArgs:\s*CLAUDE_CODE_AUTO_TRUNCATE_ARGS/);
});

test("runner enables discovered skills for desktop development sessions", () => {
  const source = readFileSync("src/electron/libs/runner.ts", "utf8");

  assert.match(source, /const enabledSkills = agentContext\.skills\.length > 0/);
  assert.match(source, /runSurface === "development"\s*\? "all"/);
  assert.match(source, /skills:\s*enabledSkills/);
});
