# src/electron/libs/design-image-path.ts

> 模块：`electron` · 语言：`typescript` · 行数：37

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `resolveDesignImagePath@13`
- `SUPPORTED_IMAGE_EXTENSIONS@3`
- `PLACEHOLDER_IMAGE_NAMES@5`
- `trimmed@15`
- `normalized@19`
- `extension@23`

## 依赖输入

- `path`
- `url`

## 对外暴露

- `resolveDesignImagePath`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { extname, isAbsolute, basename } from "path";
import { fileURLToPath } from "url";

const SUPPORTED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const PLACEHOLDER_IMAGE_NAMES = new Set([
  "image.png",
  "image.jpg",
  "image.jpeg",
  "image.webp",
  "screenshot.png",
  "reference.png",
]);

export function resolveDesignImagePath(pathOrUri: string, label: string): string {
  const trimmed = pathOrUri.trim();
  if (!trimmed) {
    throw new Error(`${label} 不能为空。`);
  }

  const normalized = trimmed.startsWith("file:")
    ? fileURLToPath(trimmed)
    : trimmed;

  const extension = extname(normalized).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(`${label} 格式暂不支持：${basename(normalized)}`);
  }

  if (!isAbsolute(normalized) && PLACEHOLDER_IMAGE_NAMES.has(basename(normalized).toLowerCase())) {
    throw new Error(
      `不要传入占位文件名 ${basename(normalized)}。请从用户附件摘要中复制完整的本地路径，并按 { "imagePath": "C:\\\\...\\\\prompt-attachments\\\\xxx.png" } 传给设计工具。`,
    );
  }

  return normalized;
}

```
