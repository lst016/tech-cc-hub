# 模块改造入口：mcp-tools

<agent_card id="module-mcp-tools" kind="module">

## 什么时候用
当任务落在 mcp-tools 时，优先读取这些高价值文件来确定入口、状态边界、接口契约和验证路径。

## 修改入口
- `src/electron/libs/mcp-tools/browser.ts`: 暴露给 Agent 的 MCP 工具面
- `src/shared/builtin-mcp-registry.ts`: 内置 MCP server 和工具元数据注册表
- `src/electron/libs/mcp-tools/figma-rest.ts`: 暴露给 Agent 的 MCP 工具面
- `src/electron/libs/builtin-mcp-servers.ts`: 内置 MCP server 工厂映射和 tool name 暴露
- `src/electron/libs/mcp-tools/design.ts`: 暴露给 Agent 的 MCP 工具面
- `src/electron/libs/mcp-tools/knowledge.ts`: 暴露给 Agent 的 MCP 工具面

## 相关文件
- `src/electron/libs/mcp-tools/browser.ts`
- `src/shared/builtin-mcp-registry.ts`
- `src/electron/libs/mcp-tools/figma-rest.ts`
- `src/electron/libs/builtin-mcp-servers.ts`
- `src/electron/libs/mcp-tools/design.ts`
- `src/electron/libs/mcp-tools/knowledge.ts`
- `src/electron/libs/mcp-tools/cron.ts`
- `src/electron/libs/mcp-tools/figma-design-intelligence.ts`
- `src/electron/libs/mcp-tools/idea.ts`
- `src/electron/libs/mcp-tools/admin.ts`

## 改代码指南
- 先确认需求是否真的属于 mcp-tools，再从 entryFiles 里包含入口/IPC/schema/store 的文件开始。
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
- MCP 注册、工厂映射和 tool handler 任一缺失都会导致 Agent 调用失败。

## 检索关键词
mcp-tools, browser.ts, mcp_tool:http_ping, mcp_tool:diagnose_port, mcp_tool:bash_batch, mcp_tool:browser_open_page, mcp_tool:browser_close_page, mcp_tool:browser_get_state, mcp_tool:browser_navigate, mcp_tool:browser_reload, builtin-mcp-registry.ts, event:builtin, figma-rest.ts, mcp_tool:figma_get_current_user, mcp_tool:figma_get_file_metadata, mcp_tool:figma_read_design, mcp_tool:figma_list_node_index, mcp_tool:figma_match_ui_nodes, mcp_tool:figma_summarize_design, mcp_tool:figma_extract_design_tokens, mcp_tool:figma_get_design_playbook, builtin-mcp-servers.ts, design.ts, mcp_tool:design_capture_current_view

## 代码信号
- mcp_tool:http_ping
- mcp_tool:diagnose_port
- mcp_tool:bash_batch
- mcp_tool:browser_open_page
- mcp_tool:browser_close_page
- mcp_tool:browser_get_state
- mcp_tool:browser_navigate
- mcp_tool:browser_reload
- event:builtin
- mcp_tool:figma_get_current_user
- mcp_tool:figma_get_file_metadata
- mcp_tool:figma_read_design
- mcp_tool:figma_list_node_index
- mcp_tool:figma_match_ui_nodes
- mcp_tool:figma_summarize_design
- mcp_tool:figma_extract_design_tokens
- mcp_tool:figma_get_design_playbook
- mcp_tool:design_capture_current_view
- mcp_tool:design_capture_current_region
- mcp_tool:design_inspect_image
- mcp_tool:design_compare_current_view
- mcp_tool:design_compare_images
- mcp_tool:design_compare_current_view_batch
- mcp_tool:design_compare_images_batch
- mcp_tool:design_read_comparison_report
- mcp_tool:knowledge_search
- mcp_tool:knowledge_read
- mcp_tool:knowledge_explore
- mcp_tool:knowledge_index
- mcp_tool:memory_update
- mcp_tool:create_scheduled_task
- mcp_tool:list_scheduled_tasks
- mcp_tool:delete_scheduled_task
- mcp_tool:idea_status
- mcp_tool:idea_open
- mcp_tool:idea_focus
- mcp_tool:idea_wait_ready
- mcp_tool:set_global_runtime_config

</agent_card>
