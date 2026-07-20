import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("composer exposes @可视化 from the plugin menu", () => {
  const promptInput = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const pluginMenu = readFileSync("src/ui/components/prompt-input/ImageGenerationPluginControls.tsx", "utf8");
  const pluginToken = readFileSync("src/ui/components/prompt-input/visualization-plugin.ts", "utf8");

  assert.match(pluginToken, /VISUALIZATION_PLUGIN_TOKEN\s*=\s*["']@可视化/);
  assert.match(pluginMenu, /onInsertVisualization/);
  assert.match(pluginMenu, />可视化</);
  assert.match(promptInput, /VISUALIZATION_PLUGIN_TOKEN/);
  assert.match(promptInput, /onInsertVisualization/);
});

test("runner activates the bundled skill and grants only the session artifact directory", () => {
  const runner = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
  const sandbox = readFileSync("src/electron/libs/claude/claude-sandbox-policy.ts", "utf8");

  assert.match(runner, /buildTechccVisualizationSkillPrompt/);
  assert.match(runner, /ensureVisualizationSessionDir/);
  assert.match(runner, /visualizationSessionDirectory/);
  assert.match(runner, /additionalDirectories/);
  assert.match(runner, /additionalWriteRoots:\s*visualizationSessionDirectory/);
  assert.match(sandbox, /additionalWriteRoots/);
});

test("assistant output renders techcc directives outside Markdown and sends follow-ups", () => {
  const app = readFileSync("src/ui/App.tsx", "utf8");
  const eventCard = readFileSync("src/ui/components/EventCard.tsx", "utf8");
  const events = readFileSync("src/ui/events.ts", "utf8");
  const card = readFileSync("src/ui/components/chat/VisualizationPreviewCard.tsx", "utf8");
  const frame = readFileSync("src/ui/components/chat/TechccVisualizationFrame.tsx", "utf8");
  const pane = readFileSync("src/ui/components/chat/VisualizationPreviewPane.tsx", "utf8");
  const activityRail = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");

  assert.match(app, /paddingBottom:\s*["']calc\(var\(--composer-bottom-offset/);
  assert.match(eventCard, /extractVisualizationDirectives\(visibleAssistantText\)/);
  assert.match(eventCard, /stripVisualizationDirectives/);
  assert.match(eventCard, /segment\.type === "visualization"/);
  assert.match(eventCard, /<VisualizationPreviewCard/);
  assert.match(eventCard, /PROMPT_SUBMIT_EVENT/);
  assert.match(events, /OPEN_VISUALIZATION_PREVIEW_EVENT/);
  assert.match(card, /OPEN_VISUALIZATION_PREVIEW_EVENT/);
  assert.match(app, /OPEN_VISUALIZATION_PREVIEW_EVENT/);
  assert.match(app, /visualizationPreview=/);
  assert.match(activityRail, /<VisualizationPreviewPane/);
  assert.match(pane, /<TechccVisualizationFrame/);
  assert.match(frame, /sandbox="allow-scripts"/);
  assert.match(frame, /referrerPolicy="no-referrer"/);
  assert.match(frame, /event\.source/);
  assert.match(frame, /techcc-visualization/);
  assert.doesNotMatch(`${card}\n${frame}\n${pane}`, /dangerouslySetInnerHTML/);
});

test("bundled visualization guidance avoids stale artifacts and narrow-screen overflow", () => {
  const skill = readFileSync("skills/techcc-visualize/SKILL.md", "utf8");

  assert.match(skill, /每个新视图使用唯一文件名/);
  assert.match(skill, /clamp\(.*标题/);
});

test("packaging includes the techcc-owned skill and main process installs the custom scheme", () => {
  const builder = readFileSync("electron-builder.json", "utf8");
  const appShell = readFileSync("index.html", "utf8");
  const main = readFileSync("src/electron/main.ts", "utf8");

  assert.match(builder, /skills\/techcc-visualize/);
  assert.match(main, /registerTechccVisualizationScheme/);
  assert.match(main, /installTechccVisualizationProtocol/);
  assert.match(main, /techcc-visualization-create-launch/);
  assert.match(main, /createTechccVisualizationLaunch/);
  assert.match(appShell, /frame-src[^;]*'self'[^;]*techcc-visualize:/);
});
