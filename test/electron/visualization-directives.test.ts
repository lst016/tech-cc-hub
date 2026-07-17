import test from "node:test";
import assert from "node:assert/strict";

import {
  extractVisualizationDirectives,
  isSafeVisualizationFileName,
  stripVisualizationDirectives,
} from "../../src/ui/utils/visualization-directives.js";

test("extractVisualizationDirectives preserves alternating CRLF text and visualization segments", () => {
  const source = [
    "先看趋势。",
    "",
    '::techcc-inline-vis{file="trend.html" title="月度趋势"}',
    "",
    "再看分布。",
    '::techcc-inline-vis{file="distribution.html"}',
    "结论。",
  ].join("\r\n");

  const segments = extractVisualizationDirectives(source);

  assert.deepEqual(segments.map((segment) => segment.type), [
    "text",
    "visualization",
    "text",
    "visualization",
    "text",
  ]);
  assert.match(segments[0]?.type === "text" ? segments[0].text : "", /先看趋势/);
  assert.deepEqual(segments[1], {
    type: "visualization",
    file: "trend.html",
    title: "月度趋势",
  });
  assert.deepEqual(segments[3], {
    type: "visualization",
    file: "distribution.html",
  });
  assert.match(segments[4]?.type === "text" ? segments[4].text : "", /结论/);
});

test("extractVisualizationDirectives leaves an incomplete streaming directive as plain text", () => {
  const source = '分析中\n\n::techcc-inline-vis{file="trend.html" title="趋势';

  assert.deepEqual(extractVisualizationDirectives(source), [{ type: "text", text: source }]);
});

test("extractVisualizationDirectives ignores directives inside Markdown fences", () => {
  const source = [
    "下面只是语法示例：",
    "```text",
    '::techcc-inline-vis{file="example.html" title="示例"}',
    "```",
    "~~~",
    '::techcc-inline-vis{file="other.html"}',
    "~~~",
  ].join("\n");

  assert.deepEqual(extractVisualizationDirectives(source), [{ type: "text", text: source }]);
});

test("a fenced line with an info string cannot close an active Markdown fence", () => {
  const source = [
    "```text",
    "literal example",
    "```js",
    '::techcc-inline-vis{file="example.html"}',
    "```",
  ].join("\n");

  assert.deepEqual(extractVisualizationDirectives(source), [{ type: "text", text: source }]);
});

test("unsafe or non-HTML file values remain ordinary text", () => {
  const unsafeFiles = [
    "../trend.html",
    "folder/trend.html",
    "folder\\trend.html",
    "C:\\trend.html",
    "/tmp/trend.html",
    "trend.svg",
    "..html",
  ];

  for (const file of unsafeFiles) {
    const source = `::techcc-inline-vis{file="${file}"}`;
    assert.deepEqual(extractVisualizationDirectives(source), [{ type: "text", text: source }]);
    assert.equal(isSafeVisualizationFileName(file), false);
  }

  assert.equal(isSafeVisualizationFileName("sales-dashboard.html"), true);
  assert.equal(isSafeVisualizationFileName("销售趋势_2026.HTML"), true);
});

test("malformed complete directives remain ordinary text", () => {
  const sources = [
    '::techcc-inline-vis{title="趋势" file="trend.html"}',
    '::techcc-inline-vis{file="trend.html" unknown="value"}',
    '::techcc-inline-vis{file="trend.html" title=趋势}',
  ];

  for (const source of sources) {
    assert.deepEqual(extractVisualizationDirectives(source), [{ type: "text", text: source }]);
  }
});

test("stripVisualizationDirectives removes complete directives for copy and reference actions", () => {
  const source = [
    "结论一。",
    "",
    '::techcc-inline-vis{file="trend.html" title="趋势"}',
    "",
    "结论二。",
  ].join("\n");

  assert.equal(stripVisualizationDirectives(source), "结论一。\n\n结论二。");
});

test("stripVisualizationDirectives truncates an incomplete streaming directive", () => {
  const source = '正文结论。\n\n::techcc-inline-vis{file="trend.html" title="趋势';

  assert.equal(stripVisualizationDirectives(source), "正文结论。");
});

test("stripVisualizationDirectives does not alter examples inside Markdown fences", () => {
  const source = [
    "```text",
    '::techcc-inline-vis{file="example.html"}',
    "```",
  ].join("\n");

  assert.equal(stripVisualizationDirectives(source), source);
});
