# src/electron/libs/knowledge/repowiki/analyzer.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：560

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildKeyFilesContext@290`
- `groupIntoModules@307`
- `rankModuleFiles@316`
- `buildModuleFilesContext@324`
- `modulePriority@340`
- `filePriority@363`
- `buildFallbackModuleDoc@373`
- `modulePurpose@414`
- `buildFallbackDescription@426`
- `describeFile@437`
- `buildFallbackRelationships@451`
- `buildFallbackConcepts@469`
- `buildOperationalNotes@481`
- `buildChangeRisks@498`
- `buildValidationHints@512`
- `contentHash@536`
- `isRecord@540`
- `asString@544`
- `asNumber@548`
- `asArray@552`
- `asStringArray@556`
- `RepoWikiAnalyzer@43`
- `MAX_KEY_FILES_CHARS@31`
- `MAX_MODULES@33`
- `MAX_MODULE_FILES@34`
- `MAX_MODULE_CONTEXT_CHARS@35`
- `MAX_FILE_CONTEXT_CHARS@36`
- `progress@51`
- `language@52`
- `keyFilesText@53`
- `intelligenceText@54`
- `treeHash@55`
- `overview@58`
- `modulesMap@61`
- `rankedFiles@62`
- `moduleEntries@63`
- `moduleDocs@69`
- `doc@70`
- `architecture@77`
- `readingGuide@80`

## 依赖输入

- `crypto`
- `../wiki-model-client.js`
- `../knowledge-types.js`
- `./graph.js`
- `./intelligence.js`
- `./prompts.js`
- `./types.js`

## 对外暴露

- `RepoWikiAnalyzerOptions`
- `RepoWikiAnalyzer`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { createHash } from "crypto";
import { completeWikiChat } from "../wiki-model-client.js";
import type { WikiModelSettings } from "../knowledge-types.js";
import { RepoWikiDependencyGraph, getModuleName } from "./graph.js";
import {
  formatModuleEvidenceForPrompt,
  formatRepoWikiIntelligenceForPrompt,
} from "./intelligence.js";
import {
  buildArchitecturePrompt,
  buildModulePrompt,
  buildOverviewPrompt,
  buildReadingGuidePrompt,
  extractJson,
} from "./prompts.js";
import type {
  ArchitectureDiagram,
  ArchitectureComponent,
  ConceptDoc,
  FileDoc,
  ModuleDoc,
  ProjectOverview,
  ReadingGuide,
  ReadingStep,
  RelationshipDoc,
  RepoWikiFileInfo,
  RepoWikiProjectContext,
  SymbolDoc,
  WikiData,
} from "./types.js";

const MAX_KEY_FILES_CHARS = 44_000;
const MAX_MODULES = 18;
const MAX_MODULE_FILES = 24;
const MAX_MODULE_CONTEXT_CHARS = 54_000;
const MAX_FILE_CONTEXT_CHARS = 4_200;

export type RepoWikiAnalyzerOptions = {
  language?: string;
  concurrency?: number;
  onProgress?: (message: string) => void;
};

export class RepoWikiAnalyzer {
  constructor(
    private readonly settings: WikiModelSettings,
    private readonly options: RepoWikiAnalyzerOptions = {},
  ) {}

  async analyze(project: RepoWikiProjectContext, graph: RepoWikiDependencyGraph): Promise<WikiData> {
    const progress = (message: string) => this.options.onProgress?.(message);
    const language = this.options.language ?? "zh";
    const keyFilesText = buildKeyFilesContext(project);
    const intelligenceText = formatRepoWikiIntelligenceForPrompt(project);
    const treeHash = contentHash(`${project.fileTree}\n${keyFilesText}`);

    progress("Generating project overview...");
    const overview = await this.generateOverview(project, keyFilesText, intelligenceText, treeHash, language);

    progress("Grouping modules...");
    const modulesMap = groupIntoModules(project.files);
    const rankedFiles = new Map(graph.rankFiles().map(([path, score]) => [path, score]));
    const moduleEntries = Array.from(modulesMap.entries())
      .map(([name, files]) => [name, rankModuleFiles(files, rankedFiles)] as const)
      .sort((left, right) => modulePriority(right[0], right[1]) - modulePriority(left[0], left[1]) || right[1].length - left[1].length)
      .slice(0, MAX_MODULES);

    progress(`Analyzing ${moduleEntries.length} modules...`);
    const moduleDocs = await mapLimit(moduleEntries, this.options.concurrency ?? 3, async ([name, files], index) => {
      const doc = await this.generateModule(name, files, overview.one_liner || overview.description || project.name, language);
      progress(`Analyzed module ${index + 1}/${moduleEntries.length}`);
      return doc;
    });
    moduleDocs.sort((left, right) => (right.files?.length ?? 0) - (left.files?.length ?? 0));

    progress("Detecting architecture...");
    const architecture = await this.generateArchitecture(project, keyFilesText, intelligenceText, treeHash, language);

    progress("Creating reading guide...");
    const readingGuide = await this.generateReadingGuide(project, graph, moduleDocs, intelligenceText, treeHash, language);

    return {
      overview,
      modules: moduleDocs,
      architecture,
      reading_guide: readingGuide,
    };
  }

  private async generateOverview(
    project: RepoWikiProjectContext,
    keyFiles: string,
    intelligenceText: string,
    _treeHash: string,
    language: string,
  ): Promise<ProjectOverview> {
    const raw = await completeWikiChat(
      this.settings,
      buildOverviewPrompt(project.fileTree, keyFiles, intelligenceText, language),
      { temperature: 0.2, maxTokens: Math.min(this.settings.maxOutputTokens, 6_144) },
    );
    const parsed = extractJson(raw);
    if (!isRecord(parsed)) {
      return { name: project.name, one_liner: project.name };
    }
    return {
      name: asString(parsed.name) || project.name,
      one_liner: asString(parsed.one_liner),
      description: asString(parsed.description),
      tech_stack: asArray(parsed.tech_stack).map((item) => isRecord(item) ? {
        name: asString(item.name),
        category: asString(item.category),
        version: asString(item.version),
      } : undefi
... (truncated)
```
