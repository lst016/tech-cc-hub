# src/ui/utils/preview-language.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：48

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `getFileExtension@1`
- `normalizeMonacoLanguage@5`
- `encodeModelPathSegment@28`
- `buildPreviewMonacoModelPath@33`
- `index@2`
- `raw@7`
- `rawPath@35`
- `normalizedPath@37`
- `absoluteLikePath@39`
- `encodedPath@44`

## 对外暴露

- `getFileExtension`
- `normalizeMonacoLanguage`
- `buildPreviewMonacoModelPath`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : "";
}

export function normalizeMonacoLanguage(language?: string, fileName?: string): string {
  const raw = (language || getFileExtension(fileName || "") || "plaintext").toLowerCase();
  const map: Record<string, string> = {
    bash: "shell",
    cjs: "javascript",
    conf: "ini",
    env: "ini",
    htm: "html",
    js: "javascript",
    jsx: "javascript",
    md: "markdown",
    mjs: "javascript",
    py: "python",
    rb: "ruby",
    sh: "shell",
    ts: "typescript",
    tsx: "typescript",
    yml: "yaml",
    zsh: "shell",
  };
  return map[raw] || raw || "plaintext";
}

function encodeModelPathSegment(segment: string, index: number): string {
  if (index === 1 && /^[a-z]:$/i.test(segment)) return segment;
  return encodeURIComponent(segment);
}

export function buildPreviewMonacoModelPath(filePath?: string, fileName?: string): string | undefined {
  const rawPath = (filePath || fileName || "").trim();
  if (!rawPath) return undefined;

  const normalizedPath = rawPath.replace(/\\/g, "/");
  const absoluteLikePath = /^[a-z]:\//i.test(normalizedPath)
    ? `/${normalizedPath}`
    : normalizedPath.startsWith("/")
      ? normalizedPath
      : `/${normalizedPath}`;
  const encodedPath = absoluteLikePath.split("/").map(encodeModelPathSegment).join("/");

  return `file://${encodedPath}`;
}

```
