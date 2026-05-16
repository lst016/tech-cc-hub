# mcp-tools

> 为 Desktop Agent 提供内置 MCP 工具集，将浏览器、设计、Figma、知识库、IDE 启动器、定时任务、管理配置等功能暴露给 AI Agent

mcp-tools 模块是 Electron 主进程的 MCP 工具集合，集中存放暴露给 Agent 的内置工具。每个工具文件都遵循 Host 模式：通过接口依赖注入，不直接绑定 UI 生命周期。工具返回给模型的内容主要是摘要、路径和结构化 JSON，避免塞入大图或密钥明文。涉及写入磁盘或配置的工具都设有字段白名单和体积上限，确保 AI 受控修改运行配置。

## 文件

### `src/electron/libs/mcp-tools/browser.ts`

浏览器工作台 MCP 工具：将右侧 BrowserView 的导航、截图、DOM 查询、样式检查能力暴露给 Agent

- `BrowserWorkbenchToolHost` (type) - Host 接口类型，定义 BrowserView 操作方法集（open/close/navigate/capture等）
- `BROWSER_TOOL_NAMES` (const) - 所有浏览器工具名常量数组（navigation、DOM query、cookies、screenshot、keyboard/mouse 等 35 个工具）
- `getBrowserMcpServer` (function) - 创建并返回浏览器 MCP 服务器实例，注册所有浏览器工具

### `src/electron/libs/mcp-tools/design.ts`

设计还原 MCP 工具：当前页面截图与参考设计图对比，生成 diff 图和量化报告

- `DesignToolHost` (type) - Host 接口，依赖 captureVisible 和 getState 能力
- `setDesignToolHost` (function) - 注入设计工具的 Host 实例
- `getDesignArtifactDir` (function) - 获取设计产物目录路径（userData/design-parity）
- `createArtifactPath` (function) - 生成带时间戳和标签的产物文件路径
- `captureCurrentView` (function) - 捕获 BrowserView 可见区域截图
- `captureCurrentRegion` (function) - 捕获指定区域的截图
- `summarizeComparisonReport` (function) - 生成 JSON 格式的 diff 比对报告，包含差异率、热点区域、统计摘要

### `src/electron/libs/mcp-tools/figma-rest.ts`

Figma PAT 只读工具集：文件/节点读取、设计树、token 提取、UX 审查、Tailwind 初稿生成

- `FIGMA_REST_TOOL_NAMES` (export) - 导出给外部使用的 Figma 工具名列表
- `getConfiguredFigmaPat` (function) - 从配置加载 Figma Personal Access Token
- `figmaApiGet` (function) - 统一的 Figma REST API GET 请求封装
- `fetchFigmaDesignPayload` (function) - 获取 Figma 文件设计数据（nodes、styles、components 等）
- `buildDesignSummary` (function) - 将 Figma 文档压缩为 CompactDesignNode 树和 DesignTokenSummary
- `extractDesignTokens` (function) - 提取颜色、字体、圆角、间距、阴影等设计 token

### `src/electron/libs/mcp-tools/figma-design-intelligence.ts`

Figma 设计智能分析：根据设计领域推荐设计系统栈，生成 UX 审查报告和 token 建议

- `FIGMA_DESIGN_DOMAINS` (const) - 设计领域常量（auto/admin/saas/ai-tool/mobile/marketing/data-heavy/ecommerce）
- `FIGMA_DESIGN_AUDIT_FRAMEWORKS` (const) - UX 审查框架（practical/laws-of-ux/enterprise/platform/token-system/ai-ux）
- `DESIGN_SYSTEM_PROFILES` (const) - 设计系统参考库（Carbon/Fluent/Primer/Ant Design/Shadcn/Aceternity/Material）
- `buildFigmaDesignPlaybook` (function) - 根据设计领域构建推荐技术栈和实施清单
- `buildFigmaDesignAudit` (function) - 根据 UX 原则生成设计审查结果和建议

### `src/electron/libs/mcp-tools/figma-node-index.ts`

Figma 节点索引构建和搜索：为设计文档建立可检索的节点索引，支持按名称/路径/text 搜索

- `FigmaNodeIndexEntry` (type) - 索引条目类型（id/name/type/bounds/text/path/childCount/matchScore）
- `buildFigmaNodeIndex` (function) - 递归遍历 Figma 节点树，构建扁平化索引（限制最大条目数）
- `filterFigmaNodeIndex` (function) - 按查询词过滤和评分索引条目
- `pickRecommendedNodeIds` (function) - 从索引中选取推荐的节点 ID，优先选择带查询分数或符合关键词的分支节点

### `src/electron/libs/mcp-tools/figma-ui-node-matcher.ts`

UI 节点与 Figma 节点匹配：将 DOM 节点映射到对应的 Figma 设计节点，计算置信度

- `FigmaUiMatchNode` (type) - UI 节点描述类型（tagName/role/text/ariaLabel/boundingBox 等）
- `matchUiNodesToFigmaNodes` (function) - 核心匹配函数：基于 text/role/geometry 计算 UI→Figma 映射，返回 confidence 和 reasons
- `scoreUiToFigmaCandidate` (function) - 计算单个 UI 节点与 Figma 节点的匹配得分

### `src/electron/libs/mcp-tools/figma-locator.ts`

Figma 链接解析：解析 Figma URL 或 fileKey，提取 fileKey 和 nodeId

- `FigmaLocator` (type) - 解析结果类型 {fileKey, nodeIds}
- `parseFigmaLocator` (function) - 解析 Figma URL 或 fileKey，支持设计文件/board/slides/proto/make 路径

### `src/electron/libs/mcp-tools/knowledge.ts`

知识库与记忆管理工具：提供 RepoWiki 搜索/阅读/探索/索引和 Memory 增删改查

- `KNOWLEDGE_TOOL_NAMES` (const) - 知识工具名列表（knowledge_search/read/explore/index, memory_update）
- `resolveWorkspaceRoot` (function) - 解析工作区根目录，验证路径存在性
- `openKnowledgeRepository` (function) - 打开知识库仓库，注入嵌入模型配置
- `openMemoryRepository` (function) - 打开记忆仓库，支持 global/workspace 作用域
- `getKnowledgeMcpServer` (function) - 获取知识 MCP 服务器实例

### `src/electron/libs/mcp-tools/idea.ts`

IntelliJ IDEA 启动器集成：发现/打开/聚焦 IDEA，检查运行状态

- `IDEA_TOOL_NAMES` (const) - IDEA 工具名（idea_status/open/focus/wait_ready）
- `getIdeaMcpServer` (function) - 获取 IDEA MCP 服务器，注册所有工具
- `statusHandler` (function) - 发现本机已安装的 IDEA 和正在运行的进程
- `openHandler` (function) - 通过 JetBrains 启动器协议打开/复用 IDEA

### `src/electron/libs/mcp-tools/cron.ts`

定时任务管理工具：让 Agent 创建/列出/删除定时任务

- `CRON_TOOL_NAMES` (const) - 定时任务工具名（create/list/delete_scheduled_task）
- `setCronService` (function) - 注入 CronService 实例（main 进程初始化时调用）
- `buildScheduleFromInput` (function) - 根据 scheduleKind（cron/every/at）构建 CronSchedule 对象
- `getCronMcpServer` (function) - 获取定时任务 MCP 服务器

### `src/electron/libs/mcp-tools/admin.ts`

受控管理工具：让 Agent 修改 tech-cc-hub 运行配置（env/skillCredentials/systemPromptExt/channels）

- `ADMIN_TOOL_NAMES` (const) - 管理工具名（set_global_runtime_config）
- `isAllowedEnvKey` (function) - 验证环境变量名合法性，排除 ANTHROPIC_* 前缀
- `normalizePatch` (function) - 规范化配置补丁，应用白名单和长度限制
- `getAdminMcpServer` (function) - 获取管理 MCP 服务器

### `src/electron/libs/mcp-tools/plan.ts`

任务计划更新工具：Agent 可更新当前会话的任务计划状态

- `PLAN_TOOL_NAMES` (const) - 计划工具名（update_plan）
- `updatePlanHandler` (function) - 更新任务计划处理器
- `getPlanMcpServer` (function) - 获取计划 MCP 服务器

### `src/electron/libs/mcp-tools/tool-result.ts`

工具结果格式化：将函数执行结果转换为统一的文本/JSON 格式

- `toTextToolResult` (function) - 将对象结果转换为格式化的文本字符串
- `toPlainTextToolResult` (function) - 返回纯文本工具结果

### `src/electron/libs/mcp-tools/README.md`

模块文档：说明各工具职责、设计原则和使用场景

## 关键概念

- **MCP Server**: 基于 @anthropic-ai/claude-agent-sdk 的 createSdkMcpServer 创建的工具服务器，每个文件一个 MCP 实例，通过 tool() 注册工具句柄
- **Host 接口模式**: 工具不直接依赖 UI 组件，而是通过 Host 接口访问主进程维护的状态。Host 由 main.ts 在初始化时注入，支持热替换
- **工具结果格式化**: 所有工具通过 tool-result.ts 的 toTextToolResult/toPlainTextToolResult 返回结构化 JSON 文本，避免大图和密钥明文
- **设计还原（Design Parity）**: design.ts 核心功能：将当前页面截图与参考设计图对比，生成 diff 图和 JSON 报告，含 ignoreRegions、maxDifferenceRatio 等参数控制灵敏度
- **Figma 节点索引**: figma-node-index.ts 将 Figma 文档树扁平化为可检索索引，支持按名称/路径/text 搜索并评分排序
- **UI-Figma 节点匹配**: figma-ui-node-matcher.ts 基于 text/role/ariaLabel/geometry 计算 DOM 节点到 Figma 节点的映射，返回高/中/低置信度
- **受控配置修改**: admin.ts 通过字段白名单、长度上限、ANTHROPIC_* 排除规则，确保 Agent 只能修改指定配置项
- **设计领域推断**: figma-design-intelligence.ts 根据设计树特征推断领域（admin/saas/ai-tool/ecommerce等），推荐对应设计系统（Carbon/Fluent/Ant Design等）

## 内部关系

- `figma-rest.ts` → `figma-locator.ts`: 解析 Figma URL 和 nodeId
- `figma-rest.ts` → `figma-design-intelligence.ts`: 使用 buildFigmaDesignPlaybook 和 buildFigmaDesignAudit
- `figma-rest.ts` → `figma-node-index.ts`: 构建和查询 Figma 节点索引
- `figma-rest.ts` → `figma-ui-node-matcher.ts`: UI 节点与 Figma 节点匹配
- `browser.ts` → `tool-result.ts`: 所有工具使用 toTextToolResult 格式化返回
- `design.ts` → `browser-manager.js`: 设计工具复用 BrowserView 截图能力
- `admin.ts` → `config-store.js`: 读取和写入全局运行配置
- `knowledge.ts` → `knowledge-repository.js`: 知识库 CRUD 操作
- `idea.ts` → `idea-launcher.js`: IDEA 启动器底层实现

## Agent 关注点

- MCP Tool 是 Agent 读取知识、搜索知识、刷新索引的入口。
- 变更工具 schema 后要同步 registry、server factory 和 smoke 测试。
