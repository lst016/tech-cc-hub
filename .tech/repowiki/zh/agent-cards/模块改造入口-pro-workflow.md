# 模块改造入口：pro-workflow

<agent_card id="module-pro-workflow" kind="module">

## 什么时候用
当任务落在 pro-workflow 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `pro-workflow/src/db/schema.sql`: 包含 SQLite/FTS/vector schema 或索引写入
- `pro-workflow/src/db/index.ts`: 入口文件，适合从这里跟踪启动链路
- `pro-workflow/src/db/store.ts`: 保存 UI 或运行态状态
- `pro-workflow/skills/llm-council/scripts/council.js`: 入口文件，适合从这里跟踪启动链路
- `pro-workflow/skills/wiki-research-loop/scripts/research-loop.js`: 入口文件，适合从这里跟踪启动链路
- `pro-workflow/skills/survey-generator/scripts/build-survey.js`: 入口文件，适合从这里跟踪启动链路

## 相关文件
- `pro-workflow/src/db/schema.sql`
- `pro-workflow/src/db/index.ts`
- `pro-workflow/src/db/store.ts`
- `pro-workflow/skills/llm-council/scripts/council.js`
- `pro-workflow/skills/wiki-research-loop/scripts/research-loop.js`
- `pro-workflow/skills/survey-generator/scripts/build-survey.js`
- `pro-workflow/skills/wiki-builder/scripts/wiki-cli.js`
- `pro-workflow/skills/wiki-viewer/scripts/render.js`
- `pro-workflow/scripts/embed-wiki.js`
- `pro-workflow/skills/wiki-query/scripts/query.js`

## 改代码指南
- 先确认需求是否真的属于 pro-workflow，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
- 修改共享契约时同步检查调用方、测试、QA smoke 和 system prompt/overview 影响。
- 如果文件带有 database、ipc、mcp_tool 或 store 信号，优先做真实运行验证。

## 验证方式
- npm run build

## 风险点
- UI 状态不能只存在前端内存，刷新后必须能从后端恢复。

## 检索关键词
pro-workflow, schema.sql, database:learnings, database:learnings_fts, database:sessions, database:wikis, database:wiki_pages, database:wiki_sources, database:wiki_claims, database:wiki_seeds, index.ts, entrypoint:pro-workflow/src/db/index.ts, store.ts, store:store, council.js, entrypoint:pro-workflow/skills/llm-council/scripts/council.js, event:council, store:council, research-loop.js, entrypoint:pro-workflow/skills/wiki-research-loop/scripts/research-loop.js, event:question, store:research-loop, build-survey.js, entrypoint:pro-workflow/skills/survey-generator/scripts/build-survey.js

## 代码信号
- database:learnings
- database:learnings_fts
- database:sessions
- database:wikis
- database:wiki_pages
- database:wiki_sources
- database:wiki_claims
- database:wiki_seeds
- entrypoint:pro-workflow/src/db/index.ts
- store:store
- entrypoint:pro-workflow/skills/llm-council/scripts/council.js
- event:council
- store:council
- entrypoint:pro-workflow/skills/wiki-research-loop/scripts/research-loop.js
- event:question
- store:research-loop
- entrypoint:pro-workflow/skills/survey-generator/scripts/build-survey.js
- store:build-survey
- entrypoint:pro-workflow/skills/wiki-builder/scripts/wiki-cli.js
- store:wiki-cli
- entrypoint:pro-workflow/skills/wiki-viewer/scripts/render.js
- store:render
- entrypoint:pro-workflow/scripts/embed-wiki.js
- store:embed-wiki
- entrypoint:pro-workflow/skills/wiki-query/scripts/query.js
- store:query

</agent_card>
