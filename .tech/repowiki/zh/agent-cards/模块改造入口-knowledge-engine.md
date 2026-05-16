# 模块改造入口：knowledge-engine

<agent_card id="module-knowledge-engine" kind="module">

## 什么时候用
当任务落在 knowledge-engine 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `src/electron/libs/knowledge/knowledge-repository.ts`: 知识库 SQLite schema、FTS5、sqlite-vec 和检索 API
- `src/electron/libs/knowledge/knowledge-ui-store.ts`: Repo Wiki 工作区、生成状态、UI 文档和开发桥 IPC 后端
- `src/electron/libs/knowledge/repowiki/engine.ts`: RepoWiki-compatible 生成器入口，串起扫描、图谱、分析、导出
- `src/electron/libs/knowledge/knowledge-indexer.ts`: Repo Wiki 生成、Markdown chunk、embedding、FTS/vector 写入主链路
- `src/electron/libs/knowledge/knowledge-overview.ts`: 聊天 system prompt 的知识库 overview 注入
- `src/electron/libs/knowledge/repowiki/types.ts`: 被依赖较多或包含关键导出

## 相关文件
- `src/electron/libs/knowledge/knowledge-repository.ts`
- `src/electron/libs/knowledge/knowledge-ui-store.ts`
- `src/electron/libs/knowledge/repowiki/engine.ts`
- `src/electron/libs/knowledge/knowledge-indexer.ts`
- `src/electron/libs/knowledge/knowledge-overview.ts`
- `src/electron/libs/knowledge/repowiki/types.ts`
- `src/electron/libs/knowledge/knowledge-utils.ts`
- `src/electron/libs/knowledge/repowiki/scanner.ts`
- `src/electron/libs/knowledge/repowiki/intelligence.ts`

## 改代码指南
- 先确认需求是否真的属于 knowledge-engine，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build
- npm run qa:knowledge
- npm run qa:knowledge-chat
- npm run qa:knowledge-ui

## 风险点
- 知识库依赖 embedding 模型，不能只靠 FTS5 宣称可用。
- 生成产物、UI DB、知识索引 DB 三者可能不同步。
- UI 状态不能只存在前端内存，刷新后必须能从后端恢复。
- Electron 主进程、renderer bridge 和浏览器预览数据源可能不一致。
- 数据库 schema 变更要考虑旧数据和向量维度。

## 检索关键词
knowledge-engine, knowledge-repository.ts, database:knowledge_documents, database:knowledge_chunks, database:knowledge_chunks_fts, database:knowledge_index_runs, database:knowledge_chunk_vectors, database:idx_knowledge_documents_workspace, database:idx_knowledge_documents_source, database:idx_knowledge_chunks_document, knowledge-ui-store.ts, database:knowledge_ui_workspaces, database:knowledge_ui_generation, database:knowledge_ui_documents, database:idx_knowledge_ui_workspaces_hidden, database:idx_knowledge_ui_documents_workspace, engine.ts, knowledge-indexer.ts, knowledge-overview.ts, types.ts, knowledge-utils.ts, scanner.ts, store:scanner, intelligence.ts

## 代码信号
- database:knowledge_documents
- database:knowledge_chunks
- database:knowledge_chunks_fts
- database:knowledge_index_runs
- database:knowledge_chunk_vectors
- database:idx_knowledge_documents_workspace
- database:idx_knowledge_documents_source
- database:idx_knowledge_chunks_document
- database:knowledge_ui_workspaces
- database:knowledge_ui_generation
- database:knowledge_ui_documents
- database:idx_knowledge_ui_workspaces_hidden
- database:idx_knowledge_ui_documents_workspace
- store:scanner
- store:intelligence

</agent_card>
