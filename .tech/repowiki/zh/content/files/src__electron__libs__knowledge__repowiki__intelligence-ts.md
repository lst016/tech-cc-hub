# src/electron/libs/knowledge/repowiki/intelligence.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：370

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildRepoWikiIntelligence@49`
- `formatRepoWikiIntelligenceForPrompt@94`
- `formatModuleEvidenceForPrompt@143`
- `readPackageScripts@160`
- `readPackageDependencies@169`
- `isPlainRecord@186`
- `parsePackageJson@190`
- `withPath@200`
- `highValueFile@207`
- `highValueReason@215`
- `buildHighValueFiles@219`
- `inferReason@240`
- `buildRuntimeFlows@250`
- `buildAgentQuestions@333`
- `IMPORTANT_DEPENDENCIES@13`
- `scripts@54`
- `dependencies@55`
- `signals@56`
- `ipcChannels@57`
- `uiIpcCalls@58`
- `mcpTools@59`
- `mcpServers@60`
- `databaseTables@61`
- `events@62`
- `entrypoints@63`
- `stores@68`
- `highValueFiles@73`
- `runtimeFlows@75`
- `agentQuestions@76`
- `intelligence@96`
- `signals@148`
- `symbols@149`
- `imports@150`
- `exports@151`
- `pkg@162`
- `scripts@163`
- `pkg@171`
- `file@192`
- `ranked@221`
- `candidates@222`

## 依赖输入

- `./graph.js`
- `./types.js`

## 对外暴露

- `buildRepoWikiIntelligence`
- `formatRepoWikiIntelligenceForPrompt`
- `formatModuleEvidenceForPrompt`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
  for (con
... (truncated)
```
