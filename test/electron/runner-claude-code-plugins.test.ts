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
  assert.match(source, /extraArgs:\s*getClaudeCodeExtraArgs\(\)/);
});

test("runner only forwards explicitly selected skills", () => {
  const source = readFileSync("src/electron/libs/runner.ts", "utf8");

  assert.match(source, /const enabledSkills = agentContext\.skills\.length > 0/);
  assert.doesNotMatch(source, /runSurface === "development"\s*\? "all"/);
  assert.match(source, /\.\.\.\(enabledSkills \? \{ skills: enabledSkills \} : \{\}\)/);
});

test("runner injects explicitly invoked local Claude definitions into the session prompt", () => {
  const runnerSource = readFileSync("src/electron/libs/runner.ts", "utf8");
  const catalogSource = readFileSync("src/electron/libs/slash-command-catalog.ts", "utf8");
  const ipcSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");

  assert.match(runnerSource, /buildInvokedLocalSlashDefinitionPromptAppend\(currentPrompt, projectCwd\)/);
  assert.match(catalogSource, /Local Claude slash definition invocation:/);
  assert.match(catalogSource, /discoverSlashCommandDefinitionItemsInRoots\(resolveSlashCommandRoots\(options\.cwd\)\)/);
  assert.match(ipcSource, /Invoked local Claude \$\{invokedDefinition\.definitionKind\}: \$\{invokedDefinition\.name\}/);
  assert.match(ipcSource, /sourceKind:\s*"skill"/);
});
