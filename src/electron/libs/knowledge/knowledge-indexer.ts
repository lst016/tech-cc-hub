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
  KnowledgeUpsertInput,
  WikiModelSettings,
} from "./knowledge-types.js";
import {
  compactWhitespace,
  estimateTokens,
  stableHash,
} from "./knowledge-utils.js";
import { generateRepoWiki } from "./repowiki/engine.js";

const DEFAULT_CHUNK_SIZE = 1_800;
const DEFAULT_CHUNK_OVERLAP = 220;

type MarkdownFile = {
  absolutePath: string;
  relativePath: string;
  title: string;
  content: string;
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

async function maybeGenerateWiki(paths: KnowledgeWorkspacePaths, wiki?: WikiModelSettings): Promise<{
  generatedFiles: string[];
  skipped: Array<{ path: string; reason: string }>;
}> {
  if (!wiki) {
    return { generatedFiles: [], skipped: [] };
  }

  const generated = await generateRepoWiki(paths, wiki);
  return generated;
}

async function buildKnowledgeInputs(
  paths: KnowledgeWorkspacePaths,
  repository: KnowledgeRepository,
  embeddingModel: string,
  embeddings: number[][],
  markdownFiles: MarkdownFile[],
): Promise<{ indexedDocuments: number; indexedChunks: number }> {
  let vectorIndex = 0;
  let indexedDocuments = 0;
  let indexedChunks = 0;
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: DEFAULT_CHUNK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
  });

  repository.deleteWorkspaceDocuments(paths.workspaceScope, "repowiki");

  for (const file of markdownFiles) {
    const chunks = await splitter.splitText(file.content);
    const input: KnowledgeUpsertInput = {
      workspaceScope: paths.workspaceScope,
      sourceKind: "repowiki",
      sourcePath: file.relativePath,
      title: file.title,
      summary: compactWhitespace(file.content, 320),
      tags: ["repowiki", "markdown"],
      metadata: {
        absolutePath: file.absolutePath,
        contentHash: stableHash(file.content),
      },
      content: file.content,
      chunks: chunks.map((content, chunkIndex) => {
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
    indexedDocuments += 1;
    indexedChunks += input.chunks.length;
  }

  return { indexedDocuments, indexedChunks };
}

export async function indexKnowledgeWorkspace(options: {
  workspaceRoot: string;
  appDataPath: string;
  mode: KnowledgeIndexMode;
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
      ? await maybeGenerateWiki(paths, settings.wiki)
      : { generatedFiles: [], skipped: [] };
    const markdownFiles = collectMarkdownFiles(paths.repowikiContentDir, paths.workspaceRoot);
    const chunks = await Promise.all(markdownFiles.map(async (file) => {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: DEFAULT_CHUNK_SIZE,
        chunkOverlap: DEFAULT_CHUNK_OVERLAP,
      });
      return splitter.splitText(file.content);
    }));
    const chunkTexts = chunks.flat();
    const embeddings = await embedTextBatches(settings.embedding, chunkTexts);
    const { indexedDocuments, indexedChunks } = await buildKnowledgeInputs(
      paths,
      repository,
      settings.embedding.model,
      embeddings,
      markdownFiles,
    );
    const report: KnowledgeIndexReport = {
      ...baseReport,
      success: true,
      vectorStoreReady: true,
      wikiGenerationEnabled: Boolean(settings.wiki),
      indexedDocuments,
      indexedChunks,
      skippedFiles: generated.skipped.length,
      generatedFiles: generated.generatedFiles,
      message: `Knowledge Engine 索引完成：${indexedDocuments} 个文档，${indexedChunks} 个 chunks。`,
    };
    writeJson(paths.indexStatePath, report);
    writeJson(paths.skippedFilesPath, generated.skipped);
    writeJson(paths.generationReportPath, {
      generatedAt: Date.now(),
      mode: options.mode,
      wikiModel: settings.wiki?.model,
      generatedFiles: generated.generatedFiles,
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
