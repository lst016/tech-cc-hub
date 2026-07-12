import test from "node:test";
import assert from "node:assert/strict";

import {
  convertChartOptionType,
  getPrimaryChartType,
  getSwitchableChartTypes,
  parseChartOption,
} from "../../src/ui/utils/chart-options.js";

test("parseChartOption accepts a JSON object and rejects invalid or unsafe payloads", () => {
  const valid = parseChartOption('{"series":[{"type":"bar","data":[1,2]}]}');
  assert.equal(valid.ok, true);

  const array = parseChartOption("[]");
  assert.equal(array.ok, false);
  if (!array.ok) assert.match(array.error, /对象/);

  const invalid = parseChartOption("{oops");
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.match(invalid.error, /JSON/);

  const unsafe = parseChartOption('{"__proto__":{"polluted":true},"series":[]}');
  assert.equal(unsafe.ok, false);
  if (!unsafe.ok) assert.match(unsafe.error, /不安全/);
});

test("parseChartOption rejects HTML tooltip formatters and forces safe rich-text tooltips", () => {
  const injected = parseChartOption(JSON.stringify({
    tooltip: { formatter: '<img src=x onerror="document.body.dataset.pwned=1">' },
    xAxis: { data: ["A"] },
    yAxis: {},
    series: [{ type: "bar", data: [1] }],
  }));
  assert.equal(injected.ok, false);
  if (!injected.ok) assert.match(injected.error, /HTML|不安全/);

  const safe = parseChartOption(JSON.stringify({
    tooltip: {},
    xAxis: { data: ["A"] },
    yAxis: {},
    series: [{ type: "bar", data: [1], tooltip: {} }],
  }));
  assert.equal(safe.ok, true);
  if (safe.ok) {
    assert.equal((safe.option.tooltip as Record<string, unknown>).renderMode, "richText");
    const series = safe.option.series as Array<Record<string, unknown>>;
    assert.equal((series[0]?.tooltip as Record<string, unknown>).renderMode, "richText");
  }
});

test("parseChartOption rejects HTML strings in toolbox data-view DOM content", () => {
  const result = parseChartOption(JSON.stringify({
    toolbox: {
      feature: {
        dataView: {
          show: true,
          lang: ['<img src=x onerror="document.body.dataset.pwned=1">', "close", "refresh"],
        },
      },
    },
    xAxis: { data: ["A"] },
    yAxis: {},
    series: [{ type: "bar", data: [1] }],
  }));

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /HTML|不安全/);
});

test("cartesian single-series data can switch between line, bar, and pie", () => {
  const option = {
    title: { text: "月度销售额" },
    xAxis: { type: "category", data: ["一月", "二月"] },
    yAxis: { type: "value" },
    series: [{ name: "销售额", type: "line", data: [2, 5] }],
  };

  assert.equal(getPrimaryChartType(option), "line");
  assert.deepEqual(getSwitchableChartTypes(option), ["line", "bar", "pie"]);
});

test("line to bar conversion is immutable and always derives from the original option", () => {
  const option = {
    xAxis: { type: "category", data: ["A", "B"] },
    yAxis: { type: "value" },
    series: [{ name: "数量", type: "line", smooth: true, data: [3, 8] }],
  };

  const converted = convertChartOptionType(option, "bar");

  assert.equal((converted.series as Array<Record<string, unknown>>)[0]?.type, "bar");
  assert.equal((converted.series as Array<Record<string, unknown>>)[0]?.smooth, undefined);
  assert.equal((option.series[0] as Record<string, unknown>).type, "line");
  assert.equal((option.series[0] as Record<string, unknown>).smooth, true);
});

test("line to pie conversion maps category labels to values without mutating source axes", () => {
  const option = {
    title: { text: "占比" },
    xAxis: { type: "category", data: ["A", "B"] },
    yAxis: { type: "value" },
    series: [{ name: "数量", type: "line", data: [3, { value: 8 }] }],
  };

  const converted = convertChartOptionType(option, "pie");
  const series = (converted.series as Array<Record<string, unknown>>)[0];

  assert.equal(converted.xAxis, undefined);
  assert.equal(converted.yAxis, undefined);
  assert.equal(series?.type, "pie");
  assert.deepEqual(series?.data, [{ name: "A", value: 3 }, { name: "B", value: 8 }]);
  assert.deepEqual(option.xAxis.data, ["A", "B"]);
});

test("pie source can switch back to cartesian views from the immutable original data", () => {
  const option = {
    series: [{
      name: "来源",
      type: "pie",
      data: [{ name: "自然", value: 7 }, { name: "广告", value: 3 }],
    }],
  };

  assert.deepEqual(getSwitchableChartTypes(option), ["line", "bar", "pie"]);
  const converted = convertChartOptionType(option, "line");

  assert.deepEqual(converted.xAxis, { type: "category", data: ["自然", "广告"] });
  assert.equal((converted.series as Array<Record<string, unknown>>)[0]?.type, "line");
  assert.deepEqual((converted.series as Array<Record<string, unknown>>)[0]?.data, [7, 3]);
  assert.equal((option.series[0] as Record<string, unknown>).type, "pie");
});

test("multi-series cartesian charts do not offer lossy pie conversion", () => {
  const option = {
    xAxis: { data: ["A", "B"] },
    yAxis: {},
    series: [
      { type: "line", data: [1, 2] },
      { type: "line", data: [3, 4] },
    ],
  };

  assert.deepEqual(getSwitchableChartTypes(option), ["line", "bar"]);
});

test("mixed line and bar series hide the ambiguous type switch", () => {
  const option = {
    xAxis: { data: ["A", "B"] },
    yAxis: {},
    series: [
      { type: "line", data: [1, 2] },
      { type: "bar", data: [3, 4] },
    ],
  };

  assert.deepEqual(getSwitchableChartTypes(option), []);
});

test("non-numeric cartesian values do not offer an invalid pie conversion", () => {
  const option = {
    xAxis: { data: ["A", "B"] },
    yAxis: {},
    series: [{ type: "line", data: [3, "not-a-number"] }],
  };

  assert.deepEqual(getSwitchableChartTypes(option), ["line", "bar"]);
});
