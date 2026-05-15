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
