import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("app exposes a session analysis entry and renders the analysis page skeleton", () => {
  const appSource = readFileSync(new URL("../../src/ui/App.tsx", import.meta.url), "utf8");
  const railSource = readFileSync(new URL("../../src/ui/components/ActivityRail.tsx", import.meta.url), "utf8");
  const analysisPageSource = readFileSync(new URL("../../src/ui/components/SessionAnalysisPage.tsx", import.meta.url), "utf8");

  assert.match(appSource, /showSessionAnalysis/);
  assert.match(railSource, /打开 Trace Viewer/);
  assert.match(analysisPageSource, /Trace Flow/);
  assert.match(analysisPageSource, /Node Inspector/);
  assert.match(analysisPageSource, /Context Distribution/);
  assert.match(analysisPageSource, /Analysis Cards/);
  assert.match(analysisPageSource, /Prompt Ledger/);
  assert.match(analysisPageSource, /Prompt 分布/);
  assert.match(analysisPageSource, /上下文诊断/);
  assert.match(analysisPageSource, /当前 Trace 节点/);
});
