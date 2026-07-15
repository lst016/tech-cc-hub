import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("runner injects enabled Claude Code plugins into Agent SDK sessions", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.match(source, /resolveEnabledClaudeCodeSdkPlugins\(\)/);
  assert.match(source, /plugins:\s*sdkPlugins\.length > 0 \? sdkPlugins : undefined/);
  assert.match(source, /isClaudeCodePluginMcpTool\(toolName, sdkPluginMcpServerNames\)/);
  assert.match(source, /maybeRunFigmaGuideOAuth\(q,/);
  assert.match(source, /mcpAuthenticate\(figmaServer\.name\)/);
});

test("runner requires visual Figma inspection before file mutation", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
  const anchorToolSet = source.match(/const FIGMA_IMPLEMENTATION_ANCHOR_TOOL_NAMES = new Set\(\[\r?\n([\s\S]*?)\r?\n\]\);/);

  assert.ok(anchorToolSet);
  assert.match(anchorToolSet[1], /"design_inspect_image"/);
  assert.doesNotMatch(anchorToolSet[1], /figma_summarize_design|figma_generate_tailwind_code|figma_export_node_images|figma_audit_design/);
  assert.match(source, /The implementation anchor is established only after .*design_inspect_image succeeds/);
  assert.match(source, /generic reference tuple/);
  assert.match(source, /browser_query_nodes\/browser_inspect_styles/);
  assert.doesNotMatch(source, /design_lint_visual_parity/);
  assert.match(source, /isImplementationGradeFigmaAnchorResponse\(input\.tool_response\)/);
  assert.match(source, /qualityGate\.confidence >= 0\.75/);
});

test("runner requires exported Figma SVG assets before SVG file mutation", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
  const workflowSource = readFileSync("src/shared/figma-development-workflow.ts", "utf8");

  assert.match(source, /const FIGMA_SVG_ASSET_TOOL_NAMES = new Set/);
  assert.match(source, /"figma_get_image_urls"/);
  assert.match(source, /shouldRequireFigmaSvgAsset\(currentDisplayPrompt\)/);
  assert.match(source, /let figmaContextSeen = hasFigmaContext\(currentDisplayPrompt, session\.lastPrompt\)/);
  assert.match(source, /figmaContextSeen && isSvgOrIconMutation\(toolName, toolInput\)/);
  assert.match(source, /getFigmaSvgAssetDenyMessage\(\s*toolName, effectiveInput, requiresFigmaSvgAsset, figmaContextSeen, figmaSvgAssetSeen,/);
  assert.match(source, /onFigmaContext\?\.\(\)/);
  assert.ok(source.includes('format=\\"svg\\"'));
  assert.match(source, /isFigmaSvgImageUrlRequest/);
  assert.match(source, /onFigmaSvgAsset\?\.\(\)/);
  assert.match(workflowSource, /Figma SVG asset rule/);
  assert.ok(workflowSource.includes('figma_get_image_urls with format=\\"svg\\"'));
});

test("runner normalizes tool inputs in the permission path as a backstop", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.match(source, /normalizeToolInputForKnownSchemas\(toolName, input\)/);
  assert.match(source, /normalizeKnownToolInputsInMessage\(rawMessage\)/);
  assert.match(source, /\[runner\]\[tool-input-normalized\]/);
  assert.match(source, /return \{ behavior: "allow", updatedInput: effectiveInput \}/);
});

test("runner enables Claude Code auto truncation for oversized resumed contexts", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.match(source, /CLAUDE_CODE_AUTO_TRUNCATE_ARGS/);
  assert.match(source, /"allow-auto-truncate": null/);
  assert.match(source, /extraArgs:\s*getClaudeCodeExtraArgs\(\)/);
});

test("runner only forwards explicitly selected skills", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.match(source, /const enabledSkills = agentContext\.skills\.length > 0/);
  assert.doesNotMatch(source, /runSurface === "development"\s*\? "all"/);
  assert.match(source, /\.\.\.\(enabledSkills \? \{ skills: enabledSkills \} : \{\}\)/);
});

test("runner injects explicitly invoked local Claude definitions into the session prompt", () => {
  const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
  const catalogSource = readFileSync("src/electron/libs/slash-command-catalog.ts", "utf8");
  const ipcSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");

  assert.match(runnerSource, /buildInvokedLocalSlashDefinitionPromptAppend\(currentDisplayPrompt, projectCwd\)/);
  assert.match(catalogSource, /Local Claude slash definition invocation:/);
  assert.match(catalogSource, /discoverSlashCommandDefinitionItemsInRoots\(resolveSlashCommandRoots\(options\.cwd\)\)/);
  assert.match(ipcSource, /Invoked local Claude \$\{invokedDefinition\.definitionKind\}: \$\{invokedDefinition\.name\}/);
  assert.match(ipcSource, /sourceKind:\s*"skill"/);
});
