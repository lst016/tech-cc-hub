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
