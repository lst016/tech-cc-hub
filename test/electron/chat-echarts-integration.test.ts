import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("assistant chat renders ECharts directives as a dedicated non-Markdown card", () => {
  const eventCardSource = readFileSync("src/ui/components/EventCard.tsx", "utf8");
  const chartCardPath = "src/ui/components/chat/EChartsCard.tsx";

  assert.equal(existsSync(chartCardPath), true);
  assert.match(eventCardSource, /extractVisualizationDirectives\(visibleAssistantText\)/);
  assert.match(eventCardSource, /extractChartBlocks\(segment\.text\)/);
  assert.match(eventCardSource, /segment\.type === "chart"/);
  assert.match(eventCardSource, /<EChartsCard/);
});

test("assistant reference and copy actions never leak raw chart configuration", () => {
  const eventCardSource = readFileSync("src/ui/components/EventCard.tsx", "utf8");

  assert.match(eventCardSource, /stripChartBlocks\(stripVisualizationDirectives\(visibleAssistantText\)\)/);
  assert.match(eventCardSource, /appendMessageReferenceToComposer\(plainAssistantText/);
  assert.match(eventCardSource, /copyText\(plainAssistantText\)/);
});

test("chart card lazy-loads ECharts, resizes, disposes, and exposes an accessible type switch", () => {
  const source = readFileSync("src/ui/components/chat/EChartsCard.tsx", "utf8");

  assert.match(source, /import\("echarts"\)/);
  assert.match(source, /new ResizeObserver/);
  assert.match(source, /\.dispose\(\)/);
  assert.match(source, /chartRef\.current\.getDom\(\) !== container/);
  assert.match(source, /aria-label="切换图表类型"/);
  assert.match(source, /convertChartOptionType\(originalOption, selectedType\)/);
  assert.match(source, /useState<SwitchableChartType \| null>\(null\)/);
  assert.match(source, /const selectedOption = selectedType[\s\S]{0,180}convertChartOptionType\(originalOption, selectedType\)[\s\S]{0,180}: originalOption/);
  assert.match(source, /setSelectedType\(null\)/);
  assert.doesNotMatch(source, /copyText\(json\)|复制图表配置/);
  assert.match(source, /if \(!originalOption\) \{[\s\S]*chartRef\.current\?\.dispose\(\)/);
});

test("chart rendering stays out of the MCP registry", () => {
  const registrySource = readFileSync("src/shared/builtin-mcp-registry.ts", "utf8");
  const serverSource = readFileSync("src/electron/libs/builtin-mcp-servers.ts", "utf8");

  assert.doesNotMatch(registrySource, /tech-cc-hub-chart|render_chart/);
  assert.doesNotMatch(serverSource, /tech-cc-hub-chart|render_chart/);
  assert.equal(existsSync("src/electron/libs/mcp-tools/chart.ts"), false);
});
