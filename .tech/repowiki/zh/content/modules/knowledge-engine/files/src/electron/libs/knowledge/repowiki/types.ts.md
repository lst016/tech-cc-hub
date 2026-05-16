# src/electron/libs/knowledge/repowiki/types.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：215

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `RepoWikiCodeSymbol@1`
- `RepoWikiFileSignal@7`
- `RepoWikiFileInfo@14`
- `RepoWikiScriptInfo@30`
- `RepoWikiDependencyInfo@35`
- `RepoWikiHighValueFile@41`
- `RepoWikiRuntimeFlow@47`
- `RepoWikiAgentQuestion@54`
- `RepoWikiProjectIntelligence@60`
- `RepoWikiProjectContext@76`
- `TechItem@85`
- `ProjectOverview@91`
- `SymbolDoc@106`
- `FileDoc@113`
- `RelationshipDoc@119`
- `ConceptDoc@125`
- `ModuleDoc@130`
- `ArchitectureComponent@145`
- `ArchitectureDiagram@151`
- `ReadingStep@163`
- `ReadingGuide@171`
- `WikiData@178`
- `WikiPage@185`
- `SidebarItem@193`
- `RepoWiki@199`
- `RepoWikiSkippedFile@205`
- `RepoWikiScanResult@210`

## 对外暴露

- `RepoWikiCodeSymbol`
- `RepoWikiFileSignal`
- `RepoWikiFileInfo`
- `RepoWikiScriptInfo`
- `RepoWikiDependencyInfo`
- `RepoWikiHighValueFile`
- `RepoWikiRuntimeFlow`
- `RepoWikiAgentQuestion`
- `RepoWikiProjectIntelligence`
- `RepoWikiProjectContext`
- `TechItem`
- `ProjectOverview`
- `SymbolDoc`
- `FileDoc`
- `RelationshipDoc`
- `ConceptDoc`
- `ModuleDoc`
- `ArchitectureComponent`
- `ArchitectureDiagram`
- `ReadingStep`
- `ReadingGuide`
- `WikiData`
- `WikiPage`
- `SidebarItem`
- `RepoWiki`
- `RepoWikiSkippedFile`
- `RepoWikiScanResult`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export type RepoWikiCodeSymbol = {
  name: string;
  kind: string;
  line: number;
  signature?: string;
};

export type RepoWikiFileSignal = {
  kind: "ipc" | "ui_ipc" | "mcp_tool" | "mcp_server" | "database" | "store" | "event" | "config" | "entrypoint";
  name: string;
  detail?: string;
  line?: number;
};

export type RepoWikiFileInfo = {
  path: string;
  absolutePath: string;
  size: number;
  language: string;
  lines: number;
  preview: string;
  content: string;
  isConfig: boolean;
  isEntrypoint: boolean;
  imports: string[];
  exports: string[];
  symbols: RepoWikiCodeSymbol[];
  signals: RepoWikiFileSignal[];
};

export type RepoWikiScriptInfo = {
  name: string;
  command: string;
};

export type RepoWikiDependencyInfo = {
  name: string;
  version: string;
  group: "runtime" | "dev";
};

export type RepoWikiHighValueFile = {
  path: string;
  reason: string;
  signals: string[];
};

export type RepoWikiRuntimeFlow = {
  title: string;
  summary: string;
  steps: string[];
  evidence: string[];
};

export type RepoWikiAgentQuestion = {
  question: string;
  answer: string;
  files: string[];
};

export type RepoWikiProjectIntelligence = {
  scripts: RepoWikiScriptInfo[];
  dependencies: RepoWikiDependencyInfo[];
  entrypoints: RepoWikiHighValueFile[];
  ipcChannels: RepoWikiFileSignal[];
  uiIpcCalls: RepoWikiFileSignal[];
  mcpTools: RepoWikiFileSignal[];
  mcpServers: RepoWikiFileSignal[];
  databaseTables: RepoWikiFileSignal[];
  stores: RepoWikiHighValueFile[];
  events: RepoWikiFileSignal[];
  highValueFiles: RepoWikiHighValueFile[];
  runtimeFlows: RepoWikiRuntimeFlow[];
  agentQuestions: RepoWikiAgentQuestion[];
};

export type RepoWikiProjectContext = {
  name: string;
  root: string;
  files: RepoWikiFileInfo[];
  fileTree: string;
  totalLines: number;
  intelligence?: RepoWikiProjectIntelligence;
};

export type TechItem = {
  name: string;
  category?: string;
  version?: string;
};

export type ProjectOverview = {
  name?: string;
  one_liner?: string;
  description?: string;
  tech_stack?: TechItem[];
  setup_instructions?: string[];
  key_features?: string[];
  agent_summary?: string[];
  key_workflows?: Array<{ name: string; summary?: string; files?: string[] }>;
  runtime_surfaces?: string[];
  storage_and_indexes?: string[];
  quality_gates?: string[];
  change_risks?: string[];
};

export type SymbolDoc = {
  name: string;
  kind?: string;
  line?: number;
  description?: string;
};

export type FileDoc = {
  path: string;
  purpose?: string;
  key_symbols?: SymbolDoc[];
};

export type RelationshipDoc = {
  source: string;
  target: string;
  description?: string;
};

export type ConceptDoc = {
  name: string;
  explanation?: string;
};

export type ModuleDoc = {
  name: string;
  purpose?: string;
  description?: string;
  files?: FileDoc[];
  relationships?: RelationshipDoc[];
  key_concepts?: ConceptDoc[];
  agent_value?: string[];
  entrypoints?: Array<{ path: string; reason?: string }>;
  data_contracts?: ConceptDoc[];
  operational_notes?: string[];
  change_risks?: string[];
  validation?: string[];
};

export type ArchitectureComponent = {
  name: string;
  purpose?: string;
  files?: string[];
};

export type ArchitectureDiagram = {
  architecture_type?: string;
  description?: string;
  components?: ArchitectureComponent[];
  mermaid_component?: string;
  mermaid_sequence?: string;
  data_flow?: string;
  layers?: ArchitectureComponent[];
  boundaries?: string[];
  integration_points?: string[];
};

export type ReadingStep = {
  order: number;
  title: string;
  files?: string[];
  explanation?: string;
  time_estimate?: string;
};

export type ReadingGuide = {
  introduction?: string;
  steps?: ReadingStep[];
  tips?: string[];
  task_paths?: Array<{ task: string; files: string[]; why?: string }>;
};

export type WikiData = {
  overview: ProjectOverview;
  modules: ModuleDoc[];
  architecture: ArchitectureDiagram;
  reading_guide: ReadingGuide;
};

export type WikiPage = {
  id: string;
  title: string;
  content: string;
  parentId?: string;
  order: number;
};

export type SidebarItem = {
  title: string;
  pageId?: string;
  children: SidebarItem[];
};

export type RepoWiki
... (truncated)
```
