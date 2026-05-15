import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { basename, extname, join, relative } from "path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { KnowledgeRepository } from "./knowledge-repository.js";
import {
  ensureKnowledgeWorkspaceDirectories,
  resolveKnowledgeWorkspacePaths,
  type KnowledgeWorkspacePaths,
} from "./knowledge-paths.js";
import { embedTextBatches } from "./embedding-client.js";
import { generateWikiMarkdown } from "./wiki-model-client.js";
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
  walkWorkspaceFiles,
} from "./knowledge-utils.js";

const DEFAULT_CHUNK_SIZE = 1_800;
const DEFAULT_CHUNK_OVERLAP = 220;
const MAX_WIKI_SOURCE_FILES = 120;
const MAX_WIKI_PROMPT_CHARS = 48_000;

type MarkdownFile = {
  absolutePath: string;
  relativePath: string;
  title: string;
  content: string;
};

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureParentDir(path: string): void {
  const dir = path.split(/[\\/]/).slice(0, -1).join("/");
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
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

function buildWikiPrompt(paths: KnowledgeWorkspacePaths): {
  prompt: string;
  skipped: Array<{ path: string; reason: string }>;
} {
  const { files, skipped } = walkWorkspaceFiles(paths.workspaceRoot, {
    maxFiles: MAX_WIKI_SOURCE_FILES,
    maxFileBytes: 80_000,
    includeTech: false,
  });
  const packageJsonPath = join(paths.workspaceRoot, "package.json");
  const packageJson = existsSync(packageJsonPath)
    ? readFileSync(packageJsonPath, "utf8").slice(0, 8_000)
    : "";

  const fileSummaries: string[] = [];
  let usedChars = 0;
  for (const file of files) {
    if (usedChars >= MAX_WIKI_PROMPT_CHARS) {
      skipped.push({ path: file.relativePath, reason: "wiki prompt budget exceeded" });
      continue;
    }
    const content = readFileSync(file.absolutePath, "utf8");
    const snippet = content.slice(0, 2_200);
    const block = [
      `## ${file.relativePath}`,
      "```",
      snippet,
      "```",
    ].join("\n");
    usedChars += block.length;
    fileSummaries.push(block);
  }

  const prompt = [
    `仓库路径：${paths.workspaceRoot}`,
    "请生成一个面向前端/Agent 的 Repo Wiki 总览，要求：",
    "- 中文 Markdown。",
    "- 说明项目用途、主要技术栈、核心目录、运行/构建入口、后续实现切入点。",
    "- 不要编造没有出现在文件列表或 package.json 里的事实。",
    "- 内容适合保存到 .tech/repowiki/zh/content/00-project-overview.md。",
    "",
    "package.json:",
    "```json",
    packageJson,
    "```",
    "",
    "源码片段：",
    ...fileSummaries,
  ].join("\n");

  return { prompt, skipped };
}

async function maybeGenerateWiki(paths: KnowledgeWorkspacePaths, wiki?: WikiModelSettings): Promise<{
  generatedFiles: string[];
  skipped: Array<{ path: string; reason: string }>;
}> {
  if (!wiki) {
    return { generatedFiles: [], skipped: [] };
  }

  const { prompt, skipped } = buildWikiPrompt(paths);
  const markdown = await generateWikiMarkdown(wiki, prompt);
  const overviewPath = join(paths.repowikiContentDir, "00-project-overview.md");
  ensureParentDir(overviewPath);
  writeFileSync(overviewPath, `${markdown.trim()}\n`, "utf8");
  writeJson(paths.repowikiMetadataPath, {
    version: 1,
    generatedAt: Date.now(),
    workspaceScope: paths.workspaceScope,
    wikiModel: wiki.model,
    costTier: wiki.costTier,
    files: ["00-project-overview.md"],
  });
  return {
    generatedFiles: [relative(paths.workspaceRoot, overviewPath)],
    skipped,
  };
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
