import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDesignInspectionPrompt,
  buildDesignSemanticDiffPrompt,
  parseDesignInspectionDsl,
  parseDesignSemanticDiffDsl,
} from "../../src/electron/libs/design-inspection-dsl.js";

test("buildDesignInspectionPrompt requires chart topology for diagrams", () => {
  const prompt = buildDesignInspectionPrompt("Read this Sankey chart.");

  assert.match(prompt, /diagram\.nodes/);
  assert.match(prompt, /diagram\.links/);
  assert.match(prompt, /topology invariants/);
});

test("parseDesignInspectionDsl preserves diagram nodes and links", () => {
  const dsl = parseDesignInspectionDsl(JSON.stringify({
    summary: "送达情况 Sankey 图",
    screen: { kind: "chart", language: "zh-CN" },
    diagram: {
      kind: "sankey",
      nodes: [
        { id: "total", label: "总计 81", value: "81", position: "left" },
        { id: "sent", label: "已送达57(70%)", value: "57(70%)", position: "center" },
      ],
      links: [
        { from: "total", to: "sent", value: "57" },
      ],
      invariants: ["总计 must split into 已送达, 发送中, 失败"],
    },
  }));

  assert.equal(dsl.diagram?.kind, "sankey");
  assert.equal(dsl.diagram?.nodes?.[0]?.label, "总计 81");
  assert.equal(dsl.diagram?.links?.[0]?.from, "total");
});

test("parseDesignSemanticDiffDsl keeps critical topology issues", () => {
  const prompt = buildDesignSemanticDiffPrompt();
  assert.match(prompt, /topology/);
  assert.match(prompt, /nodes/);
  assert.match(prompt, /links/);

  const diff = parseDesignSemanticDiffDsl(JSON.stringify({
    score: 24,
    verdict: "fail",
    summary: "候选图拓扑错误",
    issues: [
      {
        severity: "critical",
        type: "topology",
        region: "right",
        target: "reply branches",
        expected: "已读分为已回复和未回复",
        actual: "候选图把回复节点画成独立右侧分支",
        fix: "Rebuild Sankey data links from 已读 to 已回复/未回复.",
        confidence: 0.94,
      },
    ],
  }));

  assert.equal(diff.verdict, "fail");
  assert.equal(diff.score, 24);
  assert.equal(diff.issues[0]?.severity, "critical");
  assert.equal(diff.issues[0]?.type, "topology");
});
