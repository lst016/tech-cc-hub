import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { basename, extname, join, relative } from "path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { KnowledgeRepository } from "./knowledge-repository.js";
import {
  ensureKnowledgeWorkspaceDirectories,
  resolveKnowledgeWorkspacePaths,
  type KnowledgeWorkspacePaths,
} from "./knowledge-paths.js";
import { embedTextBatches } from "./embedding-client.js";
import { resolveKnowledgeModelSettings } from "./knowledge-model-settings.js";
import type {
  KnowledgeIndexMode,
  KnowledgeIndexReport,
  KnowledgeSourceKind,
  KnowledgeUpsertInput,
  WikiModelSettings,
} from "./knowledge-types.js";
import {
  compactWhitespace,
  estimateTokens,
  stableHash,
} from "./knowledge-utils.js";
import { generateAgentKnowledgeCards } from "./agent-cards.js";
import { generateRepoWiki } from "./repowiki/engine.js";
import type { RepoWikiProgressEvent } from "./repowiki/engine.js";

const DEFAULT_CHUNK_SIZE = 1_800;
const DEFAULT_CHUNK_OVERLAP = 220;

type MarkdownFile = {
  absolutePath: string;
  relativePath: string;
  title: string;
  content: string;
};

type MarkdownIndexItem = MarkdownFile & {
  sourceKind: KnowledgeSourceKind;
  tags: string[];
  metadata: Record<string, unknown>;
  chunks: string[];
  contentHash: string;
  changed: boolean;
};

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function extractMarkdownTitle(content: string, fallback: string): string {
  const firstHeading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return firstHeading || fallback.replace(/\.md$/i, "");
}

function collectMarkdownFiles(dir: string, root: string): MarkdownFile[] {
  if (!existsSync(dir)) {
    return [];
  }

  const files: MarkdownFile[] = [];
  function walk(currentDir: string): void {
    for (const entry of readdirSync(currentDir)) {
      const absolutePath = join(currentDir, entry);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!stats.isFile() || extname(entry).toLowerCase() !== ".md") {
        continue;
      }
      if (entry === "_sidebar.md") {
        continue;
      }
      const content = readFileSync(absolutePath, "utf8");
      files.push({
        absolutePath,
        relativePath: relative(root, absolutePath),
        title: extractMarkdownTitle(content, basename(entry)),
        content,
      });
    }
  }
  walk(dir);
  return files;
}

async function maybeGenerateWiki(
  paths: KnowledgeWorkspacePaths,
  wiki?: WikiModelSettings,
  onProgress?: (event: RepoWikiProgressEvent) => void,
): Promise<{
  generatedFiles: string[];
  skipped: Array<{ path: string; reason: string }>;
}> {
  if (!wiki) {
    return { generatedFiles: [], skipped: [] };
  }

  const generated = await generateRepoWiki(paths, wiki, onProgress);
  return generated;
}

async function buildKnowledgeInputs(
  paths: KnowledgeWorkspacePaths,
  repository: KnowledgeRepository,
  embeddingModel: string,
  embeddings: number[][],
  indexItems: MarkdownIndexItem[],
  onProgress?: (progress: { completed: number; total: number }) => void,
): Promise<{ indexedDocuments: number; indexedChunks: number; changedDocuments: number; changedChunks: number }> {
  let vectorIndex = 0;
  let changedDocuments = 0;
  let changedChunks = 0;
  const changedItems = indexItems.filter((item) => item.changed);
  const sourceKinds = new Set(indexItems.map((item) => item.sourceKind));

  for (const sourceKind of sourceKinds) {
    repository.deleteWorkspaceDocumentsNotIn(
      paths.workspaceScope,
      sourceKind,
      new Set(indexItems.filter((item) => item.sourceKind === sourceKind).map((item) => item.relativePath)),
    );
  }
  onProgress?.({ completed: 0, total: changedItems.length });

  for (const file of changedItems) {
    const input: KnowledgeUpsertInput = {
      workspaceScope: paths.workspaceScope,
      sourceKind: file.sourceKind,
      sourcePath: file.relativePath,
      title: file.title,
      summary: compactWhitespace(file.content, 320),
      tags: file.tags,
      metadata: {
        absolutePath: file.absolutePath,
        contentHash: file.contentHash,
        ...file.metadata,
      },
      content: file.content,
      chunks: file.chunks.map((content, chunkIndex) => {
        const embedding = embeddings[vectorIndex++];
        return {
          content,
          chunkIndex,
          tokenEstimate: estimateTokens(content),
          embedding,
          embeddingModel,
          metadata: {
            title: file.title,
          },
        };
      }),
    };
    repository.upsertDocument(input);
    changedDocuments += 1;
    changedChunks += input.chunks.length;
    onProgress?.({ completed: changedDocuments, total: changedItems.length });
  }

  return {
    indexedDocuments: indexItems.length,
    indexedChunks: indexItems.reduce((total, item) => total + item.chunks.length, 0),
    changedDocuments,
    changedChunks,
  };
}

export async function indexKnowledgeWorkspace(options: {
  workspaceRoot: string;
  appDataPath: string;
  mode: KnowledgeIndexMode;
  onProgress?: (event: RepoWikiProgressEvent) => void;
}): Promise<KnowledgeIndexReport> {
  const paths = resolveKnowledgeWorkspacePaths(options.workspaceRoot, options.appDataPath);
  ensureKnowledgeWorkspaceDirectories(paths);
  const settings = resolveKnowledgeModelSettings();
  const baseReport = {
    workspaceScope: paths.workspaceScope,
    techRoot: paths.techRoot,
    repositoryReady: true,
    embeddingEnabled: Boolean(settings.embedding),
    vectorStoreReady: false,
    wikiGenerationEnabled: Boolean(settings.wiki),
    indexedDocuments: 0,
    indexedChunks: 0,
    skippedFiles: 0,
    generatedFiles: [] as string[],
  };

  if (!settings.embedding) {
    const report: KnowledgeIndexReport = {
      ...baseReport,
      success: false,
      message: "Knowledge Engine 未启用：缺少 embeddingModel，不能只用 FTS5 开启知识库。",
      error: "missing-embedding-model",
    };
    writeJson(paths.indexStatePath, report);
    return report;
  }

  const repository = new KnowledgeRepository(paths.knowledgeDbPath, {
    embeddingDimension: settings.embedding.dimension,
  });

  try {
    if (!repository.isVectorStoreReady()) {
      const report: KnowledgeIndexReport = {
        ...baseReport,
        vectorStoreReady: false,
        success: false,
        message: "Knowledge Engine 未启用：sqlite-vec 扩展不可用。",
        error: "sqlite-vec-unavailable",
      };
      writeJson(paths.indexStatePath, report);
      repository.recordIndexRun(paths.workspaceScope, options.mode, "error", report);
      return report;
    }

    const generated = options.mode === "generate" || options.mode === "refresh"
      ? await maybeGenerateWiki(paths, settings.wiki, options.onProgress)
      : { generatedFiles: [], skipped: [] };
    options.onProgress?.({
      stage: "message",
      message: "正在生成 Agent Cards。",
    });
    const agentCards = generateAgentKnowledgeCards(paths);
    const markdownFiles = collectMarkdownFiles(paths.repowikiContentDir, paths.workspaceRoot);
    const agentCardFiles = collectMarkdownFiles(paths.agentCardsDir, paths.workspaceRoot);
    const allFiles = [
      ...markdownFiles.map((file) => ({
        ...file,
        sourceKind: "repowiki" as const,
        tags: ["repowiki", "markdown"],
        metadata: {},
      })),
      ...agentCardFiles.map((file) => ({
        ...file,
        sourceKind: "agent_card" as const,
        tags: ["agent-card", "repowiki", "code-routing"],
        metadata: {
          agentCard: true,
        },
      })),
    ];
    options.onProgress?.({
      stage: "indexing",
      message: `准备索引 ${markdownFiles.length} 篇 Repo Wiki 文档和 ${agentCardFiles.length} 张 Agent Cards。`,
      completed: 0,
      total: Math.max(1, allFiles.length),
    });
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: DEFAULT_CHUNK_SIZE,
      chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    });
    const existingDocuments = new Map(
      repository
        .listWorkspaceDocuments(paths.workspaceScope)
        .filter((document) => document.sourceKind === "repowiki" || document.sourceKind === "agent_card")
        .map((document) => [`${document.sourceKind}:${document.sourcePath}`, document.contentHash] as const),
    );
    const indexItems: MarkdownIndexItem[] = await Promise.all(allFiles.map(async (file) => {
      const contentHash = stableHash(file.content);
      return {
        ...file,
        contentHash,
        chunks: await splitter.splitText(file.content),
        changed: existingDocuments.get(`${file.sourceKind}:${file.relativePath}`) !== contentHash,
      };
    }));
    const changedItems = indexItems.filter((item) => item.changed);
    const chunkTexts = changedItems.flatMap((item) => item.chunks);
    options.onProgress?.({
      stage: "embedding",
      message: chunkTexts.length > 0
        ? `准备生成 ${chunkTexts.length} 个向量。`
        : "Repo Wiki 文档未变化，复用现有向量索引。",
      completed: 0,
      total: Math.max(1, chunkTexts.length),
    });
    const embeddings = await embedTextBatches(settings.embedding, chunkTexts, ({ completed, total }) => {
      options.onProgress?.({
        stage: "embedding",
        message: `正在生成向量 ${completed}/${total}。`,
        completed,
        total: Math.max(1, total),
      });
    });
    options.onProgress?.({
      stage: "indexing",
      message: `正在写入索引 0/${changedItems.length}。`,
      completed: 0,
      total: Math.max(1, changedItems.length),
    });
    const { indexedDocuments, indexedChunks, changedDocuments, changedChunks } = await buildKnowledgeInputs(
      paths,
      repository,
      settings.embedding.model,
      embeddings,
      indexItems,
      ({ completed, total }) => {
        options.onProgress?.({
          stage: "indexing",
          message: `正在写入索引 ${completed}/${total}。`,
          completed,
          total: Math.max(1, total),
        });
      },
    );
    const report: KnowledgeIndexReport = {
      ...baseReport,
      success: true,
      vectorStoreReady: true,
      wikiGenerationEnabled: Boolean(settings.wiki),
      indexedDocuments,
      indexedChunks,
      skippedFiles: generated.skipped.length + agentCards.skippedFiles.length,
      generatedFiles: [...generated.generatedFiles, ...agentCards.generatedFiles],
      message: `Knowledge Engine 索引完成：${indexedDocuments} 个文档，${indexedChunks} 个 chunks，刷新 ${changedDocuments} 个文档/${changedChunks} 个 chunks。`,
    };
    writeJson(paths.indexStatePath, report);
    writeJson(paths.skippedFilesPath, [...generated.skipped, ...agentCards.skippedFiles]);
    writeJson(paths.generationReportPath, {
      generatedAt: Date.now(),
      mode: options.mode,
      wikiModel: settings.wiki?.model,
      generatedFiles: generated.generatedFiles,
      agentCardFiles: agentCards.generatedFiles,
      agentCards: agentCards.cards.length,
      indexedDocuments,
      indexedChunks,
      changedDocuments,
      changedChunks,
    });
    repository.recordIndexRun(paths.workspaceScope, options.mode, "success", report);
    return report;
  } catch (error) {
    const report: KnowledgeIndexReport = {
      ...baseReport,
      vectorStoreReady: repository.isVectorStoreReady(),
      success: false,
      message: "Knowledge Engine 索引失败。",
      error: error instanceof Error ? error.message : String(error),
    };
    writeJson(paths.indexStatePath, report);
    repository.recordIndexRun(paths.workspaceScope, options.mode, "error", report);
    return report;
  } finally {
    repository.close();
  }
}
