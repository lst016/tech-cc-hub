import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildTechccVisualizationSkillPrompt,
  isTechccVisualizationRequested,
  resolveTechccVisualizationSdkSkills,
} from "../../src/electron/libs/techcc-visualization-skill.js";
import { buildClaudeSandboxSettings } from "../../src/electron/libs/claude/claude-sandbox-policy.js";

test("@可视化 is the only explicit techcc visualization trigger", () => {
  assert.equal(isTechccVisualizationRequested("@可视化 把订单数据做成交互看板"), true);
  assert.equal(isTechccVisualizationRequested("请使用 @可视化\n展示趋势"), true);
  assert.equal(isTechccVisualizationRequested("只画一个普通表格"), false);
  assert.equal(isTechccVisualizationRequested("@可视化工具说明"), false);
});

test("runtime prompt injects the isolated session directory and exact public contract", () => {
  const prompt = buildTechccVisualizationSkillPrompt({
    displayPrompt: "@可视化 分析这份数据",
    sessionDirectory: "D:/AppData/tech-cc-hub/visualizations/session-42",
    skillMarkdown: "写入 {{TECHCC_VISUALIZATION_DIRECTORY}}，随后输出 ::techcc-inline-vis{file=\"name.html\"}",
  });

  assert.match(prompt ?? "", /D:\/AppData\/tech-cc-hub\/visualizations\/session-42/);
  assert.match(prompt ?? "", /::techcc-inline-vis\{file="name\.html"\}/);
  assert.equal(buildTechccVisualizationSkillPrompt({
    displayPrompt: "普通请求",
    sessionDirectory: "D:/unused",
    skillMarkdown: "unused",
  }), undefined);
});

test("@可视化 hides unrelated SDK skills after its owned contract is injected", () => {
  assert.deepEqual(
    resolveTechccVisualizationSdkSkills("@可视化 创建 Agent 页面", ["claude-api", "frontend-design"]),
    [],
  );
  assert.deepEqual(
    resolveTechccVisualizationSdkSkills("创建 Agent 页面", ["claude-api"]),
    ["claude-api"],
  );
  assert.equal(resolveTechccVisualizationSdkSkills("创建 Agent 页面"), undefined);
});

test("bundled skill is techcc-owned and contains no foreign runtime namespace", () => {
  const source = readFileSync("skills/techcc-visualize/SKILL.md", "utf8");

  assert.match(source, /^---\s+[\s\S]*name:\s*techcc-visualize\s+[\s\S]*---/);
  assert.match(source, /@可视化/);
  assert.match(source, /window\.techcc\.visualization\.sendFollowUpMessage/);
  assert.match(source, /::techcc-inline-vis\{file="/);
  assert.match(source, /{{TECHCC_VISUALIZATION_DIRECTORY}}/);
  assert.doesNotMatch(source, /window\.openai|codex-inline-vis|\.codex\/visualizations/i);
});

test("sandbox grants the visualization session directory without widening other roots", () => {
  const sandbox = buildClaudeSandboxSettings({
    enabled: true,
    workspaceRoot: "D:\\workspace\\project",
    additionalWriteRoots: ["D:\\AppData\\tech-cc-hub\\visualizations\\session-42"],
  });

  assert.deepEqual(sandbox.filesystem?.allowWrite, [
    "D:/workspace/project/**",
    "D:/AppData/tech-cc-hub/visualizations/session-42/**",
  ]);
});
