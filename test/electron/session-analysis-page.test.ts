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
  assert.match(analysisPageSource, /Trace Flow/);
  assert.match(analysisPageSource, /Node Inspector/);
  assert.match(analysisPageSource, /Context Distribution/);
  assert.match(analysisPageSource, /Analysis Cards/);
  assert.match(analysisPageSource, /Prompt Ledger/);
  assert.match(analysisPageSource, /Prompt 分布/);
  assert.match(analysisPageSource, /上下文诊断/);
  assert.match(analysisPageSource, /当前 Trace 节点/);
  assert.match(analysisPageSource, /derivePromptNodeScope/);
  assert.doesNotMatch(analysisPageSource, /const nodeRelation = useMemo\(\(\) => \{/);
  assert.match(analysisPageSource, /data-prompt-ledger-workbench/);
  assert.match(analysisPageSource, /data-prompt-ledger-distribution/);
  assert.match(analysisPageSource, /data-prompt-ledger-diagnosis/);
  assert.doesNotMatch(analysisPageSource, /h-\[340px\]/);
});
