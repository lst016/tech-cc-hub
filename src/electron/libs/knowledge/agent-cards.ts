import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { basename, join, relative } from "path";
import { stableHash } from "./knowledge-utils.js";
import type { KnowledgeWorkspacePaths } from "./knowledge-paths.js";
import { RepoWikiDependencyGraph, getModuleName } from "./repowiki/graph.js";
import { buildRepoWikiIntelligence } from "./repowiki/intelligence.js";
import { scanRepoWikiProject } from "./repowiki/scanner.js";
import type {
  RepoWikiFileSignal,
  RepoWikiHighValueFile,
  RepoWikiProjectIntelligence,
  RepoWikiScriptInfo,
} from "./repowiki/types.js";

export type AgentKnowledgeCardKind =
  | "runtime_flow"
  | "module"
  | "entrypoint"
  | "mcp"
  | "database"
  | "qa"
  | "agent_question";

export type AgentKnowledgeCard = {
  id: string;
  title: string;
  kind: AgentKnowledgeCardKind;
  summary: string;
  entryFiles: Array<{ path: string; reason: string }>;
  relatedFiles: string[];
  changeGuide: string[];
  validation: string[];
  risks: string[];
  keywords: string[];
  runtimeSteps?: string[];
  sourceSignals?: string[];
  sourceQuestion?: string;
  sourceAnswer?: string;
};

export type AgentKnowledgeCardsResult = {
  cards: AgentKnowledgeCard[];
  generatedFiles: string[];
  skippedFiles: Array<{ path: string; reason: string }>;
};

const MAX_MODULE_CARDS = 18;
const MAX_HIGH_VALUE_FILES_PER_MODULE = 10;

export function generateAgentKnowledgeCards(paths: KnowledgeWorkspacePaths): AgentKnowledgeCardsResult {
  const scan = scanRepoWikiProject(paths.workspaceRoot, {
    maxFileSize: 240 * 1024,
    maxFiles: 1_800,
    previewLines: 80,
  });
  const graph = RepoWikiDependencyGraph.buildFromProject(scan.project);
  const intelligence = buildRepoWikiIntelligence(scan.project, graph);
  scan.project.intelligence = intelligence;

  const cards = dedupeCards([
    ...buildRuntimeFlowCards(intelligence),
    ...buildModuleCards(intelligence),
    ...buildEntryPointCards(intelligence),
    ...buildMcpCards(intelligence),
    ...buildDatabaseCards(intelligence),
    ...buildQaCards(intelligence),
    ...buildAgentQuestionCards(intelligence),
  ]);

  const generatedFiles = writeAgentCards(paths, cards);
  return { cards, generatedFiles, skippedFiles: scan.skipped };
}

function buildRuntimeFlowCards(intelligence: RepoWikiProjectIntelligence): AgentKnowledgeCard[] {
  return intelligence.runtimeFlows.map((flow) => ({
    id: `flow-${slugify(flow.title)}`,
    title: `运行链路：${flow.title}`,
    kind: "runtime_flow",
    summary: flow.summary,
    entryFiles: flow.evidence.slice(0, 6).map((path) => ({ path, reason: "链路证据或修改入口" })),
    relatedFiles: unique(flow.evidence).slice(0, 18),
    changeGuide: [
      "先从 entryFiles 的第一个文件确认入口，再按 runtimeSteps 顺序追踪调用链。",
      "改动跨 UI/Electron/索引/Runner 时，同步更新 IPC 契约、持久化状态和 QA 脚本。",
      "如果该链路会进入 system prompt 或 MCP，必须验证新会话里的实际注入结果。",
    ],
    validation: inferValidation(flow.evidence, intelligence.scripts),
    risks: inferRisks(flow.evidence),
    keywords: unique([flow.title, ...flow.evidence.map((file) => basename(file))]),
    runtimeSteps: flow.steps,
  }));
}

function buildModuleCards(intelligence: RepoWikiProjectIntelligence): AgentKnowledgeCard[] {
  const groups = new Map<string, RepoWikiHighValueFile[]>();
  for (const file of intelligence.highValueFiles) {
    const moduleName = getModuleName(file.path);
    const list = groups.get(moduleName) ?? [];
    list.push(file);
    groups.set(moduleName, list);
  }

  return Array.from(groups.entries())
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .slice(0, MAX_MODULE_CARDS)
    .map(([moduleName, files]) => {
      const selected = files.slice(0, MAX_HIGH_VALUE_FILES_PER_MODULE);
      const filePaths = selected.map((file) => file.path);
      return {
        id: `module-${slugify(moduleName)}`,
        title: `模块改造入口：${moduleName}`,
        kind: "module",
        summary: `当任务落在 ${moduleName} 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。`,
        entryFiles: selected.slice(0, 6).map((file) => ({ path: file.path, reason: file.reason })),
        relatedFiles: filePaths,
        changeGuide: [
          `先确认需求是否真的属于 ${moduleName}，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。`,
          "修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。",
          "如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。",
        ],
        validation: inferValidation(filePaths, intelligence.scripts),
        risks: inferRisks(filePaths),
        keywords: unique([
          moduleName,
          ...selected.flatMap((file) => [basename(file.path), ...file.signals]),
        ]).slice(0, 24),
        sourceSignals: selected.flatMap((file) => file.signals).slice(0, 40),
      } satisfies AgentKnowledgeCard;
    });
}

function buildEntryPointCards(intelligence: RepoWikiProjectIntelligence): AgentKnowledgeCard[] {
  if (intelligence.entrypoints.length === 0) return [];
  const files = intelligence.entrypoints.slice(0, 12);
  return [{
    id: "entrypoints-runtime-start",
    title: "运行入口与启动链路",
    kind: "entrypoint",
    summary: "用于回答项目从哪里启动、UI/Electron/脚本入口在哪里、改启动配置时应该先看哪些文件。",
    entryFiles: files.slice(0, 8).map((file) => ({ path: file.path, reason: file.reason })),
    relatedFiles: files.map((file) => file.path),
    changeGuide: [
      "启动失败先拆 Vite、Electron 主进程、native addon、环境变量和 dev bridge。",
      "新增入口命令时同步 package.json、脚本、QA 和文档可见入口。",
    ],
    validation: inferValidation(files.map((file) => file.path), intelligence.scripts),
    risks: ["只看到 Vite ready 不代表 Electron 已健康启动。", "native addon 或 appData 路径问题通常要用真实 Electron 验证。"],
    keywords: ["startup", "dev", "electron", "vite", "入口", "启动"],
    sourceSignals: files.flatMap((file) => file.signals).slice(0, 36),
  }];
}

function buildMcpCards(intelligence: RepoWikiProjectIntelligence): AgentKnowledgeCard[] {
  const files = signalFiles([...intelligence.mcpServers, ...intelligence.mcpTools]);
  if (files.length === 0) return [];
  return [{
    id: "mcp-tools-surface",
    title: "MCP 工具面与 Agent 能力入口",
    kind: "mcp",
    summary: "用于定位内置 MCP server、tool handler、共享 registry 和 Agent 可调用能力。",
    entryFiles: files.slice(0, 8).map((path) => ({ path, reason: "MCP server/tool 定义或注册点" })),
    relatedFiles: files,
    changeGuide: [
      "新增工具时同时改共享 registry、Electron 工厂映射、tool names 和 handler。",
      "工具返回要结构化，失败要明确可恢复错误，避免让 Agent 误判能力可用。",
      "涉及知识库工具时确认 embedding 配置、SQLite/vector 就绪和 workspaceRoot 解析。",
    ],
    validation: inferValidation(files, intelligence.scripts),
    risks: ["只注册 UI 名称但未接入 Electron 工厂会导致 Agent 看得到却调不了。", "工具 schema 太宽会让 Agent 调用不稳定。"],
    keywords: ["MCP", "tool", "registry", "Agent", "knowledge_search", "knowledge_read"],
    sourceSignals: signalLines([...intelligence.mcpServers, ...intelligence.mcpTools]),
  }];
}

function buildDatabaseCards(intelligence: RepoWikiProjectIntelligence): AgentKnowledgeCard[] {
  const files = signalFiles(intelligence.databaseTables);
  if (files.length === 0) return [];
  return [{
    id: "sqlite-fts-vector-storage",
    title: "SQLite / FTS / Vector 存储面",
    kind: "database",
    summary: "用于定位 SQLite 表、FTS5、sqlite-vec 和运行态索引写入位置。",
    entryFiles: files.slice(0, 8).map((path) => ({ path, reason: "数据库 schema、索引或写入逻辑" })),
    relatedFiles: files,
    changeGuide: [
      "改 schema 时必须考虑已有 app-data 数据迁移和重启后的读取。",
      "FTS 行数、vector 行数和 chunk 行数要保持一致。",
      "workspace 可读文件和 runtime DB 分离，别把 sqlite 直接放进用户可见 .tech 文档层。",
    ],
    validation: inferValidation(files, intelligence.scripts),
    risks: ["sqlite-vec 维度变更会让旧表不可复用。", "删除文档时要同步清理 chunk、FTS 和 vector row。"],
    keywords: ["SQLite", "FTS5", "sqlite-vec", "embedding", "knowledge_documents", "knowledge_chunks"],
    sourceSignals: signalLines(intelligence.databaseTables),
  }];
}

function buildQaCards(intelligence: RepoWikiProjectIntelligence): AgentKnowledgeCard[] {
  const scripts = intelligence.scripts.filter((script) => /^(build|test|qa|dev|lint|typecheck)/.test(script.name));
  if (scripts.length === 0) return [];
  return [{
    id: "qa-and-verification",
    title: "验证命令与质量门槛",
    kind: "qa",
    summary: "用于让 Agent 在改动后选择正确的构建、知识库、UI、聊天注入和 smoke 验证命令。",
    entryFiles: [{ path: "package.json", reason: "npm scripts 来源" }],
    relatedFiles: ["package.json", ...scripts.map((script) => `npm:${script.name}`)],
    changeGuide: [
      "窄改动先跑对应 QA，跨 Electron/UI/知识库要跑 build 加 smoke。",
      "UI 问题要用真实浏览器或 Electron dev bridge 验证，不只看类型检查。",
      "知识库改动要同时看 .tech 产物、app-data DB 和聊天 overview 注入。",
    ],
    validation: scripts.slice(0, 14).map((script) => `npm run ${script.name}`),
    risks: ["测试命令通过不等于真实 app 状态正确。", "浏览器预览和 Electron 数据源可能不同，要优先走共享 SQLite/IPC。"],
    keywords: ["QA", "build", "smoke", "knowledge", "chat injection", "UI"],
    sourceSignals: scripts.map((script) => `npm run ${script.name}: ${script.command}`),
  }];
}

function buildAgentQuestionCards(intelligence: RepoWikiProjectIntelligence): AgentKnowledgeCard[] {
  return intelligence.agentQuestions.map((item) => ({
    id: `question-${slugify(item.question)}`,
    title: `Agent 问答：${item.question}`,
    kind: "agent_question",
    summary: item.answer,
    entryFiles: item.files.slice(0, 6).map((path) => ({ path, reason: "回答该问题的证据文件" })),
    relatedFiles: item.files,
    changeGuide: ["先读取证据文件，再用当前代码验证这个回答是否仍然成立。", "如果答案涉及运行态，必须用真实 app/QA 命令复核。"],
    validation: inferValidation(item.files, intelligence.scripts),
    risks: inferRisks(item.files),
    keywords: unique([item.question, ...item.files.map((file) => basename(file))]),
    sourceQuestion: item.question,
    sourceAnswer: item.answer,
  }));
}

function writeAgentCards(paths: KnowledgeWorkspacePaths, cards: AgentKnowledgeCard[]): string[] {
  if (existsSync(paths.agentCardsDir)) {
    rmSync(paths.agentCardsDir, { recursive: true, force: true });
  }
  mkdirSync(paths.agentCardsDir, { recursive: true });

  const files: string[] = [];
  const usedFileNames = new Set<string>();
  for (const card of cards) {
    let fileName = `${slugify(card.title)}.md`;
    if (usedFileNames.has(fileName)) {
      fileName = `${slugify(card.title)}-${stableHash(card.id).slice(0, 8)}.md`;
    }
    usedFileNames.add(fileName);
    const absolutePath = join(paths.agentCardsDir, fileName);
    writeFileSync(absolutePath, renderAgentCardMarkdown(card), "utf8");
    files.push(relative(paths.workspaceRoot, absolutePath));
  }

  const indexPath = join(paths.agentCardsDir, "_index.json");
  writeFileSync(indexPath, `${JSON.stringify({
    version: 1,
    generatedAt: Date.now(),
    workspaceScope: paths.workspaceScope,
    count: cards.length,
    cards,
  }, null, 2)}\n`, "utf8");
  files.push(relative(paths.workspaceRoot, indexPath));
  return files;
}

function renderAgentCardMarkdown(card: AgentKnowledgeCard): string {
  const lines: string[] = [
    `# ${card.title}`,
    "",
    `<agent_card id="${escapeXml(card.id)}" kind="${escapeXml(card.kind)}">`,
    "",
    "## 什么时候用",
    card.summary,
    "",
    "## 修改入口",
    ...renderEntryFiles(card.entryFiles),
    "",
    "## 相关文件",
    ...renderList(card.relatedFiles.map((path) => `\`${path}\``)),
    "",
    "## 改代码指南",
    ...renderList(card.changeGuide),
    "",
  ];

  if (card.runtimeSteps?.length) {
    lines.push("## 运行链路", ...card.runtimeSteps.map((step, index) => `${index + 1}. ${step}`), "");
  }
  if (card.sourceQuestion && card.sourceAnswer) {
    lines.push("## 已知问答", `问：${card.sourceQuestion}`, "", `答：${card.sourceAnswer}`, "");
  }

  lines.push(
    "## 验证方式",
    ...renderList(card.validation),
    "",
    "## 风险点",
    ...renderList(card.risks),
    "",
    "## 检索关键词",
    card.keywords.join(", "),
    "",
  );

  if (card.sourceSignals?.length) {
    lines.push("## 代码信号", ...renderList(card.sourceSignals.slice(0, 48)), "");
  }
  lines.push("</agent_card>", "");
  return lines.join("\n");
}

function renderEntryFiles(files: Array<{ path: string; reason: string }>): string[] {
  if (files.length === 0) return ["- 暂无明确入口文件。"];
  return files.map((file) => `- \`${file.path}\`: ${file.reason}`);
}

function renderList(items: string[]): string[] {
  if (items.length === 0) return ["- 暂无。"];
  return items.map((item) => `- ${item}`);
}

function signalFiles(signals: RepoWikiFileSignal[]): string[] {
  return unique(signals.flatMap((signal) => {
    const match = signal.detail?.match(/^([^:]+):\d+/);
    return match?.[1] ? [match[1]] : [];
  })).slice(0, 24);
}

function signalLines(signals: RepoWikiFileSignal[]): string[] {
  return unique(signals.map((signal) => {
    const where = signal.detail ? ` @ ${signal.detail}` : "";
    return `${signal.kind}:${signal.name}${where}`;
  })).slice(0, 80);
}

function inferValidation(files: string[], scripts: RepoWikiScriptInfo[]): string[] {
  const names = new Set<string>();
  const joined = files.join("\n").toLowerCase();
  if (/knowledge|repowiki|agent-cards/.test(joined)) {
    addScript(names, scripts, "build");
    addScript(names, scripts, "qa:knowledge");
    addScript(names, scripts, "qa:knowledge-chat");
    addScript(names, scripts, "qa:knowledge-ui");
  }
  if (/src\/ui|tsx|css|vite|component/.test(joined)) {
    addScript(names, scripts, "build");
    addScript(names, scripts, "qa:knowledge-ui");
  }
  if (/src\/electron|ipc|mcp|runner|sqlite|database|task/.test(joined)) {
    addScript(names, scripts, "build");
    addScript(names, scripts, "qa:knowledge");
  }
  if (names.size === 0) {
    addScript(names, scripts, "build");
  }
  return Array.from(names).map((name) => `npm run ${name}`);
}

function addScript(target: Set<string>, scripts: RepoWikiScriptInfo[], name: string): void {
  if (scripts.some((script) => script.name === name)) {
    target.add(name);
  }
}

function inferRisks(files: string[]): string[] {
  const joined = files.join("\n").toLowerCase();
  const risks = new Set<string>();
  if (/knowledge|repowiki|embedding|vector/.test(joined)) {
    risks.add("知识库依赖 embedding 模型，不能只靠 FTS5 宣称可用。");
    risks.add("生成产物、UI DB、知识索引 DB 三者可能不同步。");
  }
  if (/ui|component|tsx|css/.test(joined)) {
    risks.add("UI 状态不能只存在前端内存，刷新后必须能从后端恢复。");
  }
  if (/electron|ipc|main|runner/.test(joined)) {
    risks.add("Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。");
  }
  if (/sqlite|database|repository/.test(joined)) {
    risks.add("数据库 schema 变更要考虑旧数据和向量维度。");
  }
  if (/mcp|tool|registry/.test(joined)) {
    risks.add("MCP 注册、工厂映射和 tool handler 任一缺失都会导致 Agent 调用失败。");
  }
  if (risks.size === 0) {
    risks.add("改动前先确认入口文件和真实运行面，避免只根据文档猜测。");
  }
  return Array.from(risks);
}

function dedupeCards(cards: AgentKnowledgeCard[]): AgentKnowledgeCard[] {
  const seen = new Set<string>();
  const output: AgentKnowledgeCard[] = [];
  for (const card of cards) {
    const normalizedId = slugify(card.id);
    const id = normalizedId || stableHash(card.title).slice(0, 12);
    if (seen.has(id)) continue;
    seen.add(id);
    output.push({ ...card, id });
  }
  return output.slice(0, 60);
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || stableHash(value).slice(0, 12);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
