# src/electron/libs/knowledge/knowledge-paths.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：84

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `createWorkspaceScope@26`
- `createWorkspaceHash@30`
- `resolveKnowledgeWorkspacePaths@34`
- `ensureKnowledgeWorkspaceDirectories@70`
- `resolvedRoot@36`
- `workspaceSlug@37`
- `workspaceHash@38`
- `techRoot@39`
- `repowikiRoot@40`
- `repowikiContentDir@41`
- `repowikiMetaDir@42`
- `memoryDir@43`
- `reportsDir@44`
- `appDataRoot@45`
- `appDataWorkspaceRoot@46`
- `KnowledgeWorkspacePaths@4`

## 依赖输入

- `crypto`
- `fs`
- `path`

## 对外暴露

- `KnowledgeWorkspacePaths`
- `createWorkspaceScope`
- `createWorkspaceHash`
- `resolveKnowledgeWorkspacePaths`
- `ensureKnowledgeWorkspaceDirectories`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { createHash } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { basename, join, resolve } from "path";

export type KnowledgeWorkspacePaths = {
  workspaceRoot: string;
  workspaceSlug: string;
  workspaceScope: string;
  workspaceHash: string;
  techRoot: string;
  repowikiRoot: string;
  repowikiContentDir: string;
  repowikiMetaDir: string;
  repowikiMetadataPath: string;
  memoryDir: string;
  memoryJsonPath: string;
  reportsDir: string;
  indexStatePath: string;
  skippedFilesPath: string;
  generationReportPath: string;
  appDataRoot: string;
  appDataWorkspaceRoot: string;
  knowledgeDbPath: string;
  memoryDbPath: string;
};

export function createWorkspaceScope(workspaceRoot: string): string {
  return `workspace:${basename(resolve(workspaceRoot)) || "workspace"}`;
}

export function createWorkspaceHash(workspaceRoot: string): string {
  return createHash("sha256").update(resolve(workspaceRoot)).digest("hex").slice(0, 16);
}

export function resolveKnowledgeWorkspacePaths(workspaceRoot: string, appDataPath: string): KnowledgeWorkspacePaths {
  const resolvedRoot = resolve(workspaceRoot);
  const workspaceSlug = basename(resolvedRoot) || "workspace";
  const workspaceHash = createWorkspaceHash(resolvedRoot);
  const techRoot = join(resolvedRoot, ".tech");
  const repowikiRoot = join(techRoot, "repowiki", "zh");
  const repowikiContentDir = join(repowikiRoot, "content");
  const repowikiMetaDir = join(repowikiRoot, "meta");
  const memoryDir = join(techRoot, "memory");
  const reportsDir = join(techRoot, "reports");
  const appDataRoot = join(appDataPath, "knowledge");
  const appDataWorkspaceRoot = join(appDataRoot, workspaceHash);

  return {
    workspaceRoot: resolvedRoot,
    workspaceSlug,
    workspaceScope: createWorkspaceScope(resolvedRoot),
    workspaceHash,
    techRoot,
    repowikiRoot,
    repowikiContentDir,
    repowikiMetaDir,
    repowikiMetadataPath: join(repowikiMetaDir, "repowiki-metadata.json"),
    memoryDir,
    memoryJsonPath: join(memoryDir, "memories.json"),
    reportsDir,
    indexStatePath: join(reportsDir, "index-state.json"),
    skippedFilesPath: join(reportsDir, "skipped-files.json"),
    generationReportPath: join(reportsDir, "generation-report.json"),
    appDataRoot,
    appDataWorkspaceRoot,
    knowledgeDbPath: join(appDataWorkspaceRoot, "knowledge.sqlite"),
    memoryDbPath: join(appDataWorkspaceRoot, "memory.sqlite"),
  };
}

export function ensureKnowledgeWorkspaceDirectories(paths: KnowledgeWorkspacePaths): void {
  for (const dir of [
    paths.repowikiContentDir,
    paths.repowikiMetaDir,
    paths.memoryDir,
    paths.reportsDir,
    paths.appDataWorkspaceRoot,
  ]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

```
