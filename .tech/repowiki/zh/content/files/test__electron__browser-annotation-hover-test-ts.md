# test/electron/browser-annotation-hover.test.ts

> 模块：`test` · 语言：`typescript` · 行数：34

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `source@7`
- `source@16`
- `source@24`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `node:fs`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("browser annotation hover preview", () => {
  it("installs a mousemove hover preview while annotation mode is active", () => {
    const source = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(source, /function updateHover\(/);
    assert.match(source, /document\.addEventListener\("mousemove", window\.__techCcHubAnnotationHoverHandler, true\)/);
    assert.match(source, /"\.__tech_cc_hub_hover\{/);
    assert.doesNotMatch(source, /__tech_cc_hub_hover_label/);
  });

  it("emits annotations through the BrowserWorkbench preload bridge instead of page console logs", () => {
    const source = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(source, /window\.__techCcHubAnnotation/);
    assert.match(source, /bridge\.emit\(JSON\.stringify\(annotation\)\)/);
    assert.doesNotMatch(source, /console\.info\(options\.prefix/);
  });

  it("keeps hover and outlines below annotation controls", () => {
    const source = readFileSync("src/electron/browser-manager.ts", "utf8");

    assert.match(source, /__tech_cc_hub_annotation_layer__\{[^"]*isolation:isolate/);
    assert.match(source, /\.__tech_cc_hub_hover\{[^"]*z-index:10/);
    assert.match(source, /\.__tech_cc_hub_outline\{[^"]*z-index:20/);
    assert.match(source, /\.__tech_cc_hub_comment\{[^"]*z-index:30/);
    assert.match(source, /\.__tech_cc_hub_marker\{[^"]*z-index:40/);
    assert.match(source, /\.__tech_cc_hub_background\{[^"]*z-index:50/);
  });
});

```
