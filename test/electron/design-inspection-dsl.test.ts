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

test("buildDesignInspectionPrompt requires UI restoration spec and quality gate", () => {
  const prompt = buildDesignInspectionPrompt("Restore this Drawer UI.");

  assert.match(prompt, /uiSpec/);
  assert.match(prompt, /qualityGate/);
  assert.match(prompt, /fields/);
  assert.match(prompt, /visualConstraints/);
  assert.match(prompt, /Generic component rule/);
  assert.match(prompt, /Do not simplify a UI/);
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

test("parseDesignInspectionDsl preserves UI spec and flags thin summaries", () => {
  const rich = parseDesignInspectionDsl(JSON.stringify({
    summary: "用户详情抽屉",
    screen: { kind: "modal", language: "zh-CN" },
    uiSpec: {
      container: {
        kind: "drawer",
        bounds: { width: 392, height: 780, unit: "px", confidence: 0.8 },
        position: "right",
      },
      tabs: [
        { text: "联系记录", active: false },
        { text: "用户信息", active: true, visualState: "active" },
      ],
      sections: [
        { title: "用户基本信息", collapsible: true, visualState: "expanded" },
      ],
      fields: [
        { label: "昵称", value: "Oggy", controlType: "display", editable: false, layout: "label-left/value-right" },
        { label: "电话", value: "+8617674153738", controlType: "display", editable: false },
      ],
      actions: [
        { text: "取消", role: "secondary" },
        { text: "确定", role: "primary" },
      ],
      visualConstraints: [
        {
          target: "profile summary",
          category: "alignment",
          property: "content start x",
          expected: "values start from the same x coordinate",
          measurement: "x=96px from component left",
          confidence: 0.82,
        },
      ],
      invariants: ["Must keep detail rows and tag sections; do not reduce to API edit fields."],
    },
    qualityGate: {
      confidence: 0.82,
      missingDetails: [],
      needsStrongerVisionModel: false,
      nextStep: "Use this UI spec.",
    },
  }));

  assert.equal(rich.uiSpec?.container?.kind, "drawer");
  assert.equal(rich.uiSpec?.fields?.[0]?.label, "昵称");
  assert.equal(rich.uiSpec?.tabs?.[1]?.active, true);
  assert.equal(rich.uiSpec?.visualConstraints?.[0]?.category, "alignment");
  assert.equal(rich.qualityGate.needsStrongerVisionModel, false);

  const thin = parseDesignInspectionDsl(JSON.stringify({
    summary: "用户详情抽屉，含 Tab 和表单",
    screen: { kind: "modal", language: "zh-CN" },
    regions: [{ id: "body", role: "body" }],
    elements: [{ id: "title", type: "text", text: "详情" }],
  }));

  assert.equal(thin.qualityGate.needsStrongerVisionModel, true);
  assert.ok(thin.qualityGate.missingDetails.includes("uiSpec"));
  assert.ok(thin.qualityGate.missingDetails.includes("field list"));
  assert.ok(thin.qualityGate.missingDetails.includes("measurable visual constraints"));
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
