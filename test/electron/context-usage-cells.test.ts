import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildSegmentedContextUsageCells } from "../../src/ui/utils/context-usage-cells.js";

describe("context usage cells", () => {
  it("uses separate colors for small non-zero token categories", () => {
    const cells = buildSegmentedContextUsageCells([
      { id: "system", label: "系统提示", tokens: 997, className: "system-color" },
      { id: "tool-definitions", label: "工具定义估算", tokens: 1_560, className: "tool-definition-color" },
      { id: "tool-payload", label: "工具输入/输出", tokens: 485_600, className: "tool-payload-color" },
      { id: "messages", label: "消息内容", tokens: 15_300, className: "message-color" },
    ], 1_000_000);

    assert.equal(cells.length, 40);
    assert.ok(cells.some((cell) => cell.segmentId === "system"));
    assert.ok(cells.some((cell) => cell.segmentId === "tool-definitions"));
    assert.ok(cells.some((cell) => cell.segmentId === "tool-payload"));
    assert.ok(cells.some((cell) => cell.segmentId === "messages"));
  });

  it("leaves unused context cells muted", () => {
    const cells = buildSegmentedContextUsageCells([
      { id: "messages", label: "消息内容", tokens: 250_000, className: "message-color" },
    ], 1_000_000);

    assert.equal(cells.filter((cell) => cell.segmentId === "messages").length, 10);
    assert.equal(cells.filter((cell) => cell.segmentId === "free").length, 30);
  });

  it("keeps tiny non-zero categories visible even below one grid cell", () => {
    const cells = buildSegmentedContextUsageCells([
      { id: "system", label: "系统提示", tokens: 997, className: "system-color" },
      { id: "tool-definitions", label: "工具定义估算", tokens: 1_560, className: "tool-definition-color" },
      { id: "messages", label: "消息内容", tokens: 2_630, className: "message-color" },
    ], 1_000_000);

    assert.ok(cells.some((cell) => cell.segmentId === "system"));
    assert.ok(cells.some((cell) => cell.segmentId === "tool-definitions"));
    assert.ok(cells.some((cell) => cell.segmentId === "messages"));
  });
});
