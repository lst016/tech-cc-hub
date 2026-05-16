# test/electron/design-inspection-dsl.test.ts

> 模块：`test` · 语言：`typescript` · 行数：46

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `prompt@11`
- `dsl@18`
- `dsl@40`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/electron/libs/design-inspection-dsl.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildDesignInspectionPrompt,
  parseDesignInspectionDsl,
} from "../../src/electron/libs/design-inspection-dsl.js";

describe("design inspection DSL", () => {
  it("builds a JSON-only visual inspection prompt", () => {
    const prompt = buildDesignInspectionPrompt("分析弹窗");
    assert.match(prompt, /只输出一个 JSON 对象/);
    assert.match(prompt, /"regions"/);
    assert.match(prompt, /"elements"/);
  });

  it("parses fenced JSON returned by the vision model", () => {
    const dsl = parseDesignInspectionDsl([
      "图片附件：demo.png",
      "```json",
      JSON.stringify({
        summary: "链接二维码弹窗",
        screen: { kind: "modal", language: "zh-CN" },
        regions: [{ id: "header", role: "header", alignment: "center" }],
        elements: [{ id: "download", type: "button", text: "下载二维码", priority: "high" }],
        visualTokens: { colors: ["primary blue for download"] },
        implementationHints: ["modal footer buttons centered"],
      }),
      "```",
    ].join("\n"), { width: 731, height: 588 });

    assert.equal(dsl.schemaVersion, 1);
    assert.equal(dsl.summary, "链接二维码弹窗");
    assert.equal(dsl.screen.kind, "modal");
    assert.equal(dsl.regions[0].id, "header");
    assert.equal(dsl.elements[0].text, "下载二维码");
  });

  it("falls back to a minimal DSL for plain text summaries", () => {
    const dsl = parseDesignInspectionDsl("弹窗为链接/二维码模态框，底部有关闭和下载二维码按钮。");
    assert.equal(dsl.screen.kind, "modal");
    assert.equal(dsl.rawSummary?.includes("链接/二维码"), true);
    assert.ok(dsl.implementationHints?.length);
  });
});

```
