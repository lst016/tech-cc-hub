import type { RepoWikiDependencyGraph } from "./graph.js";
import type {
  RepoWikiAgentQuestion,
  RepoWikiDependencyInfo,
  RepoWikiFileInfo,
  RepoWikiFileSignal,
  RepoWikiHighValueFile,
  RepoWikiProjectContext,
  RepoWikiProjectIntelligence,
  RepoWikiRuntimeFlow,
  RepoWikiScriptInfo,
} from "./types.js";

const IMPORTANT_DEPENDENCIES = new Set([
  "electron",
  "react",
  "vite",
  "typescript",
  "zustand",
  "better-sqlite3",
  "sqlite-vec",
  "@langchain/textsplitters",
  "@anthropic-ai/claude-agent-sdk",
  "@modelcontextprotocol/sdk",
  "zod",
  "lucide-react",
  "tailwindcss",
  "simple-git",
  "croner",
]);

const HIGH_VALUE_PATHS: Array<{ path: string; reason: string }> = [
  { path: "src/electron/main.ts", reason: "Electron 主进程入口，注册窗口、IPC、知识库通道和开发桥" },
  { path: "src/electron/ipc-handlers.ts", reason: "会话生命周期和主要 IPC 编排入口" },
  { path: "src/electron/libs/runner.ts", reason: "Agent system prompt、MCP、工作区和会话执行链路" },
  { path: "src/electron/libs/knowledge/knowledge-indexer.ts", reason: "Repo Wiki 生成、Markdown chunk、embedding、FTS/vector 写入主链路" },
  { path: "src/electron/libs/knowledge/knowledge-repository.ts", reason: "知识库 SQLite schema、FTS5、sqlite-vec 和检索 API" },
  { path: "src/electron/libs/knowledge/knowledge-ui-store.ts", reason: "Repo Wiki 工作区、生成状态、UI 文档和开发桥 IPC 后端" },
  { path: "src/electron/libs/knowledge/knowledge-overview.ts", reason: "聊天 system prompt 的知识库 overview 注入" },
  { path: "src/electron/libs/knowledge/repowiki/engine.ts", reason: "RepoWiki-compatible 生成器入口，串起扫描、图谱、分析、导出" },
  { path: "src/ui/components/KnowledgePanel.tsx", reason: "知识库前端入口，工作区列表、生成进度、Markdown 预览" },
  { path: "src/shared/builtin-mcp-registry.ts", reason: "内置 MCP server 和工具元数据注册表" },
  { path: "src/electron/libs/builtin-mcp-servers.ts", reason: "内置 MCP server 工厂映射和 tool name 暴露" },
  { path: "src/electron/libs/task/executor.ts", reason: "任务执行、恢复、重试、会话归档触发等核心编排" },
  { path: "src/ui/store/useAppStore.ts", reason: "主 UI 状态容器，连接会话、活动面板和知识库入口" },
  { path: "vite.config.ts", reason: "开发服务、预览构建和 watcher 忽略目录配置" },
  { path: "package.json", reason: "开发、构建、QA、打包命令和关键依赖来源" },
];

export function buildRepoWikiIntelligence(
  project: RepoWikiProjectContext,
  graph: RepoWikiDependencyGraph,
): RepoWikiProjectIntelligence {
  const scripts = readPackageScripts(project).slice(0, 28);
  const dependencies = readPackageDependencies(project).slice(0, 36);
  const signals = project.files.flatMap((file) => file.signals.map((signal) => withPath(signal, file.path)));
  const ipcChannels = signals.filter((signal) => signal.kind === "ipc").slice(0, 80);
  const uiIpcCalls = signals.filter((signal) => signal.kind === "ui_ipc").slice(0, 80);
  const mcpTools = signals.filter((signal) => signal.kind === "mcp_tool").slice(0, 120);
  const mcpServers = signals.filter((signal) => signal.kind === "mcp_server").slice(0, 40);
  const databaseTables = signals.filter((signal) => signal.kind === "database").slice(0, 80);
  const events = signals.filter((signal) => signal.kind === "event").slice(0, 80);

  const entrypoints = project.files
    .filter((file) => file.isEntrypoint || HIGH_VALUE_PATHS.some((item) => item.path === file.path))
    .map((file) => highValueFile(file, highValueReason(file.path) ?? "运行入口或高价值文件"))
    .slice(0, 32);

  const stores = project.files
    .filter((file) => file.signals.some((signal) => signal.kind === "store"))
    .map((file) => highValueFile(file, "状态容器或运行时 store"))
    .slice(0, 24);

  const highValueFiles = buildHighValueFiles(project, graph);
  const runtimeFlows = buildRuntimeFlows(project);
  const agentQuestions = buildAgentQuestions(project);

  return {
    scripts,
    dependencies,
    entrypoints,
    ipcChannels,
    uiIpcCalls,
    mcpTools,
    mcpServers,
    databaseTables,
    stores,
    events,
    highValueFiles,
    runtimeFlows,
    agentQuestions,
  };
}

export function formatRepoWikiIntelligenceForPrompt(project: RepoWikiProjectContext): string {
  const intelligence = project.intelligence;
  if (!intelligence) return "No extracted code intelligence.";
  const lines: string[] = [];
  lines.push("## Agent-usable Code Intelligence");
  lines.push("");
  lines.push("### Run and QA scripts");
  for (const script of intelligence.scripts.slice(0, 18)) {
    lines.push(`- npm run ${script.name}: ${script.command}`);
  }
  lines.push("");
  lines.push("### High value files");
  for (const file of intelligence.highValueFiles.slice(0, 24)) {
    lines.push(`- ${file.path}: ${file.reason}${file.signals.length ? ` (${file.signals.join(", ")})` : ""}`);
  }
  lines.push("");
  lines.push("### Runtime flows");
  for (const flow of intelligence.runtimeFlows) {
    lines.push(`- ${flow.title}: ${flow.summary}`);
    lines.push(`  Evidence: ${flow.evidence.join(", ")}`);
  }
  lines.push("");
  lines.push("### IPC channels");
  for (const signal of intelligence.ipcChannels.slice(0, 32)) {
    lines.push(`- ${signal.name} @ ${signal.detail}`);
  }
  lines.push("");
  lines.push("### Renderer bridge calls");
  for (const signal of intelligence.uiIpcCalls.slice(0, 32)) {
    lines.push(`- ${signal.name} @ ${signal.detail}`);
  }
  lines.push("");
  lines.push("### MCP tools");
  for (const signal of intelligence.mcpTools.slice(0, 48)) {
    lines.push(`- ${signal.name} @ ${signal.detail}`);
  }
  lines.push("");
  lines.push("### SQLite / vector tables and indexes");
  for (const signal of intelligence.databaseTables.slice(0, 40)) {
    lines.push(`- ${signal.name} @ ${signal.detail}`);
  }
  lines.push("");
  lines.push("### Agent questions");
  for (const item of intelligence.agentQuestions) {
    lines.push(`- ${item.question}: ${item.answer} Files: ${item.files.join(", ")}`);
  }
  return lines.join("\n");
}

export function formatModuleEvidenceForPrompt(moduleName: string, files: RepoWikiFileInfo[]): string {
  const lines: string[] = [];
  lines.push(`## Module Evidence: ${moduleName}`);
  for (const file of files) {
    const signals = file.signals.slice(0, 12).map((signal) => `${signal.kind}:${signal.name}`).join(", ");
    const symbols = file.symbols.slice(0, 12).map((symbol) => `${symbol.kind} ${symbol.name}:${symbol.line}`).join(", ");
    const imports = file.imports.slice(0, 12).join(", ");
    const exports = file.exports.slice(0, 12).join(", ");
    lines.push(`- ${file.path} (${file.language}, ${file.lines} lines)`);
    if (signals) lines.push(`  - signals: ${signals}`);
    if (symbols) lines.push(`  - symbols: ${symbols}`);
    if (imports) lines.push(`  - imports: ${imports}`);
    if (exports) lines.push(`  - exports: ${exports}`);
  }
  return lines.join("\n");
}

function readPackageScripts(project: RepoWikiProjectContext): RepoWikiScriptInfo[] {
  const pkg = parsePackageJson(project);
  const scripts = pkg?.scripts;
  if (!isPlainRecord(scripts)) return [];
  return Object.entries(scripts)
    .filter(([, command]) => typeof command === "string")
    .map(([name, command]) => ({ name, command: String(command) }));
}

function readPackageDependencies(project: RepoWikiProjectContext): RepoWikiDependencyInfo[] {
  const pkg = parsePackageJson(project);
  if (!pkg) return [];
  const output: RepoWikiDependencyInfo[] = [];
  for (const [groupName, group] of [
    ["runtime", pkg.dependencies],
    ["dev", pkg.devDependencies],
  ] as const) {
    if (!isPlainRecord(group)) continue;
    for (const [name, version] of Object.entries(group)) {
      if (!IMPORTANT_DEPENDENCIES.has(name) && !name.includes("mcp") && !name.includes("sqlite")) continue;
      output.push({ name, version: String(version), group: groupName });
    }
  }
  return output.sort((left, right) => left.group.localeCompare(right.group) || left.name.localeCompare(right.name));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parsePackageJson(project: RepoWikiProjectContext): Record<string, unknown> | null {
  const file = project.files.find((item) => item.path === "package.json");
  if (!file?.content) return null;
  try {
    return JSON.parse(file.content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function withPath(signal: RepoWikiFileSignal, path: string): RepoWikiFileSignal {
  return {
    ...signal,
    detail: signal.detail ? `${path}:${signal.line ?? 1} - ${signal.detail}` : `${path}:${signal.line ?? 1}`,
  };
}

function highValueFile(file: RepoWikiFileInfo, reason: string): RepoWikiHighValueFile {
  return {
    path: file.path,
    reason,
    signals: file.signals.slice(0, 8).map((signal) => `${signal.kind}:${signal.name}`),
  };
}

function highValueReason(path: string): string | undefined {
  return HIGH_VALUE_PATHS.find((item) => item.path === path)?.reason;
}

function buildHighValueFiles(project: RepoWikiProjectContext, graph: RepoWikiDependencyGraph): RepoWikiHighValueFile[] {
  const ranked = new Map(graph.rankFiles().slice(0, 80).map(([path, score]) => [path, score]));
  const candidates = project.files
    .map((file) => {
      const explicit = highValueReason(file.path);
      const signalScore = file.signals.length * 4 + file.exports.length + file.symbols.length * 0.5;
      const rankScore = (ranked.get(file.path) ?? 0) * 10_000;
      const entryScore = file.isConfig ? 20 : file.isEntrypoint ? 16 : 0;
      const pathScore = explicit ? 80 : /src\/electron\/libs\/|src\/ui\/components|src\/shared/.test(file.path) ? 8 : 0;
      return {
        file,
        reason: explicit ?? inferReason(file),
        score: pathScore + signalScore + rankScore + entryScore,
      };
    })
    .filter((item) => item.score > 4)
    .sort((left, right) => right.score - left.score || left.file.path.localeCompare(right.file.path));

  return candidates.map((item) => highValueFile(item.file, item.reason)).slice(0, 140);
}

function inferReason(file: RepoWikiFileInfo): string {
  if (file.isConfig) return "配置文件，会影响运行、构建或模型能力";
  if (file.isEntrypoint) return "入口文件，适合从这里跟踪启动链路";
  if (file.signals.some((signal) => signal.kind === "database")) return "包含 SQLite/FTS/vector schema 或索引写入";
  if (file.signals.some((signal) => signal.kind === "ipc" || signal.kind === "ui_ipc")) return "定义或调用跨进程接口";
  if (file.signals.some((signal) => signal.kind === "mcp_tool")) return "暴露给 Agent 的 MCP 工具面";
  if (file.signals.some((signal) => signal.kind === "store")) return "保存 UI 或运行态状态";
  return "被依赖较多或包含关键导出";
}

function buildRuntimeFlows(project: RepoWikiProjectContext): RepoWikiRuntimeFlow[] {
  const has = (path: string) => project.files.some((file) => file.path === path);
  const flows: RepoWikiRuntimeFlow[] = [];
  if (has("src/electron/libs/knowledge/knowledge-indexer.ts")) {
    flows.push({
      title: "知识库生成、索引与注入",
      summary: "RepoWiki-compatible 生成器产出 Markdown，text splitter 切块，embedding 写入 sqlite-vec/FTS5，runner 再把 overview 注入 system prompt。",
      steps: [
        "KnowledgePanel 通过 knowledge:run-generation 触发",
        "knowledge-ui-store 调用 indexKnowledgeWorkspace",
        "knowledge-indexer 调用 generateRepoWiki 并收集 Markdown",
        "RecursiveCharacterTextSplitter 切 chunk，embedTextBatches 生成向量",
        "KnowledgeRepository 写入 documents/chunks/FTS/vector",
        "knowledge-overview 为新会话拼装 <knowledge_overview>",
      ],
      evidence: [
        "src/ui/components/KnowledgePanel.tsx",
        "src/electron/libs/knowledge/knowledge-ui-store.ts",
        "src/electron/libs/knowledge/knowledge-indexer.ts",
        "src/electron/libs/knowledge/knowledge-repository.ts",
        "src/electron/libs/knowledge/knowledge-overview.ts",
        "src/electron/libs/runner.ts",
      ],
    });
  }
  if (has("src/electron/libs/runner.ts")) {
    flows.push({
      title: "聊天会话执行",
      summary: "Renderer 发起 session.start，Electron 持久化会话并构造 runner，上下文、规则、MCP server 和知识库 overview 在 runner 层合并。",
      steps: [
        "UI 创建会话请求",
        "ipc-handlers/session-store 管理会话状态",
        "runner 拼接 system prompt、Agent runtime、MCP 工具和工作区",
        "stream 事件回写到 UI store",
      ],
      evidence: [
        "src/electron/ipc-handlers.ts",
        "src/electron/libs/session-store.ts",
        "src/electron/libs/runner.ts",
        "src/ui/store/useAppStore.ts",
      ],
    });
  }
  if (has("src/electron/libs/task/executor.ts")) {
    flows.push({
      title: "任务同步与执行",
      summary: "外部任务 provider 只负责映射任务，TaskExecutor 负责并发、恢复、重试、写回和执行记录。",
      steps: [
        "provider-registry 注册外部任务源",
        "TaskRepository 持久化任务、执行和日志",
        "TaskExecutor 按状态调度并创建独立 workspace",
        "执行完成后更新任务状态并可写回外部系统",
      ],
      evidence: [
        "src/electron/libs/task/provider-registry.ts",
        "src/electron/libs/task/repository.ts",
        "src/electron/libs/task/executor.ts",
        "src/electron/libs/task/workspace.ts",
      ],
    });
  }
  if (has("src/shared/builtin-mcp-registry.ts")) {
    flows.push({
      title: "内置 MCP 工具面",
      summary: "共享 registry 描述可见工具，Electron 工厂创建真实 MCP server；Agent 能调用 browser/design/git/knowledge/plan 等能力。",
      steps: [
        "shared registry 提供 server 和 tool 元数据",
        "builtin-mcp-servers 映射 server name 到工厂函数",
        "runner 根据 runtime config 加载 MCP server",
        "工具处理器访问 BrowserView、Git、设计分析或知识库服务",
      ],
      evidence: [
        "src/shared/builtin-mcp-registry.ts",
        "src/electron/libs/builtin-mcp-servers.ts",
        "src/electron/libs/mcp-tools/browser.ts",
        "src/electron/libs/mcp-tools/design.ts",
        "src/electron/libs/mcp-tools/plan.ts",
      ],
    });
  }
  return flows;
}

function buildAgentQuestions(project: RepoWikiProjectContext): RepoWikiAgentQuestion[] {
  const questions: RepoWikiAgentQuestion[] = [];
  const has = (path: string) => project.files.some((file) => file.path === path);
  if (has("src/electron/libs/knowledge/knowledge-indexer.ts")) {
    questions.push({
      question: "为什么知识库功能必须有 embedding 模型？",
      answer: "knowledge-indexer 在缺少 embedding 设置时直接返回 missing-embedding-model，设计上不允许只开 FTS5；上线验证要检查 vectorStoreReady、FTS 行数和 vector 行数一致。",
      files: [
        "src/electron/libs/knowledge/knowledge-indexer.ts",
        "src/electron/libs/knowledge/embedding-client.ts",
        "src/electron/libs/knowledge/knowledge-repository.ts",
      ],
    });
  }
  if (has("src/ui/components/KnowledgePanel.tsx")) {
    questions.push({
      question: "刷新后生成状态为什么不能丢？",
      answer: "前端状态只是展示层，真实状态必须落在 knowledge_ui_generation 和 knowledge_ui_documents；KnowledgePanel 要通过 bridge 重新拉取后端状态。",
      files: [
        "src/ui/components/KnowledgePanel.tsx",
        "src/electron/libs/knowledge/knowledge-ui-store.ts",
      ],
    });
  }
  if (has("src/electron/libs/runner.ts")) {
    questions.push({
      question: "Agent 如何在聊天里看到知识库？",
      answer: "runner 拼 system prompt 时追加 knowledge-overview 生成的 XML 摘要，Agent 先看到标题/摘要，再按需用知识库工具或 UI 内容深取。",
      files: [
        "src/electron/libs/runner.ts",
        "src/electron/libs/knowledge/knowledge-overview.ts",
      ],
    });
  }
  return questions;
}
