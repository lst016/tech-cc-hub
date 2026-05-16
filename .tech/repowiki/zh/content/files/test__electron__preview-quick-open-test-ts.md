# test/electron/preview-quick-open.test.ts

> 模块：`test` · 语言：`typescript` · 行数：30

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `result@18`
- `result@23`
- `PreviewQuickOpenEntry@7`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/shared/preview-quick-open.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import {
  filterPreviewQuickOpenEntries,
  scorePreviewQuickOpenEntry,
  type PreviewQuickOpenEntry,
} from "../../src/shared/preview-quick-open.js";

const entries: PreviewQuickOpenEntry[] = [
  { name: "index.tsx", path: "D:/repo/src/pages/main/index.tsx", relativePath: "src/pages/main/index.tsx" },
  { name: "package.json", path: "D:/repo/package.json", relativePath: "package.json" },
  { name: "config.tsx", path: "D:/repo/src/pages/main/setting/config.tsx", relativePath: "src/pages/main/setting/config.tsx" },
  { name: "README.md", path: "D:/repo/README.md", relativePath: "README.md" },
];

test("quick open ranks basename matches before deep path matches", () => {
  const result = filterPreviewQuickOpenEntries(entries, "config");
  assert.equal(result[0]?.relativePath, "src/pages/main/setting/config.tsx");
});

test("quick open supports path fragment queries", () => {
  const result = filterPreviewQuickOpenEntries(entries, "pages main index");
  assert.equal(result[0]?.relativePath, "src/pages/main/index.tsx");
});

test("quick open excludes entries that do not match every token", () => {
  assert.equal(scorePreviewQuickOpenEntry(entries[1], "src config"), null);
});

```
