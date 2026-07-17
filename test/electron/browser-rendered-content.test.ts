import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import {
  buildBrowserRenderedContentExpression,
  createBrowserRenderedContentFingerprint,
  normalizeBrowserRenderedContentInput,
} from "../../src/electron/libs/browser-workbench/browser-rendered-content.js";

function createCanvas(overrides: Record<string, unknown> = {}) {
  const attributes = new Map<string, string>([["aria-label", "Quarterly revenue chart"]]);
  return {
    id: "surface",
    tagName: "CANVAS",
    classList: ["render-surface"],
    width: 1200,
    height: 800,
    parentElement: null,
    dataset: { view: "revenue" },
    matches: (selector: string) => selector === "canvas" || selector === "#surface",
    querySelectorAll: () => [],
    getAttribute: (name: string) => attributes.get(name) ?? null,
    getBoundingClientRect: () => ({ width: 600, height: 400 }),
    ...overrides,
  };
}

function createDocument(surfaces: unknown[]) {
  return {
    querySelectorAll(selector: string) {
      if (selector === "canvas" || selector === "canvas,svg" || selector === "*") return surfaces;
      return [];
    },
    getElementById: () => null,
  };
}

test("rendered content reader extracts accessibility and Chart.js semantics", () => {
  const canvas = createCanvas();
  const chart = {
    config: { type: "bar" },
    data: { labels: ["Q1", "Q2"], datasets: [{ label: "Revenue", data: [12, 18] }] },
    options: { plugins: { title: { text: "Revenue" } } },
  };
  const context = {
    document: createDocument([canvas]),
    window: { Chart: { getChart: (candidate: unknown) => candidate === canvas ? chart : undefined } },
  };

  const result = vm.runInNewContext(buildBrowserRenderedContentExpression(), context);

  assert.equal(result.surfaces.length, 1);
  assert.equal(result.surfaces[0].semantic, true);
  assert.equal(result.surfaces[0].semantics.some((entry: { provider: string }) => entry.provider === "accessibility"), true);
  const chartSemantic = result.surfaces[0].semantics.find((entry: { provider: string }) => entry.provider === "chartjs");
  assert.equal(chartSemantic.kind, "chart");
  assert.equal(chartSemantic.data.type, "bar");
  assert.deepEqual(chartSemantic.data.data.labels, ["Q1", "Q2"]);
});

test("rendered content reader uses ECharts public API on an ancestor container", () => {
  const container = { parentElement: null };
  const canvas = createCanvas({ parentElement: container });
  const chart = { getOption: () => ({ title: [{ text: "Traffic" }], series: [{ type: "line", data: [3, 5, 8] }] }) };
  const context = {
    document: createDocument([canvas]),
    window: { echarts: { getInstanceByDom: (candidate: unknown) => candidate === container ? chart : undefined } },
  };

  const result = vm.runInNewContext(buildBrowserRenderedContentExpression(), context);
  const semantic = result.surfaces[0].semantics.find((entry: { provider: string }) => entry.provider === "echarts");

  assert.equal(semantic.kind, "chart");
  assert.match(semantic.text, /Traffic/);
});

test("rendered content reader crosses open shadow roots and supports custom providers", () => {
  const canvas = createCanvas({ getAttribute: () => null });
  const shadowRoot = {
    querySelectorAll(selector: string) {
      if (selector === "canvas" || selector === "canvas,svg" || selector === "*") return [canvas];
      return [];
    },
  };
  const host = { shadowRoot };
  const context = {
    document: createDocument([host]),
    window: {
      __TECHCC_RENDERED_CONTENT_PROVIDERS__: [{
        name: "whiteboard-model",
        match: (candidate: unknown) => candidate === canvas,
        extract: () => ({ kind: "scene", text: "two sticky notes", data: { nodes: 2 } }),
      }],
    },
  };

  const result = vm.runInNewContext(buildBrowserRenderedContentExpression(), context);

  assert.equal(result.surfaces.length, 1);
  assert.equal(result.surfaces[0].semantics[0].provider, "whiteboard-model");
  assert.equal(result.surfaces[0].semantics[0].data.nodes, 2);
});

test("rendered content fingerprints track any semantic surface change", () => {
  const first = createBrowserRenderedContentFingerprint([{ selector: "#surface", tagName: "canvas", semantic: true, semantics: [{ provider: "custom", kind: "scene", text: "one" }] }]);
  const same = createBrowserRenderedContentFingerprint([{ selector: "#surface", tagName: "canvas", semantic: true, semantics: [{ provider: "custom", kind: "scene", text: "one" }] }]);
  const changed = createBrowserRenderedContentFingerprint([{ selector: "#surface", tagName: "canvas", semantic: true, semantics: [{ provider: "custom", kind: "scene", text: "two" }] }]);

  assert.equal(first, same);
  assert.notEqual(first, changed);
  assert.match(first, /^rendered-[0-9a-f]{8}-\d+$/);
});

test("rendered content limits stay bounded", () => {
  assert.deepEqual(normalizeBrowserRenderedContentInput({ maxSurfaces: 999, maxChars: 10, includeSvg: false, selector: "  #surface  " }), {
    maxSurfaces: 50,
    maxChars: 1_000,
    includeSvg: false,
    selector: "#surface",
  });
});
