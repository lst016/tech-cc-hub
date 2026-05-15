# 接口与存储面

## Electron IPC

| 名称 | 位置/说明 |
| --- | --- |
| `preview-list-directory` | src/electron/main.ts:1353 - Electron ipcMain channel |
| `preview-list-files` | src/electron/main.ts:1354 - Electron ipcMain channel |
| `sessions:list` | src/electron/main.ts:1355 - Electron ipcMain channel |
| `slash-commands:list` | src/electron/main.ts:1359 - Electron ipcMain channel |
| `plugins:getOpenComputerUseStatus` | src/electron/main.ts:1365 - Electron ipcMain channel |
| `plugins:checkOpenComputerUseUpdate` | src/electron/main.ts:1366 - Electron ipcMain channel |
| `plugins:installOpenComputerUse` | src/electron/main.ts:1367 - Electron ipcMain channel |
| `plugins:updateOpenComputerUse` | src/electron/main.ts:1368 - Electron ipcMain channel |
| `plugins:getFigmaOfficialStatus` | src/electron/main.ts:1369 - Electron ipcMain channel |
| `plugins:installFigmaOfficial` | src/electron/main.ts:1370 - Electron ipcMain channel |
| `plugins:connectFigmaOfficial` | src/electron/main.ts:1371 - Electron ipcMain channel |
| `plugins:connectFigmaCodexOfficial` | src/electron/main.ts:1372 - Electron ipcMain channel |
| `plugins:connectFigmaPatOfficial` | src/electron/main.ts:1373 - Electron ipcMain channel |
| `plugins:connectFigmaDesktopOfficial` | src/electron/main.ts:1374 - Electron ipcMain channel |
| `shell:openExternal` | src/electron/main.ts:1375 - Electron ipcMain channel |
| `preview-read-file` | src/electron/main.ts:1382 - Electron ipcMain channel |
| `preview-get-image-base64` | src/electron/main.ts:1383 - Electron ipcMain channel |
| `preview-get-file-metadata` | src/electron/main.ts:1384 - Electron ipcMain channel |
| `preview-write-file` | src/electron/main.ts:1414 - Electron ipcMain channel |
| `preview-remove-entry` | src/electron/main.ts:1440 - Electron ipcMain channel |
| `preview-rename-entry` | src/electron/main.ts:1463 - Electron ipcMain channel |
| `preview-open-file` | src/electron/main.ts:1488 - Electron ipcMain channel |
| `preview-show-item-in-folder` | src/electron/main.ts:1497 - Electron ipcMain channel |
| `preview-open-dialog` | src/electron/main.ts:1506 - Electron ipcMain channel |
| `client-event` | src/electron/main.ts:2662 - Electron ipcMain channel |
| `getStaticData` | src/electron/main.ts:2657 - typed Electron IPC channel |
| `generate-session-title` | src/electron/main.ts:2667 - typed Electron IPC channel |
| `get-recent-cwds` | src/electron/main.ts:2672 - typed Electron IPC channel |
| `select-directory` | src/electron/main.ts:2678 - typed Electron IPC channel |
| `get-system-workspace` | src/electron/main.ts:2690 - typed Electron IPC channel |
| `get-api-config` | src/electron/main.ts:2695 - typed Electron IPC channel |
| `check-api-config` | src/electron/main.ts:2699 - typed Electron IPC channel |
| `save-api-config` | src/electron/main.ts:2704 - typed Electron IPC channel |
| `fetch-api-models` | src/electron/main.ts:2716 - typed Electron IPC channel |
| `test-api-config` | src/electron/main.ts:2727 - typed Electron IPC channel |
| `codex-oauth-start` | src/electron/main.ts:2738 - typed Electron IPC channel |
| `codex-oauth-complete` | src/electron/main.ts:2742 - typed Electron IPC channel |
| `codex-oauth-refresh` | src/electron/main.ts:2746 - typed Electron IPC channel |
| `app-update-get-status` | src/electron/main.ts:2750 - typed Electron IPC channel |
| `cron:list-jobs` | src/electron/libs/cron-ipc-handlers.ts:36 - Electron ipcMain channel |
| `cron:list-jobs-by-conversation` | src/electron/libs/cron-ipc-handlers.ts:40 - Electron ipcMain channel |
| `cron:get-job` | src/electron/libs/cron-ipc-handlers.ts:44 - Electron ipcMain channel |
| `cron:add-job` | src/electron/libs/cron-ipc-handlers.ts:48 - Electron ipcMain channel |
| `cron:update-job` | src/electron/libs/cron-ipc-handlers.ts:52 - Electron ipcMain channel |
| `cron:remove-job` | src/electron/libs/cron-ipc-handlers.ts:56 - Electron ipcMain channel |
| `cron:run-now` | src/electron/libs/cron-ipc-handlers.ts:60 - Electron ipcMain channel |
| `skills:getManagedSkills` | src/electron/libs/skill-manager/ipc-handlers.ts:629 - skill manager IPC channel |
| `skills:getSkillsForScenario` | src/electron/libs/skill-manager/ipc-handlers.ts:633 - skill manager IPC channel |
| `skills:getSkillDocument` | src/electron/libs/skill-manager/ipc-handlers.ts:638 - skill manager IPC channel |
| `skills:deleteManagedSkill` | src/electron/libs/skill-manager/ipc-handlers.ts:659 - skill manager IPC channel |
| `skills:deleteManagedSkills` | src/electron/libs/skill-manager/ipc-handlers.ts:675 - skill manager IPC channel |
| `skills:installLocal` | src/electron/libs/skill-manager/ipc-handlers.ts:704 - skill manager IPC channel |
| `skills:batchImportFolder` | src/electron/libs/skill-manager/ipc-handlers.ts:755 - skill manager IPC channel |
| `skills:getAllTags` | src/electron/libs/skill-manager/ipc-handlers.ts:833 - skill manager IPC channel |
| `skills:setSkillTags` | src/electron/libs/skill-manager/ipc-handlers.ts:837 - skill manager IPC channel |
| `skills:getScenarios` | src/electron/libs/skill-manager/ipc-handlers.ts:842 - skill manager IPC channel |
| `skills:getActiveScenario` | src/electron/libs/skill-manager/ipc-handlers.ts:846 - skill manager IPC channel |
| `skills:createScenario` | src/electron/libs/skill-manager/ipc-handlers.ts:850 - skill manager IPC channel |
| `skills:updateScenario` | src/electron/libs/skill-manager/ipc-handlers.ts:854 - skill manager IPC channel |
| `skills:deleteScenario` | src/electron/libs/skill-manager/ipc-handlers.ts:858 - skill manager IPC channel |
| `skills:applyScenarioToDefault` | src/electron/libs/skill-manager/ipc-handlers.ts:862 - skill manager IPC channel |
| `skills:addSkillToScenario` | src/electron/libs/skill-manager/ipc-handlers.ts:866 - skill manager IPC channel |
| `skills:removeSkillFromScenario` | src/electron/libs/skill-manager/ipc-handlers.ts:870 - skill manager IPC channel |
| `skills:reorderScenarios` | src/electron/libs/skill-manager/ipc-handlers.ts:874 - skill manager IPC channel |
| `skills:getScenarioSkillOrder` | src/electron/libs/skill-manager/ipc-handlers.ts:878 - skill manager IPC channel |
| `skills:reorderScenarioSkills` | src/electron/libs/skill-manager/ipc-handlers.ts:882 - skill manager IPC channel |
| `skills:syncSkillToTool` | src/electron/libs/skill-manager/ipc-handlers.ts:887 - skill manager IPC channel |
| `skills:unsyncSkillFromTool` | src/electron/libs/skill-manager/ipc-handlers.ts:911 - skill manager IPC channel |
| `skills:getSkillToolToggles` | src/electron/libs/skill-manager/ipc-handlers.ts:920 - skill manager IPC channel |
| `skills:setSkillToolToggle` | src/electron/libs/skill-manager/ipc-handlers.ts:954 - skill manager IPC channel |
| `skills:getTools` | src/electron/libs/skill-manager/ipc-handlers.ts:1010 - skill manager IPC channel |
| `skills:setToolEnabled` | src/electron/libs/skill-manager/ipc-handlers.ts:1036 - skill manager IPC channel |
| `skills:scanLocalSkills` | src/electron/libs/skill-manager/ipc-handlers.ts:1053 - skill manager IPC channel |
| `skills:fetchLeaderboard` | src/electron/libs/skill-manager/ipc-handlers.ts:1076 - skill manager IPC channel |
| `skills:searchSkillssh` | src/electron/libs/skill-manager/ipc-handlers.ts:1080 - skill manager IPC channel |
| `skills:installSkillssh` | src/electron/libs/skill-manager/ipc-handlers.ts:1084 - skill manager IPC channel |
| `skills:previewGitInstall` | src/electron/libs/skill-manager/ipc-handlers.ts:1088 - skill manager IPC channel |
| `skills:confirmGitInstall` | src/electron/libs/skill-manager/ipc-handlers.ts:1092 - skill manager IPC channel |
| `skills:cleanupGitPreview` | src/electron/libs/skill-manager/ipc-handlers.ts:1096 - skill manager IPC channel |
| `skills:checkSkillUpdate` | src/electron/libs/skill-manager/ipc-handlers.ts:1101 - skill manager IPC channel |

## Renderer 调用

| 名称 | 位置/说明 |
| --- | --- |
| `sessions:list` | src/ui/App.tsx:721 - renderer IPC invoke |
| `shell:openExternal` | src/ui/App.tsx:1474 - renderer IPC invoke |
| `cron:update-job` | src/ui/components/cron/CreateTaskDialog.tsx:170 - renderer IPC invoke |
| `cron:add-job` | src/ui/components/cron/CreateTaskDialog.tsx:196 - renderer IPC invoke |
| `cron:run-now` | src/ui/components/cron/ScheduledTasksPage.tsx:472 - renderer IPC invoke |
| `cron:remove-job` | src/ui/components/cron/ScheduledTasksPage.tsx:482 - renderer IPC invoke |
| `knowledge:list` | src/ui/components/KnowledgePanel.tsx:625 - renderer knowledge bridge call |
| `knowledge:sync-workspaces` | src/ui/components/KnowledgePanel.tsx:662 - renderer knowledge bridge call |
| `knowledge:complete-generation` | src/ui/components/KnowledgePanel.tsx:745 - renderer knowledge bridge call |
| `knowledge:update-generation` | src/ui/components/KnowledgePanel.tsx:757 - renderer knowledge bridge call |
| `knowledge:list-documents` | src/ui/components/KnowledgePanel.tsx:771 - renderer knowledge bridge call |
| `knowledge:run-generation` | src/ui/components/KnowledgePanel.tsx:994 - renderer knowledge bridge call |
| `knowledge:add-workspace` | src/ui/components/KnowledgePanel.tsx:1095 - renderer knowledge bridge call |
| `knowledge:remove-workspace` | src/ui/components/KnowledgePanel.tsx:1117 - renderer knowledge bridge call |
| `slash-commands:list` | src/ui/components/PromptInput.tsx:808 - renderer IPC invoke |
| `skills:searchSkillssh` | src/ui/components/settings/InstallSkillsView.tsx:146 - renderer IPC invoke |
| `skills:fetchLeaderboard` | src/ui/components/settings/InstallSkillsView.tsx:147 - renderer IPC invoke |
| `skills:scanLocalSkills` | src/ui/components/settings/InstallSkillsView.tsx:175 - renderer IPC invoke |
| `skills:installLocal` | src/ui/components/settings/InstallSkillsView.tsx:197 - renderer IPC invoke |
| `preview-open-dialog` | src/ui/components/settings/InstallSkillsView.tsx:211 - renderer IPC invoke |
| `skills:batchImportFolder` | src/ui/components/settings/InstallSkillsView.tsx:238 - renderer IPC invoke |
| `skills:installSkillssh` | src/ui/components/settings/InstallSkillsView.tsx:305 - renderer IPC invoke |
| `skills:previewGitInstall` | src/ui/components/settings/InstallSkillsView.tsx:327 - renderer IPC invoke |
| `skills:cleanupGitPreview` | src/ui/components/settings/InstallSkillsView.tsx:343 - renderer IPC invoke |
| `skills:confirmGitInstall` | src/ui/components/settings/InstallSkillsView.tsx:361 - renderer IPC invoke |
| `skills:getAllTags` | src/ui/components/settings/MySkillsView.tsx:101 - renderer IPC invoke |
| `skills:deleteManagedSkill` | src/ui/components/settings/MySkillsView.tsx:181 - renderer IPC invoke |
| `skills:deleteManagedSkills` | src/ui/components/settings/MySkillsView.tsx:197 - renderer IPC invoke |
| `skills:removeSkillFromScenario` | src/ui/components/settings/MySkillsView.tsx:215 - renderer IPC invoke |
| `skills:addSkillToScenario` | src/ui/components/settings/MySkillsView.tsx:218 - renderer IPC invoke |
| `skills:batchUpdateSkills` | src/ui/components/settings/MySkillsView.tsx:255 - renderer IPC invoke |
| `plugins:getOpenComputerUseStatus` | src/ui/components/settings/PluginsSettingsPage.tsx:369 - renderer IPC invoke |
| `plugins:checkOpenComputerUseUpdate` | src/ui/components/settings/PluginsSettingsPage.tsx:371 - renderer IPC invoke |
| `plugins:getFigmaOfficialStatus` | src/ui/components/settings/PluginsSettingsPage.tsx:380 - renderer IPC invoke |
| `plugins:installOpenComputerUse` | src/ui/components/settings/PluginsSettingsPage.tsx:419 - renderer IPC invoke |
| `plugins:connectFigmaDesktopOfficial` | src/ui/components/settings/PluginsSettingsPage.tsx:444 - renderer IPC invoke |
| `plugins:connectFigmaPatOfficial` | src/ui/components/settings/PluginsSettingsPage.tsx:477 - renderer IPC invoke |
| `plugins:updateOpenComputerUse` | src/ui/components/settings/PluginsSettingsPage.tsx:568 - renderer IPC invoke |
| `skills:getManagedSkills` | src/ui/components/settings/SkillsManagementPage.tsx:37 - renderer IPC invoke |
| `skills:getScenarios` | src/ui/components/settings/SkillsManagementPage.tsx:38 - renderer IPC invoke |
| `skills:getTools` | src/ui/components/settings/SkillsManagementPage.tsx:39 - renderer IPC invoke |
| `skills:scanLocalSkills` | src/ui/components/settings/SkillsManagementPage.tsx:40 - renderer IPC invoke |
| `skills:setToolEnabled` | src/ui/components/settings/ToolSettingsView.tsx:78 - renderer IPC invoke |
| `cron:update-job` | src/ui/pages/cron/useCronJobs.ts:29 - renderer IPC invoke |
| `cron:remove-job` | src/ui/pages/cron/useCronJobs.ts:39 - renderer IPC invoke |
| `cron:list-jobs-by-conversation` | src/ui/pages/cron/useCronJobs.ts:64 - renderer IPC invoke |
| `cron:list-jobs` | src/ui/pages/cron/useCronJobs.ts:118 - renderer IPC invoke |

## MCP Tool

| 名称 | 位置/说明 |
| --- | --- |
| `set_global_runtime_config` | src/electron/libs/mcp-tools/admin.ts:534 - built-in MCP tool |
| `http_ping` | src/electron/libs/mcp-tools/browser.ts:644 - built-in MCP tool |
| `diagnose_port` | src/electron/libs/mcp-tools/browser.ts:657 - built-in MCP tool |
| `bash_batch` | src/electron/libs/mcp-tools/browser.ts:666 - built-in MCP tool |
| `browser_open_page` | src/electron/libs/mcp-tools/browser.ts:685 - built-in MCP tool |
| `browser_close_page` | src/electron/libs/mcp-tools/browser.ts:696 - built-in MCP tool |
| `browser_get_state` | src/electron/libs/mcp-tools/browser.ts:707 - built-in MCP tool |
| `browser_navigate` | src/electron/libs/mcp-tools/browser.ts:718 - built-in MCP tool |
| `browser_reload` | src/electron/libs/mcp-tools/browser.ts:729 - built-in MCP tool |
| `browser_extract_page` | src/electron/libs/mcp-tools/browser.ts:740 - built-in MCP tool |
| `browser_capture_visible` | src/electron/libs/mcp-tools/browser.ts:759 - built-in MCP tool |
| `browser_save_screenshot` | src/electron/libs/mcp-tools/browser.ts:782 - built-in MCP tool |
| `browser_save_pdf` | src/electron/libs/mcp-tools/browser.ts:804 - built-in MCP tool |
| `browser_cookies` | src/electron/libs/mcp-tools/browser.ts:826 - built-in MCP tool |
| `browser_storage` | src/electron/libs/mcp-tools/browser.ts:850 - built-in MCP tool |
| `browser_console_logs` | src/electron/libs/mcp-tools/browser.ts:869 - built-in MCP tool |
| `browser_get_dom_stats` | src/electron/libs/mcp-tools/browser.ts:914 - built-in MCP tool |
| `browser_snapshot_interactive` | src/electron/libs/mcp-tools/browser.ts:933 - built-in MCP tool |
| `browser_click_element` | src/electron/libs/mcp-tools/browser.ts:958 - built-in MCP tool |
| `browser_fill_element` | src/electron/libs/mcp-tools/browser.ts:1074 - built-in MCP tool |
| `browser_get_element` | src/electron/libs/mcp-tools/browser.ts:1122 - built-in MCP tool |
| `browser_eval` | src/electron/libs/mcp-tools/browser.ts:1150 - built-in MCP tool |
| `browser_press_key` | src/electron/libs/mcp-tools/browser.ts:1164 - built-in MCP tool |
| `browser_key_down` | src/electron/libs/mcp-tools/browser.ts:1178 - built-in MCP tool |
| `browser_key_up` | src/electron/libs/mcp-tools/browser.ts:1192 - built-in MCP tool |
| `browser_keyboard_type` | src/electron/libs/mcp-tools/browser.ts:1206 - built-in MCP tool |
| `browser_keyboard_insert_text` | src/electron/libs/mcp-tools/browser.ts:1220 - built-in MCP tool |
| `browser_mouse` | src/electron/libs/mcp-tools/browser.ts:1234 - built-in MCP tool |
| `browser_scroll_page` | src/electron/libs/mcp-tools/browser.ts:1262 - built-in MCP tool |
| `browser_wait_for` | src/electron/libs/mcp-tools/browser.ts:1286 - built-in MCP tool |
| `browser_query_nodes` | src/electron/libs/mcp-tools/browser.ts:1312 - built-in MCP tool |
| `browser_inspect_styles` | src/electron/libs/mcp-tools/browser.ts:1344 - built-in MCP tool |
| `browser_apply_styles` | src/electron/libs/mcp-tools/browser.ts:1374 - built-in MCP tool |
| `browser_inspect_at_point` | src/electron/libs/mcp-tools/browser.ts:1405 - built-in MCP tool |
| `browser_set_annotation_mode` | src/electron/libs/mcp-tools/browser.ts:1421 - built-in MCP tool |
| `create_scheduled_task` | src/electron/libs/mcp-tools/cron.ts:102 - built-in MCP tool |
| `list_scheduled_tasks` | src/electron/libs/mcp-tools/cron.ts:147 - built-in MCP tool |
| `delete_scheduled_task` | src/electron/libs/mcp-tools/cron.ts:179 - built-in MCP tool |
| `design_capture_current_view` | src/electron/libs/mcp-tools/design.ts:970 - built-in MCP tool |
| `design_capture_current_region` | src/electron/libs/mcp-tools/design.ts:995 - built-in MCP tool |
| `design_inspect_image` | src/electron/libs/mcp-tools/design.ts:1021 - built-in MCP tool |
| `design_compare_current_view` | src/electron/libs/mcp-tools/design.ts:1063 - built-in MCP tool |
| `design_compare_images` | src/electron/libs/mcp-tools/design.ts:1109 - built-in MCP tool |
| `design_compare_current_view_batch` | src/electron/libs/mcp-tools/design.ts:1149 - built-in MCP tool |
| `design_compare_images_batch` | src/electron/libs/mcp-tools/design.ts:1209 - built-in MCP tool |
| `design_read_comparison_report` | src/electron/libs/mcp-tools/design.ts:1259 - built-in MCP tool |
| `design_list_artifacts` | src/electron/libs/mcp-tools/design.ts:1291 - built-in MCP tool |
| `figma_get_current_user` | src/electron/libs/mcp-tools/figma-rest.ts:828 - built-in MCP tool |
| `figma_get_file_metadata` | src/electron/libs/mcp-tools/figma-rest.ts:849 - built-in MCP tool |
| `figma_read_design` | src/electron/libs/mcp-tools/figma-rest.ts:890 - built-in MCP tool |
| `figma_list_node_index` | src/electron/libs/mcp-tools/figma-rest.ts:935 - built-in MCP tool |
| `figma_match_ui_nodes` | src/electron/libs/mcp-tools/figma-rest.ts:984 - built-in MCP tool |
| `figma_summarize_design` | src/electron/libs/mcp-tools/figma-rest.ts:1037 - built-in MCP tool |
| `figma_extract_design_tokens` | src/electron/libs/mcp-tools/figma-rest.ts:1075 - built-in MCP tool |
| `figma_get_design_playbook` | src/electron/libs/mcp-tools/figma-rest.ts:1108 - built-in MCP tool |
| `figma_audit_design` | src/electron/libs/mcp-tools/figma-rest.ts:1136 - built-in MCP tool |
| `figma_generate_tailwind_code` | src/electron/libs/mcp-tools/figma-rest.ts:1184 - built-in MCP tool |
| `figma_get_image_urls` | src/electron/libs/mcp-tools/figma-rest.ts:1234 - built-in MCP tool |
| `figma_get_image_fills` | src/electron/libs/mcp-tools/figma-rest.ts:1275 - built-in MCP tool |
| `figma_list_file_versions` | src/electron/libs/mcp-tools/figma-rest.ts:1300 - built-in MCP tool |
| `figma_list_file_comments` | src/electron/libs/mcp-tools/figma-rest.ts:1325 - built-in MCP tool |
| `figma_list_file_library` | src/electron/libs/mcp-tools/figma-rest.ts:1353 - built-in MCP tool |
| `figma_get_file_variables` | src/electron/libs/mcp-tools/figma-rest.ts:1384 - built-in MCP tool |
| `figma_get_dev_resources` | src/electron/libs/mcp-tools/figma-rest.ts:1412 - built-in MCP tool |
| `idea_status` | src/electron/libs/mcp-tools/idea.ts:56 - built-in MCP tool |
| `idea_open` | src/electron/libs/mcp-tools/idea.ts:84 - built-in MCP tool |
| `idea_focus` | src/electron/libs/mcp-tools/idea.ts:125 - built-in MCP tool |
| `idea_wait_ready` | src/electron/libs/mcp-tools/idea.ts:143 - built-in MCP tool |
| `knowledge_search` | src/electron/libs/mcp-tools/knowledge.ts:135 - built-in MCP tool |
| `knowledge_read` | src/electron/libs/mcp-tools/knowledge.ts:193 - built-in MCP tool |
| `knowledge_explore` | src/electron/libs/mcp-tools/knowledge.ts:246 - built-in MCP tool |
| `knowledge_index` | src/electron/libs/mcp-tools/knowledge.ts:282 - built-in MCP tool |
| `memory_update` | src/electron/libs/mcp-tools/knowledge.ts:301 - built-in MCP tool |
| `update_plan` | src/electron/libs/mcp-tools/plan.ts:37 - built-in MCP tool |

## SQLite / FTS / Vector

| 名称 | 位置/说明 |
| --- | --- |
| `learnings` | pro-workflow/src/db/schema.sql:5 - SQLite table |
| `learnings_fts` | pro-workflow/src/db/schema.sql:17 - SQLite table |
| `sessions` | pro-workflow/src/db/schema.sql:45 - SQLite table |
| `wikis` | pro-workflow/src/db/schema.sql:67 - SQLite table |
| `wiki_pages` | pro-workflow/src/db/schema.sql:79 - SQLite table |
| `wiki_sources` | pro-workflow/src/db/schema.sql:92 - SQLite table |
| `wiki_claims` | pro-workflow/src/db/schema.sql:103 - SQLite table |
| `wiki_seeds` | pro-workflow/src/db/schema.sql:112 - SQLite table |
| `wiki_pages_fts` | pro-workflow/src/db/schema.sql:122 - SQLite table |
| `wiki_embeddings` | pro-workflow/src/db/schema.sql:154 - SQLite table |
| `learnings_wiki` | pro-workflow/src/db/schema.sql:164 - SQLite table |
| `idx_learnings_category` | pro-workflow/src/db/schema.sql:56 - SQLite index |
| `idx_learnings_project` | pro-workflow/src/db/schema.sql:57 - SQLite index |
| `idx_learnings_created_at` | pro-workflow/src/db/schema.sql:58 - SQLite index |
| `idx_sessions_project` | pro-workflow/src/db/schema.sql:59 - SQLite index |
| `idx_sessions_started_at` | pro-workflow/src/db/schema.sql:60 - SQLite index |
| `idx_wiki_pages_slug` | pro-workflow/src/db/schema.sql:147 - SQLite index |
| `idx_wiki_pages_type` | pro-workflow/src/db/schema.sql:148 - SQLite index |
| `idx_wiki_seeds_status` | pro-workflow/src/db/schema.sql:149 - SQLite index |
| `idx_wiki_claims_page` | pro-workflow/src/db/schema.sql:150 - SQLite index |
| `idx_wiki_embeddings_model` | pro-workflow/src/db/schema.sql:161 - SQLite index |
| `idx_learnings_wiki_slug` | pro-workflow/src/db/schema.sql:168 - SQLite index |
| `cron_jobs` | src/electron/libs/cron-db.ts:27 - SQLite table |
| `idx_cron_jobs_conversation` | src/electron/libs/cron-db.ts:54 - SQLite index |
| `idx_cron_jobs_next_run` | src/electron/libs/cron-db.ts:55 - SQLite index |
| `knowledge_documents` | src/electron/libs/knowledge/knowledge-repository.ts:49 - SQLite table |
| `knowledge_chunks` | src/electron/libs/knowledge/knowledge-repository.ts:64 - SQLite table |
| `knowledge_chunks_fts` | src/electron/libs/knowledge/knowledge-repository.ts:81 - SQLite table |
| `knowledge_index_runs` | src/electron/libs/knowledge/knowledge-repository.ts:89 - SQLite table |
| `knowledge_chunk_vectors` | src/electron/libs/knowledge/knowledge-repository.ts:118 - SQLite table |
| `idx_knowledge_documents_workspace` | src/electron/libs/knowledge/knowledge-repository.ts:98 - SQLite index |
| `idx_knowledge_documents_source` | src/electron/libs/knowledge/knowledge-repository.ts:99 - SQLite index |
| `idx_knowledge_chunks_document` | src/electron/libs/knowledge/knowledge-repository.ts:100 - SQLite index |
| `idx_knowledge_chunks_workspace` | src/electron/libs/knowledge/knowledge-repository.ts:101 - SQLite index |
| `knowledge_ui_workspaces` | src/electron/libs/knowledge/knowledge-ui-store.ts:86 - SQLite table |
| `knowledge_ui_generation` | src/electron/libs/knowledge/knowledge-ui-store.ts:96 - SQLite table |
| `knowledge_ui_documents` | src/electron/libs/knowledge/knowledge-ui-store.ts:109 - SQLite table |
| `idx_knowledge_ui_workspaces_hidden` | src/electron/libs/knowledge/knowledge-ui-store.ts:121 - SQLite index |
| `idx_knowledge_ui_documents_workspace` | src/electron/libs/knowledge/knowledge-ui-store.ts:122 - SQLite index |
| `learnings` | src/electron/libs/learning-store.ts:31 - SQLite table |
| `learnings_fts` | src/electron/libs/learning-store.ts:44 - SQLite table |
| `learnings_sessions` | src/electron/libs/learning-store.ts:84 - SQLite table |
| `idx_learnings_category` | src/electron/libs/learning-store.ts:78 - SQLite index |
| `idx_learnings_project` | src/electron/libs/learning-store.ts:79 - SQLite index |
| `idx_learnings_created_at` | src/electron/libs/learning-store.ts:80 - SQLite index |
| `idx_learnings_sessions_project` | src/electron/libs/learning-store.ts:94 - SQLite index |
| `idx_learnings_sessions_started_at` | src/electron/libs/learning-store.ts:95 - SQLite index |
| `memories` | src/electron/libs/memory/memory-repository.ts:45 - SQLite table |
| `memories_fts` | src/electron/libs/memory/memory-repository.ts:66 - SQLite table |
| `idx_memories_scope` | src/electron/libs/memory/memory-repository.ts:62 - SQLite index |
| `idx_memories_category` | src/electron/libs/memory/memory-repository.ts:63 - SQLite index |
| `idx_memories_updated` | src/electron/libs/memory/memory-repository.ts:64 - SQLite index |
| `notes` | src/electron/libs/note-repository.ts:14 - SQLite table |
| `idx_notes_updated` | src/electron/libs/note-repository.ts:21 - SQLite index |
| `sessions` | src/electron/libs/session-store.ts:500 - SQLite table |
| `messages` | src/electron/libs/session-store.ts:535 - SQLite table |
| `messages_session_id` | src/electron/libs/session-store.ts:543 - SQLite index |
| `messages_session_created_id` | src/electron/libs/session-store.ts:544 - SQLite index |
| `skills` | src/electron/libs/skill-manager/db.ts:29 - SQLite table |
| `scenarios` | src/electron/libs/skill-manager/db.ts:51 - SQLite table |
| `scenario_skills` | src/electron/libs/skill-manager/db.ts:61 - SQLite table |
| `scenario_skill_tools` | src/electron/libs/skill-manager/db.ts:68 - SQLite table |
| `skill_targets` | src/electron/libs/skill-manager/db.ts:76 - SQLite table |
| `skill_tags` | src/electron/libs/skill-manager/db.ts:88 - SQLite table |
| `settings` | src/electron/libs/skill-manager/db.ts:94 - SQLite table |
| `idx_scenario_skills_skill` | src/electron/libs/skill-manager/db.ts:99 - SQLite index |
| `idx_skill_targets_skill` | src/electron/libs/skill-manager/db.ts:100 - SQLite index |
| `idx_skill_tags_skill` | src/electron/libs/skill-manager/db.ts:101 - SQLite index |
| `tasks` | src/electron/libs/task/repository.ts:33 - SQLite table |
| `task_executions` | src/electron/libs/task/repository.ts:67 - SQLite table |
| `task_execution_logs` | src/electron/libs/task/repository.ts:88 - SQLite table |
| `task_subtasks` | src/electron/libs/task/repository.ts:97 - SQLite table |
| `task_artifacts` | src/electron/libs/task/repository.ts:109 - SQLite table |
| `task_dismissals` | src/electron/libs/task/repository.ts:120 - SQLite table |
| `idx_tasks_provider` | src/electron/libs/task/repository.ts:127 - SQLite index |
| `idx_tasks_local_status` | src/electron/libs/task/repository.ts:128 - SQLite index |
| `idx_tasks_external_id` | src/electron/libs/task/repository.ts:129 - SQLite index |
| `idx_tasks_retry_due` | src/electron/libs/task/repository.ts:130 - SQLite index |
| `idx_task_executions_task` | src/electron/libs/task/repository.ts:131 - SQLite index |
| `idx_task_execution_logs_exec` | src/electron/libs/task/repository.ts:132 - SQLite index |

## 事件

| 名称 | 位置/说明 |
| --- | --- |
| `file` | vite.config.ts:103 - typed event payload |
| `council` | pro-workflow/skills/llm-council/scripts/council.js:152 - typed event payload |
| `question` | pro-workflow/skills/wiki-research-loop/scripts/research-loop.js:245 - typed event payload |
| `codex` | scripts/codex-oauth-setup.mjs:188 - typed event payload |
| `blob` | skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs:224 - typed event payload |
| `commit` | skills/tech-cc-hub-release-deploy/scripts/publish-release.mjs:332 - typed event payload |
| `github` | src/electron/main.ts:423 - typed event payload |
| `separator` | src/ui/App.tsx:46 - typed event payload |
| `message` | src/ui/App.tsx:47 - typed event payload |
| `process_group` | src/ui/App.tsx:48 - typed event payload |
| `session.history` | src/ui/App.tsx:580 - typed event payload |
| `session.list` | src/ui/App.tsx:725 - typed event payload |
| `session.create` | src/ui/App.tsx:997 - typed event payload |
| `session.delete` | src/ui/App.tsx:1041 - typed event payload |
| `session.archive` | src/ui/App.tsx:1045 - typed event payload |
| `session.unarchive` | src/ui/App.tsx:1049 - typed event payload |
| `permission.response` | src/ui/App.tsx:1071 - typed event payload |
| `session.start` | src/ui/App.tsx:1162 - typed event payload |
| `session.continue` | src/ui/App.tsx:1215 - typed event payload |
| `oauth` | package/browser-sdk.d.ts:15 - typed event payload |
| `auth` | package/browser-sdk.d.ts:19 - typed event payload |
| `text` | package/sdk-tools.d.ts:58 - typed event payload |
| `image` | package/sdk-tools.d.ts:141 - typed event payload |
| `notebook` | package/sdk-tools.d.ts:179 - typed event payload |
| `pdf` | package/sdk-tools.d.ts:192 - typed event payload |
| `parts` | package/sdk-tools.d.ts:209 - typed event payload |
| `file_unchanged` | package/sdk-tools.d.ts:230 - typed event payload |
| `create` | package/sdk-tools.d.ts:2314 - typed event payload |
| `code` | package/sdk-tools.d.ts:2412 - typed event payload |
| `session.start` | scripts/qa/knowledge-chat-injection-smoke.mjs:99 - typed event payload |
| `task.updated` | src/electron/ipc-handlers.ts:87 - typed event payload |
| `task.deleted` | src/electron/ipc-handlers.ts:93 - typed event payload |
| `task.execution.started` | src/electron/ipc-handlers.ts:99 - typed event payload |
| `task.execution.completed` | src/electron/ipc-handlers.ts:105 - typed event payload |
| `task.execution.log` | src/electron/ipc-handlers.ts:111 - typed event payload |
| `task.stats` | src/electron/ipc-handlers.ts:117 - typed event payload |
| `task.sync.completed` | src/electron/ipc-handlers.ts:123 - typed event payload |
| `task.error` | src/electron/ipc-handlers.ts:129 - typed event payload |
| `permission.request` | src/electron/ipc-handlers.ts:652 - typed event payload |
| `info` | src/electron/ipc-handlers.ts:687 - typed event payload |
| `channel.message.receive` | src/electron/ipc-handlers.ts:768 - typed event payload |
| `runner.error` | src/electron/ipc-handlers.ts:773 - typed event payload |
| `session.start` | src/electron/ipc-handlers.ts:828 - typed event payload |
| `session.append` | src/electron/ipc-handlers.ts:858 - typed event payload |
| `session.continue` | src/electron/ipc-handlers.ts:869 - typed event payload |
| `session.list` | src/electron/ipc-handlers.ts:890 - typed event payload |
| `session.deleted` | src/electron/ipc-handlers.ts:900 - typed event payload |
| `session.archived` | src/electron/ipc-handlers.ts:904 - typed event payload |
| `session.unarchived` | src/electron/ipc-handlers.ts:923 - typed event payload |
| `session.history` | src/electron/ipc-handlers.ts:947 - typed event payload |
| `session.workflow.catalog` | src/electron/ipc-handlers.ts:972 - typed event payload |
| `session.workflow` | src/electron/ipc-handlers.ts:1004 - typed event payload |
| `session.status` | src/electron/ipc-handlers.ts:1079 - typed event payload |
| `stream.message` | src/electron/ipc-handlers.ts:1127 - typed event payload |
| `stream.user_prompt` | src/electron/ipc-handlers.ts:1141 - typed event payload |
| `local` | src/electron/libs/claude-code-plugins.ts:41 - typed event payload |
| `text` | src/electron/libs/codex-oauth.ts:95 - typed event payload |
| `tool_use` | src/electron/libs/codex-oauth.ts:96 - typed event payload |
| `message` | src/electron/libs/codex-oauth.ts:100 - typed event payload |
| `codex` | src/electron/libs/codex-oauth.ts:265 - typed event payload |
| `output_text` | src/electron/libs/codex-oauth.ts:358 - typed event payload |
| `message_start` | src/electron/libs/codex-oauth.ts:372 - typed event payload |
| `content_block_start` | src/electron/libs/codex-oauth.ts:387 - typed event payload |
| `content_block_delta` | src/electron/libs/codex-oauth.ts:393 - typed event payload |
| `text_delta` | src/electron/libs/codex-oauth.ts:395 - typed event payload |
| `input_json_delta` | src/electron/libs/codex-oauth.ts:408 - typed event payload |
| `content_block_stop` | src/electron/libs/codex-oauth.ts:415 - typed event payload |
| `message_delta` | src/electron/libs/codex-oauth.ts:421 - typed event payload |
| `message_stop` | src/electron/libs/codex-oauth.ts:430 - typed event payload |
| `function_call` | src/electron/libs/codex-oauth.ts:516 - typed event payload |
| `function_call_output` | src/electron/libs/codex-oauth.ts:532 - typed event payload |
| `function` | src/electron/libs/codex-oauth.ts:556 - typed event payload |
| `object` | src/electron/libs/codex-oauth.ts:559 - typed event payload |
| `stdio` | src/electron/libs/external-mcp-servers.ts:4 - typed event payload |
| `http` | src/electron/libs/external-mcp-servers.ts:11 - typed event payload |
| `external` | src/electron/libs/external-mcp-servers.ts:23 - typed event payload |
| `http` | src/electron/libs/figma-official-plugin.ts:109 - typed event payload |
| `desktop-mcp` | src/electron/libs/figma-official-plugin.ts:167 - typed event payload |
| `figma-rest-api` | src/electron/libs/figma-official-plugin.ts:221 - typed event payload |
| `input_text` | src/electron/libs/image-preprocessor.ts:238 - typed event payload |
