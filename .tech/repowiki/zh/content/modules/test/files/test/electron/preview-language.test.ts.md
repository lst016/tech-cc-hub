# test/electron/preview-language.test.ts

> 模块：`test` · 语言：`typescript` · 行数：32

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 依赖输入

- `node:assert/strict`
- `node:test`
- `../../src/ui/utils/preview-language.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPreviewMonacoModelPath,
  normalizeMonacoLanguage,
} from "../../src/ui/utils/preview-language.js";

test("normalizes jsx and tsx files to Monaco language ids", () => {
  assert.equal(normalizeMonacoLanguage(undefined, "AdminPhoneController.tsx"), "typescript");
  assert.equal(normalizeMonacoLanguage(undefined, "Widget.jsx"), "javascript");
  assert.equal(normalizeMonacoLanguage("tsx"), "typescript");
  assert.equal(normalizeMonacoLanguage("jsx"), "javascript");
});

test("builds file URI model paths that preserve jsx and tsx extensions", () => {
  assert.equal(
    buildPreviewMonacoModelPath("D:\\workspace\\app\\src\\Widget.tsx"),
    "file:///D:/workspace/app/src/Widget.tsx",
  );
  assert.equal(
    buildPreviewMonacoModelPath("D:\\workspace\\app\\src\\Widget.jsx"),
    "file:///D:/workspace/app/src/Widget.jsx",
  );
});

test("encodes model path characters that would break URI parsing", () => {
  assert.equal(
    buildPreviewMonacoModelPath("D:\\workspace\\my app\\src\\Widget#preview.tsx"),
    "file:///D:/workspace/my%20app/src/Widget%23preview.tsx",
  );
});

```
