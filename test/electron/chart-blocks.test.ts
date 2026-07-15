import test from "node:test";
import assert from "node:assert/strict";

import {
  extractChartBlocks,
  stripChartBlocks,
} from "../../src/ui/utils/chart-blocks.js";

test("extractChartBlocks preserves alternating text and multiple CRLF chart blocks", () => {
  const source = [
    "先看趋势。",
    "",
    ":::echarts",
    '{"xAxis":{"data":["一月","二月"]},"yAxis":{},"series":[{"type":"line","data":[2,5]}]}',
    ":::",
    "",
    "再看占比。",
    "",
    ":::echarts",
    '{"series":[{"type":"pie","data":[{"name":"A","value":2},{"name":"B","value":5}]}]}',
    ":::",
    "",
    "结论。",
  ].join("\r\n");

  const segments = extractChartBlocks(source);

  assert.deepEqual(segments.map((segment) => segment.type), ["text", "chart", "text", "chart", "text"]);
  assert.match(segments[0]?.type === "text" ? segments[0].text : "", /先看趋势/);
  assert.match(segments[1]?.type === "chart" ? segments[1].json : "", /"type":"line"/);
  assert.match(segments[3]?.type === "chart" ? segments[3].json : "", /"type":"pie"/);
  assert.match(segments[4]?.type === "text" ? segments[4].text : "", /结论/);
});

test("extractChartBlocks leaves an incomplete streaming block as plain text", () => {
  const source = '分析中\n\n:::echarts\n{"series":[{"type":"bar"';
  assert.deepEqual(extractChartBlocks(source), [{ type: "text", text: source }]);
});

test("extractChartBlocks ignores chart markers nested inside Markdown code fences", () => {
  const source = [
    "下面只是语法示例：",
    "```text",
    ":::echarts",
    '{"series":[{"type":"bar","data":[1]}]}',
    ":::",
    "```",
  ].join("\n");

  assert.deepEqual(extractChartBlocks(source), [{ type: "text", text: source }]);
});

test("a backtick fence with an info string cannot close an active Markdown fence", () => {
  const source = [
    "```text",
    "literal example",
    "```js",
    ":::echarts",
    '{"series":[{"type":"bar","data":[1]}]}',
    ":::",
    "```",
  ].join("\n");

  assert.deepEqual(extractChartBlocks(source), [{ type: "text", text: source }]);
});

test("stripChartBlocks removes only complete chart payloads for copy and reference actions", () => {
  const source = [
    "结论一。",
    "",
    ":::echarts",
    '{"series":[{"type":"bar","data":[1,2]}]}',
    ":::",
    "",
    "结论二。",
  ].join("\n");

  assert.equal(stripChartBlocks(source), "结论一。\n\n结论二。");
});

test("stripChartBlocks hides an incomplete streaming payload from copy and reference actions", () => {
  const source = '正文结论。\n\n:::echarts\n{"series":[{"type":"bar"';
  assert.equal(stripChartBlocks(source), "正文结论。");
});
