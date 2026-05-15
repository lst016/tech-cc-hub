# tech-cc-hub 项目概览

> Desktop Agent workbench: chat sessions, task execution, browser preview, model routing, knowledge base and execution trace replay.

tech-cc-hub is an Electron-based desktop Agent workbench that unifies chat sessions, task orchestration, browser preview, model routing, execution traces, and replay diagnostics in a single application. It integrates with compatible OpenAI/Anthropic gateways and supports local models, enabling local Agents to handle Feishu tasks, spawn independent workspaces, and write back results to source systems.

The frontend is a React 19 application built with Vite, located in src/ui/. Key components include KnowledgePanel.tsx for knowledge base management, PromptInput.tsx for chat input, TaskPanel.tsx for task operations, and useAppStore.ts as the main UI state container. The Electron main process in src/electron/main.ts manages windows, IPC handlers, and MCP tool servers.

The backend architecture is split into several main process libraries under src/electron/libs/: task/ for task system (provider-registry, repository, executor, workspace), mcp-tools/ for built-in MCP tools (browser, design, figma-rest, admin, cron), knowledge/ for knowledge base (indexer, repository, embedding-client, overview), and skill-manager/ for skill management. All IPC channels are registered in src/electron/main.ts and src/electron/ipc-handlers.ts.

The knowledge base system follows a RepoWiki-compatible pipeline: Markdown document generation → text splitting → embedding → FTS5/sqlite-vec storage. The runner injects knowledge overview into system prompts. Task execution uses independent workspaces per task with SQLite-backed persistence for execution records and logs.

Built-in MCP tools provide browser automation, design inspection, Figma integration, and cron scheduling. The IPC bridge is defined through src/electron/preload.ts and typed IPC channels. Database schemas live in dedicated *.db.ts files under libs/, with tables for knowledge_documents, knowledge_chunks, knowledge_chunk_vectors, cron_jobs, learnings, skills, scenarios, and task state.

## Agent 快速定位

- Knowledge base REQUIRES embedding model; without it knowledge-indexer returns 'missing-embedding-model'. Verify vectorStoreReady, FTS row count, and vector row count match after generation.
- Generation state survives refresh via backend persistence in knowledge_ui_generation and knowledge_ui_documents tables. Frontend is display-only; must query bridge to rehydrate state after reload.
- Agent sees knowledge via overview XML injected into system prompt by knowledge-overview.ts. Agent first sees title/summary, then can deep-fetch via knowledge tools or UI content.
- Task system boundary: External provider only maps to ExternalTask, Repository only persists, Executor is the sole dispatch point. Each task gets an independent workspace to avoid pollution.
- Small model / 后台模型 slot must be configured with a model available on current gateway to avoid 503 errors on internal small model requests.
- IPC channels are typed and registered in main.ts lines ~1350-2700. Renderer calls use ipcRenderer.invoke with exact channel names.
- SQLite tables and indexes are defined in dedicated *.db.ts files under libs/. Do not create ad-hoc tables outside these schema files.
- MCP tools are exposed through builtin-mcp-registry.ts metadata + Electron factory. Adding a tool requires both registry entry and real implementation in mcp-tools/*.ts.

| 你要改什么 | 优先阅读 | 原因 |
| --- | --- | --- |
| 项目入口或共享契约 | `src/ui/types.ts` | 被依赖较多或包含关键导出 |
| 项目入口或共享契约 | `src/electron/main.ts` | Electron 主进程入口，注册窗口、IPC、知识库通道和开发桥 |
| 前后端 IPC 通道 | `src/electron/ipc-handlers.ts` | 会话生命周期和主要 IPC 编排入口 |
| 项目入口或共享契约 | `src/electron/types.ts` | 被依赖较多或包含关键导出 |
| 前后端 IPC 通道 | `src/electron/libs/skill-manager/ipc-handlers.ts` | 定义或调用跨进程接口 |
| Agent 工具/MCP 能力 | `src/electron/libs/mcp-tools/browser.ts` | 暴露给 Agent 的 MCP 工具面 |
| 聊天会话、system prompt、MCP 加载 | `src/electron/libs/runner.ts` | Agent system prompt、MCP、工作区和会话执行链路 |
| UI 状态或持久化状态 | `src/ui/store/useAppStore.ts` | 主 UI 状态容器，连接会话、活动面板和知识库入口 |
| 知识库前端交互和进度显示 | `src/ui/components/KnowledgePanel.tsx` | 知识库前端入口，工作区列表、生成进度、Markdown 预览 |
| 知识库生成、索引、注入或检索 | `src/electron/libs/knowledge/knowledge-repository.ts` | 知识库 SQLite schema、FTS5、sqlite-vec 和检索 API |
| 项目入口或共享契约 | `vite.config.ts` | 开发服务、预览构建和 watcher 忽略目录配置 |
| 项目入口或共享契约 | `src/electron/libs/codex-oauth.ts` | 被依赖较多或包含关键导出 |

## 关键工作流

### Knowledge base generation and retrieval

1. User adds workspace via KnowledgePanel add-workspace bridge call. 2. knowledge-ui-store.ts persists workspace to knowledge_ui_workspaces. 3. User triggers run-generation → knowledge-indexer.ts loads documents, splits with @langchain/textsplitters, embeds via embedding-client.ts, writes to knowledge_chunks FTS5 + knowledge_chunk_vectors sqlite-vec. 4. On chat session start, runner.ts calls knowledge-overview.ts to generate XML overview and injects into system prompt. 5. Agent can use knowledge tools or read UI panel content to deep-fetch.

证据文件：`src/ui/components/KnowledgePanel.tsx`, `src/electron/libs/knowledge/knowledge-ui-store.ts`, `src/electron/libs/knowledge/knowledge-indexer.ts`, `src/electron/libs/knowledge/knowledge-repository.ts`, `src/electron/libs/knowledge/embedding-client.ts`, `src/electron/libs/knowledge/knowledge-overview.ts`, `src/electron/libs/runner.ts`

### Chat session execution pipeline

1. Renderer calls ipc:session.start via PromptInput.tsx. 2. ipc-handlers.ts persists session to session-store.ts. 3. Runner constructs system prompt by merging: builtin rules, user rules, MCP server configs, knowledge-overview XML. 4. Runner streams events back via event:stream.message, event:session.status, event:session.plan.updated. 5. ActivityRail listens to these events to display real-time timeline. 6. On completion, session archived with event:session.status → completed.

证据文件：`src/ui/components/PromptInput.tsx`, `src/electron/ipc-handlers.ts`, `src/electron/libs/session-store.ts`, `src/electron/libs/runner.ts`, `src/ui/store/useAppStore.ts`, `src/ui/components/ActivityRail.tsx`

### Task sync, execution and write-back

1. TaskPanel triggers task.sync → provider-registry.ts maps external tasks (e.g., Feishu) to ExternalTask. 2. repository.ts persists to SQLite with state pending/synced/running/completed. 3. User or auto-trigger calls task.execute → executor.ts acquires workspace.ts per task, spawns runner.ts with task-scoped config. 4. Executor emits event:task.execution.started/log/completed. 5. TaskResultPanel listens and displays logs, artifacts. 6. On completion, executor writes back status to external provider if supported.

证据文件：`src/ui/components/TaskPanel.tsx`, `src/electron/libs/task/provider-registry.ts`, `src/electron/libs/task/repository.ts`, `src/electron/libs/task/executor.ts`, `src/electron/libs/task/workspace.ts`, `src/electron/libs/task/types.ts`, `src/ui/components/TaskResultPanel.tsx`

### Browser MCP tool invocation

1. Agent or user calls browser_* tool via MCP protocol. 2. Builtin MCP registry routes to browser.ts implementation. 3. browser.ts uses Electron BrowserView to navigate/capture/screenshot/DOM query. 4. Results serialized as structured JSON back to Agent. 5. Annotation mode stores browser_annotation events for overlay rendering in renderer.

证据文件：`src/shared/builtin-mcp-registry.ts`, `src/electron/libs/mcp-tools/browser.ts`, `src/electron/libs/builtin-mcp-servers.ts`

### Design inspection and comparison

1. User provides screenshot/Figma link and asks for UI generation. 2. design_inspect_image generates semantic summary from image. 3. Agent generates code. 4. User captures current view via design_capture_current_view. 5. User calls design_compare_images or design_compare_current_view. 6. design.ts generates diff/comparison images and JSON report. 7. design_list_artifacts + design_read_comparison_report allow evidence retrieval in subsequent turns.

证据文件：`src/electron/libs/mcp-tools/design.ts`, `src/electron/libs/mcp-tools/figma-rest.ts`

## 技术栈

- **TypeScript** 5.x (language)
- **Electron** 34.x (desktop)
- **React** 19.2.3 (UI framework)
- **Vite** 6.x (bundler)
- **better-sqlite3** 12.9.0 (database)
- **sqlite-vec** (vector store)
- **@anthropic-ai/claude-agent-sdk** 0.3.142 (Agent SDK)
- **@radix-ui/react-dialog** 1.1.15 (UI component)
- **monaco-editor** 0.55.1 (code editor)
- **tailwindcss** 4.1.18 (CSS framework)
- **croner** 10.0.1 (scheduler)

## 核心功能

- Chat sessions with workspace isolation: src/ui/components/PromptInput.tsx, src/electron/libs/session-store.ts, src/electron/libs/runner.ts
- Model routing (5-tier): 主模型/专家模型/小模型/分析模型/图片模型 → package.json env vars and settings API
- Browser workbench with screenshot, DOM inspection, PDF export: src/electron/libs/mcp-tools/browser.ts, src/ui/components/PreviewPanel.tsx
- Task system with Feishu sync, SQLite persistence, independent workspace per task: src/electron/libs/task/{provider-registry,repository,executor,workspace}.ts
- Knowledge base generation and vector search: src/electron/libs/knowledge/{knowledge-indexer,knowledge-repository,embedding-client,knowledge-overview}.ts
- Built-in MCP tools (browser, design, figma-rest, cron, admin): src/electron/libs/mcp-tools/*.ts, src/shared/builtin-mcp-registry.ts
- Design inspection with screenshot comparison, diff images, JSON reports: src/electron/libs/mcp-tools/design.ts
- Execution trace timeline and replay: src/electron/libs/runner.ts event:session.status → ActivityRail
- Skill management with FTS5 search: src/electron/libs/skill-manager/{ipc-handlers,db}.ts
- Scheduled tasks (cron): src/electron/libs/mcp-tools/cron.ts, src/electron/libs/cron-db.ts

## 运行面

- React UI (Renderer process): src/ui/App.tsx entrypoint, src/ui/components/*.tsx — user-facing chat, task panel, knowledge panel, settings, preview panel
- Electron Main Process: src/electron/main.ts — window management, IPC registration, app lifecycle
- IPC bridge: src/electron/preload.ts → typed ipcRenderer.invoke channels (sessions:list, slash-commands:list, knowledge:*, skills:*, cron:* , task:*, plugins:*, preview:*, client-event, getStaticData, generate-session-title, select-directory, get-api-config, check-api-config)
- MCP tool surface: src/electron/libs/mcp-tools/{browser,design,figma-rest,admin,cron}.ts — Agent-accessible capabilities via @anthropic-ai/claude-agent-sdk bridge
- SQLite persistence layer: src/electron/libs/knowledge/knowledge-repository.ts (knowledge_documents/chunks/chunks_fts/chunk_vectors), src/electron/libs/cron-db.ts (cron_jobs), src/electron/libs/skill-manager/db.ts (skills/scenarios), src/electron/libs/learning-store.ts (learnings)
- Event bus: src/electron/types.ts + src/shared/event-types.ts — event:stream.message, event:session.status, event:task.*, event:user_prompt — drives ActivityRail, TaskResultPanel, replay
- Vite preview filesystem: vite.config.ts — /__tech_preview/list, /__tech_preview/files, /__tech_preview/read — development file browser within workspace boundary
- Scheduled task surface: src/electron/libs/mcp-tools/cron.ts — create_scheduled_task, list_scheduled_tasks, delete_scheduled_task via croner

## 存储与索引

- knowledge_documents, knowledge_chunks, knowledge_chunks_fts, knowledge_chunk_vectors, idx_knowledge_documents_workspace, idx_knowledge_documents_source, idx_knowledge_chunks_document, idx_knowledge_chunks_workspace — src/electron/libs/knowledge/knowledge-repository.ts
- knowledge_ui_workspaces, knowledge_ui_generation, knowledge_ui_documents, idx_knowledge_ui_workspaces_hidden, idx_knowledge_ui_documents_workspace — src/electron/libs/knowledge/knowledge-ui-store.ts
- cron_jobs, idx_cron_jobs_conversation, idx_cron_jobs_next_run — src/electron/libs/cron-db.ts
- skills, scenarios, scenario_skills, scenario_skill_tools, skill_targets, skill_tags, settings, idx_scenario_skills_skill — src/electron/libs/skill-manager/db.ts
- learnings — src/electron/libs/learning-store.ts
- pro-workflow: learnings, learnings_fts, sessions, wikis, wiki_pages, wiki_sources, wiki_claims, wiki_seeds, wiki_pages_fts, wiki_embeddings, learnings_wiki — pro-workflow/src/db/schema.sql
- `learnings`：pro-workflow/src/db/schema.sql:5 - SQLite table
- `learnings_fts`：pro-workflow/src/db/schema.sql:17 - SQLite table
- `sessions`：pro-workflow/src/db/schema.sql:45 - SQLite table
- `wikis`：pro-workflow/src/db/schema.sql:67 - SQLite table
- `wiki_pages`：pro-workflow/src/db/schema.sql:79 - SQLite table
- `wiki_sources`：pro-workflow/src/db/schema.sql:92 - SQLite table
- `wiki_claims`：pro-workflow/src/db/schema.sql:103 - SQLite table
- `wiki_seeds`：pro-workflow/src/db/schema.sql:112 - SQLite table
- `wiki_pages_fts`：pro-workflow/src/db/schema.sql:122 - SQLite table
- `wiki_embeddings`：pro-workflow/src/db/schema.sql:154 - SQLite table
- `learnings_wiki`：pro-workflow/src/db/schema.sql:164 - SQLite table
- `idx_learnings_category`：pro-workflow/src/db/schema.sql:56 - SQLite index
- `idx_learnings_project`：pro-workflow/src/db/schema.sql:57 - SQLite index
- `idx_learnings_created_at`：pro-workflow/src/db/schema.sql:58 - SQLite index
- `idx_sessions_project`：pro-workflow/src/db/schema.sql:59 - SQLite index
- `idx_sessions_started_at`：pro-workflow/src/db/schema.sql:60 - SQLite index

## 快速开始

1. npm install
2. npm run dev (starts Vite dev server and Electron)
3. npm run rebuild (if native dependencies fail)
4. Configure AI gateway in Settings → AI接口 → 添加兼容网关
5. Set MODEL SLOTS: 默认主模型, 专家模型, 小模型/后台模型, Prompt分析模型, 图片预处理模型

## 验证命令

- npm run qa:smoke → starts Electron and validates minimal chat round-trip (SMOKE_OK)
- npm run qa:chat-ui → chat UI smoke test via scripts/qa/chat-ui-smoke.cjs
- npm run qa:knowledge → knowledge engine smoke test via scripts/qa/knowledge-engine-smoke.mjs
- npm run qa:knowledge-chat → knowledge-chat injection smoke test
- npm run qa:knowledge-ui → knowledge UI smoke test
- npm run qa:preview → preview workbench smoke test
- npm run qa:codex → OAuth setup + Codex smoke with 120s timeout
- npm run test:activity-rail-model → TypeScript compile + Node test for activity rail model
- python doc/_tools/check_doc_links.py → validates all Markdown cross-links are valid
- python doc/_tools/validate_frontmatter.py → validates all doc frontmatter fields
- npm run lint → ESLint check across project
- `npm run qa:smoke`：`bash scripts/qa/electron-autostart-smoke.sh "请只回复：SMOKE_OK"`
- `npm run qa:slash`：`bash scripts/qa/electron-autostart-smoke.sh "/debug"`
- `npm run qa:codex`：`SMOKE_TIMEOUT_SECONDS=120 bash scripts/qa/electron-autostart-smoke.sh "/codex consult 你好，只回复 CODEX_SMOKE_OK"`
- `npm run qa:continue`：`bash scripts/qa/electron-autostart-smoke.sh "请只回复：SMOKE_ROUND_1" "请只回复：SMOKE_ROUND_2"`
- `npm run qa:chat-ui`：`node scripts/qa/chat-ui-smoke.cjs`
- `npm run qa:knowledge`：`node scripts/qa/knowledge-engine-smoke.mjs`
- `npm run qa:knowledge-chat`：`node scripts/qa/knowledge-chat-injection-smoke.mjs`
- `npm run qa:knowledge-ui`：`node scripts/qa/knowledge-ui-smoke.cjs`
- `npm run qa:preview`：`node scripts/qa/preview-workbench-smoke.cjs`
- `npm run qa:window:list`：`bash scripts/qa/window-id-tools.sh list`
- `npm run qa:window:capture`：`bash scripts/qa/window-id-tools.sh capture`
- `npm run build`：`tsc -b && vite build`

## 修改风险

- runner.ts system prompt construction: changing how context/rules/MCP/knowledge-overview merge will break Agent behavior across all sessions. Requires smoke test + knowledge smoke test.
- MCP tool signatures in mcp-tools/*.ts: Agent relies on exact tool names and schemas. Breaking changes require updating registry AND Agent instructions.
- IPC channel names: Renderer and main process both reference exact channel strings. Renaming without cross-file update causes silent failures.
- SQLite schema in knowledge-repository.ts: Changing tables (knowledge_documents, knowledge_chunks, knowledge_chunk_vectors) breaks migration from existing stores. Knowledge smoke test validates row counts.
- Task executor concurrency control: src/electron/libs/task/executor.ts manages task queue concurrency. Changes to auto-execution or recovery logic can cause duplicate executions or dead tasks.
- Model routing config: Small model slot must map to actual gateway model. Misconfig causes 503 errors. No runtime validation exists; must test with qa:smoke.
- Embedding dependency in knowledge-indexer.ts: Code path returns early if embedding client unavailable. This is intentional but means silent degradation if model is removed from gateway.
- pro-workflow plugin: Lives in pro-workflow/ subdirectory. Breaking changes to hooks.json or skills.json format will affect Claude Code integration. Hook scripts (commit-validate.js, config-watcher.js, cwd-changed.js) use specific stdin/stdout JSON contracts.

## 仓库规模

- 文件数：710
- 代码行数：134,225
