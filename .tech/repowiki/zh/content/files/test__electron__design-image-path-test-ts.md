# test/electron/design-image-path.test.ts

> 模块：`test` · 语言：`typescript` · 行数：20

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `filePath@9`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `url`
- `../../src/electron/libs/design-image-path.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "url";

import { resolveDesignImagePath } from "../../src/electron/libs/design-image-path.js";

describe("design image path resolution", () => {
  it("converts file URI image paths into local filesystem paths", () => {
    const filePath = "D:\\tmp\\reference.png";
    assert.equal(resolveDesignImagePath(pathToFileURL(filePath).toString(), "图片路径"), filePath);
  });

  it("rejects placeholder image filenames with actionable guidance", () => {
    assert.throws(
      () => resolveDesignImagePath("image.png", "图片路径"),
      /不要传入占位文件名 image\.png/,
    );
  });
});

```
