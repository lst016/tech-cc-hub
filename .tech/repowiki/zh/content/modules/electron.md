# electron

> Electron主进程模块，提供会话管理、任务编排、内置浏览器、MCP工具和自动更新等核心能力

Desktop Agent工作台的Electron主进程实现，包含会话管理、任务执行编排、Git工作台、BrowserView内置浏览器、设计还原工具、MCP协议集成、多模型路由配置和自动更新等核心功能。Renderer进程通过IPC调用主进程能力，不直接执行敏感操作。

## 文件

### `main.ts`

Electron主进程入口，初始化窗口、注册IPC处理器、启动服务

- `main` (function) - 主进程启动入口，创建BrowserWindow并初始化各种服务
- `sessions` (variable) - SessionStore实例，管理所有会话状态
- `initializeTaskExecutor` (function) - 初始化任务执行器，注册任务provider
- `handleClientEvent` (function) - 处理来自渲染进程的客户端事件

### `ipc-handlers.ts`

集中注册所有IPC处理函数，管理会话和任务生命周期

- `SessionStore` (class) - 会话存储管理类
- `TaskExecutor` (class) - 任务执行编排器
- `TaskRepository` (class) - 任务持久化存储
- `LarkTaskProvider/TbTaskProvider/FeishuProjectTaskProvider` (class) - 外部任务源适配器

### `dev-backend-bridge.ts`

开发模式下的HTTP/SSE桥接，支持前后端事件通信

- `startDevBackendBridge` (function) - 启动开发桥接服务器，支持JSON-RPC和SSE事件推送
- `BridgeHandle` (interface) - 桥接控制器接口，包含stop方法

### `browser-workbench-preload.cts`

BrowserView标注功能的preload脚本，通过contextBridge暴露API

- `__techCcHubAnnotation` (object) - 暴露给渲染进程的标注API，包含emit方法

### `libs/git/index.ts`

Git工作台模块统一导出

- `GitWorkbenchService` (class) - Git操作服务类，提供status/diff/stage/commit/push等功能
- `registerGitWorkbenchIpcHandlers` (function) - 注册Git IPC处理器

### `libs/git/types.ts`

Git领域类型和IPC payload/result定义

### `libs/git/service.ts`

唯一Git操作入口，封装所有git命令执行

### `libs/git/ipc.ts`

Electron IPC handler注册

### `libs/task/index.ts`

任务系统统一导出，外部模块从这里import

- `TaskExecutor` (class) - 编排器，负责同步、自动执行、并发控制、重试、恢复和日志事件
- `TaskRepository` (class) - SQLite持久化，包含任务状态、执行记录和日志
- `registerTaskProvider` (function) - 注册外部任务源provider

### `libs/task/types.ts`

任务领域类型定义：ExternalTask、StoredTask、TaskExecution、TaskProvider等

### `libs/task/executor.ts`

任务编排器核心实现，管理任务执行的生命周期

### `libs/task/repository.ts`

SQLite schema和持久化操作

### `libs/task/provider-registry.ts`

Provider注册表和fallback机制

### `libs/task/providers/lark-provider.ts`

Lark任务源适配器

### `libs/task/workspace.ts`

每个任务的独立workspace创建和路径安全隔离

### `libs/skill-manager/index.ts`

技能管理系统统一导出，包含数据库操作、工具适配器、同步引擎、安装器和场景管理

- `getAllSkills` (function) - 获取所有技能
- `installFromLocal` (function) - 从本地安装技能
- `syncSkill` (function) - 同步技能到目标目录

### `libs/mcp-tools/browser.ts`

BrowserView工作台能力：导航、截图摘要、DOM查询、样式检查和标注模式

- `setBrowserToolHost` (function) - 设置浏览器工具主机

### `libs/mcp-tools/design.ts`

设计还原工具：截图语义分析、截图比照、diff图、热点区域和JSON report

- `setDesignToolHost` (function) - 设置设计工具主机

### `libs/mcp-tools/figma-rest.ts`

Figma只读工具面：文件/节点读取、设计树、token提取、导出图等

### `libs/mcp-tools/admin.ts`

受控管理能力，写入agent-runtime.json的env和skillCredentials

### `libs/agent-resolver.ts`

Agent配置解析和运行时上下文构建，支持system/user/project三种作用域

- `resolveAgentRuntimeContext` (function) - 解析Agent运行时上下文，返回选中的profile和技能列表
- `ResolvedAgentRuntimeContext` (interface) - 包含surface、skills、allowedTools、appliedProfiles等

### `libs/agent-rule-docs.ts`

Agent规则文档管理，生成系统默认规则markdown

- `buildSystemDefaultMarkdown` (function) - 构建内置浏览器默认规则和编码准则
- `AgentRuleDocuments` (interface) - 包含systemDefaultMarkdown、userAgentsMarkdown等

### `libs/attachment-store.ts`

图片附件持久化存储，将base64图片写入磁盘并通过file:// URI引用

- `persistImageAttachmentReference` (function) - 持久化图片附件到userData目录
- `rehydrateStoredImageAttachment` (function) - 从磁盘读取图片并恢复为PromptAttachment

### `libs/auto-updater.ts`

自动更新实现，基于electron-updater和GitHub API

- `AppUpdateStatus` (interface) - 更新状态：idle/checking/available/downloading/downloaded/error
- `checkForUpdates` (function) - 检查GitHub releases并选择最优版本

### `libs/auto-updater-fallback.ts`

自动更新fallback逻辑，解析GitHub release metadata和版本比较

- `compareAppVersions` (function) - 语义化版本比较
- `summarizeGitHubReleaseForUpdates` (function) - 提取release关键信息

### `tsconfig.json`

TypeScript编译配置

- `target` (config) - ESNext
- `module` (config) - NodeNext，支持ESM

## 关键概念

- **IPC通信**：主进程与渲染进程通过ipcMain/ipcRenderer通信，Renderer通过invoke发送请求并等待响应，通过send发送单向事件
- **Session管理**：每个会话独立的工作目录、Agent配置、规则文档；通过SessionStore持久化，支持恢复和清理
- **MCP协议**：Model Context Protocol集成，通过@modelcontextprotocol/sdk实现MCP客户端，支持OAuth和StreamableHTTP传输
- **任务编排**：TaskExecutor是唯一调度入口，支持并发控制、重试恢复；外部Provider只负责映射任务，不直接操作UI
- **独立Workspace**：每个任务在独立workspace执行，避免互相污染；通过ensureTaskWorkspace创建并做路径安全检查
- **BrowserView集成**：内置浏览器工作台，支持导航、DOM查询、截图摘要和标注模式，通过preload脚本暴露API
- **设计还原流程**：单张参考图先用design_inspect_image摘要，再capture_current_view截图，然后用compare方法生成diff和report
- **Agent Profile**：Agent配置包含prompt、skills、allowedTools，支持system/user/project三种作用域和development/maintenance两种运行面
- **自动更新**：基于electron-updater，通过GitHub API获取releases，支持mac/linux/windows多平台，按语义版本选择最优更新

## 内部关系

- `main.ts` -> `ipc-handlers.ts`：main.ts导入并初始化ipc-handlers中的服务
- `ipc-handlers.ts` -> `libs/task/index.ts`：注册TaskExecutor、TaskRepository和各种TaskProvider
- `ipc-handlers.ts` -> `libs/session-store.ts`：使用SessionStore管理会话生命周期
- `main.ts` -> `libs/mcp-tools/browser.ts`：调用setBrowserToolHost初始化浏览器工具
- `main.ts` -> `libs/mcp-tools/design.ts`：调用setDesignToolHost初始化设计工具
- `main.ts` -> `libs/auto-updater.ts`：启动自动更新服务
- `libs/auto-updater.ts` -> `libs/auto-updater-fallback.ts`：使用fallback逻辑解析GitHub releases
- `ipc-handlers.ts` -> `libs/agent-resolver.ts`：解析Agent运行时上下文用于会话初始化
- `libs/agent-resolver.ts` -> `libs/agent-rule-docs.ts`：获取系统Agent profiles用于规则生成
- `libs/attachment-store.ts` -> `shared/attachments.ts`：使用shared模块的附件类型定义
- `libs/task/providers/lark-provider.ts` -> `libs/task/repository.ts`：将Lark任务映射为ExternalTask后存入repository
