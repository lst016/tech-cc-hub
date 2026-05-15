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
      } : undefined).filter(Boolean) as ProjectOverview["tech_stack"],
      setup_instructions: asStringArray(parsed.setup_instructions),
      key_features: asStringArray(parsed.key_features),
      agent_summary: asStringArray(parsed.agent_summary),
      key_workflows: asArray(parsed.key_workflows).flatMap((item): NonNullable<ProjectOverview["key_workflows"]> => isRecord(item) ? [{
        name: asString(item.name),
        summary: asString(item.summary),
        files: asStringArray(item.files),
      }].filter((workflow) => Boolean(workflow.name)) : []),
      runtime_surfaces: asStringArray(parsed.runtime_surfaces),
      storage_and_indexes: asStringArray(parsed.storage_and_indexes),
      quality_gates: asStringArray(parsed.quality_gates),
      change_risks: asStringArray(parsed.change_risks),
    };
  }

  private async generateModule(
    name: string,
    files: RepoWikiFileInfo[],
    projectSummary: string,
    language: string,
  ): Promise<ModuleDoc> {
    const filesContext = buildModuleFilesContext(files);
    const moduleEvidence = formatModuleEvidenceForPrompt(name, files);
    const raw = await completeWikiChat(
      this.settings,
      buildModulePrompt(name, filesContext, moduleEvidence, projectSummary, language),
      { temperature: 0.22, maxTokens: Math.min(this.settings.maxOutputTokens, 6_144) },
    );
    const parsed = extractJson(raw);
    if (!isRecord(parsed)) {
      return buildFallbackModuleDoc(name, files);
    }
    const fallback = buildFallbackModuleDoc(name, files);
    const parsedFiles = asArray(parsed.files).flatMap((item): FileDoc[] => {
      if (!isRecord(item)) return [];
      const path = asString(item.path);
      if (!path) return [];
      const sourceFile = files.find((file) => file.path === path);
      const doc: FileDoc = {
        path,
        purpose: asString(item.purpose) || (sourceFile ? describeFile(sourceFile) : ""),
        key_symbols: asArray(item.key_symbols).flatMap((symbol): SymbolDoc[] => isRecord(symbol) ? [{
          name: asString(symbol.name),
          kind: asString(symbol.kind),
          line: asNumber(symbol.line),
          description: asString(symbol.description),
        }].filter((doc) => Boolean(doc.name)) : []),
      };
      if (!doc.key_symbols?.length && sourceFile?.symbols.length) {
        doc.key_symbols = sourceFile.symbols.slice(0, 10).map((symbol) => ({
          name: symbol.name,
          kind: symbol.kind,
          line: symbol.line,
          description: symbol.signature,
        }));
      }
      return [doc];
    });
    const parsedByPath = new Map(parsedFiles.map((file) => [file.path, file]));
    const mergedFiles = fallback.files?.map((file) => ({ ...file, ...parsedByPath.get(file.path) })) ?? parsedFiles;
    for (const file of parsedFiles) {
      if (!mergedFiles.some((item) => item.path === file.path)) {
        mergedFiles.push(file);
      }
    }
    return {
      name: asString(parsed.name) || name,
      purpose: asString(parsed.purpose) || fallback.purpose,
      description: asString(parsed.description) || fallback.description,
      files: mergedFiles,
      relationships: asArray(parsed.relationships).flatMap((item): RelationshipDoc[] => isRecord(item) ? [{
        source: asString(item.source),
        target: asString(item.target),
        description: asString(item.description),
      }].filter((relation) => Boolean(relation.source && relation.target)) : []),
      key_concepts: asArray(parsed.key_concepts).flatMap((item): ConceptDoc[] => isRecord(item) ? [{
        name: asString(item.name),
        explanation: asString(item.explanation),
      }].filter((concept) => Boolean(concept.name)) : []) || fallback.key_concepts,
      agent_value: asStringArray(parsed.agent_value).length ? asStringArray(parsed.agent_value) : fallback.agent_value,
      entrypoints: asArray(parsed.entrypoints).flatMap((item): NonNullable<ModuleDoc["entrypoints"]> => isRecord(item) ? [{
        path: asString(item.path),
        reason: asString(item.reason),
      }].filter((entry) => Boolean(entry.path)) : []).length ? asArray(parsed.entrypoints).flatMap((item): NonNullable<ModuleDoc["entrypoints"]> => isRecord(item) ? [{
        path: asString(item.path),
        reason: asString(item.reason),
      }].filter((entry) => Boolean(entry.path)) : []) : fallback.entrypoints,
      data_contracts: asArray(parsed.data_contracts).flatMap((item): ConceptDoc[] => isRecord(item) ? [{
        name: asString(item.name),
        explanation: asString(item.explanation),
      }].filter((concept) => Boolean(concept.name)) : []).length ? asArray(parsed.data_contracts).flatMap((item): ConceptDoc[] => isRecord(item) ? [{
        name: asString(item.name),
        explanation: asString(item.explanation),
      }].filter((concept) => Boolean(concept.name)) : []) : fallback.data_contracts,
      operational_notes: asStringArray(parsed.operational_notes).length ? asStringArray(parsed.operational_notes) : fallback.operational_notes,
      change_risks: asStringArray(parsed.change_risks).length ? asStringArray(parsed.change_risks) : fallback.change_risks,
      validation: asStringArray(parsed.validation).length ? asStringArray(parsed.validation) : fallback.validation,
    };
  }

  private async generateArchitecture(
    project: RepoWikiProjectContext,
    keyFiles: string,
    intelligenceText: string,
    _treeHash: string,
    language: string,
  ): Promise<ArchitectureDiagram> {
    const raw = await completeWikiChat(
      this.settings,
      buildArchitecturePrompt(project.fileTree, keyFiles, intelligenceText, language),
      { temperature: 0.2, maxTokens: Math.min(this.settings.maxOutputTokens, 6_144) },
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
      layers: asArray(parsed.layers).flatMap((item): ArchitectureComponent[] => isRecord(item) ? [{
        name: asString(item.name),
        purpose: asString(item.purpose),
        files: asStringArray(item.files),
      }].filter((component) => Boolean(component.name)) : []),
      boundaries: asStringArray(parsed.boundaries),
      integration_points: asStringArray(parsed.integration_points),
    };
  }

  private async generateReadingGuide(
    project: RepoWikiProjectContext,
    graph: RepoWikiDependencyGraph,
    modules: ModuleDoc[],
    intelligenceText: string,
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
      buildReadingGuidePrompt(rankings, moduleSummaries, intelligenceText, language),
      { temperature: 0.22, maxTokens: Math.min(this.settings.maxOutputTokens, 6_144) },
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
      task_paths: asArray(parsed.task_paths).flatMap((item): NonNullable<ReadingGuide["task_paths"]> => isRecord(item) ? [{
        task: asString(item.task),
        files: asStringArray(item.files),
        why: asString(item.why),
      }].filter((taskPath) => Boolean(taskPath.task)) : []),
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
    const leftRank = filePriority(left) + (rankedFiles.get(left.path) ?? 0);
    const rightRank = filePriority(right) + (rankedFiles.get(right.path) ?? 0);
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

function modulePriority(name: string, files: RepoWikiFileInfo[]): number {
  const preferred = [
    "knowledge-engine",
    "electron-runtime",
    "knowledge-ui",
    "mcp-tools",
    "task-engine",
    "ui-state",
    "ui-shell",
    "shared-contracts",
    "settings-ui",
    "activity-and-diagnostics",
    "skill-manager",
    "git-workbench",
    "qa-smoke-tests",
    "scripts",
    "root",
  ];
  const preferredScore = preferred.includes(name) ? (preferred.length - preferred.indexOf(name)) * 100 : 0;
  const signalScore = files.reduce((sum, file) => sum + file.signals.length * 3 + file.exports.length + (file.isEntrypoint ? 12 : 0) + (file.isConfig ? 8 : 0), 0);
  return preferredScore + signalScore + Math.min(files.length, 30);
}

function filePriority(file: RepoWikiFileInfo): number {
  let score = 0;
  if (file.isConfig) score += 4;
  if (file.isEntrypoint) score += 3;
  score += Math.min(file.signals.length, 12) * 0.5;
  score += Math.min(file.exports.length, 12) * 0.15;
  if (/knowledge|runner|main|ipc|executor|repository|store|Panel|registry/i.test(file.path)) score += 1.5;
  return score;
}

function buildFallbackModuleDoc(name: string, files: RepoWikiFileInfo[]): ModuleDoc {
  const selected = files.slice(0, MAX_MODULE_FILES);
  const contracts = selected.flatMap((file) => file.signals
    .filter((signal) => ["ipc", "ui_ipc", "mcp_tool", "mcp_server", "database", "store", "event"].includes(signal.kind))
    .slice(0, 10)
    .map((signal): ConceptDoc => ({
      name: `${signal.kind}:${signal.name}`,
      explanation: `${file.path}${signal.line ? `:${signal.line}` : ""} - ${signal.detail ?? signal.kind}`,
    })));

  return {
    name,
    purpose: modulePurpose(name, selected),
    description: buildFallbackDescription(name, selected),
    files: selected.map((file) => ({
      path: file.path,
      purpose: describeFile(file),
      key_symbols: file.symbols.slice(0, 12).map((symbol) => ({
        name: symbol.name,
        kind: symbol.kind,
        line: symbol.line,
        description: symbol.signature,
      })),
    })),
    relationships: buildFallbackRelationships(selected),
    key_concepts: buildFallbackConcepts(name, selected),
    agent_value: [
      `定位 ${name} 模块的入口、数据契约和运行风险。`,
      "在模型没有稳定返回 JSON 时，本页仍由本地代码信号生成，不能再退化为空白说明。",
    ],
    entrypoints: selected
      .filter((file) => file.isEntrypoint || file.isConfig || file.signals.length > 0)
      .slice(0, 8)
      .map((file) => ({ path: file.path, reason: describeFile(file) })),
    data_contracts: contracts.slice(0, 36),
    operational_notes: buildOperationalNotes(name, selected),
    change_risks: buildChangeRisks(name, selected),
    validation: buildValidationHints(name),
  };
}

function modulePurpose(name: string, files: RepoWikiFileInfo[]): string {
  const map: Record<string, string> = {
    "knowledge-engine": "负责 Repo Wiki 生成、Markdown 切块、embedding、FTS5/sqlite-vec 索引和聊天 overview 注入。",
    "knowledge-ui": "负责知识库工作区列表、生成状态、Markdown 预览和前后端桥接调用。",
    "electron-runtime": "负责 Electron 主进程启动、IPC 注册、会话执行和开发桥服务。",
    "mcp-tools": "负责暴露给 Agent 的内置 MCP 工具和工具注册元数据。",
    "task-engine": "负责任务同步、持久化、执行、重试、恢复和独立 workspace 管理。",
    "ui-state": "负责 React/Zustand 侧的会话、活动面板和运行态状态。",
  };
  return map[name] ?? `负责 ${files.length} 个文件组成的 ${name} 功能域。`;
}

function buildFallbackDescription(name: string, files: RepoWikiFileInfo[]): string {
  const signalKinds = Array.from(new Set(files.flatMap((file) => file.signals.map((signal) => signal.kind))));
  const keyFiles = files.slice(0, 8).map((file) => `\`${file.path}\``).join(", ");
  return [
    `${name} 模块包含 ${files.length} 个被扫描文件，关键入口包括 ${keyFiles || "当前文件组"}。`,
    signalKinds.length
      ? `本地静态分析识别到这些代码信号：${signalKinds.join(", ")}，因此本页可以作为后续 Agent 定位接口、存储、事件和运行入口的索引。`
      : "本地静态分析没有识别到显式 IPC/MCP/DB 信号，建议从文件导出和 import 关系继续阅读。",
  ].join("\n\n");
}

function describeFile(file: RepoWikiFileInfo): string {
  const parts: string[] = [];
  if (file.isConfig) parts.push("配置文件，会影响构建、开发或模型能力");
  if (file.isEntrypoint) parts.push("入口文件，适合从这里追踪启动链路");
  const signals = file.signals.slice(0, 8).map((signal) => `${signal.kind}:${signal.name}`);
  if (signals.length) parts.push(`代码信号：${signals.join(", ")}`);
  const exports = file.exports.slice(0, 8);
  if (exports.length) parts.push(`导出：${exports.map((item) => `\`${item}\``).join(", ")}`);
  const symbols = file.symbols.slice(0, 6);
  if (symbols.length) parts.push(`关键符号：${symbols.map((item) => `\`${item.name}\``).join(", ")}`);
  if (parts.length) return parts.join("；");
  return `${file.language} 文件，${file.lines} 行；用于 ${file.path.split("/").slice(0, -1).join("/") || "根目录"} 功能域。`;
}

function buildFallbackRelationships(files: RepoWikiFileInfo[]): RelationshipDoc[] {
  const knownPaths = new Set(files.map((file) => file.path));
  const relationships: RelationshipDoc[] = [];
  for (const file of files) {
    for (const imported of file.imports.slice(0, 16)) {
      const localHint = imported.startsWith(".") || imported.startsWith("@/") || imported.startsWith("src/");
      if (!localHint) continue;
      relationships.push({
        source: file.path,
        target: imported,
        description: knownPaths.has(imported) ? "模块内直接依赖" : "本地相对依赖，需要按路径解析到目标文件",
      });
      if (relationships.length >= 40) return relationships;
    }
  }
  return relationships;
}

function buildFallbackConcepts(name: string, files: RepoWikiFileInfo[]): ConceptDoc[] {
  const concepts: ConceptDoc[] = [];
  const signalGroups = new Map<string, number>();
  for (const signal of files.flatMap((file) => file.signals)) {
    signalGroups.set(signal.kind, (signalGroups.get(signal.kind) ?? 0) + 1);
  }
  for (const [kind, count] of signalGroups.entries()) {
    concepts.push({ name: kind, explanation: `${name} 模块中出现 ${count} 个 ${kind} 信号，可用于定位对应接口或运行职责。` });
  }
  return concepts;
}

function buildOperationalNotes(name: string, files: RepoWikiFileInfo[]): string[] {
  const notes: string[] = [];
  if (files.some((file) => file.signals.some((signal) => signal.kind === "database"))) {
    notes.push("涉及 SQLite/FTS/vector schema 的文件变更后，要同时验证迁移、索引行数和重启后的读取。");
  }
  if (files.some((file) => file.signals.some((signal) => signal.kind === "ipc" || signal.kind === "ui_ipc"))) {
    notes.push("涉及 IPC 的变更必须同时检查主进程 handler、preload/renderer invoke 和开发桥路径。");
  }
  if (files.some((file) => file.signals.some((signal) => signal.kind === "mcp_tool"))) {
    notes.push("涉及 MCP tool 的变更要确认 registry、server factory、tool name 和 runner 加载路径一致。");
  }
  if (name.includes("knowledge")) {
    notes.push("知识库功能依赖 embedding 模型；缺失 embedding 时必须禁止开启，而不是只退回 FTS5。");
  }
  return notes;
}

function buildChangeRisks(name: string, files: RepoWikiFileInfo[]): string[] {
  const risks: string[] = [];
  if (name.includes("knowledge")) {
    risks.push("修改生成或索引链路可能导致 UI 状态、.tech Markdown、AppData SQLite、聊天注入四处不一致。");
  }
  if (files.some((file) => file.path.includes("runner"))) {
    risks.push("runner prompt 拼装顺序改变会影响所有新会话的工具、规则和知识库可见性。");
  }
  if (files.some((file) => file.signals.some((signal) => signal.kind === "database"))) {
    risks.push("schema 字段或索引名变化会破坏旧数据读取，必须保留迁移或重建路径。");
  }
  return risks.length ? risks : ["修改该模块时优先跑对应 QA，并确认 UI 与 Electron 运行态不是 stale 状态。"];
}

function buildValidationHints(name: string): string[] {
  if (name.includes("knowledge")) {
    return ["npm run qa:knowledge", "npm run qa:knowledge-ui", "npm run qa:knowledge-chat", "npm run transpile:electron"];
  }
  if (name.includes("ui")) return ["npm run build", "npm run qa:chat-ui"];
  if (name.includes("task")) return ["npm run transpile:electron", "npm run qa:smoke"];
  if (name.includes("mcp")) return ["npm run transpile:electron", "手动启动会话并确认 MCP 工具列表可见"];
  return ["npm run transpile:electron", "npm run build"];
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
