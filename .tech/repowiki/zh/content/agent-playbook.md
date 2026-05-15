# Agent 作业手册

这页只服务于后续 Agent：先用它定位要读的文件，再进入模块页看细节。

## 常见任务路径

### 为什么知识库功能必须有 embedding 模型？

knowledge-indexer 在缺少 embedding 设置时直接返回 missing-embedding-model，设计上不允许只开 FTS5；上线验证要检查 vectorStoreReady、FTS 行数和 vector 行数一致。

证据文件：`src/electron/libs/knowledge/knowledge-indexer.ts`, `src/electron/libs/knowledge/embedding-client.ts`, `src/electron/libs/knowledge/knowledge-repository.ts`

### 刷新后生成状态为什么不能丢？

前端状态只是展示层，真实状态必须落在 knowledge_ui_generation 和 knowledge_ui_documents；KnowledgePanel 要通过 bridge 重新拉取后端状态。

证据文件：`src/ui/components/KnowledgePanel.tsx`, `src/electron/libs/knowledge/knowledge-ui-store.ts`

### Agent 如何在聊天里看到知识库？

runner 拼 system prompt 时追加 knowledge-overview 生成的 XML 摘要，Agent 先看到标题/摘要，再按需用知识库工具或 UI 内容深取。

证据文件：`src/electron/libs/runner.ts`, `src/electron/libs/knowledge/knowledge-overview.ts`

## 高价值文件

| 文件 | Agent 应该知道什么 | 代码信号 |
| --- | --- | --- |
| `src/ui/types.ts` | 被依赖较多或包含关键导出 | event:user_prompt<br>event:stream.message<br>event:stream.user_prompt<br>event:session.status<br>event:session.plan.updated<br>event:session.workflow<br>event:session.workflow.catalog<br>event:session.list |
| `src/electron/main.ts` | Electron 主进程入口，注册窗口、IPC、知识库通道和开发桥 | entrypoint:src/electron/main.ts<br>ipc:preview-list-directory<br>ipc:preview-list-files<br>ipc:sessions:list<br>ipc:slash-commands:list<br>ipc:plugins:getOpenComputerUseStatus<br>ipc:plugins:checkOpenComputerUseUpdate<br>ipc:plugins:installOpenComputerUse |
| `src/electron/ipc-handlers.ts` | 会话生命周期和主要 IPC 编排入口 | event:task.updated<br>event:task.deleted<br>event:task.execution.started<br>event:task.execution.completed<br>event:task.execution.log<br>event:task.stats<br>event:task.sync.completed<br>event:task.error |
| `src/electron/types.ts` | 被依赖较多或包含关键导出 | event:user_prompt<br>event:builtin<br>event:stream.message<br>event:stream.user_prompt<br>event:session.status<br>event:session.plan.updated<br>event:session.workflow<br>event:session.workflow.catalog |
| `src/electron/libs/skill-manager/ipc-handlers.ts` | 定义或调用跨进程接口 | ipc:skills:getManagedSkills<br>ipc:skills:getSkillsForScenario<br>ipc:skills:getSkillDocument<br>ipc:skills:deleteManagedSkill<br>ipc:skills:deleteManagedSkills<br>ipc:skills:installLocal<br>ipc:skills:batchImportFolder<br>ipc:skills:getAllTags |
| `src/electron/libs/mcp-tools/browser.ts` | 暴露给 Agent 的 MCP 工具面 | mcp_tool:http_ping<br>mcp_tool:diagnose_port<br>mcp_tool:bash_batch<br>mcp_tool:browser_open_page<br>mcp_tool:browser_close_page<br>mcp_tool:browser_get_state<br>mcp_tool:browser_navigate<br>mcp_tool:browser_reload |
| `src/electron/libs/runner.ts` | Agent system prompt、MCP、工作区和会话执行链路 | event:object<br>event:array<br>event:number<br>event:string<br>event:json_schema<br>event:stream.message<br>event:permission.request<br>event:session.plan.updated |
| `src/ui/store/useAppStore.ts` | 主 UI 状态容器，连接会话、活动面板和知识库入口 | event:user_prompt<br>store:useAppStore |
| `src/ui/components/KnowledgePanel.tsx` | 知识库前端入口，工作区列表、生成进度、Markdown 预览 | ui_ipc:knowledge:list<br>ui_ipc:knowledge:sync-workspaces<br>ui_ipc:knowledge:complete-generation<br>ui_ipc:knowledge:update-generation<br>ui_ipc:knowledge:list-documents<br>ui_ipc:knowledge:run-generation<br>ui_ipc:knowledge:add-workspace<br>ui_ipc:knowledge:remove-workspace |
| `src/electron/libs/knowledge/knowledge-repository.ts` | 知识库 SQLite schema、FTS5、sqlite-vec 和检索 API | database:knowledge_documents<br>database:knowledge_chunks<br>database:knowledge_chunks_fts<br>database:knowledge_index_runs<br>database:knowledge_chunk_vectors<br>database:idx_knowledge_documents_workspace<br>database:idx_knowledge_documents_source<br>database:idx_knowledge_chunks_document |
| `vite.config.ts` | 开发服务、预览构建和 watcher 忽略目录配置 | config:vite.config.ts<br>event:file |
| `src/electron/libs/codex-oauth.ts` | 被依赖较多或包含关键导出 | event:text<br>event:tool_use<br>event:message<br>event:codex<br>event:output_text<br>event:message_start<br>event:content_block_start<br>event:content_block_delta |
| `src/electron/libs/knowledge/knowledge-ui-store.ts` | Repo Wiki 工作区、生成状态、UI 文档和开发桥 IPC 后端 | database:knowledge_ui_workspaces<br>database:knowledge_ui_generation<br>database:knowledge_ui_documents<br>database:idx_knowledge_ui_workspaces_hidden<br>database:idx_knowledge_ui_documents_workspace |
| `src/ui/App.tsx` | 入口文件，适合从这里跟踪启动链路 | entrypoint:src/ui/App.tsx<br>ui_ipc:sessions:list<br>ui_ipc:shell:openExternal<br>event:separator<br>event:message<br>event:process_group<br>event:session.history<br>event:session.list |
| `src/electron/libs/task/types.ts` | 被依赖较多或包含关键导出 | event:task.list<br>event:task.updated<br>event:task.deleted<br>event:task.execution.started<br>event:task.execution.completed<br>event:task.execution.log<br>event:task.execution.bundle<br>event:task.settings |
| `package.json` | 开发、构建、QA、打包命令和关键依赖来源 | config:package.json |
| `src/electron/libs/task/executor.ts` | 任务执行、恢复、重试、会话归档触发等核心编排 | event:stream.user_prompt<br>event:task.execution.bundle<br>event:session.status |
| `src/ui/components/PromptInput.tsx` | 定义或调用跨进程接口 | ui_ipc:slash-commands:list<br>event:browser_annotations<br>event:browser_annotation<br>event:text<br>event:code_references<br>event:message_references<br>event:file_references<br>event:session.start |
| `src/electron/libs/skill-manager/db.ts` | 包含 SQLite/FTS/vector schema 或索引写入 | database:skills<br>database:scenarios<br>database:scenario_skills<br>database:scenario_skill_tools<br>database:skill_targets<br>database:skill_tags<br>database:settings<br>database:idx_scenario_skills_skill |
| `src/shared/builtin-mcp-registry.ts` | 内置 MCP server 和工具元数据注册表 | event:builtin |
| `src/electron/libs/mcp-tools/figma-rest.ts` | 暴露给 Agent 的 MCP 工具面 | mcp_tool:figma_get_current_user<br>mcp_tool:figma_get_file_metadata<br>mcp_tool:figma_read_design<br>mcp_tool:figma_list_node_index<br>mcp_tool:figma_match_ui_nodes<br>mcp_tool:figma_summarize_design<br>mcp_tool:figma_extract_design_tokens<br>mcp_tool:figma_get_design_playbook |
| `src/electron/libs/knowledge/knowledge-indexer.ts` | Repo Wiki 生成、Markdown chunk、embedding、FTS/vector 写入主链路 | - |
| `src/ui/components/TaskPanel.tsx` | 保存 UI 或运行态状态 | event:task.list<br>event:task.stats<br>event:task.settings.get<br>event:task.providers<br>event:task.execution.logs<br>event:task.sync<br>event:task.execute<br>event:task.control |
| `src/electron/libs/knowledge/knowledge-overview.ts` | 聊天 system prompt 的知识库 overview 注入 | - |
| `package/sdk-tools.d.ts` | 被依赖较多或包含关键导出 | event:text<br>event:image<br>event:notebook<br>event:pdf<br>event:parts<br>event:file_unchanged<br>event:create<br>event:code |
| `pro-workflow/src/db/schema.sql` | 包含 SQLite/FTS/vector schema 或索引写入 | database:learnings<br>database:learnings_fts<br>database:sessions<br>database:wikis<br>database:wiki_pages<br>database:wiki_sources<br>database:wiki_claims<br>database:wiki_seeds |
| `src/electron/libs/builtin-mcp-servers.ts` | 内置 MCP server 工厂映射和 tool name 暴露 | - |
| `src/electron/libs/knowledge/repowiki/engine.ts` | RepoWiki-compatible 生成器入口，串起扫描、图谱、分析、导出 | - |
| `src/electron/libs/task/repository.ts` | 包含 SQLite/FTS/vector schema 或索引写入 | database:tasks<br>database:task_executions<br>database:task_execution_logs<br>database:task_subtasks<br>database:task_artifacts<br>database:task_dismissals<br>database:idx_tasks_provider<br>database:idx_tasks_local_status |
| `src/ui/components/settings/InstallSkillsView.tsx` | 定义或调用跨进程接口 | ui_ipc:skills:searchSkillssh<br>ui_ipc:skills:fetchLeaderboard<br>ui_ipc:skills:scanLocalSkills<br>ui_ipc:skills:installLocal<br>ui_ipc:preview-open-dialog<br>ui_ipc:skills:batchImportFolder<br>ui_ipc:skills:installSkillssh<br>ui_ipc:skills:previewGitInstall |
| `src/ui/components/settings/PluginsSettingsPage.tsx` | 定义或调用跨进程接口 | ui_ipc:plugins:getOpenComputerUseStatus<br>ui_ipc:plugins:checkOpenComputerUseUpdate<br>ui_ipc:plugins:getFigmaOfficialStatus<br>ui_ipc:plugins:installOpenComputerUse<br>ui_ipc:plugins:connectFigmaDesktopOfficial<br>ui_ipc:plugins:connectFigmaPatOfficial<br>ui_ipc:plugins:updateOpenComputerUse |
| `src/ui/components/settings/MySkillsView.tsx` | 定义或调用跨进程接口 | ui_ipc:skills:getAllTags<br>ui_ipc:skills:deleteManagedSkill<br>ui_ipc:skills:deleteManagedSkills<br>ui_ipc:skills:removeSkillFromScenario<br>ui_ipc:skills:addSkillToScenario<br>ui_ipc:skills:batchUpdateSkills |
| `src/electron/libs/figma-official-plugin.ts` | 被依赖较多或包含关键导出 | event:http<br>event:desktop-mcp<br>event:figma-rest-api |
| `src/electron/libs/mcp-tools/design.ts` | 暴露给 Agent 的 MCP 工具面 | mcp_tool:design_capture_current_view<br>mcp_tool:design_capture_current_region<br>mcp_tool:design_inspect_image<br>mcp_tool:design_compare_current_view<br>mcp_tool:design_compare_images<br>mcp_tool:design_compare_current_view_batch<br>mcp_tool:design_compare_images_batch<br>mcp_tool:design_read_comparison_report |
| `src/ui/dev-electron-shim.ts` | 被依赖较多或包含关键导出 | event:session.list<br>event:session.history<br>event:user_prompt<br>event:agent.list<br>event:mcp.list<br>event:builtin |
| `src/shared/attachments.ts` | 保存 UI 或运行态状态 | event:user_prompt<br>event:text<br>event:image<br>event:base64<br>store:attachments |

## 可执行命令

- `npm run rebuild`：`npx electron-rebuild -f -w better-sqlite3`
- `npm run dev`：`node scripts/dev.mjs`
- `npm run dev:react`：`vite`
- `npm run dev:electron`：`bun run transpile:electron && node scripts/dev-electron.mjs`
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
- `npm run codex:oauth:setup`：`node scripts/codex-oauth-setup.mjs`
- `npm run build`：`tsc -b && vite build`
- `npm run lint`：`eslint .`
- `npm run preview`：`vite preview`
- `npm run test:activity-rail-model`：`tsc --project test/electron/tsconfig.json && node --test dist-test/test/electron/activity-rail-model.test.js`
- `npm run transpile:electron`：`tsc --project src/electron/tsconfig.json`
- `npm run package:mac`：`bun run transpile:electron && bun run build && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac zip --arm64 --publish never`
- `npm run package:mac:fast`：`bun run transpile:electron && bun run build && cross-env CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac dir --arm64 --publish never`
- `npm run package:win`：`node scripts/package-win-safe.mjs`
- `npm run dist:mac-arm64`：`bun run transpile:electron && bun run build && electron-builder --mac --arm64`
- `npm run dist:mac-x64`：`bun run transpile:electron && bun run build && electron-builder --mac --x64`
- `npm run dist:win`：`node scripts/package-win-safe.mjs`
- `npm run dist:win:stable`：`node scripts/package-win-safe.mjs`

## 关键依赖

- **@types/better-sqlite3** ^7.6.13 (dev)
- **electron** ^39.2.7 (dev)
- **typescript** ~5.9.3 (dev)
- **vite** ^7.3.1 (dev)
- **@anthropic-ai/claude-agent-sdk** ^0.3.142 (runtime)
- **@langchain/textsplitters** ^1.0.1 (runtime)
- **better-sqlite3** ^12.9.0 (runtime)
- **croner** ^10.0.1 (runtime)
- **lucide-react** ^1.14.0 (runtime)
- **react** ^19.2.3 (runtime)
- **simple-git** ^3.36.0 (runtime)
- **sqlite-vec** ^0.1.9 (runtime)
- **tailwindcss** ^4.1.18 (runtime)
- **zod** ^4.4.2 (runtime)
- **zustand** ^5.0.10 (runtime)
