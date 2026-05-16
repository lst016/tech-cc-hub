# src/ui/utils/preview-file-locator.ts

> 模块：`ui-shell` · 语言：`typescript` · 行数：46

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `trimTrailingPreviewSeparators@2`
- `getPreferredSeparator@8`
- `appendPreviewPathSegment@12`
- `isPreviewFileInsideWorkspace@18`
- `getPreviewFileAncestorDirectories@24`
- `trimmed@4`
- `separator@14`
- `needsSeparator@15`
- `normalizedWorkspace@20`
- `normalizedFilePath@21`
- `workspaceRoot@26`
- `targetPath@27`
- `normalizedWorkspace@31`
- `unifiedTargetPath@33`
- `relativePath@34`
- `segments@35`
- `directories@36`
- `currentPath@37`

## 依赖输入

- `./preview-file-refresh.js`

## 对外暴露

- `isPreviewFileInsideWorkspace`
- `getPreviewFileAncestorDirectories`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { normalizePreviewFilePath } from './preview-file-refresh.js';

function trimTrailingPreviewSeparators(path: string): string {
  const trimmed = path.trim();
  if (trimmed === '/' || /^[a-z]:[\\/]?$/i.test(trimmed)) return trimmed;
  return trimmed.replace(/[\\/]+$/, '');
}

function getPreferredSeparator(path: string): '\\' | '/' {
  return path.includes('\\') ? '\\' : '/';
}

function appendPreviewPathSegment(basePath: string, segment: string): string {
  const separator = getPreferredSeparator(basePath);
  const needsSeparator = !basePath.endsWith('/') && !basePath.endsWith('\\');
  return `${basePath}${needsSeparator ? separator : ''}${segment}`;
}

export function isPreviewFileInsideWorkspace(workspace: string, filePath: string): boolean {
  const normalizedWorkspace = normalizePreviewFilePath(trimTrailingPreviewSeparators(workspace));
  const normalizedFilePath = normalizePreviewFilePath(trimTrailingPreviewSeparators(filePath));
  return normalizedFilePath === normalizedWorkspace || normalizedFilePath.startsWith(`${normalizedWorkspace}/`);
}

export function getPreviewFileAncestorDirectories(workspace: string, filePath: string): string[] {
  const workspaceRoot = trimTrailingPreviewSeparators(workspace);
  const targetPath = trimTrailingPreviewSeparators(filePath);
  if (!workspaceRoot || !targetPath || !isPreviewFileInsideWorkspace(workspaceRoot, targetPath)) {
    return [];
  }

  const normalizedWorkspace = normalizePreviewFilePath(workspaceRoot);
  const unifiedTargetPath = targetPath.replace(/\\/g, '/');
  const relativePath = unifiedTargetPath.slice(normalizedWorkspace.length).replace(/^\/+/, '');
  const segments = relativePath.split('/').filter(Boolean);
  const directories = [workspaceRoot];

  let currentPath = workspaceRoot;
  for (const segment of segments.slice(0, -1)) {
    currentPath = appendPreviewPathSegment(currentPath, segment);
    directories.push(currentPath);
  }

  return directories;
}

```
