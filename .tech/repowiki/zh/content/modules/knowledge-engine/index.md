# knowledge-engine

> Multi-modal knowledge base system for desktop agent, providing vector search, full-text search, AI-generated project wiki, and memory storage.

知识引擎模块为桌面 Agent 工作台提供完整的知识管理能力。核心功能包括：(1) 通过 sqlite-vec 实现向量检索和 FTS5 全文搜索；(2) 扫描工作区文件并 chunk 生成 embedding；(3) RepoWiki 系统通过 Python 脚本分析项目依赖图谱、提取代码信号，生成中文项目文档；(4) 与聊天 system prompt 集成，向 Agent 注入知识库概览。模块分为核心存储层(knowledge-repository)、索引管道(knowledge-indexer)、UI状态(knowledge-ui-store)、RepoWiki生成器(repowiki/*)四大子系统。

## 文件

### `knowledge-repository.ts`

SQLite存储层，管理文档、chunks和向量索引，提供upsert/search API

- `KnowledgeRepository` (class) - 核心仓库类，管理knowledge_documents、knowledge_chunks、knowledge_chunks_fts(FTS5)和knowledge_chunk_vectors(vec0)四张表
- `initializeVectorStore` (method) - 尝试加载sqlite-vec扩展，失败则优雅降级
- `upsertDocument` (method) - 批量写入文档和chunks，包含去重(content_hash)、embedding写入
- `searchKnowledge` (method) - 混合搜索：mode=vector时用sqlite-vec的vec_search_pages，mode=hybrid时合并FTS结果

### `knowledge-ui-store.ts`

UI状态持久化，管理工作区、生成状态和Wiki文档，与前端开发桥IPC对接

- `KnowledgeUiStore` (class) - 管理knowledge_ui_workspaces、knowledge_ui_generation、knowledge_ui_documents三表
- `createKnowledgeUiStore` (function) - 工厂函数，创建store实例并注册到IPC通道
- `runKnowledgeGeneration` (method) - 触发RepoWiki生成，基于git commit追踪增量变更

### `knowledge-indexer.ts`

索引管道主入口，遍历文件→chunk→embedding→写入仓库

- `indexKnowledgeWorkspace` (function) - 主索引函数：收集Markdown→生成chunks→批量embedding→upsert入库
- `buildKnowledgeInputs` (function) - 构建KnowledgeUpsertInput数组，处理标题提取和元数据附加
- `DEFAULT_CHUNK_SIZE` (constant) - 默认chunk大小1800 tokens，overlap 220

### `knowledge-utils.ts`

通用工具函数，支持忽略模式匹配、文件遍历、哈希和token估算

- `walkWorkspaceFiles` (function) - 遍历工作区文件，过滤ignore文件(maxFiles/maxFileBytes)
- `matchesIgnorePattern` (function) - glob风格模式匹配，支持通配符和目录限定
- `stableHash` (function) - 对输入内容生成稳定SHA256哈希(截取16位)用于去重

### `repowiki/analyzer.ts`

AI驱动的项目分析器，通过wiki-model生成概览、模块和文档

- `RepoWikiAnalyzer` (class) - 使用WikiModel并行生成overview、modules、reading_guide等WikiData
- `generateOverview` (method) - 调用completeWikiChat构建项目描述、技术栈、关键工作流
- `MAX_MODULES` (constant) - 最多生成18个模块文档

### `repowiki/builder.ts`

将分析数据构建为WikiPage数组，生成侧边栏结构

- `RepoWikiBuilder` (class) - 按顺序构建index、agent-playbook、architecture、module、dependencies等页面
- `buildOverviewPage` (function) - 生成项目概览Markdown，含mermaid架构图占位
- `buildModulePage` (function) - 生成模块文档，包含文件列表和关系描述

### `repowiki/engine.ts`

调用vendored Python RepoWiki脚本执行实际生成

- `generateRepoWiki` (function) - 异步调用run-repowiki.py，传递workspace、output、model参数
- `findRepoRoot` (function) - 向上查找third_party/repowiki目录
- `parseRunnerJson` (function) - 从stdout反向扫描有效JSON行

### `repowiki/graph.ts`

从源码import语句构建依赖图，实现PageRank排序

- `RepoWikiDependencyGraph` (class) - 解析JS/TS/Python/Go等多语言import，支持相对路径解析
- `buildFromProject` (static method) - 静态工厂，从RepoWikiProjectContext构建图
- `rankFiles` (method) - 30次迭代PageRank算法，返回文件重要性排序
- `toMermaid` (method) - 导出Mermaid格式依赖图

### `repowiki/intelligence.ts`

从项目文件提取信号：IPC通道、MCP工具、数据库表、脚本命令等

- `buildRepoWikiIntelligence` (function) - 提取package.json scripts/deps、代码中的信号，构建RepoWikiProjectIntelligence
- `buildRuntimeFlows` (function) - 根据信号模式推断关键运行链路
- `HIGH_VALUE_PATHS` (constant) - 本项目关键文件路径及用途说明

### `repowiki/scanner.ts`

扫描文件系统：检测语言、提取符号(signals)、预览内容

- `scanRepoWikiProject` (function) - 主扫描函数，遍历文件→提取imports/exports/symbols/signals
- `extractFileSignals` (function) - 正则匹配代码中的IPC、mcp_tool、database等信号标记
- `LANG_MAP` (constant) - 文件扩展名到语言名映射

### `repowiki/types.ts`

整个RepoWiki系统的TypeScript类型定义

- `RepoWikiFileSignal` (type) - 信号类型：ipc|ui_ipc|mcp_tool|mcp_server|database|store|event|config|entrypoint
- `RepoWikiProjectContext` (type) - 扫描后的完整项目上下文，含files、fileTree、intelligence
- `WikiData` (type) - 分析输出：overview、modules、architecture、reading_guide

### `knowledge-model-settings.ts`

从config-store解析embedding和wiki模型配置

- `resolveKnowledgeModelSettings` (function) - 从profiles过滤出embeddingModel和wikiModel，返回KnowledgeModelSettings
- `resolveEmbeddingDimension` (function) - 根据模型名匹配已知维度(如qwen3/text-embedding-3)
- `DEFAULT_EMBEDDING_DIMENSION` (constant) - 默认1536

### `knowledge-overview.ts`

构建聊天system prompt附加的XML格式知识概览

- `buildKnowledgeOverviewPromptAppend` (function) - 查询knowledge和memory库，生成<knowledge_overview>标签追加到system prompt
- `groupKnowledge` (function) - 按category分组知识条目

### `knowledge-paths.ts`

解析并确保工作区路径结构：.tech/repowiki、.tech/memory、appData/knowledge等

- `KnowledgeWorkspacePaths` (type) - 完整路径类型：workspaceRoot、techRoot、repowikiContentDir、knowledgeDbPath等
- `resolveKnowledgeWorkspacePaths` (function) - 从workspaceRoot和appDataPath计算所有派生路径
- `ensureKnowledgeWorkspaceDirectories` (function) - 确保所有目录存在(递归创建)

## 关键概念

- **向量检索 + 全文搜索混合**: knowledge-repository同时维护FTS5虚拟表(全文)和sqlite-vec虚拟表(向量)。searchKnowledge根据mode参数选择vec_search_pages(精确)或hybrid(合并FTS降权)，实现语义+关键词混合检索。
- **RepoWiki生成管道**: scanner扫描源码→graph构建依赖→intelligence提取信号→analyzer调用AI生成→builder构建页面。engine通过Python脚本串起全流程，实现deterministic deterministic文件页面生成。
- **增量生成追踪**: knowledge-ui-store存储generation状态，记录commitId、branch。indexKnowledgeWorkspace基于git diff识别增量文件，只重索引变更部分。
- **信号系统(Signals)**: scanner从源码正则提取IPC通道、MCP工具、数据库表等运行时信号。intelligence聚合后注入prompt，让Agent理解项目的调用契约和关键工作流。
- **Chunk策略**: 使用@langchain/textsplitters的RecursiveCharacterTextSplitter，按1800 tokens分块220 overlap，保留markdown标题结构作为chunk title。
- **知识概览注入**: buildKnowledgeOverviewPromptAppend查询最近24条knowledge和18条memory条目，按category分组后生成XML标签追加到聊天system prompt，向Agent暴露可用知识。

## 内部关系

- `knowledge-indexer.ts` → `knowledge-repository.ts`: indexer调用repository.upsertDocument写入索引数据
- `knowledge-indexer.ts` → `embedding-client.ts`: 获取embedding向量后传给repository
- `knowledge-indexer.ts` → `knowledge-paths.ts`: 使用paths解析工作区目录结构
- `knowledge-overview.ts` → `knowledge-repository.ts`: 查询仓库构建system prompt概览
- `knowledge-overview.ts` → `knowledge-paths.ts`: 解析db路径
- `knowledge-ui-store.ts` → `knowledge-indexer.ts`: UI层触发索引任务
- `knowledge-ui-store.ts` → `knowledge-paths.ts`: 解析工作区路径用于文件操作
- `repowiki/engine.ts` → `repowiki/scanner.ts`: Python脚本内部调用scanner逻辑
- `repowiki/engine.ts` → `repowiki/analyzer.ts`: Python脚本内部调用analyzer逻辑
- `repowiki/analyzer.ts` → `repowiki/graph.ts`: 构建依赖图用于模块分组和排序
- `repowiki/analyzer.ts` → `repowiki/intelligence.ts`: 使用project intelligence增强prompt
- `repowiki/intelligence.ts` → `repowiki/scanner.ts`: 依赖scanner提取的file signals
- `repowiki/builder.ts` → `repowiki/graph.ts`: 导出mermaid依赖图
- `knowledge-model-settings.ts` → `config-store.js`: 从配置加载API profiles

## Agent 关注点

- Repo Wiki 生成由 `generateRepoWiki` 触发，输出 Markdown 到 `.tech/repowiki`。
- `knowledge-indexer.ts` 负责 Markdown chunk、embedding 调用和索引写入。
- `KnowledgeRepository` 维护 `knowledge_documents`、`knowledge_chunks`、FTS5 和 sqlite-vec。
- `knowledge-overview.ts` 将索引摘要注入聊天 system prompt。
