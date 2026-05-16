# src/electron/libs/task/workspace.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：36

## 文件职责

源码文件。依赖：fs、path、./types.js、./workflow.js

## 关键符号

- `ensureTaskWorkspace@6 - `
- `buildWorkspaceFolderName@15 - `
- `sanitizeSegment@22 - `
- `assertInsideRoot@30 - `
- `root@8 - `
- `folderName@9 - `
- `workspacePath@10 - `
- `provider@17 - `
- `externalId@18 - `
- `title@19 - `
- `relation@32 - `

## 依赖输入

- `fs`
- `path`
- `./types.js`
- `./workflow.js`

## 对外暴露

- `ensureTaskWorkspace`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { mkdirSync } from "fs";
import { isAbsolute, relative, resolve } from "path";

import type { StoredTask } from "./types.js";
import type { TaskWorkflowConfig } from "./workflow.js";

export function ensureTaskWorkspace(task: StoredTask, config: TaskWorkflowConfig): string {
  const root = resolve(config.workspace.root);
  const folderName = buildWorkspaceFolderName(task);
  const workspacePath = resolve(root, folderName);
  assertInsideRoot(workspacePath, root);
  mkdirSync(workspacePath, { recursive: true });
  return workspacePath;
}

function buildWorkspaceFolderName(task: StoredTask): string {
  const provider = sanitizeSegment(task.provider);
  const externalId = sanitizeSegment(task.externalId).slice(0, 48) || sanitizeSegment(task.id).slice(0, 16);
  const title = sanitizeSegment(task.title).slice(0, 48);
  return [provider, externalId, title].filter(Boolean).join("__");
}

function sanitizeSegment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function assertInsideRoot(targetPath: string, root: string): void {
  const relation = relative(root, targetPath);
  if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))) return;
  throw new Error(`Task workspace escaped root: ${targetPath}`);
}

```
