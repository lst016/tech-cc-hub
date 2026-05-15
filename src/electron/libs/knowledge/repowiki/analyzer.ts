import { createHash } from "crypto";
import { completeWikiChat } from "../wiki-model-client.js";
import type { WikiModelSettings } from "../knowledge-types.js";
import { RepoWikiDependencyGraph, getModuleName } from "./graph.js";
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

const MAX_KEY_FILES_CHARS = 28_000;
const MAX_MODULES = 12;
const MAX_MODULE_FILES = 16;
const MAX_MODULE_CONTEXT_CHARS = 34_000;
const MAX_FILE_CONTEXT_CHARS = 2_800;

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
    const treeHash = contentHash(`${project.fileTree}\n${keyFilesText}`);

    progress("Generating project overview...");
    const overview = await this.generateOverview(project, keyFilesText, treeHash, language);

    progress("Grouping modules...");
    const modulesMap = groupIntoModules(project.files);
    const rankedFiles = new Map(graph.rankFiles().map(([path, score]) => [path, score]));
    const moduleEntries = Array.from(modulesMap.entries())
      .map(([name, files]) => [name, rankModuleFiles(files, rankedFiles)] as const)
      .sort((left, right) => right[1].length - left[1].length)
      .slice(0, MAX_MODULES);

    progress(`Analyzing ${moduleEntries.length} modules...`);
    const moduleDocs = await mapLimit(moduleEntries, this.options.concurrency ?? 3, async ([name, files], index) => {
      const doc = await this.generateModule(name, files, overview.one_liner || overview.description || project.name, language);
      progress(`Analyzed module ${index + 1}/${moduleEntries.length}`);
      return doc;
    });
    moduleDocs.sort((left, right) => (right.files?.length ?? 0) - (left.files?.length ?? 0));

    progress("Detecting architecture...");
    const architecture = await this.generateArchitecture(project, keyFilesText, treeHash, language);

    progress("Creating reading guide...");
    const readingGuide = await this.generateReadingGuide(project, graph, moduleDocs, treeHash, language);

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
    _treeHash: string,
    language: string,
  ): Promise<ProjectOverview> {
    const raw = await completeWikiChat(
      this.settings,
      buildOverviewPrompt(project.fileTree, keyFiles, language),
      { temperature: 0.2, maxTokens: Math.min(this.settings.maxOutputTokens, 4_096) },
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
      } : undefined).filter(Boolean) as ProjectOverview["tech_stack"],
      setup_instructions: asStringArray(parsed.setup_instructions),
      key_features: asStringArray(parsed.key_features),
    };
  }

  private async generateModule(
    name: string,
    files: RepoWikiFileInfo[],
    projectSummary: string,
    language: string,
  ): Promise<ModuleDoc> {
    const filesContext = buildModuleFilesContext(files);
    const raw = await completeWikiChat(
      this.settings,
      buildModulePrompt(name, filesContext, projectSummary, language),
      { temperature: 0.25, maxTokens: Math.min(this.settings.maxOutputTokens, 4_096) },
    );
    const parsed = extractJson(raw);
    if (!isRecord(parsed)) {
      return {
        name,
        purpose: `包含 ${files.length} 个文件的模块。`,
        files: files.slice(0, MAX_MODULE_FILES).map((file) => ({ path: file.path, purpose: "模型未返回结构化说明。" })),
      };
    }
    return {
      name: asString(parsed.name) || name,
      purpose: asString(parsed.purpose),
      description: asString(parsed.description),
      files: asArray(parsed.files).flatMap((item): FileDoc[] => {
        if (!isRecord(item)) return [];
        const doc: FileDoc = {
          path: asString(item.path),
          purpose: asString(item.purpose),
          key_symbols: asArray(item.key_symbols).flatMap((symbol): SymbolDoc[] => isRecord(symbol) ? [{
            name: asString(symbol.name),
            kind: asString(symbol.kind),
            line: asNumber(symbol.line),
            description: asString(symbol.description),
          }].filter((doc) => Boolean(doc.name)) : []),
        };
        return doc.path ? [doc] : [];
      }).filter((item): item is FileDoc => Boolean(item?.path)),
      relationships: asArray(parsed.relationships).flatMap((item): RelationshipDoc[] => isRecord(item) ? [{
        source: asString(item.source),
        target: asString(item.target),
        description: asString(item.description),
      }].filter((relation) => Boolean(relation.source && relation.target)) : []),
      key_concepts: asArray(parsed.key_concepts).flatMap((item): ConceptDoc[] => isRecord(item) ? [{
        name: asString(item.name),
        explanation: asString(item.explanation),
      }].filter((concept) => Boolean(concept.name)) : []),
    };
  }

  private async generateArchitecture(
    project: RepoWikiProjectContext,
    keyFiles: string,
    _treeHash: string,
    language: string,
  ): Promise<ArchitectureDiagram> {
    const raw = await completeWikiChat(
      this.settings,
      buildArchitecturePrompt(project.fileTree, keyFiles, language),
      { temperature: 0.2, maxTokens: Math.min(this.settings.maxOutputTokens, 4_096) },
    );
    const parsed = extractJson(raw);
    if (!isRecord(parsed)) return {};
    return {
      architecture_type: asString(parsed.architecture_type),
      description: asString(parsed.description),
      components: asArray(parsed.components).flatMap((item): ArchitectureComponent[] => isRecord(item) ? [{
        name: asString(item.name),
        purpose: asString(item.purpose),
        files: asStringArray(item.files),
      }].filter((component) => Boolean(component.name)) : []),
      mermaid_component: asString(parsed.mermaid_component),
      mermaid_sequence: asString(parsed.mermaid_sequence),
      data_flow: asString(parsed.data_flow),
    };
  }

  private async generateReadingGuide(
    project: RepoWikiProjectContext,
    graph: RepoWikiDependencyGraph,
    modules: ModuleDoc[],
    _treeHash: string,
    language: string,
  ): Promise<ReadingGuide> {
    const ranked = graph.rankFiles().slice(0, 28);
    const rankings = ranked.map(([path], index) => {
      const file = project.files.find((item) => item.path === path);
      const tag = file?.isEntrypoint ? " [entrypoint]" : file?.isConfig ? " [config]" : "";
      return `${index + 1}. ${path}${tag} (${file?.lines ?? 0} lines)`;
    }).join("\n");
    const moduleSummaries = modules.map((module) => `- **${module.name}**: ${module.purpose || ""}`).join("\n");
    const raw = await completeWikiChat(
      this.settings,
      buildReadingGuidePrompt(rankings, moduleSummaries, language),
      { temperature: 0.25, maxTokens: Math.min(this.settings.maxOutputTokens, 4_096) },
    );
    const parsed = extractJson(raw);
    if (!isRecord(parsed)) return {};
    return {
      introduction: asString(parsed.introduction),
      steps: asArray(parsed.steps).flatMap((item): ReadingStep[] => isRecord(item) ? [{
        order: asNumber(item.order) || 0,
        title: asString(item.title),
        files: asStringArray(item.files),
        explanation: asString(item.explanation),
        time_estimate: asString(item.time_estimate),
      }].filter((step) => Boolean(step.title)) : []),
      tips: asStringArray(parsed.tips),
    };
  }
}

function buildKeyFilesContext(project: RepoWikiProjectContext): string {
  const parts: string[] = [];
  let used = 0;
  for (const file of project.files) {
    if (!file.isConfig && !file.isEntrypoint) continue;
    let content = file.content || file.preview;
    if (content.length > MAX_FILE_CONTEXT_CHARS) {
      content = `${content.slice(0, MAX_FILE_CONTEXT_CHARS)}\n... (truncated)`;
    }
    const block = `### ${file.path}\n\`\`\`${file.language}\n${content}\n\`\`\``;
    if (used + block.length > MAX_KEY_FILES_CHARS) break;
    used += block.length;
    parts.push(block);
  }
  return parts.join("\n\n");
}

function groupIntoModules(files: RepoWikiFileInfo[]): Map<string, RepoWikiFileInfo[]> {
  const modules = new Map<string, RepoWikiFileInfo[]>();
  for (const file of files) {
    const moduleName = getModuleName(file.path);
    modules.set(moduleName, [...(modules.get(moduleName) ?? []), file]);
  }
  return modules;
}

function rankModuleFiles(files: RepoWikiFileInfo[], rankedFiles: Map<string, number>): RepoWikiFileInfo[] {
  return [...files].sort((left, right) => {
    const leftRank = left.isConfig ? 1 : left.isEntrypoint ? 0.8 : rankedFiles.get(left.path) ?? 0;
    const rightRank = right.isConfig ? 1 : right.isEntrypoint ? 0.8 : rankedFiles.get(right.path) ?? 0;
    return rightRank - leftRank || left.path.localeCompare(right.path);
  }).slice(0, MAX_MODULE_FILES);
}

function buildModuleFilesContext(files: RepoWikiFileInfo[]): string {
  const parts: string[] = [];
  let used = 0;
  for (const file of files) {
    let content = file.content || file.preview;
    if (content.length > MAX_FILE_CONTEXT_CHARS) {
      content = `${content.slice(0, MAX_FILE_CONTEXT_CHARS)}\n... (truncated)`;
    }
    const block = `### ${file.path} (${file.language})\n\`\`\`${file.language}\n${content}\n\`\`\``;
    if (used + block.length > MAX_MODULE_CONTEXT_CHARS) break;
    used += block.length;
    parts.push(block);
  }
  return parts.join("\n\n");
}

async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 24);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value).map((item) => asString(item)).filter(Boolean);
}
