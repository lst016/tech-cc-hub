import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("app exposes a session analysis entry and renders the analysis page skeleton", () => {
  const appSource = readFileSync(join(process.cwd(), "src/ui/App.tsx"), "utf8");
  const railSource = readFileSync(join(process.cwd(), "src/ui/components/ActivityRail.tsx"), "utf8");
  const analysisPageSource = readFileSync(join(process.cwd(), "src/ui/components/SessionAnalysisPage.tsx"), "utf8");

  assert.match(appSource, /showSessionAnalysis/);
  assert.match(railSource, /打开 Trace Viewer/);
  assert.match(analysisPageSource, /提示词分布/);
  assert.match(analysisPageSource, /上下文诊断/);
  assert.match(analysisPageSource, /当前 Trace 节点/);
  assert.match(analysisPageSource, /提示词账本/);
  assert.match(analysisPageSource, /分析优化/);
  assert.match(analysisPageSource, /分析卡片/);
  assert.match(analysisPageSource, /导出诊断包/);
  assert.match(analysisPageSource, /buildTraceDiagnosticExportPayload/);
  assert.match(analysisPageSource, /sanitizeDiagnosticValue/);
});
