# src/electron/libs/knowledge/knowledge-types.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：125

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `KnowledgeSourceKind@1`
- `KnowledgeIndexMode@2`
- `KnowledgeSearchMode@4`
- `KnowledgeScopeMode@6`
- `KnowledgeDocument@8`
- `KnowledgeChunk@22`
- `KnowledgeDocumentInput@39`
- `KnowledgeChunkInput@50`
- `KnowledgeUpsertInput@59`
- `KnowledgeSearchResult@63`
- `KnowledgeOverviewEntry@76`
- `KnowledgeIndexReport@83`
- `EmbeddingModelSettings@99`
- `WikiModelSettings@109`
- `KnowledgeModelSettings@120`

## 对外暴露

- `KnowledgeSourceKind`
- `KnowledgeIndexMode`
- `KnowledgeSearchMode`
- `KnowledgeScopeMode`
- `KnowledgeDocument`
- `KnowledgeChunk`
- `KnowledgeDocumentInput`
- `KnowledgeChunkInput`
- `KnowledgeUpsertInput`
- `KnowledgeSearchResult`
- `KnowledgeOverviewEntry`
- `KnowledgeIndexReport`
- `EmbeddingModelSettings`
- `WikiModelSettings`
- `KnowledgeModelSettings`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type KnowledgeSourceKind = "repowiki" | "memory" | "manual" | "source";

export type KnowledgeIndexMode = "scan" | "generate" | "refresh";

export type KnowledgeSearchMode = "shallow" | "deep" | "hybrid";

export type KnowledgeScopeMode = "workspace" | "memory" | "all";

export type KnowledgeDocument = {
  id: string;
  workspaceScope: string;
  sourceKind: KnowledgeSourceKind;
  sourcePath: string;
  title: string;
  summary?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  contentHash: string;
  createdAt: number;
  updatedAt: number;
};

export type KnowledgeChunk = {
  id: string;
  documentId: string;
  workspaceScope: string;
  sourceKind: KnowledgeSourceKind;
  sourcePath: string;
  title: string;
  content: string;
  chunkIndex: number;
  tokenEstimate: number;
  metadata: Record<string, unknown>;
  embeddingModel?: string;
  embeddingDimension?: number;
  createdAt: number;
  updatedAt: number;
};

export type KnowledgeDocumentInput = {
  workspaceScope: string;
  sourceKind: KnowledgeSourceKind;
  sourcePath: string;
  title: string;
  summary?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  content: string;
};

export type KnowledgeChunkInput = {
  content: string;
  chunkIndex: number;
  tokenEstimate: number;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  embeddingModel?: string;
};

export type KnowledgeUpsertInput = KnowledgeDocumentInput & {
  chunks: KnowledgeChunkInput[];
};

export type KnowledgeSearchResult = {
  chunkId: string;
  documentId: string;
  title: string;
  sourceKind: KnowledgeSourceKind;
  sourcePath: string;
  content: string;
  score: number;
  vectorDistance?: number;
  rank?: number;
  updatedAt: number;
};

export type KnowledgeOverviewEntry = {
  category: KnowledgeSourceKind;
  title: string;
  sourcePath: string;
  updatedAt: number;
};

export type KnowledgeIndexReport = {
  success: boolean;
  workspaceScope: string;
  techRoot: string;
  repositoryReady: boolean;
  embeddingEnabled: boolean;
  vectorStoreReady: boolean;
  wikiGenerationEnabled: boolean;
  indexedDocuments: number;
  indexedChunks: number;
  skippedFiles: number;
  generatedFiles: string[];
  message: string;
  error?: string;
};

export type EmbeddingModelSettings = {
  profileId: string;
  profileName: string;
  apiKey: string;
  baseURL: string;
  model: string;
  dimension: number;
  batchSize: number;
};

export type WikiModelSettings = {
  profileId: string;
  profileName: string;
  apiKey: string;
  baseURL: string;
  model: string;
  costTier: "free" | "cheap" | "standard";
  maxInputTokens: number;
  maxOutputTokens: number;
};

export type KnowledgeModelSettings = {
  embedding?: EmbeddingModelSettings;
  wiki?: WikiModelSettings;
};

```
