import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("app exposes a session analysis entry and renders the analysis page skeleton", () => {
  const appSource = readFileSync(new URL("../../src/ui/App.tsx", import.meta.url), "utf8");
  const railSource = readFileSync(new URL("../../src/ui/components/ActivityRail.tsx", import.meta.url), "utf8");
  const analysisPageSource = readFileSync(new URL("../../src/ui/components/SessionAnalysisPage.tsx", import.meta.url), "utf8");

  assert.match(appSource, /showSessionAnalysis/);
  assert.match(railSource, /查看本会话分析/);
  assert.match(analysisPageSource, /本会话完整分析/);
  assert.match(analysisPageSource, /计划 vs 执行/);
  assert.match(analysisPageSource, /执行步骤分析/);
  assert.match(analysisPageSource, /关键节点证据/);
});
