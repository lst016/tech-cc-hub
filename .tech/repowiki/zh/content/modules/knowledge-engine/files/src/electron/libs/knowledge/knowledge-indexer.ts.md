# src/electron/libs/knowledge/knowledge-indexer.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：248

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `writeJson@34`
- `extractMarkdownTitle@38`
- `collectMarkdownFiles@43`
- `walk@50`
- `maybeGenerateWiki@76`
- `buildKnowledgeInputs@88`
- `indexKnowledgeWorkspace@141`
- `DEFAULT_CHUNK_SIZE@24`
- `DEFAULT_CHUNK_OVERLAP@26`
- `firstHeading@40`
- `absolutePath@52`
- `stats@53`
- `content@64`
- `generated@84`
- `vectorIndex@96`
- `indexedDocuments@97`
- `indexedChunks@98`
- `splitter@99`
- `chunks@107`
- `embedding@121`
- `paths@147`
- `settings@149`
- `baseReport@150`
- `repository@173`
- `generated@191`
- `markdownFiles@195`
- `chunks@196`
- `splitter@197`
- `chunkTexts@203`
- `embeddings@204`
- `KnowledgeWorkspacePaths@8`
- `MarkdownFile@27`

## 依赖输入

- `fs`
- `path`
- `@langchain/textsplitters`
- `./knowledge-repository.js`
- `./knowledge-paths.js`
- `./embedding-client.js`
- `./knowledge-model-settings.js`
- `./knowledge-types.js`
- `./knowledge-utils.js`
- `./repowiki/engine.js`

## 对外暴露

- `indexKnowledgeWorkspace`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

export async function indexKnowledgeWorkspace(options
... (truncated)
```
