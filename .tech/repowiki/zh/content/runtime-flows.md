# 关键运行链路

## Repo Wiki 生成链路

1. Renderer 通过 `knowledge:run-generation` 请求生成。
2. Electron 后端调用 vendored `he-yufeng/RepoWiki` 引擎生成 Markdown。
3. `knowledge-indexer` 收集 `.tech/repowiki` 文档，切 chunk、调用 embedding、写入 `knowledge_documents` 和向量表。
4. 聊天 runner 读取索引 overview，把知识摘要注入 system prompt。

## 从源码提取到的运行信号

### `src/electron/main.ts`

- `ipcMain.handle: preview-list-directory`
- `ipcMain.handle: preview-list-files`
- `ipcMain.handle: sessions:list`
- `ipcMain.handle: slash-commands:list`
- `ipcMain.handle: plugins:getOpenComputerUseStatus`
- `ipcMain.handle: plugins:checkOpenComputerUseUpdate`
- `ipcMain.handle: plugins:installOpenComputerUse`
- `ipcMain.handle: plugins:updateOpenComputerUse`
- `ipcMain.handle: plugins:getFigmaOfficialStatus`
- `ipcMain.handle: plugins:installFigmaOfficial`
- `ipcMain.handle: plugins:connectFigmaOfficial`
- `ipcMain.handle: plugins:connectFigmaCodexOfficial`

### `src/ui/App.tsx`

- `electron.invoke: sessions:list`
- `electron.invoke: shell:openExternal`

### `src/electron/libs/cron-db.ts`

- `create table: cron_jobs`

### `src/electron/libs/cron-ipc-handlers.ts`

- `ipcMain.handle: cron:list-jobs`
- `ipcMain.handle: cron:list-jobs-by-conversation`
- `ipcMain.handle: cron:get-job`
- `ipcMain.handle: cron:add-job`
- `ipcMain.handle: cron:update-job`
- `ipcMain.handle: cron:remove-job`
- `ipcMain.handle: cron:run-now`

### `src/electron/libs/knowledge/knowledge-repository.ts`

- `create table: knowledge_documents`
- `create table: knowledge_chunks`
- `create table: knowledge_index_runs`
- `virtual table: knowledge_chunks_fts`
- `virtual table: knowledge_chunk_vectors`

### `src/electron/libs/knowledge/knowledge-ui-store.ts`

- `create table: knowledge_ui_workspaces`
- `create table: knowledge_ui_generation`
- `create table: knowledge_ui_documents`

### `src/electron/libs/learning-store.ts`

- `create table: learnings`
- `create table: learnings_sessions`
- `virtual table: learnings_fts`

### `src/electron/libs/mcp-tools/admin.ts`

- `mcp tool: set_global_runtime_config`

### `src/electron/libs/mcp-tools/browser.ts`

- `mcp tool: http_ping`
- `mcp tool: diagnose_port`
- `mcp tool: bash_batch`
- `mcp tool: browser_open_page`
- `mcp tool: browser_close_page`
- `mcp tool: browser_get_state`
- `mcp tool: browser_navigate`
- `mcp tool: browser_reload`
- `mcp tool: browser_extract_page`
- `mcp tool: browser_capture_visible`
- `mcp tool: browser_save_screenshot`
- `mcp tool: browser_save_pdf`

### `src/electron/libs/mcp-tools/cron.ts`

- `mcp tool: create_scheduled_task`
- `mcp tool: list_scheduled_tasks`
- `mcp tool: delete_scheduled_task`

### `src/electron/libs/mcp-tools/design.ts`

- `mcp tool: design_capture_current_view`
- `mcp tool: design_capture_current_region`
- `mcp tool: design_inspect_image`
- `mcp tool: design_compare_current_view`
- `mcp tool: design_compare_images`
- `mcp tool: design_compare_current_view_batch`
- `mcp tool: design_compare_images_batch`
- `mcp tool: design_read_comparison_report`
- `mcp tool: design_list_artifacts`

### `src/electron/libs/mcp-tools/figma-rest.ts`

- `mcp tool: figma_get_current_user`
- `mcp tool: figma_get_file_metadata`
- `mcp tool: figma_read_design`
- `mcp tool: figma_list_node_index`
- `mcp tool: figma_match_ui_nodes`
- `mcp tool: figma_summarize_design`
- `mcp tool: figma_extract_design_tokens`
- `mcp tool: figma_get_design_playbook`
- `mcp tool: figma_audit_design`
- `mcp tool: figma_generate_tailwind_code`
- `mcp tool: figma_get_image_urls`
- `mcp tool: figma_get_image_fills`

### `src/electron/libs/mcp-tools/idea.ts`

- `mcp tool: idea_status`
- `mcp tool: idea_open`
- `mcp tool: idea_focus`
- `mcp tool: idea_wait_ready`

### `src/electron/libs/mcp-tools/knowledge.ts`

- `mcp tool: knowledge_search`
- `mcp tool: knowledge_read`
- `mcp tool: knowledge_explore`
- `mcp tool: knowledge_index`
- `mcp tool: memory_update`

### `src/electron/libs/mcp-tools/plan.ts`

- `mcp tool: update_plan`

### `src/electron/libs/memory/memory-repository.ts`

- `create table: memories`
- `virtual table: memories_fts`

### `src/electron/libs/note-repository.ts`

- `create table: notes`

### `src/electron/libs/session-store.ts`

- `create table: sessions`
- `create table: messages`

### `src/electron/libs/skill-manager/db.ts`

- `create table: skills`
- `create table: scenarios`
- `create table: scenario_skills`
- `create table: scenario_skill_tools`
- `create table: skill_targets`
- `create table: skill_tags`
- `create table: settings`

### `src/electron/libs/task/repository.ts`

- `create table: tasks`
- `create table: task_executions`
- `create table: task_execution_logs`
- `create table: task_subtasks`
- `create table: task_artifacts`
- `create table: task_dismissals`

### `src/ui/components/PromptInput.tsx`

- `electron.invoke: slash-commands:list`

### `src/ui/components/cron/CreateTaskDialog.tsx`

- `electron.invoke: cron:update-job`
- `electron.invoke: cron:add-job`

### `src/ui/components/cron/ScheduledTasksPage.tsx`

- `electron.invoke: cron:run-now`
- `electron.invoke: cron:remove-job`

### `src/ui/components/settings/PluginsSettingsPage.tsx`

- `electron.invoke: plugins:getOpenComputerUseStatus`
- `electron.invoke: plugins:checkOpenComputerUseUpdate`
- `electron.invoke: plugins:getFigmaOfficialStatus`
- `electron.invoke: plugins:installOpenComputerUse`
- `electron.invoke: plugins:connectFigmaDesktopOfficial`
- `electron.invoke: plugins:connectFigmaPatOfficial`
- `electron.invoke: plugins:updateOpenComputerUse`

### `src/ui/pages/cron/useCronJobs.ts`

- `electron.invoke: cron:update-job`
- `electron.invoke: cron:remove-job`
- `electron.invoke: cron:list-jobs-by-conversation`
- `electron.invoke: cron:list-jobs`
