# SQLite / FTS / Vector 存储面

<agent_card id="sqlite-fts-vector-storage" kind="database">

## 什么时候用
用于定位 SQLite 表、FTS5、sqlite-vec 和运行态索引写入位置。

## 修改入口
- `pro-workflow/src/db/schema.sql`: 数据库 schema、索引或写入逻辑
- `src/electron/libs/cron-db.ts`: 数据库 schema、索引或写入逻辑
- `src/electron/libs/knowledge/knowledge-repository.ts`: 数据库 schema、索引或写入逻辑
- `src/electron/libs/knowledge/knowledge-ui-store.ts`: 数据库 schema、索引或写入逻辑
- `src/electron/libs/learning-store.ts`: 数据库 schema、索引或写入逻辑
- `src/electron/libs/memory/memory-repository.ts`: 数据库 schema、索引或写入逻辑
- `src/electron/libs/note-repository.ts`: 数据库 schema、索引或写入逻辑
- `src/electron/libs/session-store.ts`: 数据库 schema、索引或写入逻辑

## 相关文件
- `pro-workflow/src/db/schema.sql`
- `src/electron/libs/cron-db.ts`
- `src/electron/libs/knowledge/knowledge-repository.ts`
- `src/electron/libs/knowledge/knowledge-ui-store.ts`
- `src/electron/libs/learning-store.ts`
- `src/electron/libs/memory/memory-repository.ts`
- `src/electron/libs/note-repository.ts`
- `src/electron/libs/session-store.ts`
- `src/electron/libs/skill-manager/db.ts`
- `src/electron/libs/task/repository.ts`

## 改代码指南
- 改 schema 时必须考虑已有 app-data 数据迁移和重启后的读取。
- FTS 行数、vector 行数和 chunk 行数要保持一致。
- workspace 可读文件和 runtime DB 分离，别把 sqlite 直接放进用户可见 .tech 文档层。

## 验证方式
- npm run build
- npm run qa:knowledge
- npm run qa:knowledge-chat
- npm run qa:knowledge-ui

## 风险点
- sqlite-vec 维度变更会让旧表不可复用。
- 删除文档时要同步清理 chunk、FTS 和 vector row。

## 检索关键词
SQLite, FTS5, sqlite-vec, embedding, knowledge_documents, knowledge_chunks

## 代码信号
- database:learnings @ pro-workflow/src/db/schema.sql:5 - SQLite table
- database:learnings_fts @ pro-workflow/src/db/schema.sql:17 - SQLite table
- database:sessions @ pro-workflow/src/db/schema.sql:45 - SQLite table
- database:wikis @ pro-workflow/src/db/schema.sql:67 - SQLite table
- database:wiki_pages @ pro-workflow/src/db/schema.sql:79 - SQLite table
- database:wiki_sources @ pro-workflow/src/db/schema.sql:92 - SQLite table
- database:wiki_claims @ pro-workflow/src/db/schema.sql:103 - SQLite table
- database:wiki_seeds @ pro-workflow/src/db/schema.sql:112 - SQLite table
- database:wiki_pages_fts @ pro-workflow/src/db/schema.sql:122 - SQLite table
- database:wiki_embeddings @ pro-workflow/src/db/schema.sql:154 - SQLite table
- database:learnings_wiki @ pro-workflow/src/db/schema.sql:164 - SQLite table
- database:idx_learnings_category @ pro-workflow/src/db/schema.sql:56 - SQLite index
- database:idx_learnings_project @ pro-workflow/src/db/schema.sql:57 - SQLite index
- database:idx_learnings_created_at @ pro-workflow/src/db/schema.sql:58 - SQLite index
- database:idx_sessions_project @ pro-workflow/src/db/schema.sql:59 - SQLite index
- database:idx_sessions_started_at @ pro-workflow/src/db/schema.sql:60 - SQLite index
- database:idx_wiki_pages_slug @ pro-workflow/src/db/schema.sql:147 - SQLite index
- database:idx_wiki_pages_type @ pro-workflow/src/db/schema.sql:148 - SQLite index
- database:idx_wiki_seeds_status @ pro-workflow/src/db/schema.sql:149 - SQLite index
- database:idx_wiki_claims_page @ pro-workflow/src/db/schema.sql:150 - SQLite index
- database:idx_wiki_embeddings_model @ pro-workflow/src/db/schema.sql:161 - SQLite index
- database:idx_learnings_wiki_slug @ pro-workflow/src/db/schema.sql:168 - SQLite index
- database:cron_jobs @ src/electron/libs/cron-db.ts:27 - SQLite table
- database:idx_cron_jobs_conversation @ src/electron/libs/cron-db.ts:54 - SQLite index
- database:idx_cron_jobs_next_run @ src/electron/libs/cron-db.ts:55 - SQLite index
- database:knowledge_documents @ src/electron/libs/knowledge/knowledge-repository.ts:84 - SQLite table
- database:knowledge_chunks @ src/electron/libs/knowledge/knowledge-repository.ts:99 - SQLite table
- database:knowledge_chunks_fts @ src/electron/libs/knowledge/knowledge-repository.ts:116 - SQLite table
- database:knowledge_index_runs @ src/electron/libs/knowledge/knowledge-repository.ts:124 - SQLite table
- database:knowledge_chunk_vectors @ src/electron/libs/knowledge/knowledge-repository.ts:153 - SQLite table
- database:idx_knowledge_documents_workspace @ src/electron/libs/knowledge/knowledge-repository.ts:133 - SQLite index
- database:idx_knowledge_documents_source @ src/electron/libs/knowledge/knowledge-repository.ts:134 - SQLite index
- database:idx_knowledge_chunks_document @ src/electron/libs/knowledge/knowledge-repository.ts:135 - SQLite index
- database:idx_knowledge_chunks_workspace @ src/electron/libs/knowledge/knowledge-repository.ts:136 - SQLite index
- database:knowledge_ui_workspaces @ src/electron/libs/knowledge/knowledge-ui-store.ts:101 - SQLite table
- database:knowledge_ui_generation @ src/electron/libs/knowledge/knowledge-ui-store.ts:111 - SQLite table
- database:knowledge_ui_documents @ src/electron/libs/knowledge/knowledge-ui-store.ts:125 - SQLite table
- database:idx_knowledge_ui_workspaces_hidden @ src/electron/libs/knowledge/knowledge-ui-store.ts:137 - SQLite index
- database:idx_knowledge_ui_documents_workspace @ src/electron/libs/knowledge/knowledge-ui-store.ts:138 - SQLite index
- database:learnings @ src/electron/libs/learning-store.ts:31 - SQLite table
- database:learnings_fts @ src/electron/libs/learning-store.ts:44 - SQLite table
- database:learnings_sessions @ src/electron/libs/learning-store.ts:84 - SQLite table
- database:idx_learnings_category @ src/electron/libs/learning-store.ts:78 - SQLite index
- database:idx_learnings_project @ src/electron/libs/learning-store.ts:79 - SQLite index
- database:idx_learnings_created_at @ src/electron/libs/learning-store.ts:80 - SQLite index
- database:idx_learnings_sessions_project @ src/electron/libs/learning-store.ts:94 - SQLite index
- database:idx_learnings_sessions_started_at @ src/electron/libs/learning-store.ts:95 - SQLite index
- database:memories @ src/electron/libs/memory/memory-repository.ts:45 - SQLite table

</agent_card>
