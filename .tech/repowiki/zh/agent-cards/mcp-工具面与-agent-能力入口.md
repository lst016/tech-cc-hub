# MCP 工具面与 Agent 能力入口

<agent_card id="mcp-tools-surface" kind="mcp">

## 什么时候用
用于定位内置 MCP server、tool handler、共享 registry 和 Agent 可调用能力。

## 修改入口
- `src/electron/libs/mcp-tools/admin.ts`: MCP server/tool 定义或注册点
- `src/electron/libs/mcp-tools/browser.ts`: MCP server/tool 定义或注册点
- `src/electron/libs/mcp-tools/cron.ts`: MCP server/tool 定义或注册点
- `src/electron/libs/mcp-tools/design.ts`: MCP server/tool 定义或注册点
- `src/electron/libs/mcp-tools/figma-rest.ts`: MCP server/tool 定义或注册点
- `src/electron/libs/mcp-tools/idea.ts`: MCP server/tool 定义或注册点
- `src/electron/libs/mcp-tools/knowledge.ts`: MCP server/tool 定义或注册点
- `src/electron/libs/mcp-tools/plan.ts`: MCP server/tool 定义或注册点

## 相关文件
- `src/electron/libs/mcp-tools/admin.ts`
- `src/electron/libs/mcp-tools/browser.ts`
- `src/electron/libs/mcp-tools/cron.ts`
- `src/electron/libs/mcp-tools/design.ts`
- `src/electron/libs/mcp-tools/figma-rest.ts`
- `src/electron/libs/mcp-tools/idea.ts`
- `src/electron/libs/mcp-tools/knowledge.ts`
- `src/electron/libs/mcp-tools/plan.ts`

## 改代码指南
- 新增工具时同时改共享 registry、Electron 工厂映射、tool names 和 handler。
- 工具返回要结构化，失败要明确可恢复错误，避免让 Agent 误判能力可用。
- 涉及知识库工具时确认 embedding 配置、SQLite/vector 就绪和 workspaceRoot 解析。

## 验证方式
- npm run build
- npm run qa:knowledge
- npm run qa:knowledge-chat
- npm run qa:knowledge-ui

## 风险点
- 只注册 UI 名称但未接入 Electron 工厂会导致 Agent 看得到却调不了。
- 工具 schema 太宽会让 Agent 调用不稳定。

## 检索关键词
MCP, tool, registry, Agent, knowledge_search, knowledge_read

## 代码信号
- mcp_tool:set_global_runtime_config @ src/electron/libs/mcp-tools/admin.ts:534 - built-in MCP tool
- mcp_tool:http_ping @ src/electron/libs/mcp-tools/browser.ts:644 - built-in MCP tool
- mcp_tool:diagnose_port @ src/electron/libs/mcp-tools/browser.ts:657 - built-in MCP tool
- mcp_tool:bash_batch @ src/electron/libs/mcp-tools/browser.ts:666 - built-in MCP tool
- mcp_tool:browser_open_page @ src/electron/libs/mcp-tools/browser.ts:685 - built-in MCP tool
- mcp_tool:browser_close_page @ src/electron/libs/mcp-tools/browser.ts:696 - built-in MCP tool
- mcp_tool:browser_get_state @ src/electron/libs/mcp-tools/browser.ts:707 - built-in MCP tool
- mcp_tool:browser_navigate @ src/electron/libs/mcp-tools/browser.ts:718 - built-in MCP tool
- mcp_tool:browser_reload @ src/electron/libs/mcp-tools/browser.ts:729 - built-in MCP tool
- mcp_tool:browser_extract_page @ src/electron/libs/mcp-tools/browser.ts:740 - built-in MCP tool
- mcp_tool:browser_capture_visible @ src/electron/libs/mcp-tools/browser.ts:759 - built-in MCP tool
- mcp_tool:browser_save_screenshot @ src/electron/libs/mcp-tools/browser.ts:782 - built-in MCP tool
- mcp_tool:browser_save_pdf @ src/electron/libs/mcp-tools/browser.ts:804 - built-in MCP tool
- mcp_tool:browser_cookies @ src/electron/libs/mcp-tools/browser.ts:826 - built-in MCP tool
- mcp_tool:browser_storage @ src/electron/libs/mcp-tools/browser.ts:850 - built-in MCP tool
- mcp_tool:browser_console_logs @ src/electron/libs/mcp-tools/browser.ts:869 - built-in MCP tool
- mcp_tool:browser_get_dom_stats @ src/electron/libs/mcp-tools/browser.ts:914 - built-in MCP tool
- mcp_tool:browser_snapshot_interactive @ src/electron/libs/mcp-tools/browser.ts:933 - built-in MCP tool
- mcp_tool:browser_click_element @ src/electron/libs/mcp-tools/browser.ts:958 - built-in MCP tool
- mcp_tool:browser_fill_element @ src/electron/libs/mcp-tools/browser.ts:1074 - built-in MCP tool
- mcp_tool:browser_get_element @ src/electron/libs/mcp-tools/browser.ts:1122 - built-in MCP tool
- mcp_tool:browser_eval @ src/electron/libs/mcp-tools/browser.ts:1150 - built-in MCP tool
- mcp_tool:browser_press_key @ src/electron/libs/mcp-tools/browser.ts:1164 - built-in MCP tool
- mcp_tool:browser_key_down @ src/electron/libs/mcp-tools/browser.ts:1178 - built-in MCP tool
- mcp_tool:browser_key_up @ src/electron/libs/mcp-tools/browser.ts:1192 - built-in MCP tool
- mcp_tool:browser_keyboard_type @ src/electron/libs/mcp-tools/browser.ts:1206 - built-in MCP tool
- mcp_tool:browser_keyboard_insert_text @ src/electron/libs/mcp-tools/browser.ts:1220 - built-in MCP tool
- mcp_tool:browser_mouse @ src/electron/libs/mcp-tools/browser.ts:1234 - built-in MCP tool
- mcp_tool:browser_scroll_page @ src/electron/libs/mcp-tools/browser.ts:1262 - built-in MCP tool
- mcp_tool:browser_wait_for @ src/electron/libs/mcp-tools/browser.ts:1286 - built-in MCP tool
- mcp_tool:browser_query_nodes @ src/electron/libs/mcp-tools/browser.ts:1312 - built-in MCP tool
- mcp_tool:browser_inspect_styles @ src/electron/libs/mcp-tools/browser.ts:1344 - built-in MCP tool
- mcp_tool:browser_apply_styles @ src/electron/libs/mcp-tools/browser.ts:1374 - built-in MCP tool
- mcp_tool:browser_inspect_at_point @ src/electron/libs/mcp-tools/browser.ts:1405 - built-in MCP tool
- mcp_tool:browser_set_annotation_mode @ src/electron/libs/mcp-tools/browser.ts:1421 - built-in MCP tool
- mcp_tool:create_scheduled_task @ src/electron/libs/mcp-tools/cron.ts:102 - built-in MCP tool
- mcp_tool:list_scheduled_tasks @ src/electron/libs/mcp-tools/cron.ts:147 - built-in MCP tool
- mcp_tool:delete_scheduled_task @ src/electron/libs/mcp-tools/cron.ts:179 - built-in MCP tool
- mcp_tool:design_capture_current_view @ src/electron/libs/mcp-tools/design.ts:970 - built-in MCP tool
- mcp_tool:design_capture_current_region @ src/electron/libs/mcp-tools/design.ts:995 - built-in MCP tool
- mcp_tool:design_inspect_image @ src/electron/libs/mcp-tools/design.ts:1021 - built-in MCP tool
- mcp_tool:design_compare_current_view @ src/electron/libs/mcp-tools/design.ts:1063 - built-in MCP tool
- mcp_tool:design_compare_images @ src/electron/libs/mcp-tools/design.ts:1109 - built-in MCP tool
- mcp_tool:design_compare_current_view_batch @ src/electron/libs/mcp-tools/design.ts:1149 - built-in MCP tool
- mcp_tool:design_compare_images_batch @ src/electron/libs/mcp-tools/design.ts:1209 - built-in MCP tool
- mcp_tool:design_read_comparison_report @ src/electron/libs/mcp-tools/design.ts:1259 - built-in MCP tool
- mcp_tool:design_list_artifacts @ src/electron/libs/mcp-tools/design.ts:1291 - built-in MCP tool
- mcp_tool:figma_get_current_user @ src/electron/libs/mcp-tools/figma-rest.ts:828 - built-in MCP tool

</agent_card>
