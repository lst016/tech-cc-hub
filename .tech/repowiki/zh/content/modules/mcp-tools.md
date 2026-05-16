# mcp-tools

> mcp-tools 模块包含 17 个高价值文件。

模型未返回稳定 JSON 时，RepoWiki 会保留源码扫描得到的文件、符号、依赖和运行信号，避免生成空泛模块页。

## 文件

### `src/electron/libs/mcp-tools/browser.ts`

源码文件。运行信号：mcp tool: http_ping、mcp tool: diagnose_port、mcp tool: bash_batch、mcp tool: browser_open_page、mcp tool: browser_close_page；依赖：@anthropic-ai/claude-agent-sdk、node:child_process、zod、../../browser-manager.js、./tool-result.js

- `setBrowserToolHost` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `getBrowserToolNames` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `getHost` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `normalizeFieldParts` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `isRecord` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `getPathValue` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `setPathValue` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `normalizeFields` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `filterNodeQueryResult` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `filterStyleInspection` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `clampInteger` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `clampDuration` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `sleep` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `normalizeHttpUrl` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `httpPing` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch
- `execFileText` (symbol) - mcp tool: http_ping, mcp tool: diagnose_port, mcp tool: bash_batch

### `src/electron/libs/mcp-tools/figma-rest.ts`

源码文件。运行信号：mcp tool: figma_get_current_user、mcp tool: figma_get_file_metadata、mcp tool: figma_read_design、mcp tool: figma_list_node_index、mcp tool: figma_match_ui_nodes；依赖：@anthropic-ai/claude-agent-sdk、@modelcontextprotocol/sdk/types.js、zod、../config-store.js、../figma-official-plugin.js

- `isRecord` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `getConfiguredFigmaPat` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `clampMaxBytes` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `figmaApiGet` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `parseJsonBody` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `getFigmaApiErrorMessage` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `capPayload` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `capFigmaDesignPayload` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `getFigmaFileKey` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `toFigmaErrorResult` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `countRecordKeys` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `summarizeFileMetadataFromDocument` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `fetchFigmaDesignPayload` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `extractDocumentNodes` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `buildDesignSummary` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design
- `compactDesignNode` (symbol) - mcp tool: figma_get_current_user, mcp tool: figma_get_file_metadata, mcp tool: figma_read_design

### `src/electron/libs/mcp-tools/design.ts`

源码文件。运行信号：mcp tool: design_capture_current_view、mcp tool: design_capture_current_region、mcp tool: design_inspect_image、mcp tool: design_compare_current_view、mcp tool: design_compare_images；依赖：@anthropic-ai/claude-agent-sdk、electron、fs、path、zod

- `setDesignToolHost` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `getHost` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `getDesignArtifactDir` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `sanitizeLabel` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `createArtifactPath` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `writePngArtifact` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `writeJsonArtifact` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `isJsonRecord` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `resolveDesignArtifactPath` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `inferDesignArtifactKind` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `listDesignArtifacts` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `summarizeComparisonReport` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `dataUrlToBuffer` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `createImageFromBuffer` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `createImageFromPath` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image
- `assertReasonableSize` (symbol) - mcp tool: design_capture_current_view, mcp tool: design_capture_current_region, mcp tool: design_inspect_image

### `src/electron/libs/mcp-tools/knowledge.ts`

源码文件。运行信号：mcp tool: knowledge_search、mcp tool: knowledge_read、mcp tool: knowledge_explore、mcp tool: knowledge_index、mcp tool: memory_update；依赖：electron、fs、@anthropic-ai/claude-agent-sdk、zod、../knowledge/embedding-client.js

- `resolveWorkspaceRoot` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `parseMemoryCategories` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `parseTags` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `resolveMemoryScope` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `openKnowledgeRepository` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `openMemoryRepository` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `mirrorMemoryJson` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `getKnowledgeMcpServer` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `KNOWLEDGE_TOOL_NAMES` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `KNOWLEDGE_MCP_SERVER_NAME` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `KNOWLEDGE_MCP_SERVER_VERSION` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `knowledgeMcpServers` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `SEARCH_SCHEMA` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `READ_SCHEMA` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `EXPLORE_SCHEMA` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore
- `INDEX_SCHEMA` (symbol) - mcp tool: knowledge_search, mcp tool: knowledge_read, mcp tool: knowledge_explore

### `src/electron/libs/mcp-tools/idea.ts`

源码文件。运行信号：mcp tool: idea_status、mcp tool: idea_open、mcp tool: idea_focus、mcp tool: idea_wait_ready；依赖：@anthropic-ai/claude-agent-sdk、zod、../idea-launcher.js、./tool-result.js

- `getIdeaMcpServer` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `IDEA_TOOL_NAMES` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `IDEA_TOOLS_SERVER_NAME` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `IDEA_MCP_SERVER_VERSION` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `EDITION_SCHEMA` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `IDEA_STATUS_SCHEMA` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `IDEA_OPEN_SCHEMA` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `IDEA_FOCUS_SCHEMA` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `IDEA_WAIT_READY_SCHEMA` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `statusHandler` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `status` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `recommended` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `openHandler` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `status` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `result` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus
- `focusHandler` (symbol) - mcp tool: idea_status, mcp tool: idea_open, mcp tool: idea_focus

### `src/electron/libs/mcp-tools/cron.ts`

源码文件。运行信号：mcp tool: create_scheduled_task、mcp tool: list_scheduled_tasks、mcp tool: delete_scheduled_task；依赖：@anthropic-ai/claude-agent-sdk、zod、../cron-service.js、../cron-types.js、./tool-result.js

- `setCronService` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `buildScheduleFromInput` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `getCronMcpServer` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `CRON_TOOL_NAMES` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `CRON_TOOLS_SERVER_NAME` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `CRON_MCP_SERVER_VERSION` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `kind` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `desc` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `expr` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `seconds` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `ms` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `minutes` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `raw` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `atMs` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `inMinutes` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task
- `CREATE_SCHEMA` (symbol) - mcp tool: create_scheduled_task, mcp tool: list_scheduled_tasks, mcp tool: delete_scheduled_task

### `src/electron/libs/mcp-tools/admin.ts`

源码文件。运行信号：mcp tool: set_global_runtime_config；依赖：@anthropic-ai/claude-agent-sdk、zod、../config-store.js、./tool-result.js

- `isAllowedEnvKey` (symbol) - mcp tool: set_global_runtime_config
- `toEnvString` (symbol) - mcp tool: set_global_runtime_config
- `normalizeSystemPromptExt` (symbol) - mcp tool: set_global_runtime_config
- `isChannelProviderId` (symbol) - mcp tool: set_global_runtime_config
- `isChannelTransportMode` (symbol) - mcp tool: set_global_runtime_config
- `normalizeChannelText` (symbol) - mcp tool: set_global_runtime_config
- `normalizeLarkChannelPatch` (symbol) - mcp tool: set_global_runtime_config
- `normalizeChannelsPatch` (symbol) - mcp tool: set_global_runtime_config
- `normalizePatch` (symbol) - mcp tool: set_global_runtime_config
- `collectSkillEnvCandidates` (symbol) - mcp tool: set_global_runtime_config
- `readSystemPromptExtLines` (symbol) - mcp tool: set_global_runtime_config
- `mergeSystemPromptExtLines` (symbol) - mcp tool: set_global_runtime_config
- `mergeConfig` (symbol) - mcp tool: set_global_runtime_config
- `buildResultSummary` (symbol) - mcp tool: set_global_runtime_config
- `getAdminMcpServer` (symbol) - mcp tool: set_global_runtime_config
- `ADMIN_TOOL_NAMES` (symbol) - mcp tool: set_global_runtime_config

### `src/electron/libs/mcp-tools/README.md`

配置文件

### `src/electron/libs/mcp-tools/figma-design-intelligence.ts`

源码文件

- `buildFigmaDesignPlaybook` (symbol)
- `buildFigmaDesignAudit` (symbol)
- `rankDesignSystems` (symbol)
- `buildRecommendedStack` (symbol)
- `inferDomain` (symbol)
- `normalizeFrameworks` (symbol)
- `flattenNodes` (symbol)
- `buildAuditStats` (symbol)
- `buildAuditFindings` (symbol)
- `buildTokenRecommendations` (symbol)
- `buildImplementationChecklist` (symbol)
- `isActionLikeNode` (symbol)
- `getTextNumber` (symbol)
- `formatNodeRef` (symbol)
- `severityWeight` (symbol)
- `clampInteger` (symbol)

### `src/electron/libs/mcp-tools/figma-node-index.ts`

源码文件

- `buildFigmaNodeIndex` (symbol)
- `pickRecommendedNodeIds` (symbol)
- `filterFigmaNodeIndex` (symbol)
- `collectFigmaNodeText` (symbol)
- `parseFigmaNodeIndexQuery` (symbol)
- `scoreFigmaNodeIndexEntry` (symbol)
- `getFigmaNodeIndexSearchText` (symbol)
- `compareFigmaRecommendationEntries` (symbol)
- `getFigmaNodeIndexPathDepth` (symbol)
- `getFigmaNodeIndexArea` (symbol)
- `getFigmaNodeIndexCompactnessScore` (symbol)
- `readNodeIndexBounds` (symbol)
- `getNodeChildren` (symbol)
- `isRecord` (symbol)
- `readString` (symbol)
- `readNumber` (symbol)

### `src/electron/libs/mcp-tools/figma-ui-node-matcher.ts`

源码文件。依赖：./figma-node-index.js

- `matchUiNodesToFigmaNodes` (symbol)
- `scoreUiToFigmaCandidate` (symbol)
- `compactUiNode` (symbol)
- `getUiSearchText` (symbol)
- `getFigmaSearchText` (symbol)
- `getPrimaryUiText` (symbol)
- `buildSearchTerms` (symbol)
- `scoreRoleHints` (symbol)
- `roleHintsForUiNode` (symbol)
- `scoreComponentHints` (symbol)
- `scoreGeometry` (symbol)
- `normalizedCenterDistance` (symbol)
- `getUiBounds` (symbol)
- `buildMappingAdvice` (symbol)
- `normalizeText` (symbol)
- `readString` (symbol)

### `src/electron/libs/mcp-tools/plan.ts`

源码文件。运行信号：mcp tool: update_plan；依赖：@anthropic-ai/claude-agent-sdk、zod、./tool-result.js

- `planUpdatedResult` (symbol) - mcp tool: update_plan
- `getPlanMcpServer` (symbol) - mcp tool: update_plan
- `PLAN_TOOL_NAMES` (symbol) - mcp tool: update_plan
- `PLAN_MCP_SERVER_NAME` (symbol) - mcp tool: update_plan
- `PLAN_MCP_SERVER_VERSION` (symbol) - mcp tool: update_plan
- `PLAN_ITEM_SCHEMA` (symbol) - mcp tool: update_plan
- `UPDATE_PLAN_SCHEMA` (symbol) - mcp tool: update_plan
- `updatePlanHandler` (symbol) - mcp tool: update_plan
- `McpSdkServerConfigWithInstance` (symbol) - mcp tool: update_plan

### `src/electron/libs/mcp-tools/figma-locator.ts`

源码文件

- `parseFigmaLocator` (symbol)
- `normalizeNodeId` (symbol)
- `raw` (symbol)
- `parsedNodeIds` (symbol)
- `url` (symbol)
- `segments` (symbol)
- `keySegmentIndex` (symbol)
- `fileKey` (symbol)
- `nodeIdFromUrl` (symbol)
- `FigmaLocator` (symbol)

### `src/shared/builtin-mcp-registry.ts`

源码文件

- `getBuiltinMcpServerDefinition` (symbol)
- `listBuiltinMcpServerInfos` (symbol)
- `listBuiltinMcpToolNames` (symbol)
- `buildBuiltinMcpPromptHints` (symbol)
- `enabledNames` (symbol)
- `BuiltinMcpServerName` (symbol)
- `BuiltinMcpIconKey` (symbol)
- `BuiltinMcpToolInfo` (symbol)
- `BuiltinMcpToolGroup` (symbol)
- `BuiltinMcpServerDefinition` (symbol)

### `src/electron/libs/builtin-mcp-servers.ts`

源码文件。依赖：@anthropic-ai/claude-agent-sdk、../../shared/builtin-mcp-registry.js、./mcp-tools/admin.js、./mcp-tools/browser.js、./mcp-tools/design.js

- `getBuiltinMcpServers` (symbol)
- `listBuiltinMcpToolNames` (symbol)
- `context` (symbol)
- `enabledNames` (symbol)
- `server` (symbol)
- `BuiltinMcpServerName` (symbol)
- `BuiltinMcpFactoryContext` (symbol)
- `BuiltinMcpFactory` (symbol)

### `src/electron/libs/mcp-tools/tool-result.ts`

源码文件。依赖：@modelcontextprotocol/sdk/types.js

- `toTextToolResult` (symbol)
- `toPlainTextToolResult` (symbol)

### `test/electron/builtin-mcp-registry.test.ts`

源码文件。依赖：node:assert/strict、node:test、../../src/shared/builtin-mcp-registry.js

- `serverInfos` (symbol)
- `registryNames` (symbol)
- `toolNames` (symbol)
- `uniqueToolNames` (symbol)
- `hints` (symbol)

## 关键概念

- **确定性文档**: 该模块页由 RepoWiki fallback 从真实源码元数据生成；具体细节见左侧文件页。

## Agent 关注点

- MCP Tool 是 Agent 读取知识、搜索知识、刷新索引的入口。
- 变更工具 schema 后要同步 registry、server factory 和 smoke 测试。
